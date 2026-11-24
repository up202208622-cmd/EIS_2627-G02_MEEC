// ===== Estafeta: veículos, documentos e propostas de despacho (módulo do Miguel) =====
// RF-16 registar veículo · RF-35 certificado novo · RF-36 alertas · WP3 propostas com 60 s.
// Bloco independente para pôr na Courier page (do Rafael) sem mexer no código dela:
//   1. <div id="fleet-panel"></div> no sítio onde deve aparecer "My vehicles"
//   2. <link rel="stylesheet" href="css/courier-fleet.css">
//   3. depois do users.js: <script src="js/fleet-common.js"></script> <script src="js/courier-fleet.js"></script>
//
// O aviso da proposta (60 s) aparece sozinho no canto do ecrã.
// Quando o estafeta aceita, é lançado o evento "fleet:order-assigned" em document,
// para a parte das rotas (Rafael) poder atualizar a lista:
//   document.addEventListener('fleet:order-assigned', function (e) { ... e.detail.order_id ... });
//
// Tudo fica dentro de uma função (IIFE) e os ids começam por "fleet-",
// para não chocar com os nomes e ids da Courier page.
// Usa do validation.js: byId, validate, required, clearError, clearErrorsOnInput;
// do users.js: apiRequest, showServerFieldErrors; do fleet-common.js: apiUpload e as datas.

