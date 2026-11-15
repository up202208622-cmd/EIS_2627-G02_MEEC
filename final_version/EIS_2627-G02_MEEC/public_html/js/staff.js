// ===== Staff page =====
// Sprint 1: tudo estático. Os dados vêm do staff-data.js (STAFF_DATA) e as alterações
// (aprovar, recusar, lembretes) só ficam em memória até a página ser recarregada.
// Usa as funções comuns do validation.js (byId, validate, required, clearError,
// clearErrorsOnInput) e os dados do users.js (DEMO_USERS).
//
// Requisitos desta página (docs/Requirements.xlsx):
//   RF-26 ver veículos pendentes · RF-27 aprovar/recusar · RF-28 validade a vermelho se expirada
//   RF-29 consultar encomendas e rotas · RF-30 consultar a e-POD de uma entrega concluída
//   RF-35 validar contas de courier · RF-36 alerta quando o courier carrega um certificado novo

// O Staff "com sessão iniciada" é a conta staff do users.js
const currentStaff = DEMO_USERS.find(function (user) { return user.role === 'staff'; });

const STATUS_LABEL = {
    'initiated': 'Initiated',
    'in-progress': 'In progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
};
const APPROVAL_LABEL = { pending: 'Pending', approved: 'Approved', disapproved: 'Disapproved', rejected: 'Rejected' };
const APPROVAL_PILL = { pending: 'pill-pending', approved: 'pill-ok', disapproved: 'pill-no', rejected: 'pill-no' };
const DOC_LABEL = { insurance: 'Insurance', inspection: 'Inspection' };
const POD_LABEL = { signature: 'Signature', photo: 'Photo' };

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

// '2026-11-13' -> '13/11/2026' (o mesmo formato da Courier page)
function formatDate(iso) {
    const p = iso.slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
}

// '2026-11-13T09:52' -> '13/11/2026, 09:52'
function formatDateTime(isoDateTime) {
    return formatDate(isoDateTime) + ', ' + isoDateTime.slice(11, 16);
}

function statusBadge(status) {
    return '<span class="status-badge status-' + status + '">' + STATUS_LABEL[status] + '</span>';
}

let toastTimer;
function showToast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2800);
}

// ===== Procurar nos dados =====
function findVehicle(id) {
    return STAFF_DATA.vehicles.find(function (v) { return v.id === id; });
}
function findOrder(id) {
    return STAFF_DATA.orders.find(function (o) { return o.id === id; });
}
function findRoute(id) {
    return STAFF_DATA.routes.find(function (r) { return r.id === id; });
}
function findPod(orderId) {
    return STAFF_DATA.pods.find(function (p) { return p.order_id === orderId; });
}

// ===== Validade dos documentos (use case "Check expiry dates") =====
function todayIso() {
    return daysFromToday(0);
}

// Dias inteiros entre hoje e a data (negativo = já expirou)
function daysUntil(iso) {
    return Math.round((Date.parse(iso) - Date.parse(todayIso())) / 86400000);
}

// 'expired' | 'expiring' | 'valid'
function docState(iso) {
    const n = daysUntil(iso);
    if (n < 0) { return 'expired'; }
    return n <= STAFF_DATA.alert_window_days ? 'expiring' : 'valid';
}

function docText(iso) {
    const n = daysUntil(iso);
    if (n < 0) { return 'Expired ' + (-n) + (n === -1 ? ' day ago' : ' days ago'); }
    if (n === 0) { return 'Expires today'; }
    if (n <= STAFF_DATA.alert_window_days) { return 'Expires in ' + n + (n === 1 ? ' day' : ' days'); }
    return 'Valid';
}

function hasExpiredDoc(v) {
    return docState(v.insurance_expiry_date) === 'expired' || docState(v.inspection_expiry_date) === 'expired';
}

function hasExpiringDoc(v) {
    return docState(v.insurance_expiry_date) === 'expiring' || docState(v.inspection_expiry_date) === 'expiring';
}

// Célula da tabela com a data e o estado (a vermelho se expirou, âmbar se está quase)
// Os ficheiros (insurance_doc, inspection_doc) só existem a partir do Sprint 2.
function docCell(iso) {
    return '<td class="doc-' + docState(iso) + '">' +
        '<span class="doc-date">' + formatDate(iso) + '</span>' +
        '<span class="doc-state">' + docText(iso) + '</span>' +
        '</td>';
}

