<?php
declare(strict_types=1);

namespace App\Core;

// ===== Sessão PHP =====
// Depois do login o servidor dá ao browser um cookie com um id aleatório
// (como uma pulseira de festival). Nos pedidos seguintes o browser mostra
// a pulseira e o PHP encontra os dados guardados: o id do utilizador.
// A password só é enviada uma vez, no login.
final class Session
{
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        session_name(Config::get('session.name', 'COURIERSESSID'));
        session_set_cookie_params([
            'lifetime' => 0,          // dura até fechar o browser
            'path'     => '/',
            'httponly' => true,       // o JavaScript não consegue ler o cookie (protege contra XSS)
            'samesite' => 'Lax',      // não é enviado em pedidos vindos de outros sites (CSRF)
            'secure'   => !empty($_SERVER['HTTPS']),
        ]);
        session_start();
    }

    public static function login(array $user): void
    {
        self::start();
        // Novo id de sessão no login: quem tivesse o id antigo fica sem acesso
        // (proteção contra "session fixation").
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
    }

    public static function userId(): ?int
    {
        self::start();
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    }

    public static function logout(): void
    {
        self::start();
        $_SESSION = [];
        // Apagar também o cookie no browser (data no passado).
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 3600,
            'path'     => $params['path'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_destroy();
    }
}
