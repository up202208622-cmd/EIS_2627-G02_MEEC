<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\ApiException;
use App\Repository\DeliveryCodeRepository;

// ===== WP5: código de entrega aleatório =====
// Funciona como o código de levantamento de uma encomenda nos cacifos:
//   1. Quando o estafeta aceita a encomenda, gera-se um código de 6 dígitos (generate).
//   2. O cliente descarrega o código num .txt (fileForClient).
//   3. Na entrega, o cliente diz o código ao estafeta, que o escreve no e-POD (confirmDelivery).
//      Se bater certo, a encomenda passa a entregue. Assim fica provado que
//      a encomenda chegou à pessoa certa.
final class DeliveryCodeService
{
    public const CODE_LENGTH = 6;
    public const MAX_ATTEMPTS = 5;

    public function __construct(private readonly DeliveryCodeRepository $codes = new DeliveryCodeRepository())
    {
    }

    // ----- 1. Gerar (chamado pelo módulo do Miguel quando o estafeta aceita) -----
    // Uso: $code = (new DeliveryCodeService())->generate($orderId);
    //
    // É idempotente: se for chamado duas vezes para a mesma encomenda,
    // devolve o mesmo código em vez de criar outro (o cliente pode já o ter descarregado).
    public function generate(int $orderId): string
    {
        if ($this->codes->findOrder($orderId) === null) {
            throw ApiException::notFound('Order not found.', 'ORDER_NOT_FOUND');
        }

        $existing = $this->codes->findByOrder($orderId);
        if ($existing !== null) {
            return $existing['code'];
        }

        // random_int usa o gerador seguro do sistema operativo.
        // rand()/mt_rand() são previsíveis: quem visse alguns códigos podia adivinhar os seguintes.
        // str_pad mantém os zeros à esquerda: 7 -> "000007".
        // No schema o código é único em toda a tabela: se o sorteio repetir um código
        // que já existe (muito raro), tenta-se outro.
        for ($try = 0; $try < 5; $try++) {
            $code = str_pad((string) random_int(0, 10 ** self::CODE_LENGTH - 1), self::CODE_LENGTH, '0', STR_PAD_LEFT);
            if ($this->codes->create($orderId, $code, self::now())) {
                return $code;
            }
            // Falhou a chave única. Se foi porque outro pedido acabou de criar
            // o código desta encomenda, usamos esse.
            $existing = $this->codes->findByOrder($orderId);
            if ($existing !== null) {
                return $existing['code'];
            }
        }
        throw new \RuntimeException('Could not generate a unique delivery code.');
    }

    // ----- 2. Ficheiro .txt para o cliente -----
    public function fileForClient(int $orderId, array $client): array
    {
        $order = $this->codes->findOrder($orderId);
        // Encomenda de outro cliente: respondemos 404 e não 403,
        // para não confirmar que essa encomenda existe.
        if ($order === null || (int) $order['client_id'] !== (int) $client['id']) {
            throw ApiException::notFound('Order not found.', 'ORDER_NOT_FOUND');
        }

        $record = $this->codes->findByOrder($orderId);
        if ($record === null) {
            throw ApiException::conflict(
                'The delivery code is created when a courier accepts the order.',
                'CODE_NOT_READY'
            );
        }

        $content = implode("\r\n", [
            'CourierCMS - Delivery code',
            '==========================',
            '',
            'Order:          #' . $orderId,
            'Delivery code:  ' . $record['code'],
            'Created at:     ' . $record['generated_at'],
            '',
            'Give this code to the courier only when you receive your parcel.',
            'Do not share it before the delivery.',
            '',
        ]);

        return ['filename' => 'delivery-code-order-' . $orderId . '.txt', 'content' => $content];
    }

    // ----- 3. Validar no e-POD (estafeta) -----
    public function confirmDelivery(int $orderId, string $code, array $courier): array
    {
        $order = $this->codes->findOrder($orderId);
        if ($order === null || (int) $order['courier_id'] !== (int) $courier['id']) {
            throw ApiException::notFound('Order not found.', 'ORDER_NOT_FOUND');
        }

        $code = trim($code);
        if (preg_match('/^\d{' . self::CODE_LENGTH . '}$/', $code) !== 1) {
            throw ApiException::validation(['code' => 'The code has ' . self::CODE_LENGTH . ' digits.']);
        }

        // Encomendas canceladas ou em devolução (RTO) já não podem ser entregues.
        if (in_array($order['status'], ['Cancelled', 'RTO'], true)) {
            throw ApiException::conflict('This order can no longer be delivered.', 'ORDER_NOT_DELIVERABLE');
        }

        $record = $this->codes->findByOrder($orderId);
        if ($record === null) {
            throw ApiException::conflict('This order has no delivery code yet.', 'CODE_NOT_READY');
        }
        if ($record['used_at'] !== null) {
            throw ApiException::conflict('This order was already delivered.', 'ALREADY_DELIVERED');
        }
        // Limite de tentativas: com 6 dígitos há 1 milhão de hipóteses,
        // mas sem limite bastava tentar todas. Bloqueado, só o staff resolve.
        if ((int) $record['failed_attempts'] >= self::MAX_ATTEMPTS) {
            throw new ApiException('CODE_LOCKED', 'Too many wrong codes. Contact the staff.', 423);
        }

        // hash_equals compara sempre todos os caracteres (o tempo não revela quantos acertaram).
        if (!hash_equals($record['code'], $code)) {
            $this->codes->addFailedAttempt($orderId);
            $left = self::MAX_ATTEMPTS - (int) $record['failed_attempts'] - 1;
            throw ApiException::validation(
                ['code' => "Wrong code. {$left} attempt(s) left."],
                'The delivery code is not correct.'
            );
        }

        // As duas mudanças juntas numa transação: ou ficam as duas, ou nenhuma.
        $now = self::now();
        $this->codes->transaction(function () use ($orderId, $now): void {
            if (!$this->codes->markUsed($orderId, $now)) {
                throw ApiException::conflict('This order was already delivered.', 'ALREADY_DELIVERED');
            }
            $this->codes->markOrderDelivered($orderId, $now);
        });

        return ['order_id' => $orderId, 'status' => DeliveryCodeRepository::ORDER_DELIVERED_STATUS];
    }

    private static function now(): string
    {
        return date('Y-m-d H:i:s');
    }
}
