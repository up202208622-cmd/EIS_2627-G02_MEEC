<?php
declare(strict_types=1);

namespace App\Core;

use RuntimeException;

// ===== Erro "previsto" da API =====
// Quando um Service deteta um problema (email repetido, sem sessão, ...)
// lança uma ApiException. Ela já sabe o código HTTP e o código de erro,
// e o bootstrap transforma-a no JSON de erro comum:
//   { "error": { "code": "...", "message": "...", "fields": { ... } } }
final class ApiException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 400,
        public readonly array $fields = []
    ) {
        parent::__construct($message);
    }

    // ----- Atalhos para os casos mais comuns -----

    // 400: o pedido está mal formado (JSON partido, id não numérico, ...)
    public static function badRequest(string $message, string $code = 'BAD_REQUEST'): self
    {
        return new self($code, $message, 400);
    }

    // 401: não sabemos quem és (sem sessão ou credenciais erradas)
    public static function unauthorized(string $message = 'You need to sign in.', string $code = 'UNAUTHENTICATED'): self
    {
        return new self($code, $message, 401);
    }

    // 403: sabemos quem és, mas não tens permissão
    public static function forbidden(string $message = 'You do not have permission for this action.', string $code = 'FORBIDDEN'): self
    {
        return new self($code, $message, 403);
    }

    public static function notFound(string $message = 'Not found.', string $code = 'NOT_FOUND'): self
    {
        return new self($code, $message, 404);
    }

    // 409: o pedido choca com o estado atual (ex.: email já registado)
    public static function conflict(string $message, string $code = 'CONFLICT', array $fields = []): self
    {
        return new self($code, $message, 409, $fields);
    }

    // 422: o JSON está bem formado, mas os valores não passam na validação
    public static function validation(array $fields, string $message = 'Some fields are invalid.'): self
    {
        return new self('VALIDATION_ERROR', $message, 422, $fields);
    }
}
