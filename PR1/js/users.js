// ===== Utilizadores, sessão e ligação à API (partilhado por todas as páginas) =====
// Sprint 2: quem decide se tens sessão é o servidor (sessão PHP + tabela users).
// Este ficheiro tem:
//   1. apiRequest(): a função que todas as páginas usam para falar com a API
//   2. a sessão do lado do browser, que agora é só uma "cópia" do que o servidor diz
//   3. requireRole() e o logout, com os mesmos nomes do Sprint 1 (as páginas não mudam)
//   4. os dados de teste antigos, só enquanto os outros módulos não usam a API

// ===== 1. API =====
// As páginas estão na raiz do projeto e a API em /api. Se um dia as páginas
// passarem para /public (como diz o plano do Sprint 2), o caminho ajusta-se sozinho.
const API_BASE = window.location.pathname.indexOf('/public/') !== -1 ? '../api' : 'api';

// Erro devolvido pela API, já com o código HTTP e os erros por campo.
class ApiError extends Error {
    constructor(status, code, message, fields) {
        super(message);
        this.status = status;    // ex.: 401
        this.code = code;        // ex.: 'INVALID_CREDENTIALS'
        this.fields = fields;    // ex.: { email: 'There is already an account with this email.' }
    }
}

// Faz um pedido à API e devolve o JSON da resposta.
// Se a resposta for um erro (4xx/5xx), lança um ApiError com a mensagem do servidor.
//   const data = await apiRequest('POST', '/auth/login', { email: ..., password: ... });
async function apiRequest(method, path, body) {
    const options = {
        method: method,
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'   // envia o cookie da sessão PHP
    };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(API_BASE + path, options);
    } catch (networkError) {
        // O servidor nem respondeu (XAMPP desligado, página aberta como ficheiro, ...).
        throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Please try again.', {});
    }

    if (response.status === 204) {
        return null;   // correu bem, sem conteúdo (ex.: logout)
    }

    let data = null;
    try {
        data = await response.json();
    } catch (parseError) {
        // A resposta não era JSON (ex.: erro do Apache em HTML).
    }

    if (!response.ok) {
        const error = (data && data.error) || {};
        throw new ApiError(response.status, error.code || 'UNKNOWN_ERROR',
                           error.message || 'Unexpected error. Please try again.', error.fields || {});
    }
    return data;
}

// Mostra os erros por campo que vieram do servidor junto dos inputs certos
// (usa o showError() do validation.js).
// fieldIds liga o nome do campo na API ao id do input, ex.: { email: 'reg-email' }.
function showServerFieldErrors(fields, fieldIds) {
    let firstInput = null;
    Object.keys(fields || {}).forEach(function (name) {
        const input = fieldIds[name] ? byId(fieldIds[name]) : null;
        if (input) {
            showError(input, fields[name]);
            if (!firstInput) {
                firstInput = input;
            }
        }
    });
    if (firstInput) {
        firstInput.focus();
    }
    return firstInput !== null;
}

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

// ===== 2. Sessão do lado do browser =====
// A sessão verdadeira é a do PHP (cookie). Aqui guardamos só uma cópia do nome,
// email e role, para as páginas poderem mostrar o nome logo ao abrir.
// Não serve de segurança: mesmo que alguém a altere na consola, a API recusa
// tudo o que esse utilizador não pode fazer (middleware Auth no servidor).
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
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email, name: user.name, role: user.role }));
    } catch (e) { /* sem localStorage: fica sem cópia guardada */ }
}

function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* nada a fazer */ }
}

// ===== 3. Páginas de cada role =====
// Continua a devolver a sessão logo (as páginas do Sprint 1 contam com isso)
// e, em paralelo, pergunta ao servidor (GET /api/me) se a sessão ainda é válida.
function requireRole(role) {
    const session = getSession();
    if (!session || session.role !== role) {
        window.location.replace('login.html');
        return null;
    }
    checkServerSession(role);
    return session;
}

async function checkServerSession(role) {
    try {
        const data = await apiRequest('GET', '/me');
        if (data.user.role !== role) {
            window.location.replace(ROLE_PAGES[data.user.role] || 'login.html');
            return;
        }
        setSession(data.user);   // atualiza a cópia (ex.: nome mudado noutro PC)
    } catch (error) {
        if (error.status === 401) {
            // A sessão PHP acabou (ou nunca existiu): volta ao login.
            clearSession();
            window.location.replace('login.html');
        }
        // Sem servidor (NETWORK_ERROR) a página continua em modo demonstração.
    }
}

// Termina a sessão no servidor e no browser, e vai para a página indicada.
async function logout(destination) {
    try {
        await apiRequest('POST', '/auth/logout');
    } catch (error) {
        // Mesmo que o servidor não responda, apagamos a cópia local.
    }
    clearSession();
    window.location.href = destination || 'login.html';
}

// Qualquer ligação com data-logout termina a sessão.
document.querySelectorAll('[data-logout]').forEach(function (link) {
    link.addEventListener('click', function (event) {
        event.preventDefault();
        logout(link.getAttribute('href'));
    });
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
    out.addEventListener('click', function (event) {
        event.preventDefault();
        logout('index.html');
    });

    actions.appendChild(back);
    actions.appendChild(out);

    const heroCta = document.getElementById('hero-cta');
    if (heroCta) {
        heroCta.href = ROLE_PAGES[session.role];
        heroCta.textContent = 'Back to my area';
    }
})();

// ===== 4. Dados de teste do Sprint 1 (TEMPORÁRIO) =====
// O Login e o Register já não usam isto: as contas estão na tabela users.
// Ficam aqui só porque as páginas Client, Courier, Staff e Admin ainda os leem
// (findUser, DEMO_USERS, getAccounts). Cada módulo apaga o que deixar de usar
// quando passar a ler da API.
const DEMO_USERS = [
    { email: 'client@demo.com',       password: 'Client123',  name: 'Ana Costa',     role: 'client',  username: 'acosta',   phone: '912345678', nif: '123456789' },
    { email: 'courier@demo.com',      password: 'Courier123', name: 'Rui Martins',   role: 'courier', username: 'rmartins', phone: '918765432', nif: '234567813', employeeNumber: 'CRR-1001' },
    { email: 'staff@demo.com',         password: 'Staff1234',  name: 'Marta Sousa',   role: 'staff',   username: 'msousa',   phone: '913456789', nif: '218765436', employeeNumber: 'STF-2001' },
    { email: 'admin@demo.com',         password: 'Admin1234',  name: 'Pedro Almeida', role: 'admin'   }
];


// Contas do localStorage (o Register do Sprint 1 guardava-as aqui).
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
