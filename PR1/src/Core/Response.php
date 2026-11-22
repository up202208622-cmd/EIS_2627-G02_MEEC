<?php
declare(strict_types=1);

namespace App\Core;

// ===== Respostas HTTP =====
// Todas as respostas da API saem por aqui, para terem sempre o mesmo formato.
// Cada método envia a resposta e termina o pedido (exit), por isso o tipo é "never".
final class Response
{
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // 204: correu bem e não há nada para devolver (ex.: logout)
    public static function noContent(): never
    {
        http_response_code(204);
        exit;
    }

    public static function error(string $code, string $message, int $status, array $fields = []): never
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== []) {
            $error['fields'] = $fields;   // erro por campo, para o JS mostrar junto do input certo
        }
        self::json(['error' => $error], $status);
    }

    // Ficheiro de texto para download (WP5: código de entrega em .txt).
    // "attachment" diz ao browser para guardar o ficheiro em vez de o mostrar.
    public static function textFile(string $filename, string $content): never
    {
        http_response_code(200);
        header('Content-Type: text/plain; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-store');   // o código não fica guardado em caches
        echo $content;
        exit;
    }
}
