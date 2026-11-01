// ===== Menu em ecrãs pequenos =====
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

navToggle.addEventListener('click', function () {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
});

// ===== Ano no rodapé =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== Métricas: contagem animada =====
// Cada número tem data-count (valor final) e, opcionalmente, data-suffix.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('[data-count]').forEach(function (el) {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const format = function (n) { return n.toLocaleString('en-GB') + suffix; };

    if (reduceMotion) {
        el.textContent = format(target);
        return;
    }

    const duration = 1200;
    const start = performance.now();

    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        el.textContent = format(Math.round(target * progress));
        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    }
    requestAnimationFrame(tick);
});

// ===== Mapa Leaflet: um marcador na FEUP =====
const FEUP = [41.178, -8.596];

if (typeof L === 'undefined') {
    // A biblioteca não carregou (sem Internet, por exemplo).
    document.getElementById('map-note').hidden = false;
    document.querySelector('.map-chip').hidden = true;
} else {
    const map = L.map('map', { scrollWheelZoom: false }).setView(FEUP, 14);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    L.marker(FEUP).addTo(map).bindPopup('Example: FEUP, Porto');
}

// ===== Seguir encomenda (Track an order) =====
// Sem base de dados: algumas encomendas de exemplo (sample test data).
// Os estados são os do enunciado: Initiated -> In Progress -> Completed / Cancelled.
const DEMO_ORDERS = {
    '1042': { status: 'In Progress', from: 'FEUP, Porto',       to: 'Avenida dos Aliados, Porto' },
    '1038': { status: 'Completed',   from: 'Matosinhos',        to: 'Vila Nova de Gaia' },
    '1045': { status: 'Initiated',   from: 'Campanhã, Porto',   to: 'Maia' },
    '1031': { status: 'Cancelled',   from: 'Boavista, Porto',   to: 'Gondomar' }
};

const trackForm = byId('track-form');
const trackInput = byId('track-number');
const trackResult = byId('track-result');

clearErrorsOnInput(trackForm);

trackForm.addEventListener('submit', function (event) {
    event.preventDefault();
    trackResult.hidden = true;

    // Aceita "1042" ou "#1042".
    const ok = validate([
        [trackInput, function (v) {
            return required(v) || (/^#?\d{4,6}$/.test(v) ? '' : 'Use only numbers, e.g. 1042.');
        }]
    ]);
    if (!ok) {
        return;
    }

    const number = trackInput.value.trim().replace('#', '');
    const order = DEMO_ORDERS[number];

    // textContent em vez de innerHTML: o texto escrito pelo utilizador nunca é tratado como HTML.
    trackResult.textContent = '';
    if (!order) {
        trackResult.textContent = 'No order found with number ' + number + '.';
    } else {
        const badge = document.createElement('span');
        badge.className = 'status-badge status-' + order.status.toLowerCase().replace(' ', '-');
        badge.textContent = order.status;

        const title = document.createElement('strong');
        title.textContent = 'Order #' + number + ' ';

        const route = document.createElement('p');
        route.textContent = order.from + ' \u2192 ' + order.to;

        trackResult.append(title, badge, route);
    }
    trackResult.hidden = false;
});
