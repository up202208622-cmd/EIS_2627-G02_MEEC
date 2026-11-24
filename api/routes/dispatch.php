<?php
// ===== Rotas: WP3 fila de despacho (Miguel) =====
use App\Controller\DispatchController;
use App\Middleware\Auth;

/** @var App\Core\Router $router */
$router->get('/courier/offers/current',       [DispatchController::class, 'current'],  [Auth::role('courier')]);
$router->post('/courier/offers/{id}/accept',  [DispatchController::class, 'accept'],   [Auth::role('courier')]);
$router->post('/courier/offers/{id}/decline', [DispatchController::class, 'decline'],  [Auth::role('courier')]);
$router->get('/staff/dispatch',               [DispatchController::class, 'overview'], [Auth::role('staff', 'admin')]);