// ===== Navegação entre secções (pelo # do endereço, como na Admin page) =====
const STAFF_SECTIONS = ['vehicles', 'couriers', 'routes', 'epod'];
const sideNav = byId('side-nav');
const sideToggle = byId('side-toggle');
let currentSection = null;

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

    // Em ecrãs pequenos, fecha o menu depois de escolher
    sideNav.classList.remove('open');
    sideToggle.setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);

    // O Leaflet só calcula bem o tamanho do mapa quando a secção está visível
    if (currentSection === 'routes') {
        showRouteOnMap(selectedRouteId);
    }
}

window.addEventListener('hashchange', showSection);

sideToggle.addEventListener('click', function () {
    const isOpen = sideNav.classList.toggle('open');
    sideToggle.setAttribute('aria-expanded', String(isOpen));
});

// =====================================================
// ===== 1. Aprovação de veículos (RF-26, RF-27, RF-28)
// =====================================================
let vehicleFilter = 'pending';

function vehiclesWithStatus(status) {
    return STAFF_DATA.vehicles.filter(function (v) {
        return status === 'all' || v.approval_status === status;
    });
}

function renderKpis() {
    const pending = vehiclesWithStatus('pending');
    const approved = vehiclesWithStatus('approved');
    const expired = approved.filter(hasExpiredDoc).length;
    const expiring = approved.filter(function (v) { return !hasExpiredDoc(v) && hasExpiringDoc(v); }).length;

    // O pedido mais antigo é o que está à espera há mais tempo
    let oldestNote = 'Nothing to review';
    if (pending.length > 0) {
        const oldest = pending.map(function (v) { return v.created_at; }).sort()[0];
        oldestNote = 'Oldest from ' + formatDate(oldest);
    }

    const kpis = [
        { label: 'Awaiting approval', value: pending.length, note: oldestNote, cls: pending.length > 0 ? 'is-warn' : '' },
        { label: 'Approved fleet', value: approved.length, note: 'Vehicles in service', cls: '' },
        { label: 'Expired documents', value: expired, note: expired > 0 ? 'Cannot be used on routes' : 'None', cls: expired > 0 ? 'is-danger' : '' },
        { label: 'Expiring soon', value: expiring, note: 'In the next ' + STAFF_DATA.alert_window_days + ' days', cls: expiring > 0 ? 'is-warn' : '' }
    ];

    byId('kpi-grid').innerHTML = kpis.map(function (k) {
        return '<li class="kpi ' + k.cls + '">' +
            '<span class="kpi-label">' + k.label + '</span>' +
            '<span class="kpi-value">' + k.value + '</span>' +
            '<span class="kpi-note">' + escapeHtml(k.note) + '</span>' +
            '</li>';
    }).join('');
}

function renderCounts() {
    ['pending', 'approved', 'disapproved', 'all'].forEach(function (status) {
        byId('count-' + status).textContent = vehiclesWithStatus(status).length;
    });
    const pending = vehiclesWithStatus('pending').length;
    const badge = byId('pending-badge');
    badge.textContent = pending;
    badge.classList.toggle('is-zero', pending === 0);
}

function vehicleActions(v) {
    if (v.approval_status !== 'pending') {
        return '';
    }
    // Não se aprova um veículo com documentos expirados (include "Check expiry dates")
    const expired = hasExpiredDoc(v);
    return '<div class="row-actions">' +
        '<button class="btn btn-primary btn-sm" type="button" data-approve="' + v.id + '"' +
            (expired ? ' disabled' : '') + '>Approve</button>' +
        '<button class="btn btn-danger btn-sm" type="button" data-reject="' + v.id + '">Disapprove</button>' +
        '</div>' +
        (expired ? '<span class="row-note">Expired document: cannot approve</span>' : '');
}

function renderVehicleTable() {
    // Mais recentes primeiro
    const list = vehiclesWithStatus(vehicleFilter).slice().sort(function (a, b) {
        return a.created_at < b.created_at ? 1 : -1;
    });

    byId('vehicle-rows').innerHTML = list.map(function (v) {
        return '<tr>' +
            '<td><strong class="nowrap">' + escapeHtml(v.model) + '</strong>' +
                '<span class="cell-sub">' + escapeHtml(v.license_plate) + ' · ' + escapeHtml(v.type_name) + '</span></td>' +
            '<td class="nowrap">' + escapeHtml(v.courier) + '</td>' +
            '<td class="nowrap">' + v.max_weight_kg + ' kg' +
                '<span class="cell-sub">' + v.max_vol_m3 + ' m³</span></td>' +
            docCell(v.insurance_expiry_date) +
            docCell(v.inspection_expiry_date) +
            // Estado + data do pedido (e o motivo, se foi recusado aqui)
            '<td><span class="pill ' + APPROVAL_PILL[v.approval_status] + '">' +
                APPROVAL_LABEL[v.approval_status] + '</span>' +
                '<span class="cell-sub nowrap">Sent ' + formatDate(v.created_at) + '</span>' +
                (v.reject_reason ? '<span class="cell-sub">' + escapeHtml(v.reject_reason) + '</span>' : '') +
            '</td>' +
            '<td>' + vehicleActions(v) + '</td>' +
            '</tr>';
    }).join('');

    byId('no-vehicles').hidden = list.length > 0;
}

