<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\ApiException;
use App\Core\Validator;
use App\Repository\VehicleRepository;

// ===== Veículos e certificados (Miguel) =====
// Estafeta: regista veículos e envia certificados novos (RF-16, RF-35).
// Staff: aprova ou recusa (RF-26, RF-27), tira de serviço um aprovado (RF-38)
// e confirma os certificados novos (RF-37).
// Regra "Check expiry dates": não se aprova com o seguro ou a inspeção expirados.
final class VehicleService
{
    private const STATUSES = ['pending', 'approved', 'disapproved'];

    // Matrículas portuguesas: AA-00-AA, 00-AA-00, 00-00-AA e AA-00-00
    private const PLATE_RE = '/^([A-Z]{2}-\d{2}-[A-Z]{2}|\d{2}-[A-Z]{2}-\d{2}|\d{2}-\d{2}-[A-Z]{2}|[A-Z]{2}-\d{2}-\d{2})$/';

    public function __construct(
        private readonly VehicleRepository $vehicles = new VehicleRepository(),
        private readonly DocumentStorage $storage = new DocumentStorage(),
        private readonly Clock $clock = new Clock()
    ) {
    }

    public function types(): array
    {
        return array_map(fn (array $t): array => [
            'id' => (int) $t['id'],
            'name' => $t['type_name'],
            'max_weight_kg' => (float) $t['max_weight_kg'],
            'max_vol_m3' => (float) $t['max_vol_m3'],
        ], $this->vehicles->types());
    }

    // =========================================================
    // Estafeta
    // =========================================================

    public function listForCourier(int $courierId): array
    {
        return array_map(fn (array $v): array => $this->view($v), $this->vehicles->listByCourier($courierId));
    }

    /** Novo veículo com os dois certificados. Fica 'pending' até o Staff decidir. */
    public function register(int $courierId, array $data, array $files): array
    {
        $data['license_plate'] = self::normalizePlate((string) ($data['license_plate'] ?? ''));

        $v = new Validator($data);
        $v->required('vehicle_type_id', 'Choose a vehicle type.')
          ->rule('vehicle_type_id', $this->vehicles->typeExists((int) $v->value('vehicle_type_id')), 'Choose a vehicle type.')
          ->required('license_plate')
          ->pattern('license_plate', self::PLATE_RE, 'Use the format AA-00-AA, 00-AA-00, 00-00-AA or AA-00-00.')
          ->required('model')
          ->minLength('model', 2, 'Write the model (2 to 60 characters).')
          ->maxLength('model', 60);
        if (!$v->hasError('license_plate') && $this->vehicles->plateExists($data['license_plate'])) {
            $v->rule('license_plate', false, 'This licence plate is already registered.');
        }
        foreach (VehicleRepository::DOC_TYPES as $type) {
            $this->checkExpiryDate($v, $type . '_expiry_date');
            $fileError = $this->storage->validate($files[$type . '_file'] ?? null);
            $v->rule($type . '_file', $fileError === '', $fileError);
        }
        $v->check();   // 422 com os erros de cada campo

        // Primeiro os ficheiros; se a base de dados falhar, apagam-se
        $paths = [];
        foreach (VehicleRepository::DOC_TYPES as $type) {
            $paths[$type] = $this->storage->store($files[$type . '_file']);
        }
        try {
            $id = $this->vehicles->create([
                'courier_id' => $courierId,
                'vehicle_type_id' => (int) $data['vehicle_type_id'],
                'license_plate' => $data['license_plate'],
                'model' => trim((string) $data['model']),
                'insurance_expiry_date' => $data['insurance_expiry_date'],
                'inspection_expiry_date' => $data['inspection_expiry_date'],
                'insurance_expiry_doc' => $paths['insurance'],
                'inspection_expiry_doc' => $paths['inspection'],
                'created_at' => $this->clock->nowString(),
            ]);
        } catch (\Throwable $e) {
            array_map(fn (string $path) => $this->storage->delete($path), $paths);
            if ($e instanceof \PDOException && $e->getCode() === '23000') {   // matrícula registada ao mesmo tempo
                throw ApiException::validation(['license_plate' => 'This licence plate is already registered.']);
            }
            throw $e;
        }
        return $this->view($this->vehicles->find($id));
    }

