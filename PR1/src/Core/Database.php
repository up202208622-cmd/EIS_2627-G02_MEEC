<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;

// ===== Ligação à base de dados (PDO) =====
// Uma única ligação por pedido, criada só quando alguém precisa dela
// e partilhada por todos os Repositories.
final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo === null) {
            // 'dsn' no config permite apontar para outra base de dados (ex.: testes).
            $dsn = Config::get('db.dsn') ?? sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                Config::get('db.host', '127.0.0.1'),
                (int) Config::get('db.port', 3306),
                Config::get('db.name', 'couriercms')
            );

            try {
                self::$pdo = new PDO($dsn, Config::get('db.user'), Config::get('db.password'), [
                    // Erros de SQL lançam exceção (em vez de devolverem false em silêncio).
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    // Cada linha vem como array associativo: $row['email'].
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    // Prepared statements "a sério", feitos pelo MySQL e não simulados pelo PHP.
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (PDOException $e) {
                // Não mostramos $e->getMessage(): pode trazer o utilizador da BD.
                error_log('[CourierCMS] DB connection failed: ' . $e->getMessage());
                throw new ApiException('DB_UNAVAILABLE', 'The database is not available. Is MySQL running?', 503);
            }
        }
        return self::$pdo;
    }
}