// Alertas da frota aprovada:
//  - documento expirado ou quase a expirar (o Courier vê o mesmo aviso; aqui pode-se mandar um lembrete);
//  - certificado novo carregado pelo courier, que o Staff tem de verificar (informação atualizada).
const ALERT_ORDER = { expired: 0, updated: 1, expiring: 2 };

function renderAlerts() {
    const items = [];

    vehiclesWithStatus('approved').forEach(function (v) {
        if (v.doc_update && !v.doc_update.checked) {
            const kind = v.doc_update.kind;
            items.push({
                state: 'updated',
                html: '<li class="alert-item is-updated">' +
                    '<p><strong>' + escapeHtml(v.license_plate) + '</strong> · ' + escapeHtml(v.model) +
                    ' (' + escapeHtml(v.courier) + '): new ' + DOC_LABEL[kind].toLowerCase() +
                    ' certificate uploaded on ' + formatDateTime(v.doc_update.uploaded_at) +
                    ' (' + escapeHtml(v[kind + '_doc']) + '), valid until ' + formatDate(v[kind + '_expiry_date']) +
                    '. Check the document.</p>' +
                    '<button class="btn btn-primary btn-sm" type="button" data-checked="' + v.id + '">Mark as checked</button>' +
                    '</li>'
            });
        }

        ['insurance', 'inspection'].forEach(function (kind) {
            const iso = v[kind + '_expiry_date'];
            const state = docState(iso);
            if (state === 'valid') {
                return;
            }
            const sent = v.reminded && v.reminded[kind];
            items.push({
                state: state,
                html: '<li class="alert-item is-' + state + '">' +
                    '<p><strong>' + escapeHtml(v.license_plate) + '</strong> · ' + escapeHtml(v.model) +
                    ' (' + escapeHtml(v.courier) + '): ' + DOC_LABEL[kind].toLowerCase() + ' ' +
                    (state === 'expired'
                        ? 'expired on ' + formatDate(iso) + '. The vehicle cannot be used until it is renewed.'
                        : docText(iso).toLowerCase() + ' (' + formatDate(iso) + ').') +
                    '</p>' +
                    '<button class="btn btn-ghost btn-sm" type="button" data-remind="' + v.id + '" data-kind="' + kind + '"' +
                        (sent ? ' disabled' : '') + '>' + (sent ? 'Reminder sent' : 'Send reminder') + '</button>' +
                    '</li>'
            });
        });
    });

    // Expirados primeiro, depois documentos novos, depois os que estão quase a expirar
    items.sort(function (a, b) { return ALERT_ORDER[a.state] - ALERT_ORDER[b.state]; });

    byId('doc-alerts').innerHTML = items.map(function (i) { return i.html; }).join('');
    byId('no-alerts').hidden = items.length > 0;
    byId('alerts-note').textContent = items.length === 1 ? '1 alert' : items.length + ' alerts';
}

function refreshVehicles() {
    renderKpis();
    renderCounts();
    renderVehicleTable();
    renderAlerts();
}

// Separadores Pending / Approved / Disapproved / All
document.querySelectorAll('[data-filter]').forEach(function (tab) {
    tab.addEventListener('click', function () {
        vehicleFilter = tab.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(function (t) {
            t.setAttribute('aria-pressed', String(t === tab));
        });
        renderVehicleTable();
    });
});

// Aprovar / recusar (um só listener para a tabela toda)
byId('vehicle-rows').addEventListener('click', function (event) {
    const approveBtn = event.target.closest('[data-approve]');
    const rejectBtn = event.target.closest('[data-reject]');

    if (approveBtn) {
        const v = findVehicle(Number(approveBtn.dataset.approve));
        if (hasExpiredDoc(v)) {   // segurança extra: o botão já está desativado
            showToast('This vehicle has an expired document and cannot be approved.');
            return;
        }
        v.approval_status = 'approved';
        refreshVehicles();
        showToast(v.license_plate + ' approved. ' + v.courier + ' can now use it on routes.');
    } else if (rejectBtn) {
        openRejectDialog(findVehicle(Number(rejectBtn.dataset.reject)));
    }
});

