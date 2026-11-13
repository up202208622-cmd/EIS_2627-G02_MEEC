// ===== Admin page =====
// Sprint 1: tudo estático. Os dados abaixo são de teste; no Sprint 2 vêm da base de dados.
// Usa as funções comuns do validation.js (byId, validate, required, validEmail,
// isValidNif, showError, clearError, clearErrorsOnInput, *_RE) e os dados do users.js
// (DEMO_USERS, COMPANY_DOMAIN, findUser). Esses ficheiros não são alterados aqui.

requireRole('admin');   // sem sessão de admin volta ao login (users.js)

// ===== Dados de teste =====
const ADMIN_DATA = {
    kpis: [
        { label: 'Registered clients',   value: 312,  delta: '+18 this month' },
        { label: 'Active couriers',      value: 58,   delta: '+4 this month' },
        { label: 'Staff members',        value: 14,   delta: null }, // calculado com os pedidos pendentes
        { label: 'Completed deliveries', value: 1240, delta: '+96 this week' }
    ],
    // Encomendas por dia, do mais antigo (há 6 dias) até hoje
    ordersLast7Days: [42, 51, 38, 60, 57, 71, 64],
    // Estados da rota, os mesmos do enunciado
    routesToday: [
        { key: 'initiated', label: 'Initiated',   value: 6 },
        { key: 'progress',  label: 'In Progress', value: 12 },
        { key: 'completed', label: 'Completed',   value: 41 },
        { key: 'cancelled', label: 'Cancelled',   value: 3 }
    ],
    avgDeliveryMinutes: 32,
    // Categorias da entidade Vehicle_Type
    fleetByType: [
        { type: 'Bike',  value: 21 },
        { type: 'Moto',  value: 17 },
        { type: 'Van',   value: 14 },
        { type: 'Truck', value: 6 }
    ],
    // Pedidos feitos no Register com número STF-xxxx (ficam pendentes até o Admin aprovar)
    staffRequests: [
        { id: 1, name: 'Tiago Moreira', employee: 'STF-1021', email: 'tiago.moreira@couriercms.com', nif: '252601815', phone: '913482201', requested: '2026-11-06', status: 'pending' },
        { id: 2, name: 'Beatriz Lopes', employee: 'STF-1022', email: 'beatriz.lopes@couriercms.com', nif: '259083011', phone: '926118473', requested: '2026-11-05', status: 'pending' },
        { id: 3, name: 'Rui Fernandes', employee: 'STF-1023', email: 'rui.fernandes@couriercms.com', nif: '266131867', phone: '935007612', requested: '2026-11-04', status: 'pending' },
        { id: 4, name: 'Joana Pires',   employee: 'STF-1024', email: 'joana.pires@couriercms.com',   nif: '209139099', phone: '918774390', requested: '2026-11-02', status: 'pending' }
    ],
    // Dados do perfil que não estão no users.js
    adminExtra: { username: 'palmeida', phone: '912345678', nif: '296030821' }
};

// O Admin "com sessão iniciada" é a conta admin do users.js
const currentAdmin = DEMO_USERS.find(function (user) { return user.role === 'admin'; });

// ===== Utilitários =====
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function initials(name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ? parts[0][0] : '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
}

function formatDate(iso) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatEuros(value) {
    return value.toLocaleString('en-GB', { style: 'currency', currency: 'EUR' });
}

let toastTimer;
function showToast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2800);
}

function showStatus(element, message, type) {
    element.textContent = message;
    element.className = 'form-status ' + type;
}

// ===== Navegação entre secções (pelo # do endereço) =====
const ADMIN_SECTIONS = ['dashboard', 'approvals', 'rates', 'profile'];
const sideNav = byId('side-nav');
const sideToggle = byId('side-toggle');

function showSection() {
    const wanted = window.location.hash.replace('#', '');
    const current = ADMIN_SECTIONS.includes(wanted) ? wanted : 'dashboard';

    ADMIN_SECTIONS.forEach(function (id) {
        byId(id).hidden = (id !== current);
    });
    document.querySelectorAll('[data-section]').forEach(function (link) {
        const isActive = link.dataset.section === current;
        link.classList.toggle('active', isActive);
        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });

    // Em ecrãs pequenos, fecha o menu depois de escolher
    sideNav.classList.remove('open');
    sideToggle.setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
}

window.addEventListener('hashchange', showSection);

sideToggle.addEventListener('click', function () {
    const isOpen = sideNav.classList.toggle('open');
    sideToggle.setAttribute('aria-expanded', String(isOpen));
});

