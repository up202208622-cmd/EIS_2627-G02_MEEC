<?php
declare(strict_types=1);

namespace App\Service;

use App\Repository\StatsRepository;

// ===== Estatísticas públicas =====
// Junta as contagens num só objeto para a Home fazer um único pedido.
final class StatsService
{
    public function __construct(private readonly StatsRepository $stats = new StatsRepository())
    {
    }

    public function publicStats(): array
    {
        return [
            'routes_today'             => $this->stats->routesToday(date('Y-m-d 00:00:00')),
            'active_couriers'          => $this->stats->countActiveUsers('courier'),
            'registered_clients'       => $this->stats->countActiveUsers('client'),
            'vehicles_by_type'         => self::toMap($this->stats->vehiclesByType()),
            'couriers_by_vehicle_type' => self::toMap($this->stats->couriersByVehicleType()),
        ];
    }

    // [['type_name'=>'Van','total'=>5], ...]  ->  {"Van": 5, ...}  (mais fácil de usar no JS)
    private static function toMap(array $rows): array
    {
        $map = [];
        foreach ($rows as $row) {
            $map[$row['type_name']] = (int) $row['total'];
        }
        return $map;
    }
}
