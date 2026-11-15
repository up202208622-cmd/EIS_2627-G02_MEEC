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

    // ---------- Vehicle documents (expiry alerts) ----------
    var DOC_LABEL = { insurance: 'insurance certificate', inspection: 'inspection certificate' };
    var APPROVAL_LABEL = { approved: 'Approved', pending: 'Pending approval', disapproved: 'Disapproved' };

    function todayIso() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // Whole days from today until the given YYYY-MM-DD date (negative = already expired).
    function daysUntil(iso) {
        return Math.round((Date.parse(iso) - Date.parse(todayIso())) / 86400000);
    }

    function formatDate(iso) {
        var p = iso.split('-');
        return p[2] + '/' + p[1] + '/' + p[0];
    }

    // 'expired' | 'expiring' | 'valid'
    function docState(iso) {
        var n = daysUntil(iso);
        if (n < 0) { return 'expired'; }
        return n <= data.alert_window_days ? 'expiring' : 'valid';
    }

    function docText(iso) {
        var n = daysUntil(iso);
        if (n < 0) { return 'Expired on ' + formatDate(iso); }
        if (n === 0) { return 'Expires today'; }
        if (n <= data.alert_window_days) { return 'Expires in ' + n + (n === 1 ? ' day' : ' days'); }
        return 'Valid until ' + formatDate(iso);
    }

    function docsExpired(v) {
        return docState(v.insurance_expiry_date) === 'expired' || docState(v.inspection_expiry_date) === 'expired';
    }

    function renderAlerts() {
        var ul = $('doc-alerts');
        ul.innerHTML = '';
        data.vehicles.forEach(function (v) {
            ['insurance', 'inspection'].forEach(function (kind) {
                var iso = v[kind + '_expiry_date'];
                var st = docState(iso);
                if (st === 'valid') { return; }
                var li = document.createElement('li');
                li.className = 'msg ' + (st === 'expired' ? 'msg-error' : 'msg-warn');
                li.textContent = v.license_plate + ': ' + DOC_LABEL[kind] + ' ' +
                    (st === 'expired' ? 'expired on ' + formatDate(iso) + '.' : docText(iso).toLowerCase() + ' (' + formatDate(iso) + ').') +
                    ' Update it to keep the vehicle approved.';
                ul.appendChild(li);
            });
        });
    }

    function renderDocs() {
        var body = $('docs-body');
        body.innerHTML = '';
        data.vehicles.forEach(function (v) {
            var tr = document.createElement('tr');
            var th = document.createElement('th');
            th.scope = 'row';
            th.textContent = v.license_plate + ' · ' + v.type_name;
            tr.appendChild(th);

            [v.insurance_expiry_date, v.inspection_expiry_date].forEach(function (iso) {
                var td = document.createElement('td');
                var span = document.createElement('span');
                span.className = 'doc doc-' + docState(iso);
                span.textContent = docText(iso);
                td.appendChild(span);
                tr.appendChild(td);
            });

            var tdA = document.createElement('td');
            var b = document.createElement('span');
            b.className = 'doc doc-' + (v.approval_status === 'approved' ? 'valid' : v.approval_status === 'pending' ? 'expiring' : 'expired');
            b.textContent = APPROVAL_LABEL[v.approval_status];
            tdA.appendChild(b);
            tr.appendChild(tdA);

            var tdB = document.createElement('td');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-outline';
            btn.textContent = 'Update';
            btn.setAttribute('aria-label', 'Update documents of ' + v.license_plate);
            btn.addEventListener('click', function () { openDocsForm(v); });
            tdB.appendChild(btn);
            tr.appendChild(tdB);

            body.appendChild(tr);
        });
        $('alert-window').textContent = String(data.alert_window_days);
    }

    var editingVehicle = null;
    var DOC_FIELDS = ['d-insurance', 'd-insurance-doc', 'd-inspection', 'd-inspection-doc'];

    function openDocsForm(v) {
        closeVehicleForm();
        editingVehicle = v;
        $('docs-form').reset();
        DOC_FIELDS.forEach(function (id) { clearError($(id)); });
        $('docs-form-title').textContent = 'Update documents: ' + v.license_plate;
        $('docs-form').hidden = false;
        $('d-insurance').focus();
    }

    $('docs-cancel').addEventListener('click', function () {
        $('docs-form').hidden = true;
        editingVehicle = null;
    });
    clearErrorsOnInput($('docs-form'));

    function dateError(value, current) {
        var e = required(value);
        if (e) { return e; }
        if (value <= todayIso()) { return 'The new expiry date must be in the future.'; }
        if (current && value < current) { return 'The new date cannot be earlier than the current one (' + formatDate(current) + ').'; }
        return '';
    }

    function fileError(input) {
        var f = input.files[0];
        if (!f) { return 'Attach the certificate.'; }
        if (f.type !== 'application/pdf' && f.type.indexOf('image/') !== 0) { return 'The file must be a PDF or an image.'; }
        return '';
    }

    // Corre uma lista de [id do campo, mensagem] e mostra os erros (helpers do validation.js).
    function showChecks(checks) {
        var ok = true;
        checks.forEach(function (c) {
            clearError($(c[0]));
            if (c[1]) {
                showError($(c[0]), c[1]);
                if (ok) { $(c[0]).focus(); }
                ok = false;
            }
        });
        return ok;
    }

    $('docs-form').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!editingVehicle) { return; }
        var v = editingVehicle;
        var ok = showChecks([
            ['d-insurance', dateError($('d-insurance').value, v.insurance_expiry_date)],
            ['d-insurance-doc', fileError($('d-insurance-doc'))],
            ['d-inspection', dateError($('d-inspection').value, v.inspection_expiry_date)],
            ['d-inspection-doc', fileError($('d-inspection-doc'))]
        ]);
        if (!ok) {
            showMessage('Fix the highlighted fields to update the documents.', 'error');
            return;
        }

        v.insurance_expiry_date = $('d-insurance').value;
        v.inspection_expiry_date = $('d-inspection').value;
        var resubmitted = v.approval_status === 'disapproved';
        if (resubmitted) { v.approval_status = 'pending'; }   // Staff must approve it again
        $('docs-form').hidden = true;
        editingVehicle = null;
        showMessage('Documents of ' + v.license_plate + ' updated. Staff has been notified' +
            (resubmitted ? ' and will review the vehicle again.' : '.'), 'ok');
        renderVehicles();
    });

    // ---------- Register a new vehicle (RF-16) ----------
    // O veículo fica "pending" até o Staff verificar os documentos e aprovar.
    var VEHICLE_FIELDS = ['nv-plate', 'nv-model', 'nv-type', 'nv-weight', 'nv-volume',
        'nv-insurance', 'nv-insurance-doc', 'nv-inspection', 'nv-inspection-doc'];
    var PLATE_RE = /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/;   // matrícula portuguesa: AA-00-BB

    function closeVehicleForm() {
        $('vehicle-form').hidden = true;
        $('new-vehicle-btn').setAttribute('aria-expanded', 'false');
    }

    $('new-vehicle-btn').addEventListener('click', function () {
        $('docs-form').hidden = true;
        editingVehicle = null;
        $('vehicle-form').reset();
        VEHICLE_FIELDS.forEach(function (id) { clearError($(id)); });
        $('vehicle-form').hidden = false;
        $('new-vehicle-btn').setAttribute('aria-expanded', 'true');
        $('nv-plate').focus();
    });
    $('vehicle-cancel').addEventListener('click', closeVehicleForm);
    clearErrorsOnInput($('vehicle-form'));

    function positiveNumber(raw) {
        var e = required(raw.trim());
        if (e) { return e; }
        var n = Number(raw.trim().replace(',', '.'));
        if (Number.isNaN(n)) { return 'Enter a number.'; }
        return n > 0 ? '' : 'Must be greater than 0.';
    }

    function plateError(raw) {
        var value = raw.trim().toUpperCase();
        var e = required(value);
        if (e) { return e; }
        if (!PLATE_RE.test(value)) { return 'Use the format AA-00-BB.'; }
        var exists = data.vehicles.some(function (v) { return v.license_plate === value; });
        return exists ? 'This vehicle is already registered.' : '';
    }

    $('vehicle-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = showChecks([
            ['nv-plate', plateError($('nv-plate').value)],
            ['nv-model', required($('nv-model').value.trim())],
            ['nv-type', $('nv-type').value ? '' : 'Choose the vehicle type.'],
            ['nv-weight', positiveNumber($('nv-weight').value)],
            ['nv-volume', positiveNumber($('nv-volume').value)],
            ['nv-insurance', dateError($('nv-insurance').value, null)],
            ['nv-insurance-doc', fileError($('nv-insurance-doc'))],
            ['nv-inspection', dateError($('nv-inspection').value, null)],
            ['nv-inspection-doc', fileError($('nv-inspection-doc'))]
        ]);
        if (!ok) {
            showMessage('Fix the highlighted fields to register the vehicle.', 'error');
            return;
        }

        var plate = $('nv-plate').value.trim().toUpperCase();
        var nextId = data.vehicles.reduce(function (m, v) { return Math.max(m, v.id); }, 0) + 1;
        data.vehicles.push({
            id: nextId,
            license_plate: plate,
            model: $('nv-model').value.trim(),
            type_name: $('nv-type').value,
            max_weight_kg: Number($('nv-weight').value.trim().replace(',', '.')),
            max_vol_m3: Number($('nv-volume').value.trim().replace(',', '.')),
            approval_status: 'pending',
            insurance_expiry_date: $('nv-insurance').value,
            inspection_expiry_date: $('nv-inspection').value
        });
        closeVehicleForm();
        showMessage('Vehicle ' + plate + ' sent for approval. You can use it once Staff approves it.', 'ok');
        renderVehicles();
    });

    // ---------- Vehicle ----------
    function renderVehicleSelect() {
        var select = $('vehicle-select');
        var keep = select.value;
        select.innerHTML = '<option value="">Select a vehicle…</option>';
        data.vehicles.forEach(function (v) {
            var opt = document.createElement('option');
            opt.value = String(v.id);
            var usable = v.approval_status === 'approved' && !docsExpired(v);
            var note = v.approval_status !== 'approved' ? ' (' + APPROVAL_LABEL[v.approval_status].toLowerCase() + ')'
                     : docsExpired(v) ? ' (documents expired)' : '';
            opt.textContent = v.license_plate + ' · ' + v.model + note;
            opt.disabled = !usable;
            select.appendChild(opt);
        });
        select.value = keep;
        if (select.value !== keep) { select.value = ''; state.vehicleId = null; }
    }

    function renderVehicles() {
        renderVehicleSelect();
        renderVehicleInfo();
        renderDocs();
        renderAlerts();
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
            $('map-note').hidden = false;   // the library did not load
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

    renderVehicles();
    initMap();
    renderAll();
})();
