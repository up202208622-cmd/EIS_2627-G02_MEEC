<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Service\AccountApprovalService;

// ===== Aprovação de contas (Miguel, RF-39) =====
// Staff: estafetas. Admin: estafetas e staff (?role=staff).
final class AccountApprovalController
{
    public function __construct(private readonly AccountApprovalService $service = new AccountApprovalService())
    {
    }

    // GET /api/staff/accounts?role=courier&status=pending|active|rejected|all
    public function list(Request $request): void
    {
        $accounts = $this->service->list(
            $request->user,
            (string) $request->query('role', 'courier'),
            (string) $request->query('status', 'pending')
        );
        Response::json(['accounts' => $accounts]);
    }

    // POST /api/staff/accounts/{id}/approve
    public function approve(Request $request): void
    {
        Response::json(['account' => $this->service->approve($request->user, $request->intParam('id'))]);
    }

    // POST /api/staff/accounts/{id}/reject
    public function reject(Request $request): void
    {
        Response::json(['account' => $this->service->reject($request->user, $request->intParam('id'))]);
    }
}