(function () {
    const OFFER_POLL_MS = 5000;
    const MAX_FILE_BYTES = 5 * 1024 * 1024;
    const PLATE_RE = /^([A-Z]{2}-\d{2}-[A-Z]{2}|\d{2}-[A-Z]{2}-\d{2}|\d{2}-\d{2}-[A-Z]{2}|[A-Z]{2}-\d{2}-\d{2})$/;
    const APPROVAL_LABEL = { pending: 'Waiting for Staff', approved: 'Approved', disapproved: 'Disapproved' };
    const ALERT_KIND = { expired: 'is-expired', expiring: 'is-expiring' };
    const APPROVAL_CLASS = { pending: 'fleet-pill-warn', approved: 'fleet-pill-ok', disapproved: 'fleet-pill-no' };

    const root = byId('fleet-panel');
    if (!root) {
        return;   // a página não tem o sítio para o bloco
    }

    // =====================================================
    // Estrutura (criada aqui para a Courier page só precisar do <div id="fleet-panel">)
    // =====================================================
    root.innerHTML =
        '<section class="panel fleet" aria-labelledby="fleet-title">' +
            '<div class="fleet-head">' +
                '<h2 id="fleet-title">My vehicles</h2>' +
                '<button class="btn btn-outline fleet-btn-sm" type="button" id="fleet-add">Register a vehicle</button>' +
            '</div>' +
            '<p class="fleet-help">Staff checks every vehicle and its insurance and inspection certificates. ' +
                'You are alerted 3 days before a certificate expires; with an expired certificate the vehicle cannot be used.</p>' +
            '<p class="fleet-status" id="fleet-status" role="status"></p>' +
            '<ul class="fleet-alerts" id="fleet-alerts"></ul>' +
            '<div class="fleet-list" id="fleet-list"><p class="fleet-empty">Loading…</p></div>' +
        '</section>';

    const dialogs = document.createElement('div');
    dialogs.innerHTML =
        // ---- Registar veículo ----
        '<dialog class="fleet-modal" id="fleet-register" aria-labelledby="fleet-register-title">' +
            '<form class="fleet-modal-body" id="fleet-register-form" novalidate>' +
                '<h2 id="fleet-register-title">Register a vehicle</h2>' +
                '<p class="fleet-help">It stays waiting until Staff approves it. The capacity comes from the vehicle type.</p>' +
                '<div class="fleet-row">' +
                    field('fleet-type', 'Type', '<select id="fleet-type" required aria-describedby="fleet-type-error"><option value="">Choose…</option></select>') +
                    field('fleet-plate', 'Licence plate', '<input id="fleet-plate" type="text" placeholder="AA-00-AA" maxlength="8" autocomplete="off" required aria-describedby="fleet-plate-error">') +
                '</div>' +
                field('fleet-model', 'Model', '<input id="fleet-model" type="text" maxlength="60" placeholder="e.g. Renault Kangoo" required aria-describedby="fleet-model-error">') +

                '<fieldset><legend>Insurance</legend><div class="fleet-row">' +
                    field('fleet-ins-date', 'Expiry date', '<input id="fleet-ins-date" type="date" required aria-describedby="fleet-ins-date-error">') +
                    field('fleet-ins-file', 'Certificate (PDF, JPG or PNG, max. 5 MB)', '<input id="fleet-ins-file" type="file" accept=".pdf,.jpg,.jpeg,.png" required aria-describedby="fleet-ins-file-error">') +
                '</div></fieldset>' +
                '<fieldset><legend>Inspection</legend><div class="fleet-row">' +
                    field('fleet-insp-date', 'Expiry date', '<input id="fleet-insp-date" type="date" required aria-describedby="fleet-insp-date-error">') +
                    field('fleet-insp-file', 'Certificate (PDF, JPG or PNG, max. 5 MB)', '<input id="fleet-insp-file" type="file" accept=".pdf,.jpg,.jpeg,.png" required aria-describedby="fleet-insp-file-error">') +
                '</div></fieldset>' +
                '<p class="fleet-form-error" id="fleet-register-status" role="alert"></p>' +
                '<div class="fleet-actions">' +
                    '<button class="btn btn-primary" type="submit" id="fleet-register-submit">Send to Staff</button>' +
                    '<button class="btn btn-ghost" type="button" data-fleet-close>Cancel</button>' +
                '</div>' +
            '</form>' +
        '</dialog>' +
        // ---- Novo documento (renovação) ----
        '<dialog class="fleet-modal" id="fleet-renew" aria-labelledby="fleet-renew-title">' +
            '<form class="fleet-modal-body" id="fleet-renew-form" novalidate>' +
                '<h2 id="fleet-renew-title">Upload a new certificate</h2>' +
                '<p class="fleet-help" id="fleet-renew-vehicle"></p>' +
                field('fleet-doc-type', 'Document', '<select id="fleet-doc-type" required aria-describedby="fleet-doc-type-error">' +
                    '<option value="">Choose…</option><option value="insurance">Insurance</option><option value="inspection">Inspection</option></select>') +
                field('fleet-doc-date', 'New expiry date', '<input id="fleet-doc-date" type="date" required aria-describedby="fleet-doc-date-error">') +
                field('fleet-doc-file', 'Certificate (PDF, JPG or PNG, max. 5 MB)', '<input id="fleet-doc-file" type="file" accept=".pdf,.jpg,.jpeg,.png" required aria-describedby="fleet-doc-file-error">') +
                '<p class="fleet-form-error" id="fleet-renew-status" role="alert"></p>' +
                '<div class="fleet-actions">' +
                    '<button class="btn btn-primary" type="submit" id="fleet-renew-submit">Send to Staff</button>' +
                    '<button class="btn btn-ghost" type="button" data-fleet-close>Cancel</button>' +
                '</div>' +
            '</form>' +
        '</dialog>' +
        // ---- Proposta de despacho (WP3) ----
        '<aside class="fleet-offer" id="fleet-offer" aria-labelledby="fleet-offer-title" hidden>' +
            '<p class="fleet-offer-eyebrow">New order for you</p>' +
            '<h2 id="fleet-offer-title">Order</h2>' +
            '<dl class="fleet-offer-facts">' +
                '<div><dt>To pickup</dt><dd id="fleet-offer-distance"></dd></div>' +
                '<div><dt>Trip</dt><dd id="fleet-offer-trip"></dd></div>' +
                '<div><dt>Load</dt><dd id="fleet-offer-load"></dd></div>' +
            '</dl>' +
            '<div class="fleet-countdown" aria-hidden="true"><span id="fleet-offer-bar"></span></div>' +
            '<p class="fleet-offer-time" id="fleet-offer-time" aria-live="off"></p>' +
            '<div class="fleet-actions" id="fleet-offer-actions">' +
                '<button class="btn btn-primary" type="button" id="fleet-offer-accept">Accept</button>' +
                '<button class="btn btn-ghost" type="button" id="fleet-offer-refuse">Refuse</button>' +
            '</div>' +
            '<div class="fleet-offer-result" id="fleet-offer-result" role="status" hidden></div>' +
        '</aside>';
    document.body.appendChild(dialogs);

    function field(id, label, control) {
        return '<div class="fleet-field"><label for="' + id + '">' + label + '</label>' + control +
            '<p class="field-error" id="' + id + '-error"></p></div>';
    }

    // =====================================================
    // Utilitários
    // =====================================================
    function setStatus(message, isError) {
        const status = byId('fleet-status');
        status.textContent = message;
        status.className = 'fleet-status' + (message ? (isError ? ' is-error' : ' is-ok') : '');
    }

    function todayIso() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // "12ab34" ou "12 AB 34" -> "12-AB-34" (o servidor faz o mesmo)
    function normalizePlate(value) {
        const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return clean.length === 6 ? clean.match(/.{2}/g).join('-') : value.trim().toUpperCase();
    }

    // Regras para o validate() do validation.js (devolvem '' ou a mensagem)
    function futureDate(value) {
        return required(value) || (value > todayIso() ? '' : 'The expiry date must be in the future.');
    }
    function fileRule(input) {
        return function () {
            const file = input.files[0];
            if (!file) {
                return 'Please attach the document.';
            }
            if (file.size > MAX_FILE_BYTES) {
                return 'The file is larger than 5 MB.';
            }
            return /\.(pdf|jpe?g|png)$/i.test(file.name) ? '' : 'Use a PDF, JPG or PNG file.';
        };
    }

    // =====================================================
    // Os meus veículos (GET /api/courier/vehicles + /api/courier/alerts)
    // =====================================================
    let myVehicles = [];

    function docBlock(vehicle, type) {
        const doc = vehicle.documents[type];
        return '<div class="fleet-doc fleet-doc-' + doc.state + '">' +
            '<span class="fleet-doc-label">' + FLEET_DOC_LABEL[type] + '</span>' +
            '<strong>' + fleetDate(doc.expiry_date) + '</strong>' +
            '<small>' + fleetDocText(doc) + '</small>' +
            (doc.has_file ? '<a href="' + fleetFileUrl(doc.file_url) + '" target="_blank" rel="noopener">View file</a>' : '') +
            '</div>';
    }

    function renderVehicles() {
        if (!myVehicles.length) {
            byId('fleet-list').innerHTML = '<p class="fleet-empty">You have no vehicles yet. Register one to start receiving orders.</p>';
            return;
        }
        byId('fleet-list').innerHTML = myVehicles.map(function (v) {
            const usable = v.approval_status === 'approved'
                ? (v.usable ? '<span class="fleet-pill fleet-pill-ok">In service</span>'
                            : '<span class="fleet-pill fleet-pill-no">Out of service</span>')
                : '';
            let note = '';
            if (v.approval_status === 'disapproved') {
                note = '<p class="fleet-reason">Reason: ' + fleetEscape(v.disapproval_reason || '–') +
                    '. Upload a new certificate to send the vehicle to Staff again.</p>';
            } else if (v.approval_status === 'approved' && !v.doc_checked) {
                note = '<p class="fleet-note">New certificate sent on ' + fleetDateTime(v.doc_updated_at) + '. Staff will check it.</p>';
            }
            return '<article class="fleet-vehicle">' +
                '<div class="fleet-vehicle-head">' +
                    '<div><strong>' + fleetEscape(v.model) + '</strong>' +
                        '<span class="fleet-sub">' + fleetEscape(v.license_plate) + ' · ' + fleetEscape(v.vehicle_type.name) +
                        ' · up to ' + v.vehicle_type.max_weight_kg + ' kg / ' + v.vehicle_type.max_vol_m3 + ' m³</span></div>' +
                    '<div class="fleet-pills"><span class="fleet-pill ' + APPROVAL_CLASS[v.approval_status] + '">' +
                        APPROVAL_LABEL[v.approval_status] + '</span>' + usable + '</div>' +
                '</div>' +
                note +
                '<div class="fleet-docs">' + docBlock(v, 'insurance') + docBlock(v, 'inspection') + '</div>' +
                '<button class="btn btn-ghost fleet-btn-sm" type="button" data-fleet-renew="' + v.id + '">Upload a new certificate</button>' +
                '</article>';
        }).join('');
    }

    function renderAlerts(alerts) {
        byId('fleet-alerts').innerHTML = alerts.map(function (a) {
            const text = FLEET_DOC_LABEL[a.doc_type] + ' of ' + a.vehicle.license_plate + ' (' + a.vehicle.model + ') ' +
                (a.kind === 'expired'
                    ? 'expired on ' + fleetDate(a.expiry_date) + '. The vehicle cannot be used until you upload a new one.'
                    : fleetDocText(a).toLowerCase() + ' (' + fleetDate(a.expiry_date) + '). Upload the new one soon.');
            return '<li class="fleet-alert ' + ALERT_KIND[a.kind] + '">' + fleetEscape(text) + '</li>';
        }).join('');
    }

    async function loadVehicles() {
        try {
            const results = await Promise.all([apiRequest('GET', '/courier/vehicles'), apiRequest('GET', '/courier/alerts')]);
            myVehicles = results[0].vehicles;
            renderVehicles();
            renderAlerts(results[1].alerts);
        } catch (error) {
            byId('fleet-list').innerHTML = '<p class="fleet-empty is-error">Could not load your vehicles: ' + fleetEscape(error.message) + '</p>';
        }
    }

    byId('fleet-list').addEventListener('click', function (event) {
        const button = event.target.closest('[data-fleet-renew]');
        if (button) {
            openRenew(myVehicles.find(function (v) { return v.id === Number(button.dataset.fleetRenew); }));
        }
    });

    // =====================================================
    // Registar veículo (POST /api/courier/vehicles, multipart)
    // =====================================================
    const registerDialog = byId('fleet-register');
    const registerForm = byId('fleet-register-form');
    const REGISTER_FIELDS = {
        vehicle_type_id: 'fleet-type', license_plate: 'fleet-plate', model: 'fleet-model',
        insurance_expiry_date: 'fleet-ins-date', insurance_file: 'fleet-ins-file',
        inspection_expiry_date: 'fleet-insp-date', inspection_file: 'fleet-insp-file'
    };
    let typesLoaded = false;

    clearErrorsOnInput(registerForm);

    byId('fleet-add').addEventListener('click', async function () {
        registerForm.reset();
        Object.values(REGISTER_FIELDS).forEach(function (id) { clearError(byId(id)); });
        byId('fleet-register-status').textContent = '';
        registerDialog.showModal();
        if (!typesLoaded) {
            try {
                const types = (await apiRequest('GET', '/vehicle-types')).vehicle_types;
                byId('fleet-type').innerHTML = '<option value="">Choose…</option>' + types.map(function (t) {
                    return '<option value="' + t.id + '">' + fleetEscape(t.name) + ' (up to ' + t.max_weight_kg + ' kg, ' + t.max_vol_m3 + ' m³)</option>';
                }).join('');
                typesLoaded = true;
            } catch (error) {
                byId('fleet-register-status').textContent = error.message;
            }
        }
        byId('fleet-type').focus();
    });

    registerForm.addEventListener('submit', async function (event) {
        event.preventDefault();   // impede o envio "normal" do formulário
        byId('fleet-register-status').textContent = '';
        const plate = byId('fleet-plate');
        plate.value = normalizePlate(plate.value);

        const ok = validate([
            [byId('fleet-type'), required],
            [plate, function (v) { return required(v) || (PLATE_RE.test(v) ? '' : 'Use the format AA-00-AA, 00-AA-00, 00-00-AA or AA-00-00.'); }],
            [byId('fleet-model'), function (v) { return required(v) || (v.length >= 2 ? '' : 'Write the model (2 to 60 characters).'); }],
            [byId('fleet-ins-date'), futureDate],
            [byId('fleet-ins-file'), fileRule(byId('fleet-ins-file'))],
            [byId('fleet-insp-date'), futureDate],
            [byId('fleet-insp-file'), fileRule(byId('fleet-insp-file'))]
        ]);
        if (!ok) {
            return;
        }

        const data = new FormData();
        Object.keys(REGISTER_FIELDS).forEach(function (apiField) {
            const input = byId(REGISTER_FIELDS[apiField]);
            data.append(apiField, input.type === 'file' ? input.files[0] : input.value.trim());
        });

        const submit = byId('fleet-register-submit');
        submit.disabled = true;
        try {
            const vehicle = (await apiUpload('/courier/vehicles', data)).vehicle;
            registerDialog.close();
            setStatus(vehicle.license_plate + ' was sent to Staff for approval.');
            await loadVehicles();
        } catch (error) {
            if (!showServerFieldErrors(error.fields, REGISTER_FIELDS)) {
                byId('fleet-register-status').textContent = error.message;
            }
        } finally {
            submit.disabled = false;
        }
    });

    // =====================================================
    // Novo documento (POST /api/courier/vehicles/{id}/documents)
    // =====================================================
    const renewDialog = byId('fleet-renew');
    const renewForm = byId('fleet-renew-form');
    const RENEW_FIELDS = { doc_type: 'fleet-doc-type', expiry_date: 'fleet-doc-date', file: 'fleet-doc-file' };
    let renewVehicle = null;

    clearErrorsOnInput(renewForm);

    function openRenew(vehicle) {
        renewVehicle = vehicle;
        renewForm.reset();
        Object.values(RENEW_FIELDS).forEach(function (id) { clearError(byId(id)); });
        byId('fleet-renew-status').textContent = '';
        byId('fleet-renew-vehicle').textContent = vehicle.model + ' · ' + vehicle.license_plate;
        renewDialog.showModal();
        byId('fleet-doc-type').focus();
    }

    renewForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        byId('fleet-renew-status').textContent = '';
        const ok = validate([
            [byId('fleet-doc-type'), required],
            [byId('fleet-doc-date'), futureDate],
            [byId('fleet-doc-file'), fileRule(byId('fleet-doc-file'))]
        ]);
        if (!ok) {
            return;
        }

        const data = new FormData();
        data.append('doc_type', byId('fleet-doc-type').value);
        data.append('expiry_date', byId('fleet-doc-date').value);
        data.append('file', byId('fleet-doc-file').files[0]);

        const submit = byId('fleet-renew-submit');
        submit.disabled = true;
        try {
            const vehicle = (await apiUpload('/courier/vehicles/' + renewVehicle.id + '/documents', data)).vehicle;
            renewDialog.close();
            setStatus('New ' + FLEET_DOC_LABEL[byId('fleet-doc-type').value].toLowerCase() + ' certificate of ' + vehicle.license_plate +
                (vehicle.resubmitted ? ' sent. Staff will review the vehicle again.' : ' sent. Staff will check it.'));
            await loadVehicles();
        } catch (error) {
            if (!showServerFieldErrors(error.fields, RENEW_FIELDS)) {
                byId('fleet-renew-status').textContent = error.message;
            }
        } finally {
            submit.disabled = false;
        }
    });

    // Botões "Cancel" e clique no fundo escuro fecham as janelas
    [registerDialog, renewDialog].forEach(function (dialog) {
        dialog.addEventListener('click', function (event) {
            if (event.target === dialog || event.target.closest('[data-fleet-close]')) {
                dialog.close();
            }
        });
    });

    // =====================================================
    // Proposta de despacho – WP3 (GET /api/courier/offers/current a cada 5 s)
    // =====================================================
    const offerBox = byId('fleet-offer');
    let offer = null;          // proposta à vista
    let offerTimer = null;     // contador de 1 s
    let answering = false;     // à espera da resposta do servidor

    function showOffer(newOffer) {
        offer = newOffer;
        byId('fleet-offer-title').textContent = 'Order #' + offer.order_id;
        byId('fleet-offer-distance').textContent = offer.distance_km.toFixed(1) + ' km';
        byId('fleet-offer-trip').textContent = offer.trip_km.toFixed(1) + ' km';
        byId('fleet-offer-load').textContent = offer.weight_kg + ' kg · ' + offer.volume_m3 + ' m³';
        byId('fleet-offer-actions').hidden = false;
        byId('fleet-offer-result').hidden = true;
        offerBox.classList.remove('is-done');
        offerBox.hidden = false;
        updateCountdown();
        clearInterval(offerTimer);
        offerTimer = setInterval(function () {
            offer.seconds_left = Math.max(0, offer.seconds_left - 1);
            updateCountdown();
            if (offer.seconds_left === 0) {
                finishOffer('Time is up. The order went to another courier.', false);
            }
        }, 1000);
        byId('fleet-offer-accept').focus();
    }

    function updateCountdown() {
        byId('fleet-offer-bar').style.width = Math.round(offer.seconds_left / 60 * 100) + '%';
        byId('fleet-offer-time').textContent = offer.seconds_left + ' s to answer';
    }

    /** Mostra o resultado no lugar dos botões e fecha o aviso passado algum tempo. */
    function finishOffer(html, keepOpen) {
        clearInterval(offerTimer);
        offer = null;
        byId('fleet-offer-actions').hidden = true;
        byId('fleet-offer-time').textContent = '';
        const result = byId('fleet-offer-result');
        result.innerHTML = html;
        result.hidden = false;
        offerBox.classList.add('is-done');
        if (!keepOpen) {
            setTimeout(function () {
                if (offer === null) {
                    offerBox.hidden = true;
                }
            }, 3000);
        }
    }

    async function pollOffer() {
        if (answering || document.visibilityState === 'hidden') {
            return;
        }
        try {
            const data = await apiRequest('GET', '/courier/offers/current');
            if (data.offer && (!offer || offer.id !== data.offer.id)) {
                showOffer(data.offer);
            } else if (data.offer && offer) {
                offer.seconds_left = data.offer.seconds_left;   // acerta o relógio com o servidor
            } else if (!data.offer && offer) {
                finishOffer('This offer is no longer available.', false);
            }
        } catch (error) {
            // Falha de rede: tenta outra vez daqui a 5 s
        }
    }

    async function answerOffer(action) {
        if (!offer || answering) {
            return;
        }
        answering = true;
        const current = offer;
        byId('fleet-offer-accept').disabled = true;
        byId('fleet-offer-refuse').disabled = true;
        try {
            const result = await apiRequest('POST', '/courier/offers/' + current.id + '/' + action);
            if (action === 'accept') {
                finishOffer(acceptedHtml(result), true);
                document.dispatchEvent(new CustomEvent('fleet:order-assigned', { detail: result }));
                loadVehicles();
            } else {
                finishOffer('Offer refused. It goes to the next courier.', false);
            }
        } catch (error) {
            finishOffer(fleetEscape(error.message), false);
        } finally {
            answering = false;
            byId('fleet-offer-accept').disabled = false;
            byId('fleet-offer-refuse').disabled = false;
        }
    }

    // O código de entrega (WP5) vai para o cliente, não para o estafeta: na entrega é o cliente que o diz.
    function acceptedHtml(result) {
        return '<strong>Order #' + result.order_id + ' is yours.</strong>' +
            '<span>It is now in your orders to deliver. At the door, ask the client for the delivery code.</span>' +
            '<button class="btn btn-ghost fleet-btn-sm" type="button" id="fleet-offer-ok">OK</button>';
    }

    byId('fleet-offer-accept').addEventListener('click', function () { answerOffer('accept'); });
    byId('fleet-offer-refuse').addEventListener('click', function () { answerOffer('decline'); });
    offerBox.addEventListener('click', function (event) {
        if (event.target.id === 'fleet-offer-ok') {
            offerBox.hidden = true;
        }
    });

    // =====================================================
    // Arranque
    // =====================================================
    loadVehicles();
    pollOffer();
    setInterval(pollOffer, OFFER_POLL_MS);
})();
