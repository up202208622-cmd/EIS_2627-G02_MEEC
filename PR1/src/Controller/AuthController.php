<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Service\AuthService;

// ===== Controller da autenticação =====
// Camada de apresentação: lê o pedido, chama o Service e devolve JSON.
// Não tem regras de negócio nem SQL: se amanhã a API passasse a ser chamada
// por uma app móvel, este ficheiro mudava e o AuthService ficava igual.
final class AuthController
{
    public function __construct(private readonly AuthService $auth = new AuthService())
    {
    }

    // POST /api/auth/register
    public function register(Request $request): void
    {
        $user = $this->auth->register($request->all());
        Response::json(['user' => $user], 201);   // 201 Created
    }

    // POST /api/auth/login
    public function login(Request $request): void
    {
        $user = $this->auth->login(
            (string) $request->input('email', ''),
            (string) $request->input('password', '')
        );
        Response::json(['user' => $user]);
    }

    // POST /api/auth/logout
    public function logout(Request $request): void
    {
        $this->auth->logout();
        Response::noContent();
    }

    // GET /api/me  (o middleware Auth::login() já pôs o utilizador no pedido)
    public function me(Request $request): void
    {
        Response::json(['user' => $request->user]);
    }

    // PUT /api/me
    public function updateMe(Request $request): void
    {
        $user = $this->auth->updateProfile($request->user, $request->all());
        Response::json(['user' => $user]);
    }
}