// ===== Dashboard =====
function pendingCount() {
    return ADMIN_DATA.staffRequests.filter(function (s) { return s.status === 'pending'; }).length;
}

function renderKpis() {
    const pending = pendingCount();
    byId('kpi-grid').innerHTML = ADMIN_DATA.kpis.map(function (k) {
        let delta = k.delta;
        let cls = 'kpi-delta';
        if (delta === null) {
            delta = pending === 0 ? 'No pending requests' : pending + ' awaiting approval';
            if (pending > 0) { cls += ' warn'; }
        }
        return '<li class="kpi">' +
            '<span class="kpi-label">' + escapeHtml(k.label) + '</span>' +
            '<span class="kpi-value">' + k.value.toLocaleString('en-GB') + '</span>' +
            '<span class="' + cls + '">' + escapeHtml(delta) + '</span>' +
            '</li>';
    }).join('');
}

function renderOrdersChart() {
    const values = ADMIN_DATA.ordersLast7Days;
    const max = Math.max.apply(null, values);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    for (let i = values.length - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(i === 0 ? 'Today' : weekdays[d.getDay()]);
    }

    byId('orders-chart').innerHTML = values.map(function (v, i) {
        const isToday = i === values.length - 1;
        return '<div class="bar-col">' +
            '<div class="bar' + (isToday ? ' is-today' : '') + '" style="height:' + (v / max * 100) + '%">' +
            '<span class="bar-value">' + v + '</span></div></div>';
    }).join('');

    const labels = document.createElement('div');
    labels.className = 'bar-labels';
    labels.setAttribute('aria-hidden', 'true');
    labels.innerHTML = days.map(function (d) { return '<span>' + d + '</span>'; }).join('');
    byId('orders-chart').after(labels);

    const total = values.reduce(function (a, b) { return a + b; }, 0);
    byId('week-total').textContent = total + ' orders';
}

function renderRoutes() {
    const routes = ADMIN_DATA.routesToday;
    const total = routes.reduce(function (a, r) { return a + r.value; }, 0);

    byId('routes-stack').innerHTML = routes.map(function (r) {
        return '<span class="s-' + r.key + '" style="width:' + (r.value / total * 100) + '%" title="' +
            escapeHtml(r.label) + ': ' + r.value + '"></span>';
    }).join('');

    byId('routes-legend').innerHTML = routes.map(function (r) {
        return '<li><i class="s-' + r.key + '"></i>' + escapeHtml(r.label) + '<strong>' + r.value + '</strong></li>';
    }).join('');

    byId('routes-total').textContent = total + ' routes';

    // Taxa de conclusão = concluídas / (concluídas + canceladas)
    const completed = routes.find(function (r) { return r.key === 'completed'; }).value;
    const cancelled = routes.find(function (r) { return r.key === 'cancelled'; }).value;
    const finished = completed + cancelled;
    byId('completion-rate').textContent = finished === 0 ? '–' : Math.round(completed / finished * 100) + '%';
    byId('avg-time').textContent = ADMIN_DATA.avgDeliveryMinutes + ' min';
}

function renderFleet() {
    const fleet = ADMIN_DATA.fleetByType;
    const max = Math.max.apply(null, fleet.map(function (f) { return f.value; }));
    const total = fleet.reduce(function (a, f) { return a + f.value; }, 0);

    byId('fleet-bars').innerHTML = fleet.map(function (f) {
        return '<li><span>' + escapeHtml(f.type) + '</span>' +
            '<div class="hbar-track"><div class="hbar-fill" style="width:' + (f.value / max * 100) + '%"></div></div>' +
            '<strong>' + f.value + '</strong></li>';
    }).join('');

    byId('fleet-total').textContent = total + ' vehicles';
}

function renderPendingPreview() {
    const pending = ADMIN_DATA.staffRequests.filter(function (s) { return s.status === 'pending'; });
    if (pending.length === 0) {
        byId('pending-preview').innerHTML = '<li class="empty">No pending requests.</li>';
        return;
    }
    byId('pending-preview').innerHTML = pending.slice(0, 4).map(function (s) {
        return '<li><span class="avatar" aria-hidden="true">' + escapeHtml(initials(s.name)) + '</span>' +
            '<div><strong>' + escapeHtml(s.name) + '</strong><span>' + escapeHtml(s.employee) +
            ' · ' + formatDate(s.requested) + '</span></div>' +
            '<span class="pill pill-pending">Pending</span></li>';
    }).join('');
}

