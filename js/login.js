// ===== Login =====
// Sem servidor: o email é procurado nos dados de teste (users.js)
// e é a conta encontrada que decide para que área vamos.

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
loginForm.addEventListener('submit', function (event) {
    event.preventDefault();   // impede o envio "normal" do formulário
    showStatus('', '');

    const ok = validate([
        [emailInput, validEmail],
        [passwordInput, required]
    ]);
    if (!ok) {
        return;
    }

    const user = findUser(emailInput.value.trim());

    // A mesma mensagem para email ou password errados:
    // assim não se revela que emails existem na plataforma.
    if (!user || user.password !== passwordInput.value) {
        showStatus('Invalid email or password.', 'error');
        passwordInput.value = '';
        passwordInput.focus();
        return;
    }

    setSession(user);
    showStatus('Welcome, ' + user.name + '. Opening your area...', 'success');
    setTimeout(function () {
        window.location.href = ROLE_PAGES[user.role];
    }, 800);
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
