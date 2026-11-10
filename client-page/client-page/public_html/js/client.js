/* Client Page (Sprint 1): protótipo estático, sem servidor.
   Os dados vivem em memória e voltam aos de exemplo ao recarregar a página. */
"use strict";

const FEUP = [41.1780, -8.5980];

/* ---------- Dados de exemplo ---------- */
const products = [
    { id: 1, name: "Caixa de livros", weight: 12.5, volume: 0.04, fragile: false },
    { id: 2, name: "Monitor 27\"", weight: 6.8, volume: 0.09, fragile: true },
    { id: 3, name: "Conjunto de copos", weight: 2.4, volume: 0.02, fragile: true },
    { id: 4, name: "Cadeira de escritório", weight: 14, volume: 0.35, fragile: false }
];

const orders = [
    { id: "PD-1048", origin: [41.1496, -8.6109], dest: [41.1780, -8.5980], items: [3], status: "pending", courier: null, vehicle: null, date: "2026-11-08" },
    { id: "PD-1047", origin: [41.1780, -8.5980], dest: [41.1496, -8.6109], items: [1], status: "progress", courier: "Rui Santos", vehicle: "Moto · 45-TX-82", date: "2026-11-07" },
    { id: "PD-1046", origin: [41.1579, -8.6291], dest: [41.2356, -8.6200], items: [2], status: "initiated", courier: "Marta Lopes", vehicle: "Van · 17-RD-30", date: "2026-11-06" },
    { id: "PD-1039", origin: [41.2010, -8.6420], dest: [41.1579, -8.6291], items: [4], status: "completed", courier: "Marta Lopes", vehicle: "Van · 17-RD-30", date: "2026-10-29" },
    { id: "PD-1035", origin: [41.1496, -8.6109], dest: [41.2010, -8.6420], items: [1, 3], status: "completed", courier: "Rui Santos", vehicle: "Moto · 45-TX-82", date: "2026-10-22" },
    { id: "PD-1031", origin: [41.1780, -8.5980], dest: [41.1800, -8.5500], items: [2], status: "cancelled", courier: "Marta Lopes", vehicle: "Van · 17-RD-30", date: "2026-10-15" }
];

const STATUS = {
    pending:   "A aguardar estafeta",
    initiated: "Iniciado",
    progress:  "Em curso",
    completed: "Concluído",
    cancelled: "Cancelado"
};
const FLOW = ["pending", "initiated", "progress", "completed"];
const STEP_LABELS = ["Pendente", "Iniciado", "Em curso", "Concluído"];

let nextProductId = 5;
let nextOrderNumber = 1049;
let historyFilter = "all";

/* ---------- Utilitários ---------- */
const $ = (id) => document.getElementById(id);

function esc(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

const fmt = (n, digits) => n.toLocaleString("pt-PT", { maximumFractionDigits: digits });
const coord = (c) => `${c[0].toFixed(4)}, ${c[1].toFixed(4)}`;
const isActive = (o) => o.status !== "completed" && o.status !== "cancelled";
const productById = (id) => products.find((p) => p.id === id);
const orderProducts = (o) => o.items.map((id) => {
    const p = productById(id);
    if (!p) return "Produto removido";
    return p.fragile ? `${p.name} (frágil)` : p.name;
}).join(", ");

function parseNumber(raw) {
    const value = raw.trim().replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
}

function setError(input, errorEl, message) {
    errorEl.textContent = message;
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
}

function showSummary(el, count) {
    el.hidden = count === 0;
    el.textContent = count === 1 ? "Corrija 1 campo antes de submeter." : `Corrija ${count} campos antes de submeter.`;
}

/* O aviso geral desaparece assim que o utilizador começa a corrigir. */
$("order-form").addEventListener("input", () => { $("order-summary").hidden = true; });
$("product-form").addEventListener("input", () => { $("product-summary").hidden = true; });

let toastTimer;
function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

/* ---------- Navegação entre secções ---------- */
let map;

function showView(name) {
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== `view-${name}`; });
    document.querySelectorAll(".menu-item").forEach((b) => {
        if (b.dataset.view === name) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
    });
    $("search-box").classList.toggle("off", name !== "active" && name !== "history");
    if (name === "new-order" && map) map.invalidateSize();
    window.scrollTo(0, 0);
}

