// ===== Dados de teste (sample test data) =====
// Ainda não há base de dados (só no Sprint 2), por isso as contas de demonstração
// ficam aqui. O Login procura o email nesta lista e é a conta que diz qual é o role:
// o utilizador nunca escolhe o perfil.
// No Sprint 2 isto passa para a tabela User, com password_hash em vez da password.

const DEMO_USERS = [
    { email: 'client@demo.com',       password: 'Client123',  name: 'Ana Costa',     role: 'client',  username: 'acosta',   phone: '912345678', nif: '123456789' },
    { email: 'courier@demo.com',      password: 'Courier123', name: 'Rui Martins',   role: 'courier', username: 'rmartins', phone: '918765432', nif: '234567813', employeeNumber: 'CRR-1001' },
    { email: 'staff@demo.com',         password: 'Staff1234',  name: 'Marta Sousa',   role: 'staff',   username: 'msousa',   phone: '913456789', nif: '218765436', employeeNumber: 'STF-2001' },
    { email: 'admin@demo.com',         password: 'Admin1234',  name: 'Pedro Almeida', role: 'admin'   }
];

// Página de destino de cada role.
const ROLE_PAGES = {
    client: 'client.html',
    courier: 'courier.html',
    staff: 'staff.html',
    admin: 'admin.html'
};

// Domínio dos emails da empresa: quem se regista como staff tem de o usar.
// (As contas de demonstração usam todas @demo.com.)
const COMPANY_DOMAIN = '@couriercms.com';

// ===== Contas criadas no Register (simuladas) =====
// Sem base de dados, as contas novas ficam no localStorage com um estado:
//   active   = pode entrar (clientes, e couriers/staff depois de aprovados)
//   pending  = à espera de aprovação (courier: Staff; staff: Admin)
//   rejected = pedido recusado
// As contas de demonstração (DEMO_USERS) não têm estado: estão sempre ativas.
// No Sprint 2 isto passa para a tabela User (com password_hash, nunca a password).
const ACCOUNTS_KEY = 'couriercms_accounts';

function getAccounts() {
    try {
        const raw = localStorage.getItem(ACCOUNTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveAccounts(list) {
    try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
    } catch (e) { /* sem localStorage: a conta não fica guardada */ }
}

function addAccount(account) {
    const list = getAccounts();
    list.push(account);
    saveAccounts(list);
}

function setAccountStatus(email, status) {
    const wanted = String(email).toLowerCase();
    const list = getAccounts();
    list.forEach(function (account) {
        if (account.email === wanted) { account.status = status; }
    });
    saveAccounts(list);
}

function findUser(email) {
    const wanted = email.toLowerCase();
    return DEMO_USERS.find(function (user) {
        return user.email === wanted;
    }) || getAccounts().find(function (account) {
        return account.email === wanted;
    });
}

// ===== Sessão (simulada) =====
// Sem servidor, a sessão fica no localStorage do browser. No Sprint 2 passa a ser
// uma sessão PHP no servidor.
const SESSION_KEY = 'couriercms_session';

function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function setSession(user) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ email: user.email, name: user.name, role: user.role }));
    } catch (e) { /* sem localStorage: fica sem sessão guardada */ }
}

function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* nada a fazer */ }
}

// Páginas de cada role: sem sessão (ou com outro role) volta ao login.
function requireRole(role) {
    const session = getSession();
    if (!session || session.role !== role) {
        window.location.replace('login.html');
        return null;
    }
    return session;
}

// Qualquer ligação com data-logout termina a sessão.
document.querySelectorAll('[data-logout]').forEach(function (link) {
    link.addEventListener('click', clearSession);
});

// Páginas públicas: com sessão iniciada, "Login / Register" dá lugar a "Back to my area".
(function () {
    const session = getSession();
    const actions = document.querySelector('.nav-actions');
    if (!session || !actions || !ROLE_PAGES[session.role]) {
        return;
    }
    actions.innerHTML = '';

    const back = document.createElement('a');
    back.className = 'btn btn-primary';
    back.href = ROLE_PAGES[session.role];
    back.textContent = 'Back to my area';

    const out = document.createElement('a');
    out.className = 'btn btn-ghost';
    out.href = 'index.html';
    out.textContent = 'Log out';
    out.addEventListener('click', clearSession);

    actions.appendChild(back);
    actions.appendChild(out);

    const heroCta = document.getElementById('hero-cta');
    if (heroCta) {
        heroCta.href = ROLE_PAGES[session.role];
        heroCta.textContent = 'Back to my area';
    }
})();