// Lembrete ao courier (simulado: no Sprint 2 seria um email/notificação)
// e "Mark as checked" para os certificados novos
byId('doc-alerts').addEventListener('click', function (event) {
    const remindBtn = event.target.closest('[data-remind]');
    const checkedBtn = event.target.closest('[data-checked]');

    if (remindBtn) {
        const v = findVehicle(Number(remindBtn.dataset.remind));
        v.reminded = v.reminded || {};
        v.reminded[remindBtn.dataset.kind] = true;
        renderAlerts();
        showToast('Reminder sent to ' + v.courier + '.');
    } else if (checkedBtn) {
        const v = findVehicle(Number(checkedBtn.dataset.checked));
        v.doc_update.checked = true;
        renderAlerts();
        showToast('New ' + DOC_LABEL[v.doc_update.kind].toLowerCase() + ' certificate of ' + v.license_plate + ' checked.');
    }
});

// ===== Janela "Disapprove vehicle" =====
const rejectDialog = byId('reject-dialog');
const rejectForm = byId('reject-form');
const rejectReason = byId('reject-reason');
let vehicleToReject = null;

clearErrorsOnInput(rejectForm);
rejectReason.addEventListener('change', function () { clearError(rejectReason); });

function openRejectDialog(v) {
    vehicleToReject = v;
    rejectForm.reset();
    clearError(rejectReason);
    byId('reject-vehicle').textContent = v.model + ' · ' + v.license_plate + ' · ' + v.courier;
    // Se um documento já expirou, essa é a razão mais provável
    if (hasExpiredDoc(v)) {
        rejectReason.value = 'Expired insurance or inspection';
    }
    rejectDialog.showModal();
    rejectReason.focus();
}

rejectForm.addEventListener('submit', function (event) {
    event.preventDefault();   // impede o envio "normal" do formulário
    if (!validate([[rejectReason, required]])) {
        return;
    }
    vehicleToReject.approval_status = 'disapproved';
    vehicleToReject.reject_reason = rejectReason.value;
    rejectDialog.close();
    refreshVehicles();
    showToast(vehicleToReject.license_plate + ' disapproved. ' + vehicleToReject.courier + ' was notified.');
});

byId('reject-cancel').addEventListener('click', function () {
    rejectDialog.close();
});

// =====================================================
// ===== 2. Aprovação de contas de courier (RF-35)
// =====================================================
function pendingCouriers() {
    return STAFF_DATA.courierRequests.filter(function (c) { return c.status === 'pending'; }).length;
}

function renderCouriers() {
    const list = STAFF_DATA.courierRequests;

    byId('courier-rows').innerHTML = list.map(function (c) {
        const done = c.status !== 'pending';
        return '<tr' + (done ? ' class="is-done"' : '') + '>' +
            '<td><strong>' + escapeHtml(c.name) + '</strong><span class="cell-sub">' + escapeHtml(c.email) + '</span></td>' +
            '<td class="nowrap">' + escapeHtml(c.employee) + '</td>' +
            '<td>' + escapeHtml(c.nif) + '</td>' +
            '<td>' + escapeHtml(c.phone) + '</td>' +
            '<td class="nowrap">' + formatDate(c.requested) + '</td>' +
            '<td><span class="pill ' + APPROVAL_PILL[c.status] + '">' + APPROVAL_LABEL[c.status] + '</span></td>' +
            '<td>' + (done ? '' :
                '<div class="row-actions">' +
                '<button class="btn btn-primary btn-sm" type="button" data-courier-approve="' + c.id + '">Approve</button>' +
                '<button class="btn btn-danger btn-sm" type="button" data-courier-reject="' + c.id + '">Reject</button>' +
                '</div>') + '</td>' +
            '</tr>';
    }).join('');

    const pending = pendingCouriers();
    byId('no-couriers').hidden = list.length > 0;
    byId('couriers-note').textContent = pending === 1 ? '1 pending' : pending + ' pending';
    const badge = byId('courier-badge');
    badge.textContent = pending;
    badge.classList.toggle('is-zero', pending === 0);
}

