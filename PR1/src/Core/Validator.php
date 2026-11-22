<?php
declare(strict_types=1);

namespace App\Core;

// ===== Validação no servidor =====
// As mesmas regras do validation.js do Sprint 1, agora em PHP.
// A validação em JS é só conforto para o utilizador: qualquer pessoa consegue
// chamar a API sem passar pela página (Postman, consola do browser).
// Por isso quem decide é sempre o servidor.
//
// Uso:
//   $v = new Validator($data);
//   $v->required('name')->email('email');
//   $v->check();   // lança 422 com os erros de cada campo, se houver
final class Validator
{
    private array $errors = [];

    public function __construct(private readonly array $data)
    {
    }

    public function value(string $field): string
    {
        $value = $this->data[$field] ?? '';
        return is_scalar($value) ? trim((string) $value) : '';
    }

    public function required(string $field, string $message = 'This field is required.'): self
    {
        if ($this->value($field) === '') {
            $this->addError($field, $message);
        }
        return $this;
    }

    public function email(string $field): self
    {
        return $this->rule($field, filter_var($this->value($field), FILTER_VALIDATE_EMAIL) !== false,
            'Invalid email (e.g. name@domain.com).');
    }

    public function pattern(string $field, string $regex, string $message): self
    {
        return $this->rule($field, preg_match($regex, $this->value($field)) === 1, $message);
    }

    public function minLength(string $field, int $min, string $message): self
    {
        return $this->rule($field, mb_strlen($this->value($field)) >= $min, $message);
    }

    public function maxLength(string $field, int $max): self
    {
        return $this->rule($field, mb_strlen($this->value($field)) <= $max, "At most {$max} characters.");
    }

    // NIF português: 9 dígitos, o último é dígito de controlo (módulo 11). Igual ao JS.
    public function nif(string $field): self
    {
        return $this->rule($field, self::isValidNif($this->value($field)), 'Invalid NIF.');
    }

    // Regra genérica: $ok diz se passou.
    public function rule(string $field, bool $ok, string $message): self
    {
        if (!$ok) {
            $this->addError($field, $message);
        }
        return $this;
    }

    public function hasError(string $field): bool
    {
        return isset($this->errors[$field]);
    }

    public function check(): void
    {
        if ($this->errors !== []) {
            throw ApiException::validation($this->errors);
        }
    }

    // Só guardamos o primeiro erro de cada campo (como no JS).
    private function addError(string $field, string $message): void
    {
        $this->errors[$field] ??= $message;
    }

    public static function isValidNif(string $nif): bool
    {
        if (preg_match('/^\d{9}$/', $nif) !== 1) {
            return false;
        }
        $sum = 0;
        for ($i = 0; $i < 8; $i++) {
            $sum += (int) $nif[$i] * (9 - $i);
        }
        $rest = $sum % 11;
        $check = $rest < 2 ? 0 : 11 - $rest;
        return $check === (int) $nif[8];
    }
}
