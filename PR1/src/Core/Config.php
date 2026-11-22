<?php
declare(strict_types=1);

namespace App\Core;

// ===== Config =====
// Guarda o array do config.php e deixa ler valores com "pontos":
// Config::get('db.host') em vez de $config['db']['host'].
final class Config
{
    private static array $values = [];

    public static function load(array $values): void
    {
        self::$values = $values;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $value = self::$values;
        foreach (explode('.', $key) as $part) {
            if (!is_array($value) || !array_key_exists($part, $value)) {
                return $default;
            }
            $value = $value[$part];
        }
        return $value;
    }
}
