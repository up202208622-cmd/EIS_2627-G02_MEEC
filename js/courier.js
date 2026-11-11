// Courier page (Sprint 1: everything runs in the browser, with sample data).
(function () {
    'use strict';

    var FEUP = [41.178, -8.596];
    var data = window.COURIER_DATA;

    // ---------- Page state ----------
    var state = {
        vehicleId: null,                          // chosen vehicle
        available: data.orders.slice(),           // orders waiting to be accepted
        selected: {},                             // ids ticked in the list
        route: null,                              // active route: { status, orders }
        completed: data.completed.slice()         // history
    };

    var STATUS_LABEL = { initiated: 'Initiated', in_progress: 'In progress' };
    var POD_LABEL = { signature: 'Signature', photo: 'Photo' };

    function $(id) { return document.getElementById(id); }
    function fmt(n) { return n.toLocaleString('en-GB'); }

    function getVehicle() {
        for (var i = 0; i < data.vehicles.length; i++) {
            if (data.vehicles[i].id === state.vehicleId) { return data.vehicles[i]; }
        }
        return null;
    }

    // ---------- Feedback messages (instead of alert) ----------
    function showMessage(text, type) {
        var box = $('messages');
        box.innerHTML = '';
        var p = document.createElement('p');
        p.className = 'msg msg-' + (type || 'info');
        p.textContent = text;
        box.appendChild(p);
    }

    // The mobile menu and the footer year are handled by js/nav.js.
    $('welcome').textContent = 'Demo session: ' + data.courier.name + '.';

    // ---------- Vehicle ----------
    function renderVehicleSelect() {
        var select = $('vehicle-select');
        data.vehicles.forEach(function (v) {
            var opt = document.createElement('option');
            opt.value = String(v.id);
            var approved = v.approval_status === 'approved';
            opt.textContent = v.license_plate + ' · ' + v.model + (approved ? '' : ' (pending approval)');
            opt.disabled = !approved;
            select.appendChild(opt);
        });
    }

    function renderVehicleInfo() {
        var v = getVehicle();
        $('vehicle-info').hidden = !v;
        $('load').hidden = !v;
        if (!v) { return; }
        $('v-plate').textContent = v.license_plate;
        $('v-type').textContent = v.type_name;
        $('v-weight').textContent = fmt(v.max_weight_kg) + ' kg';
        $('v-volume').textContent = fmt(v.max_vol_m3) + ' m³';
        updateLoad();
    }

    $('vehicle-select').addEventListener('change', function (e) {
        if (state.route) {
            // The vehicle cannot be changed in the middle of a route.
            e.target.value = String(state.vehicleId);
            showMessage('You cannot change vehicle while a route is active.', 'error');
            return;
        }
        state.vehicleId = e.target.value ? Number(e.target.value) : null;
        renderVehicleInfo();
    });

    // ---------- Selected load vs vehicle capacity ----------
    function selectedOrders() {
        return state.available.filter(function (o) { return state.selected[o.id]; });
    }

    function totals(list) {
        var w = 0, v = 0;
        list.forEach(function (o) { w += o.weight_kg; v += o.volume_m3; });
        return { weight: w, volume: v };
    }

    function updateLoad() {
        var veh = getVehicle();
        if (!veh) { return; }
        var t = totals(selectedOrders());
        setLoadRow('weight', t.weight, veh.max_weight_kg, 'kg');
        setLoadRow('volume', t.volume, veh.max_vol_m3, 'm³');
    }

    function setLoadRow(name, used, max, unit) {
        var bar = $('load-' + name);
        bar.value = Math.min(100, (used / max) * 100);
        $('load-' + name + '-text').textContent =
            fmt(Math.round(used * 100) / 100) + ' / ' + fmt(max) + ' ' + unit +
            (used > max ? ' (exceeds capacity)' : '');
        bar.parentNode.classList.toggle('over', used > max);
    }

    // ---------- Available orders ----------
    function renderAvailable() {
        var list = $('available-list');
        list.innerHTML = '';

        state.available.forEach(function (o) {
            var li = document.createElement('li');
            li.className = 'order-card';

            var label = document.createElement('label');
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = String(o.id);
            cb.checked = !!state.selected[o.id];
            cb.addEventListener('change', function () {
                state.selected[o.id] = cb.checked;
                updateLoad();
            });

            var text = document.createElement('span');
            var main = document.createElement('span');
            main.className = 'order-main';
            main.textContent = '#' + o.id + ' · ' + o.origin_name + ' → ' + o.dest_name;
            if (o.attempt > 1) {
                var tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = 'Attempt ' + o.attempt;
                main.appendChild(tag);
            }
            var meta = document.createElement('span');
            meta.className = 'order-meta';
            meta.textContent = o.products + ' · ' + fmt(o.weight_kg) + ' kg · ' + fmt(o.volume_m3) + ' m³';
            text.appendChild(main);
            text.appendChild(meta);

            label.appendChild(cb);
            label.appendChild(text);
            li.appendChild(label);
            list.appendChild(li);
        });

        $('available-empty').hidden = state.available.length > 0;
        $('accept-btn').disabled = state.available.length === 0;
        updateLoad();
    }

    // ---------- Accept orders (creates the route) ----------
    $('accept-btn').addEventListener('click', function () {
        var chosen = selectedOrders();

        if (state.route) {
            showMessage('You already have an active route. Complete or cancel it before accepting another.', 'error');
            return;
        }
        var veh = getVehicle();
        if (!veh) {
            showMessage('Choose the vehicle first.', 'error');
            $('vehicle-select').focus();
            return;
        }
        if (chosen.length === 0) {
            showMessage('Select at least one order.', 'error');
            return;
        }
        var t = totals(chosen);
        if (t.weight > veh.max_weight_kg || t.volume > veh.max_vol_m3) {
            showMessage('The load exceeds the capacity of vehicle ' + veh.license_plate +
                '. Choose another vehicle or fewer orders.', 'error');
            return;
        }

        state.route = { status: 'initiated', orders: chosen };
        state.available = state.available.filter(function (o) { return !state.selected[o.id]; });
        state.selected = {};

        showMessage(chosen.length > 1
            ? 'Consolidated route created with ' + chosen.length + ' orders.'
            : 'Order #' + chosen[0].id + ' accepted.', 'ok');
        renderAll();
    });

    // ---------- Active route ----------
    function renderRoute() {
        var r = state.route;
        $('route-empty').hidden = !!r;
        $('route-panel').hidden = !r;
        $('vehicle-select').disabled = !!r;
        if (!r) { return; }

        var badge = $('route-badge');
        badge.textContent = STATUS_LABEL[r.status];
        badge.className = 'badge badge-' + r.status;

        var order = ['initiated', 'in_progress', 'completed'];
        var idx = order.indexOf(r.status);
        Array.prototype.forEach.call($('stepper').children, function (li, i) {
            li.classList.toggle('done', i < idx);
            li.classList.toggle('current', i === idx);
            if (i === idx) { li.setAttribute('aria-current', 'step'); }
            else { li.removeAttribute('aria-current'); }
        });

        var ul = $('route-orders');
        ul.innerHTML = '';
        r.orders.forEach(function (o) {
            var li = document.createElement('li');
            li.textContent = '#' + o.id + ' · ' + o.origin_name + ' → ' + o.dest_name +
                ' (' + fmt(o.weight_kg) + ' kg)';
            ul.appendChild(li);
        });

        // Only the button for the allowed transition is shown (Initiated → In progress → Completed/Cancelled).
        $('start-btn').hidden = r.status !== 'initiated';
        $('complete-btn').hidden = r.status !== 'in_progress';
        $('cancel-btn').hidden = r.status !== 'in_progress';
    }

    $('start-btn').addEventListener('click', function () {
        state.route.status = 'in_progress';
        showMessage('Delivery started.', 'ok');
        renderAll();
    });

    // Cancel (with confirmation on the page itself)
    $('cancel-btn').addEventListener('click', function () {
        $('epod-form').hidden = true;
        $('cancel-confirm').hidden = false;
        $('cancel-yes').focus();
    });
    $('cancel-no').addEventListener('click', function () {
        $('cancel-confirm').hidden = true;
    });
    $('cancel-yes').addEventListener('click', function () {
        state.route.orders.forEach(function (o) {
            o.attempt += 1;          // new attempt
            o.status = 'initiated';  // goes back to the orders list
            state.available.push(o);
        });
        state.available.sort(function (a, b) { return a.id - b.id; });
        state.route = null;
        $('cancel-confirm').hidden = true;
        showMessage('Delivery cancelled. The orders went back to the available list.', 'info');
        renderAll();
    });

    // ---------- e-POD (signature or photo) ----------
    var canvas = $('sig-canvas');
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var hasInk = false;

    function setupCanvas() {
        // The canvas only has a size once it is visible on the page.
        var ratio = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * ratio));
        canvas.height = Math.max(1, Math.round(rect.height * ratio));
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#10243a';
        hasInk = false;
    }

    function pos(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener('pointerdown', function (e) {
        drawing = true;
        canvas.setPointerCapture(e.pointerId);
        var p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 0.1, p.y + 0.1); // a dot, so that a simple tap counts
        ctx.stroke();
        hasInk = true;
        clearFieldError('sig');
    });
    canvas.addEventListener('pointermove', function (e) {
        if (!drawing) { return; }
        var p = pos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    });
    function stopDrawing() { drawing = false; }
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);

    $('sig-clear').addEventListener('click', setupCanvas);

    function currentPodType() {
        return document.querySelector('input[name="pod-type"]:checked').value;
    }

    Array.prototype.forEach.call(document.querySelectorAll('input[name="pod-type"]'), function (r) {
        r.addEventListener('change', function () {
            var isSig = currentPodType() === 'signature';
            $('pod-signature').hidden = !isSig;
            $('pod-photo').hidden = isSig;
            clearFieldError('sig');
            if (isSig) { setupCanvas(); }
        });
    });

    $('pod-file').addEventListener('change', function (e) {
        var file = e.target.files[0];
        var img = $('pod-preview');
        clearFieldError('sig');
        if (file && file.type.indexOf('image/') === 0) {
            img.src = URL.createObjectURL(file);
            img.hidden = false;
        } else {
            img.hidden = true;
        }
    });

    $('complete-btn').addEventListener('click', function () {
        $('cancel-confirm').hidden = true;
        $('epod-form').hidden = false;
        setupCanvas();
        $('recipient').focus();
    });
    $('epod-back').addEventListener('click', function () {
        $('epod-form').hidden = true;
    });

    // Field errors
    // The recipient field uses the shared helpers from js/validation.js
    // (error shown in <p id="recipient-error">). The signature/photo error has no
    // input with that id, so it has its own small helpers.
    function setFieldError(field, text) {
        if (field === 'recipient') {
            showError($('recipient'), text);
        } else {
            $('sig-error').textContent = text;
            $('sig-error').hidden = false;
        }
    }
    function clearFieldError(field) {
        if (field === 'recipient') {
            clearError($('recipient'));
        } else {
            $('sig-error').hidden = true;
        }
    }
    clearErrorsOnInput($('epod-form'));

    $('epod-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true;
        clearFieldError('recipient');
        clearFieldError('sig');

        var recipientError = required($('recipient').value.trim());
        if (recipientError) {
            setFieldError('recipient', recipientError);
            ok = false;
        }

        var type = currentPodType();
        if (type === 'signature' && !hasInk) {
            setFieldError('sig', 'The signature is required. Ask the recipient to sign.');
            ok = false;
        }
        if (type === 'photo') {
            var file = $('pod-file').files[0];
            if (!file) {
                setFieldError('sig', 'Select a photo of the delivery.');
                ok = false;
            } else if (file.type.indexOf('image/') !== 0) {
                setFieldError('sig', 'The file must be an image.');
                ok = false;
            }
        }
        if (!ok) {
            showMessage('Fix the highlighted fields to complete the delivery.', 'error');
            return;
        }

        // Delivery completed: moves to the history.
        var when = new Date().toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
        state.route.orders.forEach(function (o) {
            state.completed.unshift({ id: o.id, dest_name: o.dest_name, completed_at: when, pod_type: type });
        });
        var n = state.route.orders.length;
        state.route = null;
        $('epod-form').reset();
        $('epod-form').hidden = true;
        $('pod-signature').hidden = false;
        $('pod-photo').hidden = true;
        $('pod-preview').hidden = true;
        showMessage(n > 1 ? 'Deliveries completed and recorded.' : 'Delivery completed and recorded.', 'ok');
        renderAll();
    });

    // ---------- History ----------
    function renderCompleted() {
        var body = $('completed-body');
        body.innerHTML = '';
        state.completed.forEach(function (c) {
            var tr = document.createElement('tr');
            var th = document.createElement('th');
            th.scope = 'row';
            th.textContent = '#' + c.id;
            tr.appendChild(th);
            [c.dest_name, c.completed_at, POD_LABEL[c.pod_type]].forEach(function (text) {
                var td = document.createElement('td');
                td.textContent = text;
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
    }

    // ---------- Leaflet map ----------
    var map = null;
    var layer = null;

    function initMap() {
        if (typeof L === 'undefined') {
            $('map-note').hidden = false;   // the library did not load (no Internet)
            return;
        }
        map = L.map('map', { scrollWheelZoom: false }).setView(FEUP, 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        layer = L.layerGroup().addTo(map);
    }

    function renderMap() {
        if (!map) { return; }
        layer.clearLayers();
        L.marker(FEUP).addTo(layer).bindPopup('Base: FEUP, Porto');

        if (!state.route) {
            map.setView(FEUP, 13);
            $('map-caption').textContent = 'Base: FEUP, Porto.';
            return;
        }
        var points = [FEUP];
        state.route.orders.forEach(function (o) {
            var p = [o.dest_lat, o.dest_long];
            L.marker(p).addTo(layer).bindPopup('#' + o.id + ' · ' + o.dest_name);
            points.push(p);
        });
        L.polyline(points, { color: '#0b7a75', weight: 4, dashArray: '6 8' }).addTo(layer);
        map.fitBounds(L.latLngBounds(points).pad(0.25));
        $('map-caption').textContent = 'Route: FEUP → ' +
            state.route.orders.map(function (o) { return o.dest_name; }).join(' → ') + '.';
    }

    // ---------- Start-up ----------
    function renderAll() {
        renderAvailable();
        renderRoute();
        renderCompleted();
        renderMap();
    }

    renderVehicleSelect();
    initMap();
    renderAll();
})();
