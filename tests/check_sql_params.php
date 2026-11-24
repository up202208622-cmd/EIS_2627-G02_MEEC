<?php
// Verifica que nenhuma query repete o mesmo :marcador.
// No MySQL com prepared statements nativos (ATTR_EMULATE_PREPARES = false) isso dá erro,
// e os testes em SQLite não o apanham.
$problems = 0;
foreach (glob(__DIR__ . '/../src/Repository/*.php') as $file) {
    $code = file_get_contents($file);
    // Strings entre aspas (simples ou duplas) que parecem SQL
    preg_match_all('/(["\'])\s*((?:SELECT|UPDATE|INSERT|DELETE)\b.*?)(?<!\\\\)\1/s', $code, $m);
    foreach ($m[2] as $sql) {
        preg_match_all('/(?<![:\w]):([a-z_][a-z0-9_]*)/i', $sql, $p);
        $repeated = array_keys(array_filter(array_count_values($p[1]), fn ($n) => $n > 1));
        if ($repeated) {
            $problems++;
            echo basename($file), ': repeated ', implode(', ', $repeated), "\n";
        }
    }
}
echo $problems === 0 ? "OK: no repeated SQL parameters\n" : "$problems problem(s)\n";
exit($problems === 0 ? 0 : 1);
