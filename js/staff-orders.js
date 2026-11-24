// ===== Staff page – Encomendas, rotas e e-POD (dados de exemplo) =====
// Código do Sprint 1, separado do staff.js. Usa os dados do staff-data.js até haver
// a API das encomendas (João), das rotas (Rafael) e da e-POD. Nessa altura troca-se
// STAFF_DATA por pedidos à API e o resto (mapa, tabelas, janela da e-POD) fica igual.
//
// Está dentro de uma função (IIFE) para os nomes daqui não chocarem com os do staff.js.
// Usa do validation.js: byId.

(function () {
const STATUS_LABEL = {
    'initiated': 'Initiated',
    'in-progress': 'In progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
};
const POD_LABEL = { signature: 'Signature', photo: 'Photo' };

// ===== Utilitários =====
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

// =====================================================
// ===== 2. Encomendas e rotas (RF-29)
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
// ===== 3. Prova de entrega (RF-30)
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
podDialog.addEventListener('click', function (event) {
    if (event.target === podDialog) {
        podDialog.close();
    }
});

// O staff.js chama isto quando a secção das rotas fica visível
// (o Leaflet só calcula bem o tamanho do mapa com a secção à vista)
window.onRoutesSectionShown = function () {
    showRouteOnMap(selectedRouteId);
};

// ===== Arranque =====
renderRouteList();
renderRouteDetail();
renderOrders();
renderPods();
})();
