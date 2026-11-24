<?php
// ===== Rotas: veículos, certificados, alertas e aprovação de contas (Miguel) =====
use App\Controller\AccountApprovalController;
use App\Controller\VehicleController;
use App\Middleware\Auth;

/** @var App\Core\Router $router */

// Estafeta
$router->get('/vehicle-types',                    [VehicleController::class, 'types'],          [Auth::login()]);
$router->get('/courier/vehicles',                 [VehicleController::class, 'mine'],           [Auth::role('courier')]);
$router->post('/courier/vehicles',                [VehicleController::class, 'register'],       [Auth::role('courier')]);
$router->post('/courier/vehicles/{id}/documents', [VehicleController::class, 'updateDocument'], [Auth::role('courier')]);
$router->get('/courier/alerts',                   [VehicleController::class, 'courierAlerts'],  [Auth::role('courier')]);
$router->get('/vehicles/{id}/documents/{type}',   [VehicleController::class, 'documentFile'],   [Auth::role('courier', 'staff', 'admin')]);

// Staff (o Admin também pode)
$router->get('/staff/vehicles',                          [VehicleController::class, 'list'],        [Auth::role('staff', 'admin')]);
$router->post('/staff/vehicles/{id}/approve',            [VehicleController::class, 'approve'],     [Auth::role('staff', 'admin')]);
$router->post('/staff/vehicles/{id}/disapprove',         [VehicleController::class, 'disapprove'],  [Auth::role('staff', 'admin')]);
$router->post('/staff/vehicles/{id}/documents-checked',  [VehicleController::class, 'markChecked'], [Auth::role('staff', 'admin')]);
$router->get('/staff/alerts',                            [VehicleController::class, 'staffAlerts'], [Auth::role('staff', 'admin')]);

// Contas pendentes: Staff -> estafetas; Admin -> estafetas e staff
$router->get('/staff/accounts',               [AccountApprovalController::class, 'list'],    [Auth::role('staff', 'admin')]);
$router->post('/staff/accounts/{id}/approve', [AccountApprovalController::class, 'approve'], [Auth::role('staff', 'admin')]);
$router->post('/staff/accounts/{id}/reject',  [AccountApprovalController::class, 'reject'],  [Auth::role('staff', 'admin')]);
