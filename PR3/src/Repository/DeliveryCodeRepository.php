<?php
declare(strict_types=1);

namespace App\Repository;

use PDOException;

// ===== WP5: acesso a delivery_codes (e leitura de orders) =====
// A tabela delivery_codes é do WP5. A tabela orders é do João:
// aqui só lemos o dono e o estafeta e, na entrega, mudamos o estado.
final class DeliveryCodeRepository extends Repository
{
    // Estado final de uma encomenda entregue (ENUM de orders.status no schema.sql).
    public const ORDER_DELIVERED_STATUS = 'Completed';

    public function findOrder(int $orderId): ?array
    {
        return $this->fetchOne(
            'SELECT id, client_id, courier_id, status FROM orders WHERE id = :id',
            ['id' => $orderId]
        );
    }

    public function findByOrder(int $orderId): ?array
    {
        return $this->fetchOne(
            'SELECT order_id, code, generated_at, used_at, failed_attempts
               FROM delivery_codes WHERE order_id = :id',
            ['id' => $orderId]
        );
    }

    // Devolve false se a chave única falhar: já há código para esta encomenda,
    // ou (muito raro) o código sorteado já existe noutra encomenda.
    public function create(int $orderId, string $code, string $now): bool
    {
        try {
            $this->execute(
                'INSERT INTO delivery_codes (order_id, code, generated_at) VALUES (:id, :code, :now)',
                ['id' => $orderId, 'code' => $code, 'now' => $now]
            );
            return true;
        } catch (PDOException $e) {
            if (self::isDuplicateKey($e)) {
                return false;
            }
            throw $e;
        }
    }

    public function addFailedAttempt(int $orderId): void
    {
        $this->execute(
            'UPDATE delivery_codes SET failed_attempts = failed_attempts + 1 WHERE order_id = :id',
            ['id' => $orderId]
        );
    }

    // "AND used_at IS NULL": se dois pedidos chegarem ao mesmo tempo, só um consegue.
    public function markUsed(int $orderId, string $now): bool
    {
        return $this->execute(
            'UPDATE delivery_codes SET used_at = :now WHERE order_id = :id AND used_at IS NULL',
            ['id' => $orderId, 'now' => $now]
        ) === 1;
    }

    public function markOrderDelivered(int $orderId, string $now): void
    {
        $this->execute(
            'UPDATE orders SET status = :status, delivered_at = :now WHERE id = :id',
            ['status' => self::ORDER_DELIVERED_STATUS, 'now' => $now, 'id' => $orderId]
        );
    }
}
