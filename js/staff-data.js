// ===== Dados de exemplo de "Orders and routes" e "Proof of delivery" (Staff page) =====
// Sprint 2: os veículos, certificados, contas e a fila de despacho já vêm da API (staff.js).
// Estes dados só servem o staff-orders.js até haver a API das encomendas, das rotas e da e-POD.
// (Os veículos daqui só são usados para mostrar o modelo e a matrícula de cada rota.)

// Data de hoje + n dias, no formato YYYY-MM-DD (n negativo = no passado)
function daysFromToday(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

const STAFF_DATA = {
    // Staff e courier são avisados quando um documento expira dentro destes dias
    // (o mesmo valor do courier-data.js)
    alert_window_days: 3,

    // Origem comum de todas as encomendas (marcador do FEUP, RNF-08)
    origin: { name: 'FEUP', lat: 41.178, long: -8.596 },

    // ===== Vehicle =====
    // approval_status: 'pending' | 'approved' | 'disapproved' (os mesmos do courier-data.js)
    // doc_update: o courier carregou um certificado novo e o Staff ainda não o verificou
    vehicles: [
        // --- Pedidos novos (pendentes) ---
        {
            id: 3, courier: 'Rui Martins', license_plate: '78-EF-90', model: 'Mercedes Sprinter', type_name: 'Van',
            max_weight_kg: 1200, max_vol_m3: 11, approval_status: 'pending',
            insurance_expiry_date: daysFromToday(120), inspection_expiry_date: daysFromToday(90),
            insurance_doc: 'insurance_78-EF-90.pdf', inspection_doc: 'inspection_78-EF-90.pdf',
            created_at: daysFromToday(-1)
        },
        {
            id: 11, courier: 'Sofia Ribeiro', license_plate: '31-KL-08', model: 'Honda PCX 125', type_name: 'Moto',
            max_weight_kg: 30, max_vol_m3: 0.18, approval_status: 'pending',
            insurance_expiry_date: daysFromToday(300), inspection_expiry_date: daysFromToday(2),
            insurance_doc: 'insurance_31-KL-08.pdf', inspection_doc: 'inspection_31-KL-08.jpg',
            created_at: daysFromToday(-2)
        },
        {
            id: 12, courier: 'Carlos Nunes', license_plate: '56-MN-12', model: 'Peugeot Partner', type_name: 'Van',
            max_weight_kg: 650, max_vol_m3: 3.3, approval_status: 'pending',
            insurance_expiry_date: daysFromToday(-4), inspection_expiry_date: daysFromToday(150),
            insurance_doc: 'insurance_56-MN-12.pdf', inspection_doc: 'inspection_56-MN-12.pdf',
            created_at: daysFromToday(-3)
        },
        {
            id: 13, courier: 'Inês Carvalho', license_plate: '90-QR-33', model: 'Iveco Daily', type_name: 'Truck',
            max_weight_kg: 3500, max_vol_m3: 18, approval_status: 'pending',
            insurance_expiry_date: daysFromToday(45), inspection_expiry_date: daysFromToday(200),
            insurance_doc: 'insurance_90-QR-33.pdf', inspection_doc: 'inspection_90-QR-33.pdf',
            created_at: daysFromToday(-4)
        },

        // --- Frota já aprovada (para os alertas de validade) ---
        {
            id: 1, courier: 'Rui Martins', license_plate: '12-AB-34', model: 'Renault Kangoo', type_name: 'Van',
            max_weight_kg: 600, max_vol_m3: 3.5, approval_status: 'approved',
            insurance_expiry_date: daysFromToday(2), inspection_expiry_date: daysFromToday(200),
            insurance_doc: 'insurance_12-AB-34.pdf', inspection_doc: 'inspection_12-AB-34.pdf',
            created_at: daysFromToday(-90)
        },
        {
            id: 2, courier: 'Rui Martins', license_plate: '45-CD-67', model: 'Yamaha NMAX', type_name: 'Moto',
            max_weight_kg: 25, max_vol_m3: 0.15, approval_status: 'approved',
            insurance_expiry_date: daysFromToday(180), inspection_expiry_date: daysFromToday(-1),
            insurance_doc: 'insurance_45-CD-67.pdf', inspection_doc: 'inspection_45-CD-67.pdf',
            created_at: daysFromToday(-60)
        },
        {
            id: 7, courier: 'Sofia Ribeiro', license_plate: '67-ST-21', model: 'Citroën Berlingo', type_name: 'Van',
            max_weight_kg: 800, max_vol_m3: 4.4, approval_status: 'approved',
            insurance_expiry_date: daysFromToday(90), inspection_expiry_date: daysFromToday(365),
            insurance_doc: 'insurance_67-ST-21.pdf', inspection_doc: 'inspection_67-ST-21_new.pdf',
            created_at: daysFromToday(-120),
            doc_update: { kind: 'inspection', uploaded_at: daysFromToday(0) + 'T08:47' }
        },
        {
            id: 9, courier: 'Carlos Nunes', license_plate: '09-UV-54', model: 'Honda Forza 350', type_name: 'Moto',
            max_weight_kg: 35, max_vol_m3: 0.2, approval_status: 'approved',
            insurance_expiry_date: daysFromToday(25), inspection_expiry_date: daysFromToday(400),
            insurance_doc: 'insurance_09-UV-54.pdf', inspection_doc: 'inspection_09-UV-54.pdf',
            created_at: daysFromToday(-45)
        },

        // --- Recusado ---
        {
            id: 4, courier: 'Rui Martins', license_plate: '23-GH-45', model: 'Fiat Doblò', type_name: 'Van',
            max_weight_kg: 750, max_vol_m3: 4, approval_status: 'disapproved',
            insurance_expiry_date: daysFromToday(-10), inspection_expiry_date: daysFromToday(60),
            insurance_doc: 'insurance_23-GH-45.pdf', inspection_doc: 'inspection_23-GH-45.pdf',
            created_at: daysFromToday(-12)
        }
    ],

    // ===== Order =====
    // status: 'initiated' | 'in-progress' | 'completed' | 'cancelled'
    // (os nomes das classes .status-* que já existem no style.css)
    // route_id: rota onde a encomenda está (null = ainda ninguém a aceitou)
    orders: [
        { id: 1031, client: 'Ana Costa',      dest_name: 'Foz do Douro',          dest_lat: 41.1500, dest_long: -8.6740, status: 'completed',   attempt: 1, weight_kg: 3,   route_id: 201, created_at: daysFromToday(-6) + 'T18:20' },
        { id: 1033, client: 'Bruno Teixeira', dest_name: 'Cedofeita',             dest_lat: 41.1530, dest_long: -8.6200, status: 'completed',   attempt: 1, weight_kg: 12,  route_id: 203, created_at: daysFromToday(-5) + 'T16:02' },
        { id: 1034, client: 'Carla Mendes',   dest_name: 'Bonfim',                dest_lat: 41.1460, dest_long: -8.5960, status: 'completed',   attempt: 1, weight_kg: 6,   route_id: 203, created_at: daysFromToday(-5) + 'T17:45' },
        { id: 1035, client: 'Ana Costa',      dest_name: 'Campanhã',              dest_lat: 41.1488, dest_long: -8.5856, status: 'completed',   attempt: 1, weight_kg: 1,   route_id: 204, created_at: daysFromToday(-5) + 'T19:10' },
        { id: 1036, client: 'Diogo Ferreira', dest_name: 'Antas',                 dest_lat: 41.1617, dest_long: -8.5843, status: 'completed',   attempt: 2, weight_kg: 20,  route_id: 203, created_at: daysFromToday(-6) + 'T11:30' },
        { id: 1038, client: 'Bruno Teixeira', dest_name: 'Paranhos',              dest_lat: 41.1700, dest_long: -8.6050, status: 'completed',   attempt: 1, weight_kg: 8,   route_id: 208, created_at: daysFromToday(-1) + 'T15:40' },
        { id: 1039, client: 'Carla Mendes',   dest_name: 'Ribeira',               dest_lat: 41.1407, dest_long: -8.6131, status: 'in-progress', attempt: 1, weight_kg: 35,  route_id: 208, created_at: daysFromToday(-1) + 'T16:25' },
        { id: 1040, client: 'Ana Costa',      dest_name: 'Senhora da Hora',       dest_lat: 41.1866, dest_long: -8.6530, status: 'in-progress', attempt: 1, weight_kg: 14,  route_id: 208, created_at: daysFromToday(-1) + 'T17:05' },
        { id: 1041, client: 'Diogo Ferreira', dest_name: 'Maia',                  dest_lat: 41.2357, dest_long: -8.6199, status: 'cancelled',   attempt: 1, weight_kg: 5,   route_id: null, created_at: daysFromToday(-1) + 'T18:50' },
        { id: 1042, client: 'Ana Costa',      dest_name: 'Aliados',               dest_lat: 41.1496, dest_long: -8.6109, status: 'initiated',   attempt: 1, weight_kg: 4,   route_id: null, created_at: daysFromToday(0) + 'T08:12' },
        { id: 1043, client: 'Bruno Teixeira', dest_name: 'Boavista',              dest_lat: 41.1579, dest_long: -8.6291, status: 'initiated',   attempt: 1, weight_kg: 120, route_id: null, created_at: daysFromToday(0) + 'T08:30' },
        { id: 1044, client: 'Carla Mendes',   dest_name: 'Rio Tinto',             dest_lat: 41.1780, dest_long: -8.5590, status: 'initiated',   attempt: 1, weight_kg: 2,   route_id: 209, created_at: daysFromToday(0) + 'T08:41' },
        { id: 1045, client: 'Diogo Ferreira', dest_name: 'São Mamede de Infesta', dest_lat: 41.1990, dest_long: -8.6060, status: 'initiated',   attempt: 1, weight_kg: 4,   route_id: 209, created_at: daysFromToday(0) + 'T09:02' },
        { id: 1047, client: 'Ana Costa',      dest_name: 'Matosinhos',            dest_lat: 41.1844, dest_long: -8.6963, status: 'initiated',   attempt: 1, weight_kg: 15,  route_id: null, created_at: daysFromToday(0) + 'T09:20' },
        { id: 1050, client: 'Bruno Teixeira', dest_name: 'Gaia',                  dest_lat: 41.1239, dest_long: -8.6118, status: 'initiated',   attempt: 2, weight_kg: 700, route_id: null, created_at: daysFromToday(0) + 'T09:55' }
    ],

    // ===== Route + Route_Order =====
    // status: o mesmo conjunto de estados das encomendas
    // orders: ids das encomendas pela ordem de entrega (campo "sequence" da Route_Order)
    routes: [
        { id: 209, courier: 'Carlos Nunes',  vehicle_id: 9, status: 'initiated',   created_at: daysFromToday(0) + 'T10:40',  orders: [1044, 1045] },
        { id: 208, courier: 'Rui Martins',   vehicle_id: 1, status: 'in-progress', created_at: daysFromToday(0) + 'T09:10',  orders: [1038, 1039, 1040] },
        { id: 204, courier: 'Rui Martins',   vehicle_id: 2, status: 'completed',   created_at: daysFromToday(-4) + 'T15:20', orders: [1035] },
        { id: 203, courier: 'Sofia Ribeiro', vehicle_id: 7, status: 'completed',   created_at: daysFromToday(-4) + 'T09:30', orders: [1033, 1034, 1036] },
        { id: 201, courier: 'Rui Martins',   vehicle_id: 1, status: 'completed',   created_at: daysFromToday(-5) + 'T11:05', orders: [1031] }
    ],

    // ===== Proof_of_Delivery (e-POD) =====
    // type: 'signature' | 'photo'; recipient: quem recebeu (RF-23)
    // file: nome do ficheiro que o courier enviou (no Sprint 1 a imagem é desenhada pelo staff.js)
    pods: [
        { id: 1, order_id: 1031, type: 'signature', file: 'pod_1031.png', recipient: 'Manuel Costa',          delivered_at: daysFromToday(-5) + 'T11:42' },
        { id: 2, order_id: 1033, type: 'photo',     file: 'pod_1033.jpg', recipient: 'Paulo Sá (concierge)',  delivered_at: daysFromToday(-4) + 'T10:15' },
        { id: 3, order_id: 1034, type: 'signature', file: 'pod_1034.png', recipient: 'Carla Mendes',          delivered_at: daysFromToday(-4) + 'T10:48' },
        { id: 4, order_id: 1036, type: 'photo',     file: 'pod_1036.jpg', recipient: 'Diogo Ferreira',        delivered_at: daysFromToday(-4) + 'T11:30' },
        { id: 5, order_id: 1035, type: 'photo',     file: 'pod_1035.jpg', recipient: 'Rita Costa',            delivered_at: daysFromToday(-4) + 'T16:05' },
        { id: 6, order_id: 1038, type: 'signature', file: 'pod_1038.png', recipient: 'Bruno Teixeira',        delivered_at: daysFromToday(0) + 'T09:52' }
    ]
};
