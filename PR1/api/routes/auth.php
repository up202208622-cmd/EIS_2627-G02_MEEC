<?php
// ===== Rotas: autenticação e perfil (Gonçalo) =====
use App\Controller\AuthController;
use App\Middleware\Auth;

/** @var App\Core\Router $router */
$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/login',    [AuthController::class, 'login']);
$router->post('/auth/logout',   [AuthController::class, 'logout']);
$router->get('/me',             [AuthController::class, 'me'],       [Auth::login()]);
$router->put('/me',             [AuthController::class, 'updateMe'], [Auth::login()]);