document.querySelectorAll(".menu-item").forEach((b) => {
    b.addEventListener("click", () => showView(b.dataset.view));
});

/* ---------- Mapa Leaflet / OpenStreetMap ---------- */
const points = { origin: null, dest: null };
const markers = { origin: null, dest: null };
let activePoint = "origin";
let routeLine = null;
let feupMarker = null;

function setActivePoint(point) {
    activePoint = point;
    document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b.dataset.point === point));
}

function pinIcon(point) {
    return L.divIcon({
        className: "",
        html: `<div class="pin ${point}">${point === "origin" ? "O" : "D"}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

function drawPoint(point, latLng) {
    points[point] = latLng;
    if (markers[point]) {
        map.removeLayer(markers[point]);
        markers[point] = null;
    }
    if (latLng) {
        markers[point] = L.marker(latLng, { icon: pinIcon(point) })
            .bindPopup(`${point === "origin" ? "Origem" : "Destino"}: ${coord(latLng)}`)
            .addTo(map);
    }

    const hasPoint = points.origin || points.dest;
    if (hasPoint && feupMarker) { map.removeLayer(feupMarker); feupMarker = null; }
    if (!hasPoint && !feupMarker) addFeupMarker();

    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (points.origin && points.dest) {
        routeLine = L.polyline([points.origin, points.dest], { color: "#7c57df", weight: 4, dashArray: "2 8", lineCap: "round" }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }
}

function addFeupMarker() {
    feupMarker = L.marker(FEUP).bindPopup("FEUP").addTo(map);
}

function initMap() {
    map = L.map("map").setView(FEUP, 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    addFeupMarker();

    map.on("click", (e) => {
        const prefix = activePoint === "origin" ? "origin" : "dest";
        $(`${prefix}-lat`).value = e.latlng.lat.toFixed(6);
        $(`${prefix}-long`).value = e.latlng.lng.toFixed(6);
        validateCoordPair(prefix);
        if (activePoint === "origin") setActivePoint("dest");
    });
}

document.querySelectorAll(".seg").forEach((b) => {
    b.addEventListener("click", () => setActivePoint(b.dataset.point));
});

/* ---------- Validação das coordenadas ---------- */
function coordError(raw, kind) {
    if (!raw.trim()) return "Campo obrigatório.";
    const value = parseNumber(raw);
    if (Number.isNaN(value)) return "Introduza um número (ex.: 41.1780).";
    const limit = kind === "lat" ? 90 : 180;
    if (Math.abs(value) > limit) return `Tem de estar entre -${limit} e ${limit}.`;
    return "";
}

/* Atualiza o marcador se o par for válido; devolve as coordenadas ou null. */
function readCoordPair(prefix) {
    const lat = $(`${prefix}-lat`).value;
    const long = $(`${prefix}-long`).value;
    if (coordError(lat, "lat") || coordError(long, "long")) return null;
    return [parseNumber(lat), parseNumber(long)];
}

function validateCoordPair(prefix) {
    let errors = 0;
    ["lat", "long"].forEach((kind) => {
        const input = $(`${prefix}-${kind}`);
        const message = coordError(input.value, kind);
        setError(input, $(`${prefix}-${kind}-error`), message);
        if (message) errors++;
    });
    drawPoint(prefix, readCoordPair(prefix));
    return errors;
}

/* Ao escrever: só limpa erros e move o marcador; o erro aparece ao sair do campo. */
["origin", "dest"].forEach((prefix) => {
    ["lat", "long"].forEach((kind) => {
        const input = $(`${prefix}-${kind}`);
        input.addEventListener("input", () => {
            setError(input, $(`${prefix}-${kind}-error`), "");
            drawPoint(prefix, readCoordPair(prefix));
        });
        input.addEventListener("blur", () => {
            if (input.value.trim()) setError(input, $(`${prefix}-${kind}-error`), coordError(input.value, kind));
        });
    });
});

/* ---------- Seleção de produtos no pedido ---------- */
function renderPicker() {
    const checked = selectedIds();
    $("product-picker").innerHTML = products.length
        ? products.map((p) => `
            <label class="pick">
                <input type="checkbox" value="${p.id}" ${checked.includes(p.id) ? "checked" : ""}>
                <span>${esc(p.name)}${p.fragile ? '<em class="tag">Frágil</em>' : ""}</span>
                <small>${fmt(p.weight, 2)} kg · ${fmt(p.volume, 3)} m³</small>
            </label>`).join("")
        : `<p class="hint">Ainda não tem produtos. Registe um em "Os meus produtos".</p>`;
    updateTotals();
}

function selectedIds() {
    return [...document.querySelectorAll("#product-picker input:checked")].map((c) => Number(c.value));
}

function updateTotals() {
    const chosen = selectedIds().map(productById);
    $("total-weight").textContent = `${fmt(chosen.reduce((s, p) => s + p.weight, 0), 2)} kg`;
    $("total-volume").textContent = `${fmt(chosen.reduce((s, p) => s + p.volume, 0), 3)} m³`;
}

$("product-picker").addEventListener("change", () => {
    updateTotals();
    if (selectedIds().length) $("picker-error").textContent = "";
});

/* ---------- Submeter pedido ---------- */
$("order-form").addEventListener("submit", (e) => {
    e.preventDefault();

    let errors = validateCoordPair("origin") + validateCoordPair("dest");

    if (!selectedIds().length) {
        $("picker-error").textContent = "Selecione pelo menos um produto.";
        errors++;
    }

    const origin = readCoordPair("origin");
    const dest = readCoordPair("dest");
    if (origin && dest && origin[0] === dest[0] && origin[1] === dest[1]) {
        setError($("dest-lat"), $("dest-lat-error"), "O destino tem de ser diferente da origem.");
        errors++;
    }

    showSummary($("order-summary"), errors);
    if (errors) {
        document.querySelector('#order-form [aria-invalid="true"]')?.focus();
        return;
    }

    const id = `PD-${nextOrderNumber++}`;
    orders.unshift({
        id, origin, dest, items: selectedIds(), status: "pending",
        courier: null, vehicle: null, date: new Date().toISOString().slice(0, 10)
    });

    e.target.reset();
    drawPoint("origin", null);
    drawPoint("dest", null);
    map.setView(FEUP, 14);
    setActivePoint("origin");
    renderPicker();
    renderOrders();
    showView("active");
    toast(`Pedido ${id} submetido.`);
});

/* ---------- Produtos ---------- */
const PRODUCT_FIELDS = ["p-name", "p-weight", "p-volume"];
const fragileChoice = () => document.querySelector('input[name="p-fragile"]:checked');
const firstFragileRadio = document.querySelector('input[name="p-fragile"]');

function productError(id) {
    const value = $(id).value;
    if (!value.trim()) return "Campo obrigatório.";
    if (id === "p-weight" || id === "p-volume") {
        const n = parseNumber(value);
        if (Number.isNaN(n)) return "Introduza um número.";
        if (n <= 0) return "Tem de ser maior que 0.";
    }
    return "";
}

PRODUCT_FIELDS.forEach((id) => {
    const clear = () => setError($(id), $(`${id}-error`), "");
    $(id).addEventListener("input", clear);
});

document.querySelectorAll('input[name="p-fragile"]').forEach((radio) => {
    radio.addEventListener("change", () => setError(firstFragileRadio, $("p-fragile-error"), ""));
});

$("product-form").addEventListener("submit", (e) => {
    e.preventDefault();

    let errors = 0;
    PRODUCT_FIELDS.forEach((id) => {
        const message = productError(id);
        setError($(id), $(`${id}-error`), message);
        if (message) errors++;
    });
    const fragileMessage = fragileChoice() ? "" : "Indique se o produto é frágil.";
    setError(firstFragileRadio, $("p-fragile-error"), fragileMessage);
    if (fragileMessage) errors++;

    showSummary($("product-summary"), errors);
    if (errors) {
        document.querySelector('#product-form [aria-invalid="true"]').focus();
        return;
    }

    const name = $("p-name").value.trim();
    products.push({
        id: nextProductId++,
        name,
        weight: parseNumber($("p-weight").value),
        volume: parseNumber($("p-volume").value),
        fragile: fragileChoice().value === "yes"
    });
    e.target.reset();
    renderProducts();
    renderPicker();
    toast(`Produto "${name}" registado.`);
});

function renderProducts() {
    $("count-products").textContent = products.length;
    $("product-rows").innerHTML = products.length
        ? products.map((p) => `
            <tr>
                <td>${esc(p.name)}</td>
                <td class="num nowrap">${fmt(p.weight, 2)} kg</td>
                <td class="num nowrap">${fmt(p.volume, 3)} m³</td>
                <td>${p.fragile ? '<span class="badge initiated">Sim</span>' : "Não"}</td>
                <td class="num"><button type="button" class="btn-remove" data-id="${p.id}" aria-label="Remover ${esc(p.name)}">Remover</button></td>
            </tr>`).join("")
        : `<tr><td colspan="5" class="empty">Ainda não tem produtos registados.</td></tr>`;
}

$("product-rows").addEventListener("click", (e) => {
    const button = e.target.closest(".btn-remove");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (orders.some((o) => isActive(o) && o.items.includes(id))) {
        toast("Este produto está num pedido ativo e não pode ser removido.");
        return;
    }
    products.splice(products.findIndex((p) => p.id === id), 1);
    renderProducts();
    renderPicker();
});

/* ---------- Pedidos ativos e histórico ---------- */
function stepper(status) {
    const current = FLOW.indexOf(status);
    return `<ol class="steps">${STEP_LABELS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "now" : "";
        const aria = i === current ? ' aria-current="step"' : "";
        return `<li class="${state}"${aria}>${label}</li>`;
    }).join("")}</ol>`;
}

function renderOrders() {
    const term = $("search").value.trim().toLowerCase();
    const matches = (o) => o.id.toLowerCase().includes(term);

    const active = orders.filter(isActive);
    const done = orders.filter((o) => !isActive(o));
    $("count-active").textContent = active.length;
    $("count-history").textContent = done.length;

    const activeShown = active.filter(matches);
    $("active-list").innerHTML = activeShown.length
        ? activeShown.map((o) => `
            <article class="card">
                <div class="order-head">
                    <h2>${o.id}</h2>
                    <span class="badge ${o.status}">${STATUS[o.status]}</span>
                </div>
                <dl class="facts">
                    <div><dt>Origem</dt><dd>${coord(o.origin)}</dd></div>
                    <div><dt>Destino</dt><dd>${coord(o.dest)}</dd></div>
                    <div class="full"><dt>Produtos</dt><dd>${esc(orderProducts(o))}</dd></div>
                    <div><dt>Estafeta</dt><dd>${o.courier || "Por atribuir"}</dd></div>
                    <div><dt>Veículo</dt><dd>${o.vehicle || "Por atribuir"}</dd></div>
                </dl>
                ${stepper(o.status)}
            </article>`).join("")
        : `<div class="card empty">${term ? "Nenhum pedido ativo com esse número." : "Não tem pedidos ativos."}</div>`;

    const doneShown = done.filter((o) => matches(o) && (historyFilter === "all" || o.status === historyFilter));
    $("history-rows").innerHTML = doneShown.length
        ? doneShown.map((o) => `
            <tr>
                <td class="nowrap"><strong>${o.id}</strong></td>
                <td class="nowrap">${coord(o.origin)}</td>
                <td class="nowrap">${coord(o.dest)}</td>
                <td>${esc(orderProducts(o))}</td>
                <td class="nowrap">${o.courier || "—"}</td>
                <td class="nowrap">${o.vehicle || "—"}</td>
                <td class="nowrap">${new Date(o.date).toLocaleDateString("pt-PT")}</td>
                <td><span class="badge ${o.status}">${STATUS[o.status]}</span></td>
            </tr>`).join("")
        : `<tr><td colspan="8" class="empty">Sem pedidos para mostrar.</td></tr>`;
}

$("search").addEventListener("input", renderOrders);

document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
        historyFilter = chip.dataset.filter;
        document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
        renderOrders();
    });
});

/* ---------- Relógio ---------- */
function tick() {
    $("clock").textContent = new Date().toLocaleString("pt-PT", {
        weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
}

/* ---------- Arranque ---------- */
initMap();
renderProducts();
renderPicker();
renderOrders();
tick();
setInterval(tick, 30000);
showView("new-order");
