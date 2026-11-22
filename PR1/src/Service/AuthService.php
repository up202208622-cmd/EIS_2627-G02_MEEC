<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\ApiException;
use App\Core\Session;
use App\Core\Validator;
use App\Repository\UserRepository;

// ===== Lógica de negócio da autenticação =====
// Aqui ficam as REGRAS: quem pode registar-se, que papel fica com,
// quando a conta está pendente, como se verifica a password.
// Não há SQL (isso é do UserRepository) nem HTTP (isso é do AuthController).
final class AuthService
{
    // Prefixo do nº de colaborador -> papel (a mesma regra do register.js do Sprint 1).
    public const EMPLOYEE_PREFIXES = ['CRR' => 'courier', 'STF' => 'staff'];
    public const COMPANY_DOMAIN = '@couriercms.com';

    // Mesmas regras do validation.js.
    private const USERNAME_RE = '/^[A-Za-z0-9._]{3,20}$/';
    private const PHONE_RE = '/^[29]\d{8}$/';
    private const EMPLOYEE_RE = '/^(CRR|STF)-\d{4}$/';

    // Mensagem para cada campo único que já está a ser usado por outra conta.
    private const TAKEN_MESSAGES = [
        'email'           => 'There is already an account with this email.',
        'username'        => 'This username is already taken.',
        'nif'             => 'There is already an account with this NIF.',
        'employee_number' => 'This employee number is already registered.',
    ];

    public function __construct(private readonly UserRepository $users = new UserRepository())
    {
    }

    // ----- Registo -----
    // O utilizador NUNCA escolhe o papel: mesmo que mande "role": "admin" no JSON,
    // esse campo é ignorado. O papel sai só do número de colaborador.
    public function register(array $data): array
    {
        $v = new Validator($data);
        $v->required('name')->minLength('name', 3, 'Please write your full name.')->maxLength('name', 100);
        $v->required('username')->pattern('username', self::USERNAME_RE, 'Use 3 to 20 letters, numbers, dot or _.');
        $v->required('email')->email('email')->maxLength('email', 120);
        $v->required('phone')->pattern('phone', self::PHONE_RE, '9 digits, starting with 2 or 9.');
        $v->required('nif')->nif('nif');
        $v->required('password')
          ->minLength('password', 8, 'At least 8 characters.')
          ->pattern('password', '/^(?=.*[A-Za-z])(?=.*\d)/', 'Use letters and numbers.');

        // Confirmação da password: se vier, tem de ser igual.
        if (isset($data['password2'])) {
            $v->rule('password2', $v->value('password2') === $v->value('password'), 'Passwords do not match.');
        }

        $email = strtolower($v->value('email'));
        $employeeNumber = strtoupper($v->value('employee_number'));
        $role = 'client';

        if ($employeeNumber !== '') {
            if (str_starts_with($employeeNumber, 'ADM')) {
                $v->rule('employee_number', false, 'Admin accounts are created internally, not through this form.');
            } elseif (!preg_match(self::EMPLOYEE_RE, $employeeNumber)) {
                $v->rule('employee_number', false, 'Use the format CRR-1234 or STF-1234.');
            } else {
                $role = self::EMPLOYEE_PREFIXES[substr($employeeNumber, 0, 3)];
                // Staff tem de usar o email da empresa (credencial extra).
                if ($role === 'staff' && !str_ends_with($email, self::COMPANY_DOMAIN)) {
                    $v->rule('email', false, 'Staff accounts must use a ' . self::COMPANY_DOMAIN . ' email.');
                }
            }
        }
        $v->check();   // 422 se alguma regra falhou

        $user = [
            'name'            => $v->value('name'),
            'username'        => $v->value('username'),
            'email'           => $email,
            'phone'           => $v->value('phone'),
            'nif'             => $v->value('nif'),
            'employee_number' => $employeeNumber === '' ? null : $employeeNumber,
            'role'            => $role,
            // Clientes ficam ativos logo; estafetas e staff esperam aprovação (módulo do Miguel).
            'status'          => $role === 'client' ? 'active' : 'pending',
            // Nunca guardamos a password: só o hash (bcrypt, com "sal" aleatório incluído).
            'password_hash'   => password_hash($v->value('password'), PASSWORD_DEFAULT),
        ];

        $taken = $this->users->takenFields($user);
        if ($taken !== []) {
            throw ApiException::conflict('Some details are already in use.', 'ACCOUNT_EXISTS',
                array_intersect_key(self::TAKEN_MESSAGES, array_flip($taken)));
        }

        $id = $this->users->create($user);
        return $this->users->findById($id);
    }