// ===== Aprovação de staff =====
const STATUS_LABELS = {
    pending:  { text: 'Pending',  cls: 'pill-pending' },
    approved: { text: 'Approved', cls: 'pill-ok' },
    rejected: { text: 'Rejected', cls: 'pill-no' }
};

function renderStaffTable() {
    byId('staff-rows').innerHTML = ADMIN_DATA.staffRequests.map(function (s) {
        const st = STATUS_LABELS[s.status];
        const done = s.status !== 'pending';
        return '<tr data-id="' + s.id + '"' + (done ? ' class="is-done"' : '') + '>' +
            '<td><input type="checkbox" class="row-check" aria-label="Select ' + escapeHtml(s.name) + '"' + (done ? ' disabled' : '') + '></td>' +
            '<td><strong>' + escapeHtml(s.name) + '</strong><span class="cell-sub">' + escapeHtml(s.email) + '</span></td>' +
            '<td>' + escapeHtml(s.employee) + '</td>' +
            '<td>' + escapeHtml(s.nif) + '</td>' +
            '<td>' + escapeHtml(s.phone) + '</td>' +
            '<td>' + formatDate(s.requested) + '</td>' +
            '<td><span class="pill ' + st.cls + '">' + st.text + '</span></td>' +
            '<td><div class="row-actions">' +
            (done ? '' :
                '<button class="btn btn-primary btn-sm" type="button" data-action="approve">Approve</button>' +
                '<button class="btn btn-danger btn-sm" type="button" data-action="reject">Reject</button>') +
            '</div></td></tr>';
    }).join('');

    byId('no-pending').hidden = pendingCount() > 0;
    byId('select-all').checked = false;
    byId('select-all').disabled = pendingCount() === 0;
    updateSelection();
}

function updateBadge() {
    const n = pendingCount();
    const badge = byId('pending-badge');
    badge.textContent = n;
    badge.classList.toggle('is-zero', n === 0);
}

function refreshStaff() {
    renderStaffTable();
    renderPendingPreview();
    renderKpis();
    updateBadge();
}

function setRequestStatus(ids, status) {
    ADMIN_DATA.staffRequests.forEach(function (s) {
        if (ids.includes(s.id)) { s.status = status; }
    });
    refreshStaff();
}

function selectedIds() {
    return Array.from(document.querySelectorAll('.row-check:checked')).map(function (cb) {
        return Number(cb.closest('tr').dataset.id);
    });
}

function updateSelection() {
    const n = selectedIds().length;
    byId('selected-count').textContent = n + ' selected';
    byId('approve-selected').disabled = n === 0;
}

byId('staff-rows').addEventListener('click', function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) { return; }
    const id = Number(button.closest('tr').dataset.id);
    const person = ADMIN_DATA.staffRequests.find(function (s) { return s.id === id; });

    if (button.dataset.action === 'approve') {
        setRequestStatus([id], 'approved');
        showToast(person.name + ' was approved as staff.');
    } else {
        setRequestStatus([id], 'rejected');
        showToast(person.name + "'s request was rejected.");
    }
});

byId('staff-rows').addEventListener('change', function (event) {
    if (event.target.classList.contains('row-check')) { updateSelection(); }
});

byId('select-all').addEventListener('change', function () {
    const checked = this.checked;
    document.querySelectorAll('.row-check:not(:disabled)').forEach(function (cb) { cb.checked = checked; });
    updateSelection();
});

byId('approve-selected').addEventListener('click', function () {
    const ids = selectedIds();
    if (ids.length === 0) { return; }
    setRequestStatus(ids, 'approved');
    showToast(ids.length === 1 ? '1 request approved.' : ids.length + ' requests approved.');
});

// ===== Tarifas =====
const ratesForm = byId('rates-form');
const ratesStatus = byId('rates-status');

clearErrorsOnInput(ratesForm);

function positivePrice(value) {
    if (required(value)) { return required(value); }
    const n = Number(value);
    if (Number.isNaN(n)) { return 'Enter a valid number.'; }
    return n > 0 ? '' : 'The value must be greater than zero.';
}

// O preço noturno não pode ser mais baixo do que o diurno correspondente
function nightPrice(dayInputId) {
    return function (value) {
        const message = positivePrice(value);
        if (message) { return message; }
        return Number(value) < Number(byId(dayInputId).value) ? 'Night price cannot be lower than the day price.' : '';
    };
}