    /** Certificado novo (seguro ou inspeção) com a nova data de validade (RF-35). */
    public function updateDocument(int $courierId, int $vehicleId, array $data, array $files): array
    {
        $vehicle = $this->ownVehicle($courierId, $vehicleId);

        $v = new Validator($data);
        $v->rule('doc_type', in_array($v->value('doc_type'), VehicleRepository::DOC_TYPES, true), 'Choose insurance or inspection.');
        $this->checkExpiryDate($v, 'expiry_date');
        $fileError = $this->storage->validate($files['file'] ?? null);
        $v->rule('file', $fileError === '', $fileError);
        $v->check();

        $path = $this->storage->store($files['file']);
        try {
            $this->vehicles->updateDocument($vehicleId, $data['doc_type'], $data['expiry_date'], $path, $this->clock->nowString());
        } catch (\Throwable $e) {
            $this->storage->delete($path);
            throw $e;
        }
        $updated = $this->view($this->vehicles->find($vehicleId));
        $updated['resubmitted'] = $vehicle['approval_status'] === 'disapproved';
        return $updated;
    }

    /**
     * Ficheiro de um certificado. Pode ver: o dono do veículo, o Staff e o Admin.
     * @return array{path: string, mime: string, name: string}
     */
    public function documentFile(array $user, int $vehicleId, string $docType): array
    {
        if (!in_array($docType, VehicleRepository::DOC_TYPES, true)) {
            throw ApiException::notFound('Document not found.', 'DOCUMENT_NOT_FOUND');
        }
        $vehicle = $this->vehicles->find($vehicleId);
        $isOwner = $vehicle !== null && $user['role'] === 'courier' && (int) $vehicle['courier_id'] === (int) $user['id'];
        if ($vehicle === null || (!$isOwner && !in_array($user['role'], ['staff', 'admin'], true))) {
            // Veículo de outro estafeta: 404 e não 403, para não confirmar que existe
            throw ApiException::notFound('Vehicle not found.', 'VEHICLE_NOT_FOUND');
        }
        $path = $this->storage->absolutePath($vehicle[$docType . '_expiry_doc']);
        if ($path === null || !is_file($path)) {
            throw ApiException::notFound('The file of this certificate is not on the server.', 'FILE_NOT_FOUND');
        }
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        return [
            'path' => $path,
            'mime' => $this->storage->mimeOf($path),
            'name' => $docType . '_' . $vehicle['license_plate'] . '.' . $extension,
        ];
    }

    // =========================================================
    // Staff
    // =========================================================

    public function listForStaff(string $status): array
    {
        if ($status !== 'all' && !in_array($status, self::STATUSES, true)) {
            throw ApiException::badRequest('Use status=pending, approved, disapproved or all.', 'INVALID_STATUS');
        }
        $rows = $this->vehicles->listByStatus($status === 'all' ? null : $status);
        return array_map(fn (array $v): array => $this->view($v), $rows);
    }

    /** Aprova um veículo pendente, se o seguro e a inspeção não tiverem expirado. */
    public function approve(array $staff, int $vehicleId): array
    {
        $vehicle = $this->findOrFail($vehicleId);
        if ($vehicle['approval_status'] !== 'pending') {
            throw ApiException::conflict('This vehicle was already ' . $vehicle['approval_status'] . '.', 'ALREADY_DECIDED');
        }
        $today = $this->clock->today();
        foreach (VehicleRepository::DOC_TYPES as $type) {
            $date = $vehicle[$type . '_expiry_date'];
            if (ExpiryRules::state($date, $today) === 'expired') {
                throw ApiException::conflict(
                    'The ' . $type . ' expired on ' . ExpiryRules::pretty($date) . '. The courier must upload a valid certificate first.',
                    'DOCUMENT_EXPIRED'
                );
            }
        }
        if (!$this->vehicles->approve($vehicleId, (int) $staff['id'], $this->clock->nowString())) {
            throw ApiException::conflict('This vehicle was already decided by someone else.', 'ALREADY_DECIDED');
        }
        return $this->view($this->vehicles->find($vehicleId));
    }

