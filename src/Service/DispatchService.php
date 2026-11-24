<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\ApiException;
use App\Repository\DispatchRepository;

// ===== WP3 – Fila de despacho (Miguel) =====
//
// 1. Uma encomenda paga (WP1) e sem estafeta está "à espera".
// 2. É proposta ao estafeta disponível mais próximo: distância em linha reta (Haversine)
//    desde a sua última entrega até ao ponto de recolha. Quem ainda não fez entregas conta como no FEUP.
// 3. O estafeta tem OFFER_SECONDS (60 s) para aceitar ou recusar.
// 4. Se recusar ou o tempo acabar, passa ao seguinte mais próximo. Quem recusou só volta
//    a receber essa encomenda passados RETRY_MINUTES minutos (assim nunca fica presa).
// 5. Se aceitar, a encomenda fica dele (status 'Initiated') e chama-se o gerador de código
//    de entrega do Gonçalo (WP5). Tudo numa transação.
//
// Não há cron (o XAMPP não tem tarefas agendadas): o tick() corre sempre que um estafeta
// pergunta pela proposta (a página faz isso a cada 5 s) e sempre que o Staff abre a fila.
final class DispatchService
{
    public const OFFER_SECONDS = 60;
    public const RETRY_MINUTES = 10;

    // Ponto de partida de quem ainda não fez entregas: FEUP (o mesmo do mapa do Sprint 1)
    public const DEPOT_LAT = 41.178;
    public const DEPOT_LONG = -8.596;

    /**
     * @param object|null $deliveryCodes DeliveryCodeService do Gonçalo (só se usa generate($orderId));
     *                                    null = cria-o quando for preciso
     */
    public function __construct(
        private readonly DispatchRepository $repo = new DispatchRepository(),
        private readonly Clock $clock = new Clock(),
        private ?object $deliveryCodes = null
    ) {
    }

    /** Faz a fila andar: fecha propostas com mais de 60 s e propõe as encomendas que estão à espera. */
    public function tick(): void
    {
        if (!$this->repo->lock()) {
            return;   // outro pedido está a fazer isto neste momento
        }
        try {
            $now = $this->clock->nowString();
            $this->repo->expireOffers($now);
            foreach ($this->repo->waitingOrders() as $order) {
                if ($this->repo->liveOfferForOrder((int) $order['id'], $now) !== null) {
                    continue;   // já há uma proposta a decorrer
                }
                $best = $this->nearestCourier($order);
                if ($best !== null) {
                    $this->repo->createOffer((int) $order['id'], $best['id'], round($best['distance_km'], 2), $now,
                        $this->clock->now()->modify('+' . self::OFFER_SECONDS . ' seconds')->format('Y-m-d H:i:s'));
                }
            }
        } finally {
            $this->repo->unlock();
        }
    }

    // =========================================================
    // Estafeta
    // =========================================================

    /** A proposta que este estafeta tem agora (ou null). */
    public function currentOffer(int $courierId): array
    {
        $this->tick();
        $offer = $this->repo->liveOfferForCourier($courierId, $this->clock->nowString());
        return ['offer' => $offer === null ? null : $this->offerView($offer)];
    }

    public function accept(int $courierId, int $offerId): array
    {
        $offer = $this->ownOffer($courierId, $offerId);
        $orderId = (int) $offer['order_id'];
        $now = $this->clock->nowString();

        // Tudo ou nada: se o código de entrega falhar, a proposta e a encomenda ficam como estavam
        $this->repo->transaction(function () use ($offerId, $courierId, $orderId, $now): void {
            if (!$this->repo->acceptOffer($offerId, $courierId, $now)) {
                throw ApiException::conflict('This offer has expired or was already answered.', 'OFFER_CLOSED');
            }
            if (!$this->repo->assignOrder($orderId, $courierId)) {
                throw ApiException::conflict('This order is no longer available.', 'ORDER_TAKEN');
            }
            // WP5 (Gonçalo): código de 6 dígitos que o CLIENTE descarrega em .txt.
            // O estafeta não o recebe: é o cliente que lho diz na entrega (e-POD).
            $this->codes()->generate($orderId);
        });

        return ['order_id' => $orderId, 'status' => DispatchRepository::ORDER_ASSIGNED];
    }

    public function decline(int $courierId, int $offerId): array
    {
        $offer = $this->ownOffer($courierId, $offerId);
        if (!$this->repo->declineOffer($offerId, $courierId)) {
            throw ApiException::conflict('This offer has expired or was already answered.', 'OFFER_CLOSED');
        }
        $this->tick();   // propõe já ao seguinte
        return ['order_id' => (int) $offer['order_id'], 'status' => 'declined'];
    }

