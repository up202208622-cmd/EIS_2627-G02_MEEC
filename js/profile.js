// ===== Formulário "My profile" (Client e Courier) =====
// Igual ao do Admin: detalhes pessoais + mudança de password (opcional).
// Usa as funções comuns do validation.js. Sem servidor: só atualiza o ecrã e a sessão;
// no Sprint 2 os dados guardam-se na tabela User.

function initProfile(opts) {
    const p = opts.prefix;
    const id = function (name) { return p + '-' + name; };
    const u = opts.user;

    const extra = opts.readonly ? '<div class="pf-field"><label for="' + id('extra') + '">' + opts.readonly.label + '</label>' +
        '<input type="text" id="' + id('extra') + '" value="' + opts.readonly.value + '" readonly aria-describedby="' + id('extra-hint') + '">' +
        '<p class="pf-hint" id="' + id('extra-hint') + '">' + opts.readonly.hint + '</p></div>' : '';

    opts.root.innerHTML =
        '<form class="pf-form" id="' + id('form') + '" novalidate>' +
        '<div class="pf-field"><label for="' + id('name') + '">Full name</label>' +
        '<input type="text" id="' + id('name') + '" autocomplete="name" aria-describedby="' + id('name-error') + '">' +
        '<p class="field-error" id="' + id('name-error') + '"></p></div>' +

        '<div class="pf-row">' +
        '<div class="pf-field"><label for="' + id('username') + '">Username</label>' +
        '<input type="text" id="' + id('username') + '" autocomplete="username" aria-describedby="' + id('username-hint') + ' ' + id('username-error') + '">' +
        '<p class="pf-hint" id="' + id('username-hint') + '">3 to 20 letters, numbers, dot or _</p>' +
        '<p class="field-error" id="' + id('username-error') + '"></p></div>' +
        '<div class="pf-field"><label for="' + id('email') + '">Email</label>' +
        '<input type="email" id="' + id('email') + '" autocomplete="email" aria-describedby="' + id('email-error') + '">' +
        '<p class="field-error" id="' + id('email-error') + '"></p></div>' +
        '</div>' +

        '<div class="pf-row">' +
        '<div class="pf-field"><label for="' + id('phone') + '">Phone</label>' +
        '<input type="tel" id="' + id('phone') + '" autocomplete="tel" inputmode="numeric" maxlength="9" aria-describedby="' + id('phone-error') + '">' +
        '<p class="field-error" id="' + id('phone-error') + '"></p></div>' +
        '<div class="pf-field"><label for="' + id('nif') + '">NIF (tax number)</label>' +
        '<input type="text" id="' + id('nif') + '" inputmode="numeric" maxlength="9" aria-describedby="' + id('nif-error') + '">' +
        '<p class="field-error" id="' + id('nif-error') + '"></p></div>' +
        '</div>' +

        (extra ? '<div class="pf-row">' + extra + '</div>' : '') +

        '<fieldset class="pf-fieldset"><legend>Change password <span class="pf-optional">(optional)</span></legend>' +
        '<div class="pf-row">' +
        '<div class="pf-field"><label for="' + id('password') + '">New password</label>' +
        '<div class="password-wrap pf-password"><input type="password" id="' + id('password') + '" autocomplete="new-password" aria-describedby="' + id('password-hint') + ' ' + id('password-error') + '">' +
        '<button type="button" class="pf-toggle" data-pf-toggle="' + id('password') + '" aria-pressed="false">Show</button></div>' +
        '<p class="pf-hint" id="' + id('password-hint') + '">At least 8 characters, with letters and numbers</p>' +
        '<p class="field-error" id="' + id('password-error') + '"></p></div>' +
        '<div class="pf-field"><label for="' + id('password2') + '">Confirm password</label>' +
        '<div class="password-wrap pf-password"><input type="password" id="' + id('password2') + '" autocomplete="new-password" aria-describedby="' + id('password2-error') + '">' +
        '<button type="button" class="pf-toggle" data-pf-toggle="' + id('password2') + '" aria-pressed="false">Show</button></div>' +
        '<p class="field-error" id="' + id('password2-error') + '"></p></div>' +
        '</div></fieldset>' +

        '<div><button class="btn btn-primary" type="submit">Save changes</button></div>' +
        '<p class="pf-status" id="' + id('status') + '" role="status"></p>' +
        '</form>';

    const form = byId(id('form'));
    const status = byId(id('status'));
    byId(id('name')).value = u.name;
    byId(id('username')).value = u.username;
    byId(id('email')).value = u.email;
    byId(id('phone')).value = u.phone;
    byId(id('nif')).value = u.nif;

    clearErrorsOnInput(form);

    form.querySelectorAll('[data-pf-toggle]').forEach(function (button) {
        const input = byId(button.dataset.pfToggle);
        button.addEventListener('click', function () {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            button.textContent = show ? 'Hide' : 'Show';
            button.setAttribute('aria-pressed', String(show));
        });
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        status.textContent = '';
        status.className = 'pf-status';

        const ok = validate([
            [byId(id('name')), function (v) {
                return required(v) || (v.length < 3 ? 'Please write your full name.' : '');
            }],
            [byId(id('username')), function (v) {
                return required(v) || (USERNAME_RE.test(v) ? '' : 'Use 3 to 20 letters, numbers, dot or _.');
            }],
            [byId(id('email')), validEmail],
            [byId(id('phone')), function (v) {
                return required(v) || (PHONE_RE.test(v) ? '' : '9 digits, starting with 2 or 9.');
            }],
            [byId(id('nif')), function (v) {
                return required(v) || (!/^\d{9}$/.test(v) ? 'The NIF must have exactly 9 digits.' : (isValidNif(v) ? '' : 'Invalid NIF. Check the number.'));
            }],
            // A password é opcional: só se valida se for preenchida
            [byId(id('password')), function (v) {
                if (v === '') { return ''; }
                if (v.length < 8) { return 'At least 8 characters.'; }
                if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) { return 'Use letters and numbers.'; }
                return '';
            }],
            [byId(id('password2')), function (v) {
                const password = byId(id('password')).value.trim();
                if (password === '' && v === '') { return ''; }
                return required(v) || (v === password ? '' : 'Passwords do not match.');
            }]
        ]);

        if (!ok) {
            status.textContent = 'Please fix the highlighted fields.';
            status.className = 'pf-status error';
            return;
        }

        const name = byId(id('name')).value.trim();
        byId(id('password')).value = '';
        byId(id('password2')).value = '';
        status.textContent = 'Your details were updated.';
        status.className = 'pf-status success';

        const session = getSession();
        if (session) {
            setSession({ email: session.email, name: name, role: session.role });   // o email de login mantém-se (demo)
        }
        if (opts.onSaved) { opts.onSaved(name); }
    });
}
