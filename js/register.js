// ===== Register =====
// O utilizador não escolhe o role. Sem número de colaborador é Client;
// com número, o prefixo diz o role na empresa (CRR = Courier, STF = Staff).
// Contas Admin não se criam aqui: são criadas internamente pela empresa.

const registerForm = byId('register-form');
const registerStatus = byId('register-status');
const employeeCheck = byId('reg-is-employee');
const employeeFields = byId('employee-fields');
const employeeInput = byId('reg-employee');
const emailInput = byId('reg-email');
const rolePreview = byId('role-preview');

clearErrorsOnInput(registerForm);

// Prefixo do número de colaborador -> role
const EMPLOYEE_PREFIXES = {
    CRR: 'courier',
    STF: 'staff'
};
const EMPLOYEE_RE = /^(CRR|STF)-\d{4}$/;
const ROLE_NAMES = { client: 'Client', courier: 'Courier', staff: 'Staff' };

// Devolve o role que a conta vai ter, a partir do que está preenchido.
function detectRole() {
    if (!employeeCheck.checked) {
        return 'client';
    }
    const prefix = employeeInput.value.trim().toUpperCase().slice(0, 3);
    return EMPLOYEE_PREFIXES[prefix] || null;   // null = ainda não dá para saber
}

function updateRolePreview() {
    const role = detectRole();
    if (role === null) {
        rolePreview.innerHTML = 'Account type: <strong>enter a valid employee number</strong>';
    } else if (role === 'client') {
        rolePreview.innerHTML = 'Account type: <strong>Client</strong>';
    } else {
        rolePreview.innerHTML = 'Account type: <strong>' + ROLE_NAMES[role] +
                                '</strong> (needs approval by ' + (role === 'courier' ? 'Staff' : 'an Admin') +
                                ' before first login)';
    }
}

// Mostrar / esconder o campo do número de colaborador
employeeCheck.addEventListener('change', function () {
    employeeFields.hidden = !employeeCheck.checked;
    employeeCheck.setAttribute('aria-expanded', String(employeeCheck.checked));
    if (!employeeCheck.checked) {
        employeeInput.value = '';
        clearError(employeeInput);
    }
    updateRolePreview();
});

employeeInput.addEventListener('input', updateRolePreview);

// ===== Regras específicas do registo =====
function checkEmployeeNumber(value) {
    if (!employeeCheck.checked) {
        return '';   // clientes não precisam
    }
    const number = value.toUpperCase();
    if (number === '') {
        return 'Employee number is required for company members.';
    }
    if (number.startsWith('ADM')) {
        return 'Admin accounts are created internally, not through this form.';
    }
    if (!EMPLOYEE_RE.test(number)) {
        return 'Use the format CRR-1234 or STF-1234.';
    }
    // Credencial extra: staff tem de usar o email da empresa.
    if (number.startsWith('STF') && !emailInput.value.trim().toLowerCase().endsWith(COMPANY_DOMAIN)) {
        return 'Staff accounts must use a ' + COMPANY_DOMAIN + ' email.';
    }
    return '';
}

function checkNewEmail(value) {
    const message = validEmail(value);
    if (message) {
        return message;
    }
    if (findUser(value)) {
        return 'There is already an account with this email.';
    }
    return '';
}

// ===== Criar conta =====
registerForm.addEventListener('submit', function (event) {
    event.preventDefault();   // impede o envio "normal" do formulário
    registerStatus.textContent = '';

    const ok = validate([
        [byId('reg-name'), function (v) {
            return required(v) || (v.length < 3 ? 'Please write your full name.' : '');
        }],
        [byId('reg-username'), function (v) {
            return required(v) || (USERNAME_RE.test(v) ? '' : 'Use 3 to 20 letters, numbers, dot or _.');
        }],
        [emailInput, checkNewEmail],
        [byId('reg-phone'), function (v) {
            return required(v) || (PHONE_RE.test(v) ? '' : '9 digits, starting with 2 or 9.');
        }],
        [byId('reg-nif'), function (v) {
            return required(v) || (!/^\d{9}$/.test(v) ? 'The NIF must have exactly 9 digits.' : (isValidNif(v) ? '' : 'Invalid NIF. Check the number.'));
        }],
        [byId('reg-password'), function (v) {
            if (required(v)) { return required(v); }
            if (v.length < 8) { return 'At least 8 characters.'; }
            if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) { return 'Use letters and numbers.'; }
            return '';
        }],
        [byId('reg-password2'), function (v) {
            return required(v) || (v === byId('reg-password').value.trim() ? '' : 'Passwords do not match.');
        }],
        [employeeInput, checkEmployeeNumber]
    ]);

    if (!ok) {
        return;
    }

    // Simulação: no Sprint 2 a conta é guardada na base de dados.
    // Clientes ficam ativos logo; couriers e staff ficam pendentes de aprovação.
    const role = detectRole();
    const state = (role === 'client') ? 'active' : 'pending';

    addAccount({
        email: emailInput.value.trim().toLowerCase(),
        password: byId('reg-password').value,
        name: byId('reg-name').value.trim(),
        role: role,
        username: byId('reg-username').value.trim(),
        phone: byId('reg-phone').value.trim(),
        nif: byId('reg-nif').value.trim(),
        employeeNumber: role === 'client' ? '' : employeeInput.value.trim().toUpperCase(),
        requested: new Date().toISOString().slice(0, 10),
        status: state
    });

    registerStatus.textContent = 'Account created. Taking you to the login page...';
    registerStatus.className = 'form-status success';
    setTimeout(function () {
        window.location.href = 'login.html?registered=' + state;
    }, 1000);
});
