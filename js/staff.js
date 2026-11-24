// ===== Staff page (Sprint 2) =====
// Veículos, alertas dos certificados, contas de estafeta e fila de despacho (WP3)
// vêm da API do módulo do Miguel (/api/staff/...), com o apiRequest() do users.js.
// "Orders and routes" e "Proof of delivery" ainda usam os dados de exemplo do Sprint 1
// (staff-orders.js) até haver a API das encomendas, das rotas e da e-POD.
//
// Requisitos (Docs/Requirements.xlsx): RF-26/27/28 veículos · RF-37 alertas e certificados novos
// RF-38 tirar de serviço · RF-39 contas de estafeta · WP3 fila de despacho
// Usa do validation.js: byId, validate, required, clearError, clearErrorsOnInput.

// A página só abre com sessão de staff (senão vai para o login). O admin também pode ver a fila e os veículos.
const session = requireRole('staff') || { name: 'Staff', role: 'staff' };

const APPROVAL_LABEL = { pending: 'Pending', approved: 'Approved', disapproved: 'Disapproved' };
const APPROVAL_PILL = { pending: 'pill-pending', approved: 'pill-ok', disapproved: 'pill-no' };
const ACCOUNT_LABEL = { pending: 'Pending', active: 'Active', rejected: 'Rejected' };
const ACCOUNT_PILL = { pending: 'pill-pending', active: 'pill-ok', rejected: 'pill-no' };
const QUEUE_LABEL = { offered: 'Offer sent', waiting: 'Waiting', no_courier: 'No courier available' };
const QUEUE_PILL = { offered: 'pill-ok', waiting: 'pill-plain', no_courier: 'pill-no' };
const ANSWER_LABEL = { accepted: 'Accepted', declined: 'Refused', expired: 'No answer (60 s)' };
const ANSWER_PILL = { accepted: 'pill-ok', declined: 'pill-no', expired: 'pill-pending' };

// Motivos para recusar um veículo (a API pede 3 a 255 caracteres)
const VEHICLE_REASONS = [
    'Expired insurance or inspection',
    'Documents not renewed in time',
    'Certificate is unreadable or incomplete',
    'Vehicle data does not match the documents'
];

const DISPATCH_REFRESH_MS = 5000;

// ===== Utilitários =====
let toastTimer;
function showToast(message, isError) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3500);
}

function initials(name) {
    const parts = String(name).trim().split(/\s+/);
    const first = parts[0] ? parts[0][0] : '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
}

function setUserName(name) {
    byId('user-name').textContent = name;
    byId('user-initials').textContent = initials(name);
}

function pill(cls, text) {
    return '<span class="pill ' + cls + '">' + fleetEscape(text) + '</span>';
}

/** Uma linha só na tabela: "Loading…" ou o erro. */
function messageRow(tbodyId, columns, text, isError) {
    byId(tbodyId).innerHTML = '<tr><td colspan="' + columns + '" class="' + (isError ? 'load-error' : 'loading') + '">' +
        fleetEscape(text) + '</td></tr>';
}

function setBadge(id, value) {
    const badge = byId(id);
    badge.textContent = value;
    badge.classList.toggle('is-zero', value === 0);
}

/** Desativa o botão enquanto o pedido decorre (sem cliques duplos) e mostra o erro, se houver. */
async function withButton(button, action) {
    button.disabled = true;
    try {
        await action();
    } catch (error) {
        showToast(error.message, true);
    } finally {
        button.disabled = false;
    }
}

// =====================================================
// ===== Navegação entre secções (pelo # do endereço)
// =====================================================
const STAFF_SECTIONS = ['vehicles', 'couriers', 'dispatch', 'routes', 'epod', 'profile'];
const sideNav = byId('side-nav');
const sideToggle = byId('side-toggle');
let currentSection = null;

const SECTION_LOADERS = {
    vehicles: function () { loadVehicles(); loadSummary(); },
    couriers: function () { loadCouriers(); },
    dispatch: function () { loadDispatch(); }
};

