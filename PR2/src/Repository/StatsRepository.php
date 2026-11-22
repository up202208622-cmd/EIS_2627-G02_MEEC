<?php
declare(strict_types=1);

namespace App\Repository;

// ===== Queries das estatísticas públicas (Home) =====
// Só leitura e só contagens: nunca sai daqui informação pessoal.
// Os veículos por tipo usam as vistas que o Rafael criou no schema.sql
// (v_vehicles_by_type e v_couriers_by_type), para todos contarem da mesma forma.
final class StatsRepository extends Repository
{
    // "Rotas do dia": as que estão planeadas ou a decorrer, mais as que acabaram hoje.
    // A data de hoje vem do PHP como parâmetro (nunca concatenada no SQL).
    public function routesToday(string $todayStart): int
    {
        return (int) $this->fetchValue(
            "SELECT COUNT(*) FROM routes
              WHERE status IN ('planned', 'in_progress') OR completed_at >= :today",
            ['today' => $todayStart]
        );
    }

    public function countActiveUsers(string $role): int
    {
        return (int) $this->fetchValue(
            "SELECT COUNT(*) FROM users WHERE role = :role AND status = 'active'",
            ['role' => $role]
        );
    }

    // Todos os veículos registados, por tipo: [['type_name' => 'Van', 'total' => 5], ...]
    public function vehiclesByType(): array
    {
        return $this->fetchAll('SELECT type_name, total FROM v_vehicles_by_type ORDER BY type_name');
    }

    // Estafetas com pelo menos um veículo aprovado desse tipo.
    public function couriersByVehicleType(): array
    {
        return $this->fetchAll('SELECT type_name, total FROM v_couriers_by_type ORDER BY type_name');
    }
}
