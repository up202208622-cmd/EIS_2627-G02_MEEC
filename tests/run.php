<?php
declare(strict_types=1);

/**
 * Testes automáticos do módulo do Miguel (veículos, certificados, alertas, contas, WP3).
 * Usam o núcleo do Gonçalo e o schema.sql do Rafael (com os dados de teste), convertidos
 * para SQLite: não precisam do XAMPP nem do MySQL ligado.
 *
 *   php tests/run.php        (na raiz do repositório)
 */

use App\Core\ApiException;
use App\Core\Config;
use App\Core\Database;
use App\Repository\AccountApprovalRepository;
use App\Repository\DeliveryCodeRepository;
use App\Repository\DispatchRepository;
use App\Repository\VehicleRepository;
use App\Service\AccountApprovalService;
use App\Service\Clock;
use App\Service\DeliveryCodeService;
use App\Service\DispatchService;
use App\Service\DocumentStorage;
use App\Service\Geo;
use App\Service\VehicleAlertService;
use App\Service\VehicleService;

$root = dirname(__DIR__);
require __DIR__ . '/sqlite_schema.php';

// Autoload igual ao do src/bootstrap.php (sem o config.php nem o handler de erros HTTP)
spl_autoload_register(function (string $class) use ($root): void {
    if (str_starts_with($class, 'App\\')) {
        $file = $root . '/src/' . str_replace('\\', '/', substr($class, 4)) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});

// ---------- Mini framework de testes ----------
$passed = 0;
$failed = 0;
function check(bool $ok, string $label): void
{
    global $passed, $failed;
    $ok ? $passed++ : $failed++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $label . "\n";
}
function expectError(int $status, callable $fn, string $label, ?string $code = null): ?ApiException
{
    try {
        $fn();
    } catch (ApiException $e) {
        check($e->status === $status && ($code === null || $e->errorCode === $code),
            "$label -> $status {$e->errorCode} ({$e->getMessage()})");
        return $e;
    }
    check(false, "$label -> esperava erro $status");
    return null;
}
function section(string $title): void
{
    echo "\n== $title ==\n";
}
function upload(string $path, string $name): array
{
    return ['name' => $name, 'tmp_name' => $path, 'error' => UPLOAD_ERR_OK, 'size' => filesize($path)];
}

// ---------- Base de dados de teste: schema.sql do Rafael em SQLite ----------
$schema = $root . '/sql/schema.sql';
$dbFile = sys_get_temp_dir() . '/couriercms_test_' . getmypid() . '.sqlite';
createSqliteDatabase($dbFile, $schema);
Config::load(['db' => ['dsn' => 'sqlite:' . $dbFile]]);
$db = Database::connection();

$clock = new Clock('2026-11-24 10:00:00');
$filesRoot = sys_get_temp_dir() . '/couriercms_files_' . getmypid();
$storage = new DocumentStorage($filesRoot, true);
$vehicles = new VehicleService(new VehicleRepository(), $storage, $clock);
$alerts = new VehicleAlertService(new VehicleRepository(), new AccountApprovalRepository(), $clock);
$approvals = new AccountApprovalService();

// Utilizadores do schema.sql
$rui = ['id' => 2, 'role' => 'courier'];
$sofia = ['id' => 5, 'role' => 'courier'];
$staff = ['id' => 3, 'role' => 'staff'];
$admin = ['id' => 4, 'role' => 'admin'];

// Ficheiros de exemplo (PDF e PNG verdadeiros, para o finfo os reconhecer)
$pdf = tempnam(sys_get_temp_dir(), 'pdf');
file_put_contents($pdf, "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
$png = tempnam(sys_get_temp_dir(), 'png');
file_put_contents($png, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
$txt = tempnam(sys_get_temp_dir(), 'txt');
file_put_contents($txt, 'not a certificate');
$files = ['insurance_file' => upload($pdf, 'insurance.pdf'), 'inspection_file' => upload($png, 'inspection.png')];

// =====================================================================
section('Tipos e listas');
// =====================================================================
$types = $vehicles->types();
check(count($types) === 4 && $types[0]['name'] === 'Bike' && $types[2]['max_weight_kg'] === 1000.0, 'tipos com a capacidade do schema (Bike ... Truck)');
$pending = $vehicles->listForStaff('pending');
check(array_column($pending, 'license_plate') == ['90-QR-33', '56-MN-12', '31-KL-08', '78-EF-90'] || count($pending) === 4,
    'Staff vê os 4 veículos pendentes do schema.sql');
check(count($vehicles->listForStaff('all')) === 9, 'lista "all" tem os 9 veículos');
expectError(400, fn () => $vehicles->listForStaff('xpto'), 'filtro inválido', 'INVALID_STATUS');
$v1 = $vehicles->listForCourier(2);
check(count($v1) === 4 && $v1[0]['courier']['name'] === 'Rui Martins', 'o Rui vê só os seus 4 veículos');

// =====================================================================
section('Aprovar e recusar (RF-26, RF-27, RF-38)');
// =====================================================================
$v = $vehicles->approve($staff, 3);
check($v['approval_status'] === 'approved' && $v['usable'] && $v['doc_checked'], 'Staff aprova o Sprinter (78-EF-90)');
expectError(409, fn () => $vehicles->approve($staff, 3), 'aprovar duas vezes', 'ALREADY_DECIDED');

$db->exec("UPDATE vehicles SET insurance_expiry_date = '2026-11-20' WHERE id = 7");
expectError(409, fn () => $vehicles->approve($staff, 7), 'não aprova com seguro expirado (Check expiry dates)', 'DOCUMENT_EXPIRED');
$e = expectError(422, fn () => $vehicles->disapprove($staff, 7, ['reason' => '']), 'recusar sem motivo', 'VALIDATION_ERROR');
check(isset($e->fields['reason']), 'o erro aparece no campo reason');
$v = $vehicles->disapprove($staff, 7, ['reason' => 'Expired insurance or inspection']);
check($v['approval_status'] === 'disapproved' && $v['disapproval_reason'] === 'Expired insurance or inspection', 'Staff recusa com motivo');
$v = $vehicles->disapprove($staff, 2, ['reason' => 'Documents not renewed in time']);
check($v['approval_status'] === 'disapproved' && !$v['usable'], 'RF-38: veículo aprovado tirado de serviço');
expectError(409, fn () => $vehicles->disapprove($staff, 2, ['reason' => 'again']), 'recusar duas vezes', 'ALREADY_DECIDED');
expectError(404, fn () => $vehicles->approve($staff, 999), 'veículo que não existe', 'VEHICLE_NOT_FOUND');

// =====================================================================
section('Registo de veículo pelo estafeta');
// =====================================================================
$new = $vehicles->register(2, ['vehicle_type_id' => '3', 'license_plate' => '99 zz 11', 'model' => 'Ford Transit',
    'insurance_expiry_date' => '2027-05-01', 'inspection_expiry_date' => '2027-04-01'], $files);
check($new['license_plate'] === '99-ZZ-11' && $new['approval_status'] === 'pending', 'registo fica pendente, matrícula normalizada');
check($new['vehicle_type']['max_weight_kg'] === 1000.0, 'capacidade vem do tipo (Van: 1000 kg)');
check(count(glob($filesRoot . '/uploads/docs/*')) === 2, 'os dois ficheiros foram guardados em uploads/docs');

$e = expectError(422, fn () => $vehicles->register(2, ['vehicle_type_id' => '9', 'license_plate' => '12-AB-34', 'model' => 'X',
    'insurance_expiry_date' => '2026-11-01', 'inspection_expiry_date' => 'abc'],
    ['insurance_file' => upload($txt, 'a.txt')]), 'vários campos errados', 'VALIDATION_ERROR');
check(array_keys($e->fields) == ['vehicle_type_id', 'model', 'license_plate', 'insurance_expiry_date', 'insurance_file',
    'inspection_expiry_date', 'inspection_file'] || count($e->fields) === 7, 'um erro por campo: ' . implode(', ', array_keys($e->fields)));
check($e->fields['license_plate'] === 'This licence plate is already registered.', 'matrícula repetida');
check($e->fields['insurance_file'] === 'Use a PDF, JPG or PNG file.', 'ficheiro .txt recusado');

// =====================================================================
section('Certificado novo (RF-35) e verificação pelo Staff (RF-37)');
// =====================================================================
$up = $vehicles->updateDocument(2, 1, ['doc_type' => 'insurance', 'expiry_date' => '2027-11-30'], ['file' => upload($pdf, 'new.pdf')]);
check($up['documents']['insurance']['expiry_date'] === '2027-11-30' && !$up['doc_checked'], 'nova data em vigor; fica por verificar');
check($up['approval_status'] === 'approved' && $up['usable'], 'o veículo continua aprovado e utilizável');
$updated = array_values(array_filter($alerts->forStaff()['alerts'], fn ($a) => $a['kind'] === 'updated'));
check(count($updated) === 1 && $updated[0]['vehicle']['license_plate'] === '12-AB-34', 'Staff recebe alerta "certificado novo"');
check($alerts->forStaff()['summary']['unchecked_documents'] === 1, 'resumo conta 1 certificado por verificar');
check($vehicles->markChecked(1)['doc_checked'] === true, 'Staff marca como verificado');
expectError(409, fn () => $vehicles->markChecked(1), 'verificar duas vezes', 'NOTHING_TO_CHECK');

$re = $vehicles->updateDocument(2, 4, ['doc_type' => 'insurance', 'expiry_date' => '2027-10-01'], ['file' => upload($pdf, 'doblo.pdf')]);
check($re['approval_status'] === 'pending' && $re['resubmitted'] && $re['disapproval_reason'] === null,
    'veículo recusado volta a pendente com o certificado novo');
expectError(404, fn () => $vehicles->updateDocument(5, 1, [], []), 'estafeta não mexe no veículo de outro', 'VEHICLE_NOT_FOUND');
$e = expectError(422, fn () => $vehicles->updateDocument(2, 1, ['doc_type' => 'x', 'expiry_date' => '2020-01-01'], []), 'certificado inválido');
check(count($e->fields) === 3, 'erros em doc_type, expiry_date e file');

$file = $vehicles->documentFile($rui, 1, 'insurance');
check(is_file($file['path']) && $file['mime'] === 'application/pdf' && $file['name'] === 'insurance_12-AB-34.pdf', 'o dono descarrega o certificado');
check($vehicles->documentFile($staff, 1, 'insurance')['path'] === $file['path'], 'o Staff também');
expectError(404, fn () => $vehicles->documentFile($sofia, 1, 'insurance'), 'outro estafeta não', 'VEHICLE_NOT_FOUND');
expectError(404, fn () => $vehicles->documentFile($staff, 5, 'inspection'), 'ficheiro do schema.sql não existe no disco', 'FILE_NOT_FOUND');
expectError(404, fn () => $vehicles->documentFile($staff, 1, '../config'), 'tipo de documento inválido', 'DOCUMENT_NOT_FOUND');

// =====================================================================
section('Alertas de validade (RF-36, RF-37)');
// =====================================================================
$db->exec("UPDATE vehicles SET insurance_expiry_date = '2026-11-26' WHERE id = 5");   // Sofia: expira em 2 dias
$db->exec("UPDATE vehicles SET inspection_expiry_date = '2026-11-23' WHERE id = 8");  // Carlos: expirou ontem
$s = $alerts->forStaff();
check($s['summary']['expired'] === 1 && $s['summary']['expiring'] === 1, 'resumo: 1 expirado, 1 a expirar');
check($s['alerts'][0]['kind'] === 'expired' && $s['alerts'][0]['vehicle']['license_plate'] === '09-UV-54', 'expirados primeiro');
check($s['alerts'][1]['kind'] === 'expiring' && $s['alerts'][1]['days_left'] === 2, 'faltam 2 dias para o seguro da Sofia');
check($s['summary']['pending_couriers'] === 3, 'resumo conta os 3 estafetas pendentes');
$mine = $alerts->forCourier(5);
check(count($mine) === 1 && $mine[0]['courier']['name'] === 'Sofia Ribeiro', 'a Sofia só vê o seu alerta');
check(count($alerts->forCourier(6)) === 2, 'o Carlos vê os seus (Forza expirada + Partner recusado)');

// =====================================================================
section('Contas de estafeta (RF-39)');
// =====================================================================
$list = $approvals->list($staff, 'courier', 'pending');
check(count($list) === 3 && !isset($list[0]['password_hash']), 'Staff vê os 3 pedidos, sem a password');
check($list[0]['employee_number'] === 'CRR-2041', 'mostra o número de colaborador');
expectError(403, fn () => $approvals->list($staff, 'staff', 'pending'), 'Staff não vê pedidos de staff');
check($approvals->approve($staff, 9)['status'] === 'active', 'Staff aprova o Hugo');
expectError(409, fn () => $approvals->approve($staff, 9), 'aprovar duas vezes', 'ALREADY_DECIDED');
check($approvals->reject($staff, 10)['status'] === 'rejected', 'Staff recusa a Leonor');
$db->exec("INSERT INTO users (id, username, password_hash, email, name, employee_number, role, status)
           VALUES (20, 'tmoreira', 'x', 'tiago@couriercms.com', 'Tiago Moreira', 'STF-3001', 'staff', 'pending')");
expectError(403, fn () => $approvals->approve($staff, 20), 'Staff não aprova staff');
check($approvals->approve($admin, 20)['status'] === 'active', 'Admin aprova staff');
expectError(403, fn () => $approvals->approve($admin, 1), 'clientes não passam por aprovação');

// =====================================================================
section('WP3 – despacho com os dados do schema.sql');
// =====================================================================
// Base de dados nova (os testes de cima mudaram veículos e contas)
$dispatchDb = sys_get_temp_dir() . '/couriercms_dispatch_' . getmypid() . '.sqlite';
$pdo2 = createSqliteDatabase($dispatchDb, $schema);
$pdo2->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$repo = new DispatchRepository($pdo2);
$realCodes = new DeliveryCodeService(new DeliveryCodeRepository($pdo2));
$dispatch = new DispatchService($repo, $clock, $realCodes);

// Encomenda 6: paga, Pending, recolha em (41.158, -8.629), 12.5 kg. A encomenda 7 ainda não está paga.
// Sofia está a ~2.0 km (última entrega: encomenda 2), Rui a ~3.4 km (encomenda 1), Carlos a ~4.0 km (users.last_lat).
$o = $dispatch->currentOffer(5)['offer'];
check($o !== null && $o['order_id'] === 6, 'encomenda 6 proposta à Sofia (a mais perto)');
check($o['seconds_left'] === 60 && $o['weight_kg'] === 12.5 && $o['trip_km'] === 7.3, '60 s, 12.5 kg, viagem de 7.3 km');
check(abs($o['distance_km'] - round(Geo::distanceKm(41.1467, -8.611, 41.158, -8.629), 2)) < 0.001,
    sprintf('distância desde a última entrega: %.2f km', $o['distance_km']));
check($dispatch->currentOffer(2)['offer'] === null, 'o Rui não recebe a mesma encomenda ao mesmo tempo');
check($pdo2->query("SELECT status FROM dispatch_offers WHERE id = 8")->fetchColumn() === 'expired',
    'a proposta antiga do schema.sql (17/11) foi fechada como expirada');
check(array_column($dispatch->overview()['queue'], 'order_id') === [6], 'a encomenda 7 (pagamento pendente) não entra na fila');

$dispatch->decline(5, $o['id']);
$oRui = $dispatch->currentOffer(2)['offer'];
check($oRui !== null && $oRui['order_id'] === 6, 'Sofia recusa: passa logo ao Rui');
check($dispatch->currentOffer(5)['offer'] === null, 'a Sofia não volta a receber logo a seguir');

$clock->advance('+30 seconds');
check($dispatch->currentOffer(2)['offer']['seconds_left'] === 30, 'contador a 30 s');
$clock->advance('+31 seconds');
check($dispatch->currentOffer(2)['offer'] === null, 'passados 60 s a proposta do Rui expirou');
expectError(409, fn () => $dispatch->accept(2, $oRui['id']), 'aceitar depois de expirar', 'OFFER_CLOSED');
$oCarlos = $dispatch->currentOffer(6)['offer'];
check($oCarlos !== null && $oCarlos['order_id'] === 6, 'passa ao Carlos');
expectError(404, fn () => $dispatch->accept(2, $oCarlos['id']), 'o Rui não aceita a proposta do Carlos', 'OFFER_NOT_FOUND');

// O gerador de códigos falha -> nada muda (transação)
$failing = new class {
    public function generate(int $orderId): string
    {
        throw new RuntimeException('code generator down');
    }
};
try {
    (new DispatchService($repo, $clock, $failing))->accept(6, $oCarlos['id']);
    check(false, 'esperava erro do gerador');
} catch (RuntimeException $e) {
    check(!($e instanceof ApiException), 'erro do gerador de códigos chega ao handler (500)');
}
$order = $pdo2->query('SELECT status, courier_id FROM orders WHERE id = 6')->fetch();
check($order['status'] === 'Pending' && $order['courier_id'] === null, 'rollback: a encomenda continua à espera');
check($dispatch->currentOffer(6)['offer']['id'] === $oCarlos['id'], 'rollback: a proposta continua aberta');

$res = $dispatch->accept(6, $oCarlos['id']);
check($res === ['order_id' => 6, 'status' => 'Initiated'], 'Carlos aceita: Initiated (o código não vai para o estafeta)');
$code = $pdo2->query("SELECT code FROM delivery_codes WHERE order_id = 6")->fetchColumn();
check(preg_match('/^\d{6}$/', (string) $code) === 1, "código de 6 dígitos criado pelo DeliveryCodeService do Gonçalo ($code)");
$order = $pdo2->query('SELECT status, courier_id FROM orders WHERE id = 6')->fetch();
check($order['status'] === 'Initiated' && (int) $order['courier_id'] === 6, 'encomenda atribuída ao Carlos');
expectError(409, fn () => $dispatch->accept(6, $oCarlos['id']), 'aceitar duas vezes', 'OFFER_CLOSED');
$ov = $dispatch->overview();
check($ov['queue'] === [], 'fila vazia');
check(array_column(array_slice($ov['recent'], 0, 3), 'status') === ['accepted', 'expired', 'declined'], 'últimas respostas: aceite, expirada, recusada');

// =====================================================================
section('WP3 – capacidade, várias encomendas, nova tentativa passados 10 min');
// =====================================================================
// Paga a encomenda 7 (2.2 kg) e cria a 12 (500 kg: só as vans do Rui e da Sofia aguentam)
$pdo2->exec("UPDATE payments SET status = 'paid', paid_at = '2026-11-24 10:02:00' WHERE order_id = 7");
$pdo2->exec("INSERT INTO orders (id, client_id, origin_lat, origin_long, dest_lat, dest_long, distance_km, declared_weight_kg,
                                 declared_vol_m3, price_total, status, created_at)
             VALUES (12, 1, 41.178, -8.596, 41.15, -8.61, 4.0, 500, 2, 160, 'Pending', '2026-11-24 10:03:00')");
$pdo2->exec("INSERT INTO payments (order_id, kind, amount, status, paid_at) VALUES (12, 'order', 160, 'paid', '2026-11-24 10:03:00')");

$queue = array_column($dispatch->overview()['queue'], null, 'order_id');
$who7 = $queue[7]['offer']['courier']['name'] ?? null;
$who12 = $queue[12]['offer']['courier']['name'] ?? null;
check($who7 !== null && $who12 !== null && $who7 !== $who12, "duas encomendas, dois estafetas diferentes ($who7 / $who12)");
check(in_array($who12, ['Rui Martins', 'Sofia Ribeiro'], true), '500 kg só vai para quem tem van');
check($queue[12]['offer']['seconds_left'] === 60, 'vista do Staff mostra o contador');

// Quem tem a de 500 kg recusa; o outro com van está ocupado com a proposta da encomenda 7
$id12 = $queue[12]['offer']['courier']['id'];
$id7 = $queue[7]['offer']['courier']['id'];
$dispatch->decline($id12, $queue[12]['offer']['id']);
$queue = array_column($dispatch->overview()['queue'], null, 'order_id');
check($queue[12]['status'] === 'no_courier', 'recusada e o outro estafeta com van está ocupado: "no courier available"');

// O outro aceita a encomenda 7, fica livre e recebe a de 500 kg; também recusa
$dispatch->accept($id7, $queue[7]['offer']['id']);
$offer = $dispatch->currentOffer($id7)['offer'];
check($offer !== null && $offer['order_id'] === 12, 'depois de aceitar a 7, recebe a de 500 kg');
$dispatch->decline($id7, $offer['id']);
$queue = array_column($dispatch->overview()['queue'], null, 'order_id');
check($queue[12]['status'] === 'no_courier' && $queue[12]['refusals'] === 2, 'as duas vans recusaram: 2 recusas');
$clock->advance('+11 minutes');
$queue = array_column($dispatch->overview()['queue'], null, 'order_id');
check($queue[12]['status'] === 'offered', 'passados 10 minutos volta a ser proposta');

// Cancelada enquanto espera: sai da fila
$pdo2->exec("UPDATE orders SET status = 'Cancelled' WHERE id = 12");
check(!isset(array_column($dispatch->overview()['queue'], null, 'order_id')[12]), 'encomenda cancelada sai da fila');

// =====================================================================
@unlink($dbFile);
@unlink($dispatchDb);
exec('rm -rf ' . escapeshellarg($filesRoot));
echo "\n$passed passed, $failed failed\n";
exit($failed === 0 ? 0 : 1);