function showSection() {
    const wanted = window.location.hash.replace('#', '');

    // O "Skip to content" muda o # para #main: aí fica-se na secção atual
    if (!STAFF_SECTIONS.includes(wanted) && currentSection !== null) {
        return;
    }
    currentSection = STAFF_SECTIONS.includes(wanted) ? wanted : 'vehicles';

    STAFF_SECTIONS.forEach(function (id) {
        byId(id).hidden = (id !== currentSection);
    });
    document.querySelectorAll('[data-section]').forEach(function (link) {
        const isActive = link.dataset.section === currentSection;
        link.classList.toggle('active', isActive);
        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });

    sideNav.classList.remove('open');
    sideToggle.setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);

    if (SECTION_LOADERS[currentSection]) {
        SECTION_LOADERS[currentSection]();
    }
    // A fila só se atualiza sozinha enquanto está aberta
    if (currentSection === 'dispatch') {
        startDispatchRefresh();
    } else {
        stopDispatchRefresh();
    }
    // O mapa das rotas (staff-orders.js) precisa de saber quando a secção fica visível
    if (currentSection === 'routes' && typeof window.onRoutesSectionShown === 'function') {
        window.onRoutesSectionShown();
    }
}

window.addEventListener('hashchange', showSection);

sideToggle.addEventListener('click', function () {
    const isOpen = sideNav.classList.toggle('open');
    sideToggle.setAttribute('aria-expanded', String(isOpen));
});

// =====================================================
// ===== Resumo e alertas (GET /api/staff/alerts) – RF-37
// =====================================================
let alertsCache = [];

async function loadSummary() {
    let data;
    try {
        data = await apiRequest('GET', '/staff/alerts');
    } catch (error) {
        byId('kpi-grid').innerHTML = '<li class="kpi load-error">' + fleetEscape(error.message) + '</li>';
        return;
    }
    const s = data.summary;

    const kpis = [
        { label: 'Vehicles to approve', value: s.pending_vehicles, note: s.pending_vehicles ? 'Waiting for you' : 'Nothing to review', cls: s.pending_vehicles ? 'is-warn' : '' },
        { label: 'New certificates', value: s.unchecked_documents, note: s.unchecked_documents ? 'To check' : 'All checked', cls: s.unchecked_documents ? 'is-warn' : '' },
        { label: 'Expired documents', value: s.expired, note: s.expired ? 'Vehicles out of service' : 'None', cls: s.expired ? 'is-danger' : '' },
        { label: 'Expiring soon', value: s.expiring, note: 'In the next 3 days', cls: s.expiring ? 'is-warn' : '' }
    ];
    byId('kpi-grid').innerHTML = kpis.map(function (k) {
        return '<li class="kpi ' + k.cls + '">' +
            '<span class="kpi-label">' + k.label + '</span>' +
            '<span class="kpi-value">' + k.value + '</span>' +
            '<span class="kpi-note">' + fleetEscape(k.note) + '</span>' +
            '</li>';
    }).join('');

    setBadge('badge-vehicles', s.pending_vehicles + s.unchecked_documents);
    setBadge('badge-couriers', s.pending_couriers);
    alertsCache = data.alerts;
    renderAlerts();
}

function fileLink(vehicleId, type, label) {
    return '<a href="' + fleetFileUrl('/vehicles/' + vehicleId + '/documents/' + type) + '" target="_blank" rel="noopener">' + label + '</a>';
}

function renderAlerts() {
    byId('doc-alerts').innerHTML = alertsCache.map(function (a) {
        const who = '<strong>' + fleetEscape(a.vehicle.license_plate) + '</strong> · ' + fleetEscape(a.vehicle.model) +
            ' (' + fleetEscape(a.courier.name) + '): ';

        if (a.kind === 'updated') {
            return '<li class="alert-item is-updated">' +
                '<p>' + who + 'new certificate uploaded on ' + fleetDateTime(a.uploaded_at) +
                '. Insurance valid until ' + fleetDate(a.insurance_expiry_date) + ' (' + fileLink(a.vehicle.id, 'insurance', 'view') + '), ' +
                'inspection until ' + fleetDate(a.inspection_expiry_date) + ' (' + fileLink(a.vehicle.id, 'inspection', 'view') + '). ' +
                'Check the document.</p>' +
                '<button class="btn btn-primary btn-sm" type="button" data-checked="' + a.vehicle.id + '">Mark as checked</button>' +
                '</li>';
        }
        const what = FLEET_DOC_LABEL[a.doc_type].toLowerCase() + ' ' + (a.kind === 'expired'
            ? 'expired on ' + fleetDate(a.expiry_date) + '. The vehicle cannot be used until it is renewed.'
            : fleetDocText(a).toLowerCase() + ' (' + fleetDate(a.expiry_date) + ').');
        // RF-38: um veículo com o certificado expirado pode ser tirado de serviço
        const action = a.kind === 'expired'
            ? '<button class="btn btn-danger btn-sm" type="button" data-disapprove-vehicle="' + a.vehicle.id + '">Disapprove</button>'
            : '';
        return '<li class="alert-item is-' + a.kind + '"><p>' + who + what + '</p>' + action + '</li>';
    }).join('');
    byId('no-alerts').hidden = alertsCache.length > 0;
    byId('alerts-note').textContent = alertsCache.length === 1 ? '1 alert' : alertsCache.length + ' alerts';
}

