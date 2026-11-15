/* Client page (Sprint 1): static prototype, no server.
   Data lives in memory and goes back to the sample data when the page is reloaded. */
"use strict";

const FEUP = [41.1780, -8.5980];

/* ---------- Sample data ---------- */
const products = [
    { id: 1, description: "Box of books", category: "Other", weight: 12.5, volume: 0.04, created: "2026-10-12" },
    { id: 2, description: "Monitor 27\"", category: "Electronics", weight: 6.8, volume: 0.09, created: "2026-10-14" },
    { id: 3, description: "Set of glasses", category: "Other", weight: 2.4, volume: 0.02, created: "2026-10-20" },
    { id: 4, description: "Office chair", category: "Furniture", weight: 14, volume: 0.35, created: "2026-11-02" }
];

const orders = [
    { id: "PD-1048", origin: [41.1496, -8.6109], dest: [41.1780, -8.5980], items: [3], status: "pending", courier: null, vehicle: null, date: "2026-11-08" },
    { id: "PD-1047", origin: [41.1780, -8.5980], dest: [41.1496, -8.6109], items: [1], status: "progress", courier: "Rui Martins", vehicle: "Moto · 45-TX-82", date: "2026-11-07" },
    { id: "PD-1046", origin: [41.1579, -8.6291], dest: [41.2356, -8.6200], items: [2], status: "initiated", courier: "Marta Lopes", vehicle: "Van · 17-RD-30", date: "2026-11-06" },
    { id: "PD-1039", origin: [41.2010, -8.6420], dest: [41.1579, -8.6291], items: [4], status: "completed", courier: "Marta Lopes", vehicle: "Van · 17-RD-30", date: "2026-10-29" },
    { id: "PD-1035", origin: [41.1496, -8.6109], dest: [41.2010, -8.6420], items: [1, 3], status: "completed", courier: "Rui Martins", vehicle: "Moto · 45-TX-82", date: "2026-10-22" },
    { id: "PD-1031", origin: [41.1780, -8.5980], dest: [41.1800, -8.5500], items: [2], status: "cancelled", courier: "Marta Lopes", vehicle: "Van · 17-RD-30", date: "2026-10-15" }
];

const STATUS = {
    pending:   "Awaiting courier",
    initiated: "Initiated",
    progress:  "In progress",
    completed: "Completed",
    cancelled: "Cancelled"
};
const FLOW = ["pending", "initiated", "progress", "completed"];
const STEP_LABELS = ["Pending", "Initiated", "In progress", "Completed"];

let nextProductId = 5;
let nextOrderNumber = 1049;
let historyFilter = "all";
let editingProductId = null;   // produto a ser editado (null = a registar um novo)

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);

