<?php
// ===== Rotas: estatísticas públicas (Gonçalo) =====
use App\Controller\StatsController;

/** @var App\Core\Router $router */
$router->get('/stats/public', [StatsController::class, 'publicStats']);