byId('doc-alerts').addEventListener('click', function (event) {
    const checked = event.target.closest('[data-checked]');
    const disapprove = event.target.closest('[data-disapprove-vehicle]');
    if (checked) {
        withButton(checked, async function () {
            const data = await apiRequest('POST', '/staff/vehicles/' + checked.dataset.checked + '/documents-checked');
            showToast('New certificate of ' + data.vehicle.license_plate + ' checked.');
            await Promise.all([loadSummary(), loadVehicles()]);
        });
    } else if (disapprove) {
        const alert = alertsCache.find(function (a) { return a.vehicle.id === Number(disapprove.dataset.disapproveVehicle); });
        openDisapprove({ id: alert.vehicle.id, model: alert.vehicle.model, license_plate: alert.vehicle.license_plate,
                         courier: alert.courier, expired: true });
    }
});

// =====================================================
// ===== Veículos (GET /api/staff/vehicles) – RF-26, RF-27, RF-28, RF-38
// =====================================================
let vehicles = [];
let vehicleFilter = 'pending';

async function loadVehicles() {
    try {
        vehicles = (await apiRequest('GET', '/staff/vehicles?status=all')).vehicles;
    } catch (error) {
        messageRow('vehicle-rows', 7, 'Could not load the vehicles: ' + error.message, true);
        return;
    }
    renderVehicles();
}

function hasExpiredDoc(v) {
    return v.documents.insurance.state === 'expired' || v.documents.inspection.state === 'expired';
}

function docCell(v, type) {
    const doc = v.documents[type];
    return '<td class="doc-' + doc.state + '">' +
        '<span class="doc-date">' + fleetDate(doc.expiry_date) + '</span>' +
        '<span class="doc-state">' + fleetDocText(doc) + '</span>' +
        (doc.has_file ? '<a class="doc-link" href="' + fleetFileUrl(doc.file_url) + '" target="_blank" rel="noopener">View file</a>' : '') +
        '</td>';
}

function vehicleActions(v) {
    // Pendente: aprovar (se nada expirou) ou recusar
    if (v.approval_status === 'pending') {
        const expired = hasExpiredDoc(v);
        return '<div class="row-actions">' +
            '<button class="btn btn-primary btn-sm" type="button" data-approve-vehicle="' + v.id + '"' + (expired ? ' disabled' : '') + '>Approve</button>' +
            '<button class="btn btn-danger btn-sm" type="button" data-disapprove-vehicle="' + v.id + '">Disapprove</button>' +
            '</div>' + (expired ? '<span class="row-note">Expired document: cannot approve</span>' : '');
    }
    // Aprovado com um certificado expirado: pode ser tirado de serviço (RF-38)
    if (v.approval_status === 'approved' && hasExpiredDoc(v)) {
        return '<div class="row-actions"><button class="btn btn-danger btn-sm" type="button" data-disapprove-vehicle="' + v.id + '">Disapprove</button></div>';
    }
    return '';
}

