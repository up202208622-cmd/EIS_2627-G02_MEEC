<?php
declare(strict_types=1);

namespace App\Service;

/**
 * Distância em linha reta entre dois pontos (fórmula de Haversine).
 * Chega para escolher o estafeta mais próximo; o percurso real pela estrada
 * é calculado com o OsrmClient do Rafael (WP2) quando a rota é montada.
 */
final class Geo
{
    private const EARTH_RADIUS_KM = 6371.0;

    public static function distanceKm(float $lat1, float $long1, float $lat2, float $long2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLong = deg2rad($long2 - $long1);
        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLong / 2) ** 2;
        return 2 * self::EARTH_RADIUS_KM * asin(min(1.0, sqrt($a)));
    }
}
