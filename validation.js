// ===== Funções de validação comuns =====
// Usadas pelo Login, pelo Register e pelo "Track order" da Home.
// Ficam num ficheiro à parte para não repetir o mesmo código em cada página.

function byId(id) {
    return document.getElementById(id);
}

// Cada campo tem um <p id="<id do campo>-error"> logo a seguir, onde aparece a mensagem.
function showError(input, message) {
    byId(input.id + '-error').textContent = message;
    input.setAttribute('aria-invalid', 'true');   // leitores de ecrã anunciam o campo como inválido
}

function clearError(input) {
    byId(input.id + '-error').textContent = '';
    input.removeAttribute('aria-invalid');
}

// Assim que o utilizador volta a escrever, o erro desse campo desaparece.
function clearErrorsOnInput(form) {
    form.querySelectorAll('input, select').forEach(function (input) {
        input.addEventListener('input', function () {
            if (byId(input.id + '-error')) {
                clearError(input);
            }
        });
    });
}

// ===== Regras =====
// Cada regra recebe o valor e devolve '' se estiver bem, ou a mensagem de erro.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;   // algo@algo.algo
const USERNAME_RE = /^[A-Za-z0-9._]{3,20}$/;
const PHONE_RE = /^[29]\d{8}$/;                  // 9 dígitos, fixo (2...) ou móvel (9...)

function required(value) {
    return value === '' ? 'This field is required.' : '';
}

function validEmail(value) {
    return required(value) || (EMAIL_RE.test(value) ? '' : 'Invalid email (e.g. name@domain.com).');
}

// O NIF português tem 9 dígitos e o último é um dígito de controlo,
// calculado a partir dos outros 8 (algoritmo módulo 11).
function isValidNif(nif) {
    if (!/^\d{9}$/.test(nif)) {
        return false;
    }
    let sum = 0;
    for (let i = 0; i < 8; i++) {
        sum += Number(nif[i]) * (9 - i);
    }
    const rest = sum % 11;
    const check = rest < 2 ? 0 : 11 - rest;
    return check === Number(nif[8]);
}

// Corre uma lista de [campo, regra] e devolve true se não houver erros.
// Põe o cursor no primeiro campo errado, para o utilizador saber por onde começar.
function validate(checks) {
    let firstInvalid = null;

    checks.forEach(function (check) {
        const input = check[0];
        const message = check[1](input.value.trim());
        if (message) {
            showError(input, message);
            if (!firstInvalid) {
                firstInvalid = input;
            }
        } else {
            clearError(input);
        }
    });

    if (firstInvalid) {
        firstInvalid.focus();
        return false;
    }
    return true;
}

// Botões "Show/Hide" dos campos de password: trocam o type entre password e text.
document.querySelectorAll('[data-toggle-password]').forEach(function (button) {
    const input = byId(button.dataset.togglePassword);
    button.addEventListener('click', function () {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.textContent = show ? 'Hide' : 'Show';
        button.setAttribute('aria-pressed', String(show));
    });
});