function renderVehicles() {
    ['pending', 'approved', 'disapproved'].forEach(function (status) {
        byId('vcount-' + status).textContent = vehicles.filter(function (v) { return v.approval_status === status; }).length;
    });
    byId('vcount-all').textContent = vehicles.length;

    const list = vehicles.filter(function (v) { return vehicleFilter === 'all' || v.approval_status === vehicleFilter; });
    byId('vehicle-rows').innerHTML = list.map(function (v) {
        const toCheck = v.approval_status === 'approved' && !v.doc_checked
            ? '<span class="cell-sub txt-info">New certificate to check</span>' : '';
        return '<tr>' +
            '<td><strong class="nowrap">' + fleetEscape(v.model) + '</strong>' +
                '<span class="cell-sub">' + fleetEscape(v.license_plate) + ' · ' + fleetEscape(v.vehicle_type.name) + '</span></td>' +
            '<td class="nowrap">' + fleetEscape(v.courier.name) +
                '<span class="cell-sub">' + fleetEscape(v.courier.employee_number || '') + '</span></td>' +
            '<td class="nowrap">' + v.vehicle_type.max_weight_kg + ' kg<span class="cell-sub">' + v.vehicle_type.max_vol_m3 + ' m³</span></td>' +
            docCell(v, 'insurance') +
            docCell(v, 'inspection') +
            '<td>' + pill(APPROVAL_PILL[v.approval_status], APPROVAL_LABEL[v.approval_status]) +
                '<span class="cell-sub nowrap">Sent ' + fleetDate(v.created_at) + '</span>' +
                (v.disapproval_reason ? '<span class="cell-sub">' + fleetEscape(v.disapproval_reason) + '</span>' : '') +
                toCheck +
            '</td>' +
            '<td>' + vehicleActions(v) + '</td>' +
            '</tr>';
    }).join('');
    byId('no-vehicles').hidden = list.length > 0;
}

document.querySelectorAll('[data-vehicle-filter]').forEach(function (tab) {
    tab.addEventListener('click', function () {
        vehicleFilter = tab.dataset.vehicleFilter;
        document.querySelectorAll('[data-vehicle-filter]').forEach(function (t) {
            t.setAttribute('aria-pressed', String(t === tab));
        });
        renderVehicles();
    });
});

byId('vehicle-rows').addEventListener('click', function (event) {
    const approve = event.target.closest('[data-approve-vehicle]');
    const disapprove = event.target.closest('[data-disapprove-vehicle]');

    if (approve) {
        withButton(approve, async function () {
            const v = (await apiRequest('POST', '/staff/vehicles/' + approve.dataset.approveVehicle + '/approve')).vehicle;
            showToast(v.license_plate + ' approved. ' + v.courier.name + ' can now use it.');
            await Promise.all([loadVehicles(), loadSummary()]);
        });
    } else if (disapprove) {
        const v = vehicles.find(function (x) { return x.id === Number(disapprove.dataset.disapproveVehicle); });
        openDisapprove({ id: v.id, model: v.model, license_plate: v.license_plate, courier: v.courier, expired: hasExpiredDoc(v) });
    }
});

function openDisapprove(v) {
    openReasonDialog({
        title: 'Disapprove vehicle',
        subject: v.model + ' · ' + v.license_plate + ' · ' + v.courier.name,
        reasons: VEHICLE_REASONS,
        suggested: v.expired ? VEHICLE_REASONS[0] : '',
        button: 'Disapprove',
        send: async function (reason) {
            await apiRequest('POST', '/staff/vehicles/' + v.id + '/disapprove', { reason: reason });
            showToast(v.license_plate + ' disapproved. ' + v.courier.name + ' can upload new certificates.');
            await Promise.all([loadVehicles(), loadSummary()]);
        }
    });
}

// =====================================================
// ===== Contas de estafeta (GET /api/staff/accounts) – RF-39
// =====================================================
let couriers = [];
let accountFilter = 'pending';

async function loadCouriers() {
    try {
        couriers = (await apiRequest('GET', '/staff/accounts?role=courier&status=all')).accounts;
    } catch (error) {
        messageRow('courier-rows', 7, 'Could not load the accounts: ' + error.message, true);
        return;
    }
    renderCouriers();
}

