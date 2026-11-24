<?php
declare(strict_types=1);

namespace App\Repository;

// ===== WP3: fila de despacho (Miguel) =====
// Tabela dispatch_offers: cada proposta feita a um estafeta (offered -> accepted | declined | expired).
// Lê orders, payments, users, vehicles e vehicle_types; na encomenda só muda courier_id e status
// quando um estafeta aceita.
//
// Várias mudanças são "condicionais" (UPDATE ... WHERE status = 'offered'): se dois pedidos
// chegarem ao mesmo tempo, só um muda a linha (rowCount() === 1) e o outro percebe que perdeu.
// Cada :marcador aparece só uma vez por query (prepared statements nativos do MySQL).
final class DispatchRepository extends Repository
{
    // Estados de orders.status (ENUM do schema.sql)
    public const ORDER_WAITING = 'Pending';      // paga e ainda sem estafeta
    public const ORDER_ASSIGNED = 'Initiated';   // um estafeta aceitou

    // ---------- Trinco: só um pedido de cada vez faz a fila andar ----------
    // No MySQL usa GET_LOCK (um trinco com nome, partilhado por todos os pedidos).
    // Nos testes (SQLite) não há pedidos ao mesmo tempo, por isso não é preciso.
    public function lock(): bool
    {
        if ($this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) !== 'mysql') {
            return true;
        }
        return (int) $this->fetchValue("SELECT GET_LOCK('couriercms_dispatch', 0)") === 1;
    }

    public function unlock(): void
    {
        if ($this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql') {
            $this->fetchValue("SELECT RELEASE_LOCK('couriercms_dispatch')");
        }
    }

    // ---------- Encomendas à espera ----------

    /** Encomendas pagas (WP1) e sem estafeta, as mais antigas primeiro. */
    public function waitingOrders(): array
    {
        return $this->fetchAll(
            "SELECT o.id, o.origin_lat, o.origin_long, o.dest_lat, o.dest_long, o.distance_km,
                    o.declared_weight_kg, o.declared_vol_m3, o.price_total, o.created_at
               FROM orders o
              WHERE o.status = :waiting AND o.courier_id IS NULL
                AND EXISTS (SELECT 1 FROM payments p
                             WHERE p.order_id = o.id AND p.kind = 'order' AND p.status = 'paid')
              ORDER BY o.created_at, o.id",
            ['waiting' => self::ORDER_WAITING]
        );
    }

    public function findOrder(int $orderId): ?array
    {
        return $this->fetchOne(
            'SELECT id, status, courier_id, origin_lat, origin_long, dest_lat, dest_long, distance_km,
                    declared_weight_kg, declared_vol_m3
               FROM orders WHERE id = :id',
            ['id' => $orderId]
        );
    }

    /** Atribui a encomenda, só se ainda estiver à espera e sem estafeta. */
    public function assignOrder(int $orderId, int $courierId): bool
    {
        return $this->execute(
            'UPDATE orders SET courier_id = :courier, status = :assigned
              WHERE id = :id AND courier_id IS NULL AND status = :waiting',
            ['courier' => $courierId, 'assigned' => self::ORDER_ASSIGNED, 'id' => $orderId, 'waiting' => self::ORDER_WAITING]
        ) === 1;
    }

    // ---------- Estafetas ----------

    /**
     * Estafetas que podem receber esta encomenda agora, com o sítio onde estão:
     * destino da última entrega concluída; se não houver, users.last_lat/last_long; senão null (= FEUP).
     *
     * Disponível = conta ativa
     *            + um veículo aprovado, com seguro e inspeção válidos hoje,
     *              cujo tipo aguenta o peso e o volume declarados
     *            + nenhuma proposta à espera de resposta
     *            + não recusou (nem deixou expirar) esta encomenda desde $since
     */
    public function availableCouriers(int $orderId, float $weightKg, float $volumeM3, string $today, string $now, string $since): array
    {
        return $this->fetchAll(
            "SELECT u.id, u.name,
                    COALESCE((SELECT o1.dest_lat FROM orders o1
                               WHERE o1.courier_id = u.id AND o1.status = 'Completed' AND o1.delivered_at IS NOT NULL
                               ORDER BY o1.delivered_at DESC LIMIT 1), u.last_lat) AS last_lat,
                    COALESCE((SELECT o2.dest_long FROM orders o2
                               WHERE o2.courier_id = u.id AND o2.status = 'Completed' AND o2.delivered_at IS NOT NULL
                               ORDER BY o2.delivered_at DESC LIMIT 1), u.last_long) AS last_long
               FROM users u
              WHERE u.role = 'courier' AND u.status = 'active'
                AND EXISTS (SELECT 1 FROM vehicles v JOIN vehicle_types t ON t.id = v.vehicle_type_id
                             WHERE v.courier_id = u.id AND v.approval_status = 'approved'
                               AND v.insurance_expiry_date >= :today1 AND v.inspection_expiry_date >= :today2
                               AND t.max_weight_kg >= :weight AND t.max_vol_m3 >= :volume)
                AND NOT EXISTS (SELECT 1 FROM dispatch_offers f1
                                 WHERE f1.courier_id = u.id AND f1.status = 'offered' AND f1.expires_at >= :now)
                AND NOT EXISTS (SELECT 1 FROM dispatch_offers f2
                                 WHERE f2.courier_id = u.id AND f2.order_id = :order_id
                                   AND f2.status IN ('declined', 'expired') AND f2.offered_at >= :since)
              ORDER BY u.id",
            [
                'today1' => $today, 'today2' => $today,
                'weight' => $weightKg, 'volume' => $volumeM3,
                'now' => $now, 'order_id' => $orderId, 'since' => $since,
            ]
        );
    }

    // ---------- Propostas ----------

    /** Propostas sem resposta depois dos 60 s passam a 'expired'. */
    public function expireOffers(string $now): int
    {
        return $this->execute(
            "UPDATE dispatch_offers SET status = 'expired' WHERE status = 'offered' AND expires_at < :now",
            ['now' => $now]
        );
    }

    /** Proposta a decorrer para esta encomenda (no máximo uma). */
    public function liveOfferForOrder(int $orderId, string $now): ?array
    {
        return $this->fetchOne(
            "SELECT f.*, u.name AS courier_name FROM dispatch_offers f JOIN users u ON u.id = f.courier_id
              WHERE f.order_id = :order_id AND f.status = 'offered' AND f.expires_at >= :now
              ORDER BY f.id DESC LIMIT 1",
            ['order_id' => $orderId, 'now' => $now]
        );
    }

    /** Proposta à espera de resposta deste estafeta. */
    public function liveOfferForCourier(int $courierId, string $now): ?array
    {
        return $this->fetchOne(
            "SELECT * FROM dispatch_offers
              WHERE courier_id = :courier AND status = 'offered' AND expires_at >= :now
              ORDER BY id LIMIT 1",
            ['courier' => $courierId, 'now' => $now]
        );
    }

    public function createOffer(int $orderId, int $courierId, float $distanceKm, string $offeredAt, string $expiresAt): int
    {
        return $this->insert(
            "INSERT INTO dispatch_offers (order_id, courier_id, distance_km, offered_at, expires_at, status)
             VALUES (:order_id, :courier_id, :distance, :offered_at, :expires_at, 'offered')",
            ['order_id' => $orderId, 'courier_id' => $courierId, 'distance' => $distanceKm,
             'offered_at' => $offeredAt, 'expires_at' => $expiresAt]
        );
    }

    public function findOffer(int $offerId): ?array
    {
        return $this->fetchOne('SELECT * FROM dispatch_offers WHERE id = :id', ['id' => $offerId]);
    }

    /** Aceitar só funciona se a proposta é deste estafeta, ainda está 'offered' e não passou o prazo. */
    public function acceptOffer(int $offerId, int $courierId, string $now): bool
    {
        return $this->execute(
            "UPDATE dispatch_offers SET status = 'accepted'
              WHERE id = :id AND courier_id = :courier AND status = 'offered' AND expires_at >= :now",
            ['id' => $offerId, 'courier' => $courierId, 'now' => $now]
        ) === 1;
    }

    public function declineOffer(int $offerId, int $courierId): bool
    {
        return $this->execute(
            "UPDATE dispatch_offers SET status = 'declined' WHERE id = :id AND courier_id = :courier AND status = 'offered'",
            ['id' => $offerId, 'courier' => $courierId]
        ) === 1;
    }

    /** Quantas vezes esta encomenda foi recusada ou ficou sem resposta. */
    public function countRefusals(int $orderId): int
    {
        return (int) $this->fetchValue(
            "SELECT COUNT(*) FROM dispatch_offers WHERE order_id = :order_id AND status IN ('declined', 'expired')",
            ['order_id' => $orderId]
        );
    }

    /** Últimas respostas, para a vista do Staff. */
    public function recentAnswers(int $limit): array
    {
        $limit = max(1, min(100, $limit));   // número validado: pode ir no SQL
        return $this->fetchAll(
            "SELECT f.id, f.order_id, f.courier_id, u.name AS courier_name, f.status, f.distance_km, f.offered_at
               FROM dispatch_offers f JOIN users u ON u.id = f.courier_id
              WHERE f.status <> 'offered'
              ORDER BY f.offered_at DESC, f.id DESC
              LIMIT {$limit}"
        );
    }
}
