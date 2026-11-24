<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\ApiException;
use App\Repository\AccountApprovalRepository;

// ===== Aprovação das contas criadas no registo (RF-39) =====
//   Staff -> aprova ou recusa estafetas (CRR-xxxx)
//   Admin -> aprova ou recusa estafetas e staff (STF-xxxx); a Admin page pode usar estes mesmos endpoints
// Os clientes ficam ativos logo no registo, por isso não passam por aqui.
final class AccountApprovalService
{
    private const CAN_APPROVE = [
        'staff' => ['courier'],
        'admin' => ['courier', 'staff'],
    ];
    private const STATUSES = ['pending', 'active', 'rejected'];

    public function __construct(private readonly AccountApprovalRepository $accounts = new AccountApprovalRepository())
    {
    }

    public function list(array $user, string $role, string $status): array
    {
        $this->checkCanManage($user, $role);
        if ($status !== 'all' && !in_array($status, self::STATUSES, true)) {
            throw ApiException::badRequest('Use status=pending, active, rejected or all.', 'INVALID_STATUS');
        }
        return $this->accounts->list($role, $status === 'all' ? null : $status);
    }

    public function approve(array $user, int $accountId): array
    {
        return $this->decide($user, $accountId, 'active');
    }

    public function reject(array $user, int $accountId): array
    {
        return $this->decide($user, $accountId, 'rejected');
    }

    private function decide(array $user, int $accountId, string $status): array
    {
        $account = $this->accounts->find($accountId) ?? throw ApiException::notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
        $this->checkCanManage($user, $account['role']);
        if ($account['status'] !== 'pending' || !$this->accounts->decide($accountId, $status)) {
            throw ApiException::conflict('This account was already ' . $account['status'] . '.', 'ALREADY_DECIDED');
        }
        return $this->accounts->find($accountId);
    }

    private function checkCanManage(array $user, string $role): void
    {
        if (!in_array($role, self::CAN_APPROVE[$user['role']] ?? [], true)) {
            throw ApiException::forbidden($role === 'staff'
                ? 'Only an administrator can approve staff accounts.'
                : 'You cannot manage ' . $role . ' accounts.');
        }
    }
}
