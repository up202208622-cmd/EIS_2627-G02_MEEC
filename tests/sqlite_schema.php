<?php
declare(strict_types=1);

/**
 * Converte o sql/schema.sql do Rafael (MySQL) para SQLite, só para os testes automáticos.
 * Assim os testes usam sempre as tabelas e os dados de teste verdadeiros do projeto,
 * sem precisar do MySQL a correr.
 *
 * O que muda: ENUM -> TEXT, UNSIGNED/AUTO_INCREMENT/ENGINE saem, KEY (índices) saem,
 * DATE_FORMAT -> strftime. Os INSERT ficam iguais.
 */
function mysqlSchemaToSqlite(string $mysql): string
{
    $sql = str_replace("\r\n", "\n", $mysql);

    // Linhas só do MySQL
    $sql = preg_replace('/^\s*(DROP DATABASE|CREATE DATABASE|USE |SET )[^;]*;\s*$/mi', '', $sql);

    // Coluna id AUTO_INCREMENT -> INTEGER PRIMARY KEY AUTOINCREMENT (e tira o PRIMARY KEY (id) da tabela)
    $sql = preg_replace_callback('/CREATE TABLE (\w+) \((.*?)\n\) ENGINE=InnoDB;/s', function (array $m): string {
        $lines = explode("\n", $m[2]);
        $out = [];
        $autoColumn = null;
        foreach ($lines as $line) {
            if (preg_match('/^\s*(\w+)\s+INT UNSIGNED NOT NULL AUTO_INCREMENT,?\s*$/', $line, $c)) {
                $autoColumn = $c[1];
                $out[] = "  {$c[1]} INTEGER PRIMARY KEY AUTOINCREMENT,";
                continue;
            }
            if ($autoColumn && preg_match('/^\s*PRIMARY KEY \(' . $autoColumn . '\),?\s*$/', $line)) {
                continue;
            }
            if (preg_match('/^\s*KEY \w+ \(/', $line)) {
                continue;   // índices normais: não fazem falta nos testes
            }
            $line = preg_replace('/UNIQUE KEY \w+ \(/', 'UNIQUE (', $line);
            $line = preg_replace('/ENUM\([^)]*\)/', 'TEXT', $line);
            $line = str_replace(' UNSIGNED', '', $line);
            $line = preg_replace('/--.*$/', '', $line);
            if (trim($line) !== '') {
                $out[] = rtrim($line);
            }
        }
        // A última definição não pode acabar em vírgula
        $last = count($out) - 1;
        $out[$last] = rtrim($out[$last], ',');
        return "CREATE TABLE {$m[1]} (\n" . implode("\n", $out) . "\n);";
    }, $sql);

    $sql = preg_replace("/DATE_FORMAT\((\w+), '%Y-%m'\)/", "strftime('%Y-%m', $1)", $sql);
    return $sql;
}

/** Cria (ou recria) uma base de dados SQLite com o schema e os dados de teste. */
function createSqliteDatabase(string $file, string $schemaFile): PDO
{
    if (is_file($file)) {
        unlink($file);
    }
    $pdo = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec(mysqlSchemaToSqlite(file_get_contents($schemaFile)));
    return $pdo;
}
