<?php
// ===== Rotas: WP5 código de entrega (Gonçalo) =====
use App\Controller\DeliveryCodeController;
use App\Middleware\Auth;

/** @var App\Core\Router $router */
$router->get('/orders/{id}/delivery-code', [DeliveryCodeController::class, 'download'], [Auth::role('client')]);
$router->post('/orders/{id}/epod',         [DeliveryCodeController::class, 'confirm'],  [Auth::role('courier')]);