function updateSimulation() {
    const km = Math.max(0, Number(byId('sim-km').value) || 0);
    const day = (Number(byId('day-base').value) || 0) + km * (Number(byId('day-km').value) || 0);
    const night = (Number(byId('night-base').value) || 0) + km * (Number(byId('night-km').value) || 0);

    byId('sim-day').textContent = formatEuros(day);
    byId('sim-night').textContent = formatEuros(night);

    const start = byId('night-start').value || '--:--';
    const end = byId('night-end').value || '--:--';
    byId('sim-window').textContent = 'The night rate applies from ' + start + ' to ' + end + '.';
}

ratesForm.addEventListener('submit', function (event) {
    event.preventDefault();   // impede o envio "normal" do formulário
    showStatus(ratesStatus, '', '');

    const ok = validate([
        [byId('day-base'), positivePrice],
        [byId('day-km'), positivePrice],
        [byId('night-base'), nightPrice('day-base')],
        [byId('night-km'), nightPrice('day-km')],
        [byId('night-start'), required],
        [byId('night-end'), function (v) {
            return required(v) || (v === byId('night-start').value ? 'End time must differ from start time.' : '');
        }]
    ]);

    if (!ok) {
        showStatus(ratesStatus, 'Please fix the highlighted fields.', 'error');
        return;
    }

    // Simulação: no Sprint 2 as tarifas são guardadas na base de dados.
    showStatus(ratesStatus, 'Rates saved (until the page is reloaded, as there is no database yet).', 'success');
    showToast('Rates updated.');
});

ratesForm.addEventListener('reset', function () {
    // Espera que o browser reponha os valores antes de atualizar
    setTimeout(function () {
        ratesForm.querySelectorAll('input').forEach(clearError);
        showStatus(ratesStatus, '', '');
        updateSimulation();
    }, 0);
});

ratesForm.addEventListener('input', updateSimulation);
byId('sim-km').addEventListener('input', updateSimulation);

// ===== Perfil =====
const profileForm = byId('profile-form');
const profileStatus = byId('profile-status');

clearErrorsOnInput(profileForm);

function fillProfile() {
    byId('adm-name').value = currentAdmin.name;
    byId('adm-email').value = currentAdmin.email;
    byId('adm-username').value = ADMIN_DATA.adminExtra.username;
    byId('adm-phone').value = ADMIN_DATA.adminExtra.phone;
    byId('adm-nif').value = ADMIN_DATA.adminExtra.nif;
    byId('user-name').textContent = currentAdmin.name;
    byId('user-initials').textContent = initials(currentAdmin.name);
}

profileForm.addEventListener('submit', function (event) {
    event.preventDefault();   // impede o envio "normal" do formulário
    showStatus(profileStatus, '', '');

    const ok = validate([
        [byId('adm-name'), function (v) {
            return required(v) || (v.length < 3 ? 'Please write your full name.' : '');
        }],
        [byId('adm-username'), function (v) {
            return required(v) || (USERNAME_RE.test(v) ? '' : 'Use 3 to 20 letters, numbers, dot or _.');
        }],
        // Contas Admin usam sempre o email da empresa
        [byId('adm-email'), function (v) {
            return validEmail(v) ||
                (v.toLowerCase().endsWith(COMPANY_DOMAIN) ? '' : 'Admin accounts must use a ' + COMPANY_DOMAIN + ' email.');
        }],
        [byId('adm-phone'), function (v) {
            return required(v) || (PHONE_RE.test(v) ? '' : '9 digits, starting with 2 or 9.');
        }],
        [byId('adm-nif'), function (v) {
            return required(v) || (isValidNif(v) ? '' : 'Invalid NIF.');
        }],
        // A password é opcional: só se valida se for preenchida
        [byId('adm-password'), function (v) {
            if (v === '') { return ''; }
            if (v.length < 8) { return 'At least 8 characters.'; }
            if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) { return 'Use letters and numbers.'; }
            return '';
        }],
        [byId('adm-password2'), function (v) {
            const password = byId('adm-password').value.trim();
            if (password === '' && v === '') { return ''; }
            return required(v) || (v === password ? '' : 'Passwords do not match.');
        }]
    ]);

    if (!ok) {
        showStatus(profileStatus, 'Please fix the highlighted fields.', 'error');
        return;
    }

    const name = byId('adm-name').value.trim();
    byId('user-name').textContent = name;
    byId('user-initials').textContent = initials(name);
    byId('adm-password').value = '';
    byId('adm-password2').value = '';

    showStatus(profileStatus, 'Your details were updated.', 'success');
    showToast('Profile saved.');
});

// ===== Arranque =====
byId('today').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

fillProfile();
renderOrdersChart();
renderRoutes();
renderFleet();
refreshStaff();
updateSimulation();
showSection();
