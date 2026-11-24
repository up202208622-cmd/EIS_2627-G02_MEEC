<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Service\VehicleAlertService;
use App\Service\VehicleService;

// ===== Veículos e certificados (Miguel) =====
// Camada de apresentação: lê o pedido, chama o Service e devolve JSON.
// As regras estão no VehicleService e no VehicleAlertService.
final class VehicleController
{
    public function __construct(
        private readonly VehicleService $vehicles = new VehicleService(),
        private readonly VehicleAlertService $alerts = new VehicleAlertService()
    ) {
    }

    // GET /api/vehicle-types
    public function types(Request $request): void
    {
        Response::json(['vehicle_types' => $this->vehicles->types()]);
    }

    // ---------- Estafeta ----------

    // GET /api/courier/vehicles
    public function mine(Request $request): void
    {
        Response::json(['vehicles' => $this->vehicles->listForCourier((int) $request->user['id'])]);
    }

    // POST /api/courier/vehicles  (multipart/form-data: campos + insurance_file + inspection_file)
    public function register(Request $request): void
    {
        $vehicle = $this->vehicles->register((int) $request->user['id'], $request->all(), self::uploadedFiles());
        Response::json(['vehicle' => $vehicle], 201);
    }

    // POST /api/courier/vehicles/{id}/documents  (multipart: doc_type, expiry_date, file)
    public function updateDocument(Request $request): void
    {
        $vehicle = $this->vehicles->updateDocument(
            (int) $request->user['id'], $request->intParam('id'), $request->all(), self::uploadedFiles());
        Response::json(['vehicle' => $vehicle]);
    }

    // GET /api/courier/alerts
    public function courierAlerts(Request $request): void
    {
        Response::json(['alerts' => $this->alerts->forCourier((int) $request->user['id'])]);
    }

    // GET /api/vehicles/{id}/documents/{type}  ->  o próprio ficheiro (PDF/JPG/PNG), não JSON
    public function documentFile(Request $request): void
    {
        $file = $this->vehicles->documentFile($request->user, $request->intParam('id'), (string) ($request->params['type'] ?? ''));

        http_response_code(200);
        header('Content-Type: ' . $file['mime']);
        header('Content-Length: ' . filesize($file['path']));
        header('Content-Disposition: inline; filename="' . $file['name'] . '"');   // abre no browser
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, no-store');
        readfile($file['path']);
        exit;
    }

    // ---------- Staff ----------

    // GET /api/staff/vehicles?status=pending|approved|disapproved|all
    public function list(Request $request): void
    {
        Response::json(['vehicles' => $this->vehicles->listForStaff((string) $request->query('status', 'pending'))]);
    }

    // POST /api/staff/vehicles/{id}/approve
    public function approve(Request $request): void
    {
        Response::json(['vehicle' => $this->vehicles->approve($request->user, $request->intParam('id'))]);
    }

    // POST /api/staff/vehicles/{id}/disapprove   { "reason": "..." }
    public function disapprove(Request $request): void
    {
        Response::json(['vehicle' => $this->vehicles->disapprove($request->user, $request->intParam('id'), $request->all())]);
    }

    // POST /api/staff/vehicles/{id}/documents-checked
    public function markChecked(Request $request): void
    {
        Response::json(['vehicle' => $this->vehicles->markChecked($request->intParam('id'))]);
    }

    // GET /api/staff/alerts
    public function staffAlerts(Request $request): void
    {
        Response::json($this->alerts->forStaff());
    }

    // O Request do núcleo só traz o corpo (JSON ou $_POST); os ficheiros enviados vêm de $_FILES.
    private static function uploadedFiles(): array
    {
        return $_FILES;
    }
}
