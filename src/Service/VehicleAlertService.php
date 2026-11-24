<?php
declare(strict_types=1);

namespace App\Service;

use App\Repository\AccountApprovalRepository;
use App\Repository\VehicleRepository;

// ===== Alertas dos certificados (RF-36 estafeta, RF-37 Staff) =====
// Não há tabela de alertas: calculam-se a partir das datas, por isso nunca ficam desatualizados.
//   expired  - certificado expirado: o veículo não pode ser usado
//   expiring - expira nos próximos ExpiryRules::ALERT_DAYS dias
//   updated  - o estafeta enviou um certificado novo que o Staff ainda não viu (doc_checked = 0)
final class VehicleAlertService
{
    private const ORDER = ['expired' => 0, 'updated' => 1, 'expiring' => 2];

    public function __construct(
        private readonly VehicleRepository $vehicles = new VehicleRepository(),
        private readonly AccountApprovalRepository $accounts = new AccountApprovalRepository(),
        private readonly Clock $clock = new Clock()
    ) {
    }

    /** Painel do Staff: contadores + alertas da frota aprovada. */
    public function forStaff(): array
    {
        $alerts = $this->alerts($this->vehicles->listByStatus('approved'), true);
        $count = fn (string $kind): int => count(array_filter($alerts, fn (array $a): bool => $a['kind'] === $kind));

        return [
            'summary' => [
                'pending_vehicles' => $this->vehicles->countByStatus('pending'),
                'unchecked_documents' => $this->vehicles->countUnchecked(),
                'expired' => $count('expired'),
                'expiring' => $count('expiring'),
                'pending_couriers' => $this->accounts->countPending('courier'),
            ],
            'alerts' => $alerts,
        ];
    }

    /** Alertas dos veículos deste estafeta (todos menos os recusados sem certificado em falta). */
    public function forCourier(int $courierId): array
    {
        return $this->alerts($this->vehicles->listByCourier($courierId), false);
    }

    private function alerts(array $vehicles, bool $withUpdates): array
    {
        $today = $this->clock->today();
        $alerts = [];

        foreach ($vehicles as $v) {
            $base = [
                'vehicle' => ['id' => (int) $v['id'], 'license_plate' => $v['license_plate'], 'model' => $v['model'],
                              'approval_status' => $v['approval_status']],
                'courier' => ['id' => (int) $v['courier_id'], 'name' => $v['courier_name']],
            ];

            foreach (VehicleRepository::DOC_TYPES as $type) {
                $date = $v[$type . '_expiry_date'];
                $state = ExpiryRules::state($date, $today);
                if ($state !== 'valid') {
                    $alerts[] = $base + [
                        'kind' => $state,
                        'doc_type' => $type,
                        'expiry_date' => $date,
                        'days_left' => ExpiryRules::daysLeft($date, $today),
                    ];
                }
            }

            if ($withUpdates && !$v['doc_checked'] && $v['doc_updated_at'] !== null) {
                $alerts[] = $base + [
                    'kind' => 'updated',
                    'doc_type' => null,
                    'uploaded_at' => $v['doc_updated_at'],
                    'insurance_expiry_date' => $v['insurance_expiry_date'],
                    'inspection_expiry_date' => $v['inspection_expiry_date'],
                ];
            }
        }

        // Expirados primeiro, depois certificados novos, depois os que estão quase a expirar
        usort($alerts, fn (array $a, array $b): int =>
            [self::ORDER[$a['kind']], $a['days_left'] ?? 0] <=> [self::ORDER[$b['kind']], $b['days_left'] ?? 0]);
        return $alerts;
    }
}