byId('courier-rows').addEventListener('click', function (event) {
    const approveBtn = event.target.closest('[data-courier-approve]');
    const rejectBtn = event.target.closest('[data-courier-reject]');
    const btn = approveBtn || rejectBtn;
    if (!btn) {
        return;
    }
    const id = Number(approveBtn ? approveBtn.dataset.courierApprove : rejectBtn.dataset.courierReject);
    const courier = STAFF_DATA.courierRequests.find(function (c) { return c.id === id; });
    courier.status = approveBtn ? 'approved' : 'rejected';
    renderCouriers();
    showToast(approveBtn
        ? courier.name + ' can now sign in as a courier.'
        : courier.name + "'s request was rejected.");
});

// =====================================================
// ===== 3. Encomendas e rotas (RF-29)
// =====================================================
let selectedRouteId = STAFF_DATA.routes[0].id;
let map = null;
let mapLayer = null;

function routeVehicle(route) {
    return findVehicle(route.vehicle_id);
}

function deliveredCount(route) {
    return route.orders.filter(function (id) { return findOrder(id).status === 'completed'; }).length;
}

function renderRouteList() {
    const active = STAFF_DATA.routes.filter(function (r) { return r.status !== 'completed' && r.status !== 'cancelled'; }).length;
    byId('routes-note').textContent = active + ' active';

    byId('route-list').innerHTML = STAFF_DATA.routes.map(function (r) {
        const v = routeVehicle(r);
        return '<li><button type="button" class="route-btn" data-route="' + r.id + '" aria-pressed="' + (r.id === selectedRouteId) + '">' +
            '<strong>Route ' + r.id + '</strong>' + statusBadge(r.status) +
            '<span class="cell-sub">' + escapeHtml(r.courier) + ' · ' + escapeHtml(v.license_plate) + ' · ' +
                r.orders.length + (r.orders.length === 1 ? ' order' : ' orders') + '</span>' +
            '</button></li>';
    }).join('');
}

function renderRouteDetail() {
    const r = findRoute(selectedRouteId);
    const v = routeVehicle(r);

    byId('route-title').textContent = 'Route ' + r.id;
    byId('route-status').innerHTML = statusBadge(r.status);
    byId('route-meta').textContent = r.courier + ' · ' + v.model + ' (' + v.license_plate + ') · created ' +
        formatDateTime(r.created_at) + ' · ' + deliveredCount(r) + ' of ' + r.orders.length + ' delivered';

    // Paragens pela ordem da Route_Order.sequence
    byId('route-stops').innerHTML = r.orders.map(function (orderId, index) {
        const o = findOrder(orderId);
        const pod = findPod(o.id);
        return '<li>' +
            '<span class="stop-num" aria-hidden="true">' + (index + 1) + '</span>' +
            '<div class="stop-main"><strong>#' + o.id + ' · ' + escapeHtml(o.dest_name) + '</strong>' +
                '<span class="cell-sub">' + escapeHtml(o.client) + ' · ' + o.weight_kg + ' kg</span></div>' +
            statusBadge(o.status) +
            (pod ? '<button class="btn btn-ghost btn-sm" type="button" data-pod="' + o.id + '">View e-POD</button>' : '') +
            '</li>';
    }).join('');
}

