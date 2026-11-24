<?php
declare(strict_types=1);

namespace App\Service;

// ===== Validade dos documentos (use case "Check expiry dates") =====
// O Staff e o estafeta são avisados quando faltam ALERT_DAYS dias ou menos (RF-36, RF-37).
final class ExpiryRules
{
    public const ALERT_DAYS = 3;

    /** Dias inteiros de $today até $expiry (negativo = já expirou). */
    public static function daysLeft(string $expiry, string $today): int
    {
        $from = new \DateTimeImmutable(substr($today, 0, 10));
        $to = new \DateTimeImmutable(substr($expiry, 0, 10));
        return (int) $from->diff($to)->format('%r%a');
    }

    /** 'expired' | 'expiring' | 'valid' */
    public static function state(string $expiry, string $today): string
    {
        $days = self::daysLeft($expiry, $today);
        if ($days < 0) {
            return 'expired';
        }
        return $days <= self::ALERT_DAYS ? 'expiring' : 'valid';
    }

    /** '2026-11-19' -> '19/11/2026' (para as mensagens de erro) */
    public static function pretty(string $date): string
    {
        return (new \DateTimeImmutable(substr($date, 0, 10)))->format('d/m/Y');
    }
}