function renderCouriers() {
    ['pending', 'active', 'rejected'].forEach(function (status) {
        byId('acount-' + status).textContent = couriers.filter(function (c) { return c.status === status; }).length;
    });
    setBadge('badge-couriers', couriers.filter(function (c) { return c.status === 'pending'; }).length);

    const list = couriers.filter(function (c) { return c.status === accountFilter; });
    byId('courier-rows').innerHTML = list.map(function (c) {
        const actions = c.status !== 'pending' ? '' :
            '<div class="row-actions">' +
            '<button class="btn btn-primary btn-sm" type="button" data-approve-account="' + c.id + '">Approve</button>' +
            '<button class="btn btn-danger btn-sm" type="button" data-reject-account="' + c.id + '">Reject</button>' +
            '</div>';
        return '<tr>' +
            '<td><strong>' + fleetEscape(c.name) + '</strong><span class="cell-sub">' + fleetEscape(c.email) + '</span></td>' +
            '<td class="nowrap">' + fleetEscape(c.employee_number || '–') + '</td>' +
            '<td class="nowrap">' + fleetEscape(c.nif || '–') + '</td>' +
            '<td class="nowrap">' + fleetEscape(c.phone || '–') + '</td>' +
            '<td class="nowrap">' + fleetDate(c.created_at) + '</td>' +
            '<td>' + pill(ACCOUNT_PILL[c.status], ACCOUNT_LABEL[c.status]) + '</td>' +
            '<td>' + actions + '</td>' +
            '</tr>';
    }).join('');
    byId('no-couriers').hidden = list.length > 0;
}

document.querySelectorAll('[data-account-filter]').forEach(function (tab) {
    tab.addEventListener('click', function () {
        accountFilter = tab.dataset.accountFilter;
        document.querySelectorAll('[data-account-filter]').forEach(function (t) {
            t.setAttribute('aria-pressed', String(t === tab));
        });
        renderCouriers();
    });
});

byId('courier-rows').addEventListener('click', function (event) {
    const approve = event.target.closest('[data-approve-account]');
    const reject = event.target.closest('[data-reject-account]');

    if (approve) {
        withButton(approve, async function () {
            const account = (await apiRequest('POST', '/staff/accounts/' + approve.dataset.approveAccount + '/approve')).account;
            showToast(account.name + ' can now sign in as a courier.');
            await loadCouriers();
        });
    } else if (reject) {
        const c = couriers.find(function (x) { return x.id === Number(reject.dataset.rejectAccount); });
        openReasonDialog({
            title: 'Reject registration',
            subject: c.name + ' · ' + (c.employee_number || '') + ' · ' + c.email + '. The account will not be able to sign in.',
            reasons: null,   // só confirmação
            button: 'Reject',
            send: async function () {
                await apiRequest('POST', '/staff/accounts/' + c.id + '/reject');
                showToast(c.name + "'s request was rejected.");
                await loadCouriers();
            }
        });
    }
});

// =====================================================
// ===== Fila de despacho – WP3 (GET /api/staff/dispatch)
// =====================================================
let queue = [];
let dispatchTimer = null;
let countdownTimer = null;

async function loadDispatch() {
    let data;
    try {
        data = await apiRequest('GET', '/staff/dispatch');
    } catch (error) {
        messageRow('queue-rows', 6, 'Could not load the dispatch queue: ' + error.message, true);
        return;
    }
    queue = data.queue;
    renderQueue();
    renderRecent(data.recent);
    setBadge('badge-dispatch', queue.filter(function (q) { return q.status === 'no_courier'; }).length);
}

function offerCell(q) {
    if (!q.offer) {
        return '<span class="cell-sub">–</span>';
    }
    const percent = Math.round(q.offer.seconds_left / 60 * 100);
    return '<strong>' + fleetEscape(q.offer.courier.name) + '</strong>' +
        '<span class="cell-sub">' + q.offer.distance_km.toFixed(1) + ' km away · ' + q.offer.seconds_left + ' s left</span>' +
        '<span class="countdown" aria-hidden="true"><span style="width:' + percent + '%"></span></span>';
}

function renderQueue() {
    byId('queue-rows').innerHTML = queue.map(function (q) {
        return '<tr>' +
            '<td><strong>#' + q.order_id + '</strong></td>' +
            '<td class="nowrap">' + fleetDateTime(q.waiting_since) + '</td>' +
            '<td class="nowrap">' + q.weight_kg + ' kg<span class="cell-sub">' + q.volume_m3 + ' m³</span></td>' +
            '<td>' + pill(QUEUE_PILL[q.status], QUEUE_LABEL[q.status]) + '</td>' +
            '<td class="offer-cell">' + offerCell(q) + '</td>' +
            '<td>' + q.refusals + '</td>' +
            '</tr>';
    }).join('');
    byId('no-queue').hidden = queue.length > 0;
}

