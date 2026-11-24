// ===== Comum à Staff page e ao bloco do estafeta (módulo do Miguel) =====
// Os pedidos à API usam o apiRequest() do users.js (Gonçalo). Aqui fica:
//   - apiUpload(): o mesmo, mas para enviar ficheiros (multipart/form-data)
//   - formatação de datas e da validade dos certificados
// Tem de ser carregado depois do users.js.

/**
 * Envia um formulário com ficheiros para a API e devolve o JSON da resposta.
 * Os erros vêm iguais aos do apiRequest() (ApiError com status, code, message e fields).
 *   const data = await apiUpload('/courier/vehicles', new FormData(form));
 */
async function apiUpload(path, formData) {
    let response;
    try {
        // Sem Content-Type: o browser põe o multipart/form-data com o "boundary" certo
        response = await fetch(API_BASE + path, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            credentials: 'same-origin',
            body: formData
        });
    } catch (networkError) {
        throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Please try again.', {});
    }

    let data = null;
    try {
        data = await response.json();
    } catch (parseError) {
        // não era JSON (ex.: ficheiro maior do que o PHP aceita)
    }
    if (response.status === 401) {
        clearSession();
        window.location.replace('login.html');
    }
    if (!response.ok) {
        const error = (data && data.error) || {};
        throw new ApiError(response.status, error.code || 'UNKNOWN_ERROR',
            error.message || 'Unexpected error. Please try again.', error.fields || {});
    }
    return data;
}

/** Endereço do ficheiro de um certificado (a API verifica quem pede). */
function fleetFileUrl(apiPath) {
    return API_BASE + apiPath;
}

function fleetEscape(text) {
    return String(text === null || text === undefined ? '' : text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// '2026-11-24' ou '2026-11-24 10:05:00' -> '24/11/2026'
function fleetDate(value) {
    if (!value) {
        return '–';
    }
    const p = String(value).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
}

// '2026-11-24 10:05:00' -> '24/11/2026, 10:05'
function fleetDateTime(value) {
    return value ? fleetDate(value) + ', ' + String(value).slice(11, 16) : '–';
}

// Texto da validade, a partir de state e days_left que vêm da API
function fleetDocText(doc) {
    const n = doc.days_left;
    if (doc.state === 'expired') {
        return 'Expired ' + (-n) + (n === -1 ? ' day ago' : ' days ago');
    }
    if (n === 0) {
        return 'Expires today';
    }
    if (doc.state === 'expiring') {
        return 'Expires in ' + n + (n === 1 ? ' day' : ' days');
    }
    return 'Valid';
}

const FLEET_DOC_LABEL = { insurance: 'Insurance', inspection: 'Inspection' };
