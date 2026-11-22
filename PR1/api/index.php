<?php
// ===== Ponto de entrada da API =====
// Todos os pedidos /api/... chegam aqui (o .htaccess encaminha-os).
// 1. arranque (autoload, config, erros em JSON)
// 2. cada ficheiro em api/routes/ regista as suas rotas
// 3. o Router escolhe a rota e chama o Controller

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

use App\Core\Request;
use App\Core\Router;

$router = new Router();

// Um ficheiro de rotas por módulo (auth.php, orders.php, ...), para cada membro
// mexer só no seu e não haver conflitos de merge neste ficheiro.
foreach (glob(__DIR__ . '/routes/*.php') as $routesFile) {
    require $routesFile;
}

$router->dispatch(Request::fromGlobals());
