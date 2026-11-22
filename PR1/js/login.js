// ===== Login =====
// Sprint 2: o email e a password vão para a API (POST /api/auth/login).
// É o servidor que verifica a password (password_verify), vê se a conta está
// ativa e abre a sessão PHP. A conta que ele devolve decide para que área vamos.

const loginForm = byId('login-form');
const loginStatus = byId('login-status');
const emailInput = byId('login-email');
const passwordInput = byId('login-password');

clearErrorsOnInput(loginForm);

// ===== Mensagem depois do registo =====
// O Register redireciona para login.html?registered=active ou ?registered=pending.
const registered = new URLSearchParams(window.location.search).get('registered');
const registeredAlert = byId('registered-alert');

if (registered === 'active') {
    registeredAlert.textContent = 'Account created. You can now sign in.';
    registeredAlert.hidden = false;
} else if (registered === 'pending') {
    registeredAlert.textContent = 'Registration sent. Your account will be active once it is approved.';
    registeredAlert.hidden = false;
}

function showStatus(message, type) {
    loginStatus.textContent = message;
    loginStatus.className = 'form-status ' + type;
}

// ===== Entrar =====
const loginButton = loginForm.querySelector('button[type="submit"]');

// "async" deixa usar "await": o código espera pela resposta do servidor
// sem bloquear a página.
loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();   // impede o envio "normal" do formulário
    showStatus('', '');

    // A validação em JS continua: evita ir ao servidor com dados que já sabemos que estão errados.
    const ok = validate([
        [emailInput, validEmail],
        [passwordInput, required]
    ]);
    if (!ok) {
        return;
    }

    loginButton.disabled = true;   // evita dois cliques = dois pedidos
    showStatus('Signing in...', '');

    try {
        const data = await apiRequest('POST', '/auth/login', {
            email: emailInput.value.trim(),
            password: passwordInput.value
        });

        setSession(data.user);   // cópia local do nome e role (users.js)
        showStatus('Welcome, ' + data.user.name + '. Opening your area...', 'success');
        setTimeout(function () {
            window.location.href = ROLE_PAGES[data.user.role];
        }, 800);
    } catch (error) {
        // 401 = email ou password errados (a mesma mensagem nos dois casos,
        //       assim não se revela que emails existem na plataforma)
        // 403 = conta pendente de aprovação ou recusada
        // A mensagem certa vem sempre do servidor.
        showStatus(error.message, 'error');
        if (error.status === 401) {
            passwordInput.value = '';
            passwordInput.focus();
        }
        loginButton.disabled = false;
    }
});

// ===== Forgot password (simulado) =====
byId('forgot-link').addEventListener('click', function (event) {
    event.preventDefault();

    // Para recuperar a password precisamos de saber o email.
    const ok = validate([[emailInput, validEmail]]);
    if (!ok) {
        showStatus('Type your email above first.', 'error');
        return;
    }
    showStatus('If an account exists for ' + emailInput.value.trim() +
               ', we sent a link to reset the password.', 'success');
});