function esc(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

const fmt = (n, digits) => n.toLocaleString("en-GB", { maximumFractionDigits: digits });
const coord = (c) => `${c[0].toFixed(4)}, ${c[1].toFixed(4)}`;
const isActive = (o) => o.status !== "completed" && o.status !== "cancelled";
const productById = (id) => products.find((p) => p.id === id);
const orderProducts = (o) => o.items.map((id) => {
    const p = productById(id);
    if (!p) return "Removed product";
    return p.description;
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
    el.textContent = count === 1 ? "Fix 1 field before submitting." : `Fix ${count} fields before submitting.`;
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

/* ---------- Section navigation ---------- */
let map = null;

function showView(name) {
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== `view-${name}`; });
    document.querySelectorAll(".menu-item[data-view]").forEach((b) => {
        if (b.dataset.view === name) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
    });
    $("search-box").classList.toggle("off", name !== "active" && name !== "history");
    if (name === "new-order" && map) map.invalidateSize();
    window.scrollTo(0, 0);
}

/* Só os botões com data-view mudam de secção; os links (Home, Team) navegam normalmente. */
document.querySelectorAll(".menu-item[data-view]").forEach((b) => {
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
    if (!map) return;   // sem Leaflet, os campos continuam a funcionar
    if (markers[point]) {
        map.removeLayer(markers[point]);
        markers[point] = null;
    }
    if (latLng) {
        markers[point] = L.marker(latLng, { icon: pinIcon(point) })
            .bindPopup(`${point === "origin" ? "Origin" : "Destination"}: ${coord(latLng)}`)
            .addTo(map);
    }

    const hasPoint = points.origin || points.dest;
    if (hasPoint && feupMarker) { map.removeLayer(feupMarker); feupMarker = null; }
    if (!hasPoint && !feupMarker) addFeupMarker();

    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (points.origin && points.dest) {
        routeLine = L.polyline([points.origin, points.dest], { color: "#0b7a75", weight: 4, dashArray: "2 8", lineCap: "round" }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }
}

function addFeupMarker() {
    feupMarker = L.marker(FEUP).bindPopup("FEUP").addTo(map);
}

function initMap() {
    if (typeof L === "undefined") return;   // biblioteca não carregou
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

/* ---------- Coordinate validation ---------- */
function coordError(raw, kind) {
    if (!raw.trim()) return "This field is required.";
    const value = parseNumber(raw);
    if (Number.isNaN(value)) return "Enter a number (e.g. 41.1780).";
    const limit = kind === "lat" ? 90 : 180;
    if (Math.abs(value) > limit) return `Must be between -${limit} and ${limit}.`;
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

/* ---------- Product selection in the order ---------- */
function renderPicker() {
    const checked = selectedIds();
    $("product-picker").innerHTML = products.length
        ? products.map((p) => `
            <label class="pick">
                <input type="checkbox" value="${p.id}" ${checked.includes(p.id) ? "checked" : ""}>
                <span>${esc(p.description)}<em class="tag">${esc(p.category)}</em></span>
                <small>${fmt(p.weight, 2)} kg · ${fmt(p.volume, 3)} m³</small>
            </label>`).join("")
        : `<p class="hint">You have no products yet. Register one in "My products".</p>`;
    updateTotals();
}

function selectedIds() {
    return [...document.querySelectorAll("#product-picker input:checked")].map((c) => Number(c.value));
}

function updateTotals() {
    const chosen = selectedIds().map(productById).filter(Boolean);
    $("total-weight").textContent = `${fmt(chosen.reduce((s, p) => s + p.weight, 0), 2)} kg`;
    $("total-volume").textContent = `${fmt(chosen.reduce((s, p) => s + p.volume, 0), 3)} m³`;
}

$("product-picker").addEventListener("change", () => {
    updateTotals();
    if (selectedIds().length) $("picker-error").textContent = "";
});

/* ---------- Submit order ---------- */
$("order-form").addEventListener("submit", (e) => {
    e.preventDefault();

    let errors = validateCoordPair("origin") + validateCoordPair("dest");

    if (!selectedIds().length) {
        $("picker-error").textContent = "Select at least one product.";
        errors++;
    }

    const origin = readCoordPair("origin");
    const dest = readCoordPair("dest");
    if (origin && dest && origin[0] === dest[0] && origin[1] === dest[1]) {
        setError($("dest-lat"), $("dest-lat-error"), "The destination must be different from the origin.");
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
    if (map) map.setView(FEUP, 14);
    setActivePoint("origin");
    renderPicker();
    renderOrders();
    showView("active");
    toast(`Order ${id} submitted.`);
});

/* ---------- Produtos (registar, editar, remover) ---------- */
const PRODUCT_FIELDS = ["p-description", "p-category", "p-weight", "p-volume"];

function productError(id) {
    const value = $(id).value;
    if (!value.trim()) return id === "p-category" ? "Choose a category." : "This field is required.";
    if (id === "p-weight" || id === "p-volume") {
        const n = parseNumber(value);
        if (Number.isNaN(n)) return "Enter a number.";
        if (n <= 0) return "Must be greater than 0.";
    }
    return "";
}

PRODUCT_FIELDS.forEach((id) => {
    const clear = () => setError($(id), $(`${id}-error`), "");
    $(id).addEventListener("input", clear);
    $(id).addEventListener("change", clear);
});

function clearProductErrors() {
    PRODUCT_FIELDS.forEach((id) => setError($(id), $(`${id}-error`), ""));
    $("product-summary").hidden = true;
}

/* Passa o formulário para "editar" (com os dados do produto) ou de volta para "registar". */
function setProductMode(product) {
    editingProductId = product ? product.id : null;
    $("product-form").reset();
    clearProductErrors();
    if (product) {
        $("p-description").value = product.description;
        $("p-category").value = product.category;
        $("p-weight").value = String(product.weight);
        $("p-volume").value = String(product.volume);
    }
    $("product-form-title").textContent = product ? "Edit product" : "Register product";
    $("product-submit").textContent = product ? "Save changes" : "Register product";
    $("product-cancel").hidden = !product;
    renderProducts();
}

$("product-cancel").addEventListener("click", () => setProductMode(null));

$("product-form").addEventListener("submit", (e) => {
    e.preventDefault();

    let errors = 0;
    PRODUCT_FIELDS.forEach((id) => {
        const message = productError(id);
        setError($(id), $(`${id}-error`), message);
        if (message) errors++;
    });

    showSummary($("product-summary"), errors);
    if (errors) {
        document.querySelector('#product-form [aria-invalid="true"]').focus();
        return;
    }

    const data = {
        description: $("p-description").value.trim(),
        category: $("p-category").value,
        weight: parseNumber($("p-weight").value),
        volume: parseNumber($("p-volume").value)
    };

    if (editingProductId !== null) {
        Object.assign(productById(editingProductId), data);
        toast(`Product "${data.description}" updated.`);
    } else {
        products.push(Object.assign({ id: nextProductId++, created: new Date().toISOString().slice(0, 10) }, data));
        toast(`Product "${data.description}" registered.`);
    }
    setProductMode(null);
    renderPicker();
    renderOrders();
});

function renderProducts() {
    $("count-products").textContent = products.length;
    $("product-rows").innerHTML = products.length
        ? products.map((p) => `
            <tr${p.id === editingProductId ? ' class="is-editing"' : ""}>
                <td>${esc(p.description)}</td>
                <td>${esc(p.category)}</td>
                <td class="num nowrap">${fmt(p.weight, 2)} kg</td>
                <td class="num nowrap">${fmt(p.volume, 3)} m³</td>
                <td class="nowrap" title="${esc(p.created)}">${new Date(p.created).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                <td class="num nowrap">
                    <button type="button" class="btn-edit" data-edit="${p.id}" aria-label="Edit ${esc(p.description)}">Edit</button>
                    <button type="button" class="btn-remove" data-id="${p.id}" aria-label="Remove ${esc(p.description)}">Remove</button>
                </td>
            </tr>`).join("")
        : `<tr><td colspan="6" class="empty">You have no registered products yet.</td></tr>`;
}

$("product-rows").addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit");
    if (editBtn) {
        setProductMode(productById(Number(editBtn.dataset.edit)));
        $("p-description").focus();
        return;
    }
    const button = e.target.closest(".btn-remove");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (orders.some((o) => isActive(o) && o.items.includes(id))) {
        toast("This product is in an active order and cannot be removed.");
        return;
    }
    if (id === editingProductId) setProductMode(null);
    products.splice(products.findIndex((p) => p.id === id), 1);
    renderProducts();
    renderPicker();
});

/* ---------- Active orders and history ---------- */
function stepper(status) {
    const current = FLOW.indexOf(status);
    return `<ol class="progress-steps">${STEP_LABELS.map((label, i) => {
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
                    <div><dt>Origin</dt><dd>${coord(o.origin)}</dd></div>
                    <div><dt>Destination</dt><dd>${coord(o.dest)}</dd></div>
                    <div class="full"><dt>Products</dt><dd>${esc(orderProducts(o))}</dd></div>
                    <div><dt>Courier</dt><dd>${o.courier || "Unassigned"}</dd></div>
                    <div><dt>Vehicle</dt><dd>${o.vehicle || "Unassigned"}</dd></div>
                </dl>
                ${stepper(o.status)}
            </article>`).join("")
        : `<div class="card empty">${term ? "No active order with that number." : "You have no active orders."}</div>`;

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
                <td class="nowrap">${new Date(o.date).toLocaleDateString("en-GB")}</td>
                <td><span class="badge ${o.status}">${STATUS[o.status]}</span></td>
            </tr>`).join("")
        : `<tr><td colspan="8" class="empty">No orders to show.</td></tr>`;
}

$("search").addEventListener("input", renderOrders);

document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
        historyFilter = chip.dataset.filter;
        document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
        renderOrders();
    });
});

/* ---------- Clock ---------- */
function tick() {
    $("clock").textContent = new Date().toLocaleString("en-GB", {
        weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
}

/* ---------- Start-up ---------- */
initMap();
renderProducts();
renderPicker();
renderOrders();
tick();
setInterval(tick, 30000);
showView("new-order");
