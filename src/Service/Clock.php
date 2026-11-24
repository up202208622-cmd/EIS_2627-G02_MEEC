<?php
declare(strict_types=1);

namespace App\Service;

/**
 * Hora atual do servidor.
 * Existe para os testes poderem "parar" ou "avançar" o tempo
 * (por exemplo, para ver uma proposta de 60 s expirar sem esperar).
 */
class Clock
{
    public function __construct(private ?string $fixed = null)
    {
    }

    public function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable($this->fixed ?? 'now');
    }

    /** 'YYYY-MM-DD HH:MM:SS' (formato DATETIME do MySQL) */
    public function nowString(): string
    {
        return $this->now()->format('Y-m-d H:i:s');
    }

    /** 'YYYY-MM-DD' (formato DATE do MySQL) */
    public function today(): string
    {
        return $this->now()->format('Y-m-d');
    }

    /** Só para testes: fixa a hora. */
    public function set(string $dateTime): void
    {
        $this->fixed = $dateTime;
    }

    /** Só para testes: avança a hora, ex. advance('+61 seconds'). */
    public function advance(string $modifier): void
    {
        $this->fixed = $this->now()->modify($modifier)->format('Y-m-d H:i:s');
    }
}
