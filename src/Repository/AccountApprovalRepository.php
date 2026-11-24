<?php
declare(strict_types=1);

namespace App\Repository;

// ===== Aprovação de contas (tabela users, do Gonçalo) =====
// O registo cria estafetas (CRR-) e staff (STF-) com status 'pending'.
// Aqui só se lê a lista e se muda o status. A password nunca é lida.
final class AccountApprovalRepository extends Repository
{
    private const COLUMNS = 'id, name, username, email, phone, nif, employee_number, role, status, created_at';

    public function find(int $id): ?array
    {
        return $this->fetchOne('SELECT ' . self::COLUMNS . ' FROM users WHERE id = :id', ['id' => $id]);
    }

    /** @param string|null $status null = todos os estados */
    public function list(string $role, ?string $status): array
    {
        if ($status === null) {
            return $this->fetchAll('SELECT ' . self::COLUMNS . ' FROM users WHERE role = :role ORDER BY created_at DESC, id DESC',
                ['role' => $role]);
        }
        return $this->fetchAll(
            'SELECT ' . self::COLUMNS . ' FROM users WHERE role = :role AND status = :status ORDER BY created_at DESC, id DESC',
            ['role' => $role, 'status' => $status]
        );
    }

    public function countPending(string $role): int
    {
        return (int) $this->fetchValue("SELECT COUNT(*) FROM users WHERE role = :role AND status = 'pending'", ['role' => $role]);
    }

    /** Muda o estado só se a conta ainda estiver 'pending'. */
    public function decide(int $id, string $status): bool
    {
        return $this->execute(
            "UPDATE users SET status = :status WHERE id = :id AND status = 'pending'",
            ['status' => $status, 'id' => $id]
        ) === 1;
    }
}
