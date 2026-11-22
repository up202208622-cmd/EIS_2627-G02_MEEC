<?php
// ===== Arranque comum a todos os pedidos =====
// O api/index.php inclui este ficheiro primeiro. Aqui fica tudo o que tem
// de estar pronto antes de qualquer Controller correr:
//   1. carregar as classes automaticamente (autoload)
//   2. ler o config.php
//   3. garantir que QUALQUER erro sai em JSON (nunca a página de erro do PHP)

declare(strict_types=1);

use App\Core\ApiException;
use App\Core\Config;
use App\Core\Response;

// ----- 1. Autoload -----
// Quando o código usa App\Service\AuthService, o PHP chama esta função,
// que transforma o nome da classe no caminho src/Service/AuthService.php.
// Assim não é preciso um "require" para cada ficheiro.
spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;   // não é uma classe nossa
    }
    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = __DIR__ . '/' . $relative . '.php';
    if (is_file($file)) {
        require $file;
    }
});

// ----- 2. Configuração -----
$configFile = __DIR__ . '/../config.php';
if (!is_file($configFile)) {
    Response::error('CONFIG_MISSING', 'config.php not found. Copy config.example.php to config.php.', 500);
}
Config::load(require $configFile);

// ----- 3. Erros sempre em JSON -----
// Avisos do PHP (ex.: variável indefinida) passam a exceções,
// para não "sujarem" a resposta JSON com texto HTML.
set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// Última rede de segurança: qualquer exceção que ninguém apanhou chega aqui.
set_exception_handler(function (Throwable $e): void {
    if ($e instanceof ApiException) {
        // Erro "previsto" (dados inválidos, sem sessão, ...): já traz código HTTP e mensagem.
        Response::error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
    }

    // Erro inesperado (bug, base de dados em baixo, ...): 500.
    // Fica escrito no log do Apache; ao cliente só vai a mensagem técnica em modo debug.
    error_log('[CourierCMS] ' . $e);
    $message = Config::get('debug', false) ? $e->getMessage() : 'Internal server error.';
    Response::error('INTERNAL_ERROR', $message, 500);
});
