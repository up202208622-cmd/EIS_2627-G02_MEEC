<?php
declare(strict_types=1);

namespace App\Core;

// ===== Pedido HTTP =====
// Junta num só objeto o que vem no pedido: método, caminho, corpo JSON,
// parâmetros do URL ({id}) e, depois do middleware, o utilizador autenticado.
// Os Controllers só falam com este objeto, nunca com $_SERVER ou $_POST.
final class Request
{
    public array $params = [];   // preenchido pelo Router, ex.: ['id' => '42']
    public ?array $user = null;  // preenchido pelo middleware Auth

    public function __construct(
        public readonly string $method,
        public readonly string $path,
        private readonly array $body = [],
        private readonly array $query = []
    ) {
    }

    public static function fromGlobals(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $path = self::routePath();

        // O corpo vem em JSON (é o que o fetch() das páginas envia).
        // Se não for JSON, aceitamos o formulário clássico ($_POST).
        $body = $_POST;
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($contentType, 'application/json')) {
            $raw = file_get_contents('php://input');
            if ($raw !== '' && $raw !== false) {
                $body = json_decode($raw, true);
                if (!is_array($body)) {
                    throw ApiException::badRequest('The request body is not valid JSON.', 'INVALID_JSON');
                }
            }
        }

        return new self($method, $path, $body, $_GET);
    }

    // Tira ao URL a parte da pasta onde o projeto está instalado.
    // Ex.: /EIS_2627-G02_MEEC/api/auth/login  ->  /auth/login
    // Funciona com o .htaccess (URL "limpo") e sem ele (api/index.php/auth/login).
    private static function routePath(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $uri = rawurldecode($uri);
        $script = $_SERVER['SCRIPT_NAME'] ?? '';   // ex.: /EIS_2627-G02_MEEC/api/index.php
        $base = rtrim(dirname($script), '/');      // ex.: /EIS_2627-G02_MEEC/api

        if ($script !== '' && str_starts_with($uri, $script)) {
            $uri = substr($uri, strlen($script));
        } elseif ($base !== '' && str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }

        $uri = '/' . trim($uri, '/');
        return $uri;
    }

    // Um campo do corpo (ou o valor por defeito se não vier).
    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    public function all(): array
    {
        return $this->body;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    // Parâmetro numérico do URL, ex.: /orders/{id}. Se não for um número inteiro positivo, 400.
    public function intParam(string $key): int
    {
        $value = $this->params[$key] ?? '';
        if (!ctype_digit($value) || (int) $value < 1) {
            throw ApiException::badRequest("Invalid {$key} in the URL.", 'INVALID_PARAMETER');
        }
        return (int) $value;
    }
}