    /** Recusa um pedido ou tira um veículo aprovado de serviço, sempre com o motivo. */
    public function disapprove(array $staff, int $vehicleId, array $data): array
    {
        $vehicle = $this->findOrFail($vehicleId);

        $v = new Validator($data);
        $v->required('reason', 'Write the reason.')->minLength('reason', 3, 'Write the reason.')->maxLength('reason', 255);
        $v->check();

        if ($vehicle['approval_status'] === 'disapproved'
            || !$this->vehicles->disapprove($vehicleId, trim((string) $data['reason']), (int) $staff['id'], $this->clock->nowString())) {
            throw ApiException::conflict('This vehicle is already disapproved.', 'ALREADY_DECIDED');
        }
        return $this->view($this->vehicles->find($vehicleId));
    }

    /** O Staff viu o certificado novo e está tudo bem (RF-37). */
    public function markChecked(int $vehicleId): array
    {
        $this->findOrFail($vehicleId);
        if (!$this->vehicles->markChecked($vehicleId)) {
            throw ApiException::conflict('There is no new certificate to check on this vehicle.', 'NOTHING_TO_CHECK');
        }
        return $this->view($this->vehicles->find($vehicleId));
    }

    // =========================================================
    // JSON de um veículo (igual para o estafeta e para o Staff)
    // =========================================================

    public function view(array $v): array
    {
        $today = $this->clock->today();
        $documents = [];
        $docsValid = true;
        foreach (VehicleRepository::DOC_TYPES as $type) {
            $date = $v[$type . '_expiry_date'];
            $state = ExpiryRules::state($date, $today);
            $docsValid = $docsValid && $state !== 'expired';
            $documents[$type] = [
                'expiry_date' => $date,
                'state' => $state,
                'days_left' => ExpiryRules::daysLeft($date, $today),
                'has_file' => $v[$type . '_expiry_doc'] !== null,
                'file_url' => '/vehicles/' . (int) $v['id'] . '/documents/' . $type,
            ];
        }

        return [
            'id' => (int) $v['id'],
            'courier' => ['id' => (int) $v['courier_id'], 'name' => $v['courier_name'], 'employee_number' => $v['employee_number']],
            'vehicle_type' => [
                'id' => (int) $v['vehicle_type_id'],
                'name' => $v['type_name'],
                'max_weight_kg' => (float) $v['max_weight_kg'],
                'max_vol_m3' => (float) $v['max_vol_m3'],
            ],
            'license_plate' => $v['license_plate'],
            'model' => $v['model'],
            'approval_status' => $v['approval_status'],
            'disapproval_reason' => $v['disapproval_reason'],
            'reviewed_at' => $v['reviewed_at'],
            'created_at' => $v['created_at'],
            'documents' => $documents,
            'doc_updated_at' => $v['doc_updated_at'],
            'doc_checked' => (bool) $v['doc_checked'],
            // Só um veículo aprovado e com os dois certificados em dia pode fazer entregas
            'usable' => $v['approval_status'] === 'approved' && $docsValid,
        ];
    }

    // =========================================================
    // Ajudas
    // =========================================================

    /** "12ab34" ou "12 AB 34" -> "12-AB-34" */
    public static function normalizePlate(string $plate): string
    {
        $clean = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $plate));
        return strlen($clean) === 6 ? implode('-', str_split($clean, 2)) : strtoupper(trim($plate));
    }

    private function checkExpiryDate(Validator $v, string $field): void
    {
        $value = $v->value($field);
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $v->required($field, 'Choose the expiry date.')
          ->rule($field, $value === '' || ($date !== false && $date->format('Y-m-d') === $value), 'Use a valid date.')
          ->rule($field, $value === '' || $value > $this->clock->today(), 'The expiry date must be in the future.');
    }

    private function findOrFail(int $vehicleId): array
    {
        return $this->vehicles->find($vehicleId) ?? throw ApiException::notFound('Vehicle not found.', 'VEHICLE_NOT_FOUND');
    }

    private function ownVehicle(int $courierId, int $vehicleId): array
    {
        $vehicle = $this->vehicles->find($vehicleId);
        if ($vehicle === null || (int) $vehicle['courier_id'] !== $courierId) {
            throw ApiException::notFound('Vehicle not found.', 'VEHICLE_NOT_FOUND');
        }
        return $vehicle;
    }
}
