<?php
declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;
use PDO;

// ===== Base de todos os Repositories (DAL) =====
// O Repository é a única camada que escreve SQL. Os métodos daqui garantem que
// TODAS as queries usam prepared statements: o SQL vai com marcadores (:email)
// e os valores vão à parte. O MySQL nunca mistura dados com código SQL,
// por isso não há SQL injection.
//
// Cada membro cria o seu Repository a estender este:
//   final class VehicleRepository extends Repository { ... $this->fetchAll('SELECT ...', [...]) }
abstract class Repository
{
    protected PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? Database::connection();
    }

    // Uma linha (ou null se não houver).
    protected function fetchOne(string $sql, array $params = []): ?array
    {
        $statement = $this->db->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    // Todas as linhas.
    protected function fetchAll(string $sql, array $params = []): array
    {
        $statement = $this->db->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    // Um único valor (ex.: COUNT(*)).
    protected function fetchValue(string $sql, array $params = []): mixed
    {
        $statement = $this->db->prepare($sql);
        $statement->execute($params);
        $value = $statement->fetchColumn();
        return $value === false ? null : $value;
    }

    // UPDATE / DELETE: devolve quantas linhas mudaram.
    protected function execute(string $sql, array $params = []): int
    {
        $statement = $this->db->prepare($sql);
        $statement->execute($params);
        return $statement->rowCount();
    }

    // INSERT: devolve o id criado (AUTO_INCREMENT).
    protected function insert(string $sql, array $params = []): int
    {
        $this->execute($sql, $params);
        return (int) $this->db->lastInsertId();
    }

    // Transação: ou corre tudo, ou não fica nada (ex.: marcar código usado + encomenda entregue).
    public function transaction(callable $work): mixed
    {
        $this->db->beginTransaction();
        try {
            $result = $work();
            $this->db->commit();
            return $result;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // Erro de chave única (ex.: dois registos com o mesmo email ao mesmo tempo).
    protected static function isDuplicateKey(\PDOException $e): bool
    {
        return $e->getCode() === '23000';
    }
}