    // ----- Login -----
    public function login(string $email, string $password): array
    {
        $v = new Validator(['email' => $email, 'password' => $password]);
        $v->required('email')->email('email')->required('password');
        $v->check();

        $user = $this->users->findByEmailWithPassword(strtolower(trim($email)));

        // Se o email não existe, verificamos na mesma contra um hash "falso".
        // Assim a resposta demora o mesmo tempo nos dois casos e ninguém descobre
        // que emails estão registados pelo tempo de resposta.
        $hash = $user['password_hash'] ?? '$2y$10$Cmz54Wq70wy0ctJlZwiUN./BzkS/1fTYXN.nPLwhMUBiXtVzc5a/u';
        $passwordOk = password_verify($password, $hash);

        // A mesma mensagem para email ou password errados (como no Sprint 1).
        if ($user === null || !$passwordOk) {
            throw ApiException::unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
        }

        // Estafetas são aprovados pelo Staff; staff é aprovado por um Admin.
        if ($user['status'] === 'pending') {
            $approver = $user['role'] === 'courier' ? 'Staff' : 'an Admin';
            throw ApiException::forbidden(
                "Your account is waiting for approval by {$approver}. You can sign in once it is approved.",
                'ACCOUNT_PENDING'
            );
        }
        if ($user['status'] !== 'active') {
            throw ApiException::forbidden('Your registration was not approved. Please contact CourierCMS.', 'ACCOUNT_REJECTED');
        }

        // Se um dia o PHP mudar o algoritmo por defeito, o hash é atualizado aqui.
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $this->users->updatePasswordHash((int) $user['id'], password_hash($password, PASSWORD_DEFAULT));
        }

        Session::login($user);
        unset($user['password_hash']);
        return $user;
    }

    public function logout(): void
    {
        Session::logout();
    }

    // ----- Perfil -----
    // Pode mudar nome, username, email, telefone e NIF (com as mesmas regras do registo).
    // Papel, estado e nº de colaborador não se mudam aqui.
    // Para mudar a password tem de dar a atual: se alguém deixar a sessão aberta
    // num PC, quem lá chegar não consegue trocar a password e ficar com a conta.
    public function updateProfile(array $user, array $data): array
    {
        $id = (int) $user['id'];

        $v = new Validator($data);
        $v->required('name')->minLength('name', 3, 'Please write your full name.')->maxLength('name', 100);
        $v->required('username')->pattern('username', self::USERNAME_RE, 'Use 3 to 20 letters, numbers, dot or _.');
        $v->required('email')->email('email')->maxLength('email', 120);
        $v->required('phone')->pattern('phone', self::PHONE_RE, '9 digits, starting with 2 or 9.');
        $v->required('nif')->nif('nif');

        $newPassword = (string) ($data['new_password'] ?? '');
        if ($newPassword !== '') {
            $v->minLength('new_password', 8, 'At least 8 characters.')
              ->pattern('new_password', '/^(?=.*[A-Za-z])(?=.*\d)/', 'Use letters and numbers.');
            if (isset($data['new_password2'])) {
                $v->rule('new_password2', $v->value('new_password2') === $newPassword, 'Passwords do not match.');
            }
            $v->required('current_password', 'Type your current password to change it.');
            if (!$v->hasError('current_password')) {
                $currentHash = $this->users->findPasswordHash($id) ?? '';
                $v->rule('current_password', password_verify((string) $data['current_password'], $currentHash),
                    'Current password is wrong.');
            }
        }
        $v->check();

        $profile = [
            'name'     => $v->value('name'),
            'username' => $v->value('username'),
            'email'    => strtolower($v->value('email')),
            'phone'    => $v->value('phone'),
            'nif'      => $v->value('nif'),
        ];

        $taken = $this->users->takenFields($profile, $id);
        if ($taken !== []) {
            throw ApiException::conflict('Some details are already in use.', 'ACCOUNT_EXISTS',
                array_intersect_key(self::TAKEN_MESSAGES, array_flip($taken)));
        }

        $this->users->updateProfile($id, $profile);
        if ($newPassword !== '') {
            $this->users->updatePasswordHash($id, password_hash($newPassword, PASSWORD_DEFAULT));
        }
        return $this->users->findById($id);
    }
}