    // =========================================================
    // Staff
    // =========================================================

    public function overview(): array
    {
        $this->tick();
        $now = $this->clock->nowString();

        $queue = [];
        foreach ($this->repo->waitingOrders() as $order) {
            $offer = $this->repo->liveOfferForOrder((int) $order['id'], $now);
            $status = $offer !== null ? 'offered' : ($this->nearestCourier($order) === null ? 'no_courier' : 'waiting');
            $queue[] = [
                'order_id' => (int) $order['id'],
                'waiting_since' => $order['created_at'],
                'weight_kg' => (float) $order['declared_weight_kg'],
                'volume_m3' => (float) $order['declared_vol_m3'],
                'status' => $status,
                'refusals' => $this->repo->countRefusals((int) $order['id']),
                'offer' => $offer === null ? null : [
                    'id' => (int) $offer['id'],
                    'courier' => ['id' => (int) $offer['courier_id'], 'name' => $offer['courier_name']],
                    'distance_km' => (float) $offer['distance_km'],
                    'seconds_left' => $this->secondsLeft($offer['expires_at']),
                ],
            ];
        }

        $recent = array_map(fn (array $r): array => [
            'order_id' => (int) $r['order_id'],
            'courier' => ['id' => (int) $r['courier_id'], 'name' => $r['courier_name']],
            'status' => $r['status'],
            'distance_km' => $r['distance_km'] === null ? null : (float) $r['distance_km'],
            'offered_at' => $r['offered_at'],
        ], $this->repo->recentAnswers(15));

        return ['queue' => $queue, 'recent' => $recent, 'offer_seconds' => self::OFFER_SECONDS, 'retry_minutes' => self::RETRY_MINUTES];
    }

    // =========================================================
    // Lógica interna
    // =========================================================

    /** O estafeta disponível mais perto do ponto de recolha (empate: o de id mais baixo). */
    private function nearestCourier(array $order): ?array
    {
        $since = $this->clock->now()->modify('-' . self::RETRY_MINUTES . ' minutes')->format('Y-m-d H:i:s');
        $candidates = $this->repo->availableCouriers(
            (int) $order['id'],
            (float) $order['declared_weight_kg'],
            (float) $order['declared_vol_m3'],
            $this->clock->today(),
            $this->clock->nowString(),
            $since
        );

        $best = null;
        foreach ($candidates as $c) {
            $lat = $c['last_lat'] !== null ? (float) $c['last_lat'] : self::DEPOT_LAT;
            $long = $c['last_long'] !== null ? (float) $c['last_long'] : self::DEPOT_LONG;
            $distance = Geo::distanceKm($lat, $long, (float) $order['origin_lat'], (float) $order['origin_long']);
            if ($best === null || $distance < $best['distance_km']) {
                $best = ['id' => (int) $c['id'], 'name' => $c['name'], 'distance_km' => $distance];
            }
        }
        return $best;
    }

    private function ownOffer(int $courierId, int $offerId): array
    {
        $offer = $this->repo->findOffer($offerId);
        if ($offer === null || (int) $offer['courier_id'] !== $courierId) {
            throw ApiException::notFound('Offer not found.', 'OFFER_NOT_FOUND');
        }
        return $offer;
    }

    private function offerView(array $offer): array
    {
        $order = $this->repo->findOrder((int) $offer['order_id']);
        return [
            'id' => (int) $offer['id'],
            'order_id' => (int) $offer['order_id'],
            'pickup' => ['lat' => (float) $order['origin_lat'], 'long' => (float) $order['origin_long']],
            'dropoff' => ['lat' => (float) $order['dest_lat'], 'long' => (float) $order['dest_long']],
            'trip_km' => (float) $order['distance_km'],
            'weight_kg' => (float) $order['declared_weight_kg'],
            'volume_m3' => (float) $order['declared_vol_m3'],
            'distance_km' => (float) $offer['distance_km'],
            'expires_at' => $offer['expires_at'],
            'seconds_left' => $this->secondsLeft($offer['expires_at']),
        ];
    }

    private function secondsLeft(string $expiresAt): int
    {
        $left = (new \DateTimeImmutable($expiresAt))->getTimestamp() - $this->clock->now()->getTimestamp();
        return max(0, min(self::OFFER_SECONDS, $left));
    }

    private function codes(): object
    {
        return $this->deliveryCodes ??= new DeliveryCodeService();
    }
}
