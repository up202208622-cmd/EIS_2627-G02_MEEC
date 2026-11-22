<?php
declare(strict_types=1);

namespace App\Repository;

use App\Core\ApiException;
use PDOException;

// ===== Acesso à tabela users =====
// Só SQL, sem regras de negócio: quem decide o papel, o estado ou se a
// password está certa é o AuthService.
final class UserRepository extends Repository
{
    // Colunas que podem ir para fora (nunca o password_hash).
    private const PUBLIC_COLUMNS = 'id, name, username, email, phone, nif, role, status, employee_number, created_at';

    public function findById(int $id): ?array
    {
        return $this->fetchOne('SELECT ' . self::PUBLIC_COLUMNS . ' FROM users WHERE id = :id', ['id' => $id]);
    }

    // Inclui o password_hash: só o AuthService usa isto, para o login.
    public function findByEmailWithPassword(string $email): ?array
    {
        return $this->fetchOne(
            'SELECT ' . self::PUBLIC_COLUMNS . ', password_hash FROM users WHERE email = :email',
            ['email' => $email]
        );
    }

    public function findPasswordHash(int $id): ?string
    {
        $hash = $this->fetchValue('SELECT password_hash FROM users WHERE id = :id', ['id' => $id]);
        return $hash === null ? null : (string) $hash;
    }

    // Que campos únicos já estão ocupados por OUTRA conta? Devolve ex.: ['email', 'username'].
    // $exceptId serve para o perfil: o meu próprio email não conta como "ocupado".
    // O nome da coluna vem de uma lista fixa (nunca do utilizador), por isso pode ir no SQL.
    public function takenFields(array $values, int $exceptId = 0): array
    {
        $taken = [];
        foreach (['email', 'username', 'nif', 'employee_number'] as $column) {
            if (!isset($values[$column])) {
                continue;
            }
            $exists = $this->fetchValue(
                "SELECT 1 FROM users WHERE {$column} = :value AND id <> :except",
                ['value' => $values[$column], 'except' => $exceptId]
            );
            if ($exists !== null) {
                $taken[] = $column;
            }
        }
        return $taken;
    }

    public function create(array $user): int
    {
        try {
            return $this->insert(
                'INSERT INTO users (name, username, email, phone, nif, password_hash, role, status, employee_number)
                 VALUES (:name, :username, :email, :phone, :nif, :password_hash, :role, :status, :employee_number)',
                [
                    'name'            => $user['name'],
                    'username'        => $user['username'],
                    'email'           => $user['email'],
                    'phone'           => $user['phone'],
                    'nif'             => $user['nif'],
                    'password_hash'   => $user['password_hash'],
                    'role'            => $user['role'],
                    'status'          => $user['status'],
                    'employee_number' => $user['employee_number'],
                ]
            );
        } catch (PDOException $e) {
            // Dois registos iguais no mesmo instante: o takenFields() não apanha,
            // mas a chave UNIQUE da tabela apanha.
            if (self::isDuplicateKey($e)) {
                throw ApiException::conflict('There is already an account with these details.', 'ACCOUNT_EXISTS');
            }
            throw $e;
        }
    }

    public function updateProfile(int $id, array $profile): void
    {
        try {
            $this->execute(
                'UPDATE users SET name = :name, username = :username, email = :email, phone = :phone, nif = :nif
                  WHERE id = :id',
                [
                    'name'     => $profile['name'],
                    'username' => $profile['username'],
                    'email'    => $profile['email'],
                    'phone'    => $profile['phone'],
                    'nif'      => $profile['nif'],
                    'id'       => $id,
                ]
            );
        } catch (PDOException $e) {
            if (self::isDuplicateKey($e)) {
                throw ApiException::conflict('These details are already used by another account.', 'ACCOUNT_EXISTS');
            }
            throw $e;
        }
    }

    public function updatePasswordHash(int $id, string $hash): void
    {
        $this->execute('UPDATE users SET password_hash = :hash WHERE id = :id', ['hash' => $hash, 'id' => $id]);
    }
}