function renderRecent(recent) {
    byId('recent-rows').innerHTML = recent.map(function (r) {
        return '<tr>' +
            '<td><strong>#' + r.order_id + '</strong></td>' +
            '<td>' + fleetEscape(r.courier.name) + '</td>' +
            '<td class="nowrap">' + (r.distance_km === null ? '–' : r.distance_km.toFixed(1) + ' km') + '</td>' +
            '<td>' + pill(ANSWER_PILL[r.status], ANSWER_LABEL[r.status]) + '</td>' +
            '<td class="nowrap">' + fleetDateTime(r.offered_at) + '</td>' +
            '</tr>';
    }).join('');
    byId('no-recent').hidden = recent.length > 0;
}

// O contador desce a cada segundo; a cada 5 s os dados vêm outra vez do servidor
function tickCountdown() {
    let changed = false;
    queue.forEach(function (q) {
        if (q.offer && q.offer.seconds_left > 0) {
            q.offer.seconds_left -= 1;
            changed = true;
        }
    });
    if (changed) {
        renderQueue();
    }
}

function startDispatchRefresh() {
    stopDispatchRefresh();
    dispatchTimer = setInterval(loadDispatch, DISPATCH_REFRESH_MS);
    countdownTimer = setInterval(tickCountdown, 1000);
}

function stopDispatchRefresh() {
    clearInterval(dispatchTimer);
    clearInterval(countdownTimer);
    dispatchTimer = null;
    countdownTimer = null;
}

// =====================================================
// ===== Janela: recusar veículo (com motivo) ou conta (confirmação)
// =====================================================
const reasonDialog = byId('reason-dialog');
const reasonForm = byId('reason-form');
const reasonSelect = byId('reason-select');
let reasonOptions = null;

clearErrorsOnInput(reasonForm);

/**
 * options = { title, subject, reasons: [...] ou null (só confirmar), suggested, button, send: async function (reason) }
 * O send() faz o pedido à API; se der erro, a mensagem aparece na janela.
 */
function openReasonDialog(options) {
    reasonOptions = options;
    reasonForm.reset();
    clearError(reasonSelect);
    byId('reason-status').textContent = '';
    byId('reason-title').textContent = options.title;
    byId('reason-subject').textContent = options.subject;
    byId('reason-submit').textContent = options.button;
    byId('reason-field').hidden = !options.reasons;
    reasonSelect.innerHTML = '<option value="">Choose a reason…</option>' +
        (options.reasons || []).map(function (r) { return '<option>' + fleetEscape(r) + '</option>'; }).join('');
    reasonSelect.value = options.suggested || '';
    reasonDialog.showModal();
    (options.reasons ? reasonSelect : byId('reason-submit')).focus();
}

reasonForm.addEventListener('submit', async function (event) {
    event.preventDefault();   // impede o envio "normal" do formulário
    if (reasonOptions.reasons && !validate([[reasonSelect, required]])) {
        return;
    }
    const submit = byId('reason-submit');
    submit.disabled = true;
    try {
        await reasonOptions.send(reasonSelect.value);
        reasonDialog.close();
    } catch (error) {
        // 422: o erro do motivo vem em error.fields.reason
        byId('reason-status').textContent = (error.fields && error.fields.reason) || error.message;
    } finally {
        submit.disabled = false;
    }
});

byId('reason-cancel').addEventListener('click', function () {
    reasonDialog.close();
});

reasonDialog.addEventListener('click', function (event) {
    if (event.target === reasonDialog) {
        reasonDialog.close();
    }
});

// =====================================================
// ===== Arranque
// =====================================================
// Espera pelo fim de todos os scripts (o staff-orders.js vem depois deste)
document.addEventListener('DOMContentLoaded', function () {
    byId('today').textContent = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    setUserName(session.name);
    initProfile({ root: byId('profile-root'), prefix: 'pf', user: session, onSaved: setUserName });

    loadSummary();       // KPIs e contadores da barra lateral
    loadDispatch();      // contador da fila (e faz a fila andar)
    showSection();
});