// Mapa da rota: FEUP + paragens numeradas, ligadas pela ordem de entrega
function makePin(text, cls) {
    return L.divIcon({
        className: '',
        html: '<span class="stop-pin ' + cls + '">' + text + '</span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

function initMap() {
    if (typeof L === 'undefined') {   // o leaflet.js não carregou
        byId('map-note').hidden = false;
        return false;
    }
    map = L.map('route-map', { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
    return true;
}

function showRouteOnMap(routeId) {
    if (!map && !initMap()) {
        return;
    }
    map.invalidateSize();
    mapLayer.clearLayers();

    const origin = [STAFF_DATA.origin.lat, STAFF_DATA.origin.long];
    const points = [origin];

    L.marker(origin, { icon: makePin('F', 'pin-origin'), title: 'Origin: FEUP' })
        .bindPopup('Origin: ' + STAFF_DATA.origin.name)
        .addTo(mapLayer);

    findRoute(routeId).orders.forEach(function (orderId, index) {
        const o = findOrder(orderId);
        const point = [o.dest_lat, o.dest_long];
        points.push(point);
        L.marker(point, { icon: makePin(index + 1, 'pin-' + o.status), title: '#' + o.id + ' ' + o.dest_name })
            .bindPopup('<strong>#' + o.id + '</strong><br>' + escapeHtml(o.dest_name) + '<br>' + STATUS_LABEL[o.status])
            .addTo(mapLayer);
    });

    const line = L.polyline(points, { color: '#0b7a75', weight: 4, dashArray: '2 8', lineCap: 'round' }).addTo(mapLayer);
    map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 14 });
}

function selectRoute(routeId) {
    selectedRouteId = routeId;
    renderRouteList();
    renderRouteDetail();
    showRouteOnMap(routeId);
}

byId('route-list').addEventListener('click', function (event) {
    const btn = event.target.closest('[data-route]');
    if (btn) {
        selectRoute(Number(btn.dataset.route));
    }
});

// ===== Tabela de todas as encomendas =====
const orderSearch = byId('order-search');
const orderStatus = byId('order-status');

function renderOrders() {
    const number = orderSearch.value.trim().replace('#', '');
    const status = orderStatus.value;

    const list = STAFF_DATA.orders.filter(function (o) {
        return (status === 'all' || o.status === status) &&
               (number === '' || String(o.id).includes(number));
    }).sort(function (a, b) { return b.id - a.id; });

    byId('order-rows').innerHTML = list.map(function (o) {
        return '<tr>' +
            '<td><strong>#' + o.id + '</strong></td>' +
            '<td class="nowrap">' + escapeHtml(o.client) + '</td>' +
            '<td>' + escapeHtml(o.dest_name) +
                '<span class="cell-sub">' + o.dest_lat.toFixed(4) + ', ' + o.dest_long.toFixed(4) + '</span></td>' +
            '<td class="nowrap">' + o.weight_kg + ' kg</td>' +
            '<td>' + (o.route_id
                ? '<button class="btn btn-ghost btn-sm" type="button" data-goto-route="' + o.route_id + '">Route ' + o.route_id + '</button>'
                : '<span class="cell-sub">Not assigned</span>') + '</td>' +
            '<td>' + (o.attempt > 1 ? '<span class="pill pill-pending">' + o.attempt + '</span>' : o.attempt) + '</td>' +
            '<td class="nowrap">' + formatDateTime(o.created_at) + '</td>' +
            '<td>' + statusBadge(o.status) + '</td>' +
            '<td>' + (findPod(o.id)
                ? '<button class="btn btn-ghost btn-sm" type="button" data-pod="' + o.id + '">View e-POD</button>'
                : '') + '</td>' +
            '</tr>';
    }).join('');

    byId('no-orders').hidden = list.length > 0;
}

orderSearch.addEventListener('input', renderOrders);
orderStatus.addEventListener('change', renderOrders);

// Botão "Route xxx" na tabela: mostra essa rota no mapa
byId('order-rows').addEventListener('click', function (event) {
    const btn = event.target.closest('[data-goto-route]');
    if (btn) {
        selectRoute(Number(btn.dataset.gotoRoute));
        byId('routes').scrollIntoView({ behavior: 'smooth' });
    }
});

// =====================================================
// ===== 4. Prova de entrega (RF-30)
// =====================================================
const podSearch = byId('pod-search');

function renderPods() {
    const number = podSearch.value.trim().replace('#', '');

    // Mais recentes primeiro
    const list = STAFF_DATA.pods.filter(function (p) {
        return number === '' || String(p.order_id).includes(number);
    }).sort(function (a, b) { return a.delivered_at < b.delivered_at ? 1 : -1; });

    byId('pod-rows').innerHTML = list.map(function (p) {
        const o = findOrder(p.order_id);
        const r = findRoute(o.route_id);
        return '<tr>' +
            '<td><strong>#' + o.id + '</strong><span class="cell-sub">' + escapeHtml(o.dest_name) + '</span></td>' +
            '<td>' + escapeHtml(o.client) + '</td>' +
            '<td>' + escapeHtml(r.courier) + '<span class="cell-sub">Route ' + r.id + '</span></td>' +
            '<td>' + escapeHtml(p.recipient) + '</td>' +
            '<td class="nowrap">' + formatDateTime(p.delivered_at) + '</td>' +
            '<td><span class="pill pill-plain">' + POD_LABEL[p.type] + '</span></td>' +
            '<td><div class="row-actions">' +
                '<button class="btn btn-primary btn-sm" type="button" data-pod="' + o.id + '">View e-POD</button>' +
            '</div></td>' +
            '</tr>';
    }).join('');

    byId('no-pods').hidden = list.length > 0;
}

podSearch.addEventListener('input', renderPods);

// ===== Imagens da e-POD =====
// No Sprint 1 não há ficheiros guardados, por isso a assinatura e a foto são desenhadas em SVG.
// No Sprint 2 isto passa a ser um <img src="..."> com o ficheiro do campo Proof_of_Delivery.file.

// Gerador de números "aleatórios" que dá sempre o mesmo resultado para o mesmo nome,
// para cada pessoa ter sempre a mesma assinatura
function seededRandom(text) {
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
        seed = (seed * 31 + text.charCodeAt(i)) % 2147483647;
    }
    if (seed === 0) { seed = 1; }
    return function () {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
}

function n1(value) {
    return value.toFixed(1);
}

// Assinatura: inicial do primeiro nome + último apelido, escrita com laçadas e inclinada,
// como a que o courier recolhe no telemóvel
function signatureSvg(name) {
    const rand = seededRandom(name);
    const words = name.replace(/\(.*\)/, '').trim().split(/\s+/);   // "Paulo Sá (concierge)" -> Paulo Sá
    const text = (words.length > 1 ? words[0][0] + words[words.length - 1] : words[0]).replace(/[^A-Za-zÀ-ÿ]/g, '');
    let x = 60;
    let y = 130;
    let d = 'M ' + x + ' ' + (y + 6);

    text.split('').forEach(function (ch, i) {
        const fade = 1 - i / (text.length + 4);                 // as últimas letras ficam mais pequenas
        const isCap = i === 0 || (i === 1 && words.length > 1);
        const plain = ch.normalize('NFD').charAt(0).toLowerCase();   // "á" -> "a"
        let h;
        let w;
        if (isCap) {
            h = 70 + rand() * 20; w = 26 + rand() * 10;
        } else if ('bdfhklt'.includes(plain)) {
            h = 50 * fade + rand() * 10; w = 14 + rand() * 6;
        } else {
            h = 20 * fade + rand() * 8; w = 12 + rand() * 6;
        }

        if ('gjpqy'.includes(plain) && !isCap) {
            // letra com perna: desce abaixo da linha, faz a laçada e volta
            d += ' C ' + n1(x + w * 0.5) + ' ' + n1(y - h) + ', ' + n1(x + w * 0.9) + ' ' + n1(y + 10) + ', ' + n1(x + w * 0.5) + ' ' + n1(y + 34);
            d += ' C ' + n1(x + w * 0.2) + ' ' + n1(y + 50) + ', ' + n1(x - w * 0.2) + ' ' + n1(y + 20) + ', ' + n1(x + w) + ' ' + n1(y - 4);
        } else if ('mnu'.includes(plain) && !isCap) {
            // dois arcos
            d += ' C ' + n1(x + w * 0.1) + ' ' + n1(y - h) + ', ' + n1(x + w * 0.6) + ' ' + n1(y - h) + ', ' + n1(x + w * 0.55) + ' ' + n1(y);
            d += ' C ' + n1(x + w * 0.6) + ' ' + n1(y - h) + ', ' + n1(x + w * 1.1) + ' ' + n1(y - h) + ', ' + n1(x + w) + ' ' + n1(y);
        } else {
            // laçada: sobe, volta para trás e desce
            d += ' C ' + n1(x + w * 0.9) + ' ' + n1(y - h) + ', ' + n1(x - w * 0.25) + ' ' + n1(y - h * 1.05) + ', ' + n1(x + w * 0.3) + ' ' + n1(y + 2);
            d += ' S ' + n1(x + w * 0.8) + ' ' + n1(y + 4) + ', ' + n1(x + w) + ' ' + n1(y - h * 0.25);
        }
        x += w * (isCap ? 1.15 : 0.95);
        y -= 1.2;                                                // a linha sobe um pouco
        if (i === 0 && words.length > 1) {                      // levanta a caneta depois da inicial
            x += 14;
            d += ' M ' + n1(x) + ' ' + n1(y + 4);
        }
    });
    // traço final por baixo
    const flourish = 'M ' + n1(x + 4) + ' ' + n1(y - 10) + ' C ' + n1(x + 40) + ' ' + n1(y + 30) + ', 120 ' + n1(y + 34) + ', 52 ' + n1(y + 18);

    return '<svg viewBox="0 0 480 220" role="img" aria-label="Signature of ' + escapeHtml(name) + '">' +
        '<rect width="480" height="220" fill="#ffffff"/>' +
        '<line x1="30" y1="172" x2="450" y2="172" stroke="#dbe4e1" stroke-width="2"/>' +
        '<text x="30" y="200" font-size="13" fill="#8396a8">Signed by ' + escapeHtml(name) + '</text>' +
        '<g transform="translate(30 0) skewX(-14)" fill="none" stroke="#10243a" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="' + d + '" stroke-width="2.6"/>' +
        '<path d="' + flourish + '" stroke-width="2"/>' +
        '</g></svg>';
}

// Foto: encomenda à porta, com a data e hora carimbadas pela câmara
function photoSvg(order, pod) {
    return '<svg viewBox="0 0 480 300" role="img" aria-label="Photo of order ' + order.id + ' left at the door">' +
        '<rect width="480" height="300" fill="#e9e2d6"/>' +
        '<rect y="236" width="480" height="64" fill="#b7aa96"/>' +
        '<rect x="150" y="30" width="150" height="208" rx="4" fill="#7a5236"/>' +
        '<rect x="166" y="48" width="118" height="78" rx="3" fill="#6a452c"/>' +
        '<rect x="166" y="140" width="118" height="78" rx="3" fill="#6a452c"/>' +
        '<circle cx="282" cy="140" r="6" fill="#d9b44a"/>' +
        '<rect x="320" y="70" width="44" height="30" rx="4" fill="#f5f8f7"/>' +
        '<text x="342" y="91" font-size="16" font-weight="700" text-anchor="middle" fill="#10243a">' + (order.id % 97) + '</text>' +
        '<rect x="132" y="232" width="186" height="16" rx="3" fill="#8a7a63"/>' +
        '<rect x="190" y="176" width="84" height="62" rx="3" fill="#c89b62"/>' +
        '<polygon points="190,176 274,176 262,164 202,164" fill="#d8ad74"/>' +
        '<rect x="226" y="164" width="12" height="74" fill="#e8d3a6"/>' +
        '<rect x="200" y="196" width="22" height="14" rx="2" fill="#f5f8f7"/>' +
        '<rect x="300" y="268" width="172" height="26" rx="4" fill="#10243a" fill-opacity="0.55"/>' +
        '<text x="462" y="286" font-size="14" font-family="monospace" text-anchor="end" fill="#f2a31b">' +
            formatDateTime(pod.delivered_at) + '</text>' +
        '</svg>';
}

// ===== Janela "Proof of delivery" =====
const podDialog = byId('pod-dialog');

function openPod(orderId) {
    const o = findOrder(orderId);
    const p = findPod(orderId);
    const r = findRoute(o.route_id);
    const v = routeVehicle(r);

    byId('pod-title').textContent = 'Proof of delivery · Order #' + o.id;
    byId('pod-image').innerHTML = p.type === 'signature' ? signatureSvg(p.recipient) : photoSvg(o, p);
    byId('pod-caption').textContent = (p.type === 'signature'
        ? 'Signature collected on the courier\'s phone'
        : 'Photo taken by the courier at the door') + ' · ' + p.file;

    const details = [
        ['Order', '#' + o.id + ' · ' + o.client],
        ['Delivered to', STAFF_DATA.origin.name + ' → ' + o.dest_name],
        ['Received by', p.recipient],
        ['Delivered at', formatDateTime(p.delivered_at)],
        ['Courier', r.courier + ' · Route ' + r.id],
        ['Vehicle', v.model + ' (' + v.license_plate + ')'],
        ['Proof type', POD_LABEL[p.type]],
        ['Attempt', String(o.attempt)]
    ];
    byId('pod-details').innerHTML = details.map(function (row) {
        return '<div><dt>' + row[0] + '</dt><dd>' + escapeHtml(row[1]) + '</dd></div>';
    }).join('');

    podDialog.showModal();
}

byId('pod-close').addEventListener('click', function () {
    podDialog.close();
});

// Os botões "View e-POD" estão em três sítios: paragens da rota, tabela de encomendas e tabela e-POD
document.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-pod]');
    if (btn) {
        openPod(Number(btn.dataset.pod));
    }
});

// Clicar fora da janela (no fundo escuro) também a fecha
[rejectDialog, podDialog].forEach(function (dialog) {
    dialog.addEventListener('click', function (event) {
        if (event.target === dialog) {
            dialog.close();
        }
    });
});

// ===== Arranque =====
byId('today').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});
byId('alert-window').textContent = STAFF_DATA.alert_window_days;
byId('user-name').textContent = currentStaff.name;
byId('user-initials').textContent = initials(currentStaff.name);

refreshVehicles();
renderCouriers();
renderRouteList();
renderRouteDetail();
renderOrders();
renderPods();
showSection();
