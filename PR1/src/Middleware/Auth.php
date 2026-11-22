<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Session;
use App\Repository\UserRepository;

// ===== Middleware de autenticação e papéis =====
// Corre ANTES do Controller, como um segurança à porta de uma zona reservada:
// confirma a pulseira (sessão) e se o teu papel pode entrar.
// Se não puder, lança 401/403 e o Controller nem chega a correr.
//
// Uso nas rotas (cada membro usa isto nas suas):
//   [Auth::login()]                    qualquer utilizador com sessão
//   [Auth::role('courier')]            só estafetas
//   [Auth::role('staff', 'admin')]     staff ou admin
//
// Depois disto, o Controller tem o utilizador em $request->user.
final class Auth
{
    public static function login(): callable
    {
        return function (Request $request): void {
            $request->user = self::loadActiveUser();
        };
    }

    public static function role(string ...$roles): callable
    {
        return function (Request $request) use ($roles): void {
            $user = self::loadActiveUser();
            if (!in_array($user['role'], $roles, true)) {
                throw ApiException::forbidden();
            }
            $request->user = $user;
        };
    }

    // Vai buscar o utilizador à BD em cada pedido (e não só à sessão):
    // se o admin desativar uma conta, ela perde o acesso logo no pedido seguinte.
    private static function loadActiveUser(): array
    {
        $userId = Session::userId();
        if ($userId === null) {
            throw ApiException::unauthorized();
        }

        $user = (new UserRepository())->findById($userId);
        if ($user === null || $user['status'] !== 'active') {
            Session::logout();
            throw ApiException::unauthorized('Your session is no longer valid. Please sign in again.');
        }
        return $user;
    }
}
