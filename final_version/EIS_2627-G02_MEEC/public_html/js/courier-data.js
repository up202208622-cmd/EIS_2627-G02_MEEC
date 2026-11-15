// Sample data for Sprint 1.
// Field names follow the ER model (Vehicle, Order, Product), so that in
// Sprint 2 these objects can be replaced by data coming from the database.
// Dates are relative to today, so the alerts always show up in the demo.
function inDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

window.COURIER_DATA = {
    courier: { name: 'Rui Martins' },

    // Staff and courier are alerted when a document expires within this many days.
    alert_window_days: 3,

    vehicles: [
        {
            id: 1, license_plate: '12-AB-34', model: 'Renault Kangoo', type_name: 'Van',
            max_weight_kg: 600, max_vol_m3: 3.5, approval_status: 'approved',
            insurance_expiry_date: inDays(2), inspection_expiry_date: inDays(200)
        },
        {
            id: 2, license_plate: '45-CD-67', model: 'Yamaha NMAX', type_name: 'Moto',
            max_weight_kg: 25, max_vol_m3: 0.15, approval_status: 'approved',
            insurance_expiry_date: inDays(180), inspection_expiry_date: inDays(-1)
        },
        {
            id: 3, license_plate: '78-EF-90', model: 'Mercedes Sprinter', type_name: 'Van',
            max_weight_kg: 1200, max_vol_m3: 11, approval_status: 'pending',
            insurance_expiry_date: inDays(120), inspection_expiry_date: inDays(90)
        },
        {
            id: 4, license_plate: '23-GH-45', model: 'Fiat Doblò', type_name: 'Van',
            max_weight_kg: 750, max_vol_m3: 4, approval_status: 'disapproved',
            insurance_expiry_date: inDays(-10), inspection_expiry_date: inDays(60)
        }
    ],

    // Orders waiting to be accepted (status "initiated"). Common origin: FEUP.
    orders: [
        {
            id: 1042, status: 'initiated', attempt: 1,
            origin_name: 'FEUP', origin_lat: 41.178, origin_long: -8.596,
            dest_name: 'Aliados', dest_lat: 41.1496, dest_long: -8.6109,
            products: '2× Small box', weight_kg: 4, volume_m3: 0.02
        },
        {
            id: 1043, status: 'initiated', attempt: 1,
            origin_name: 'FEUP', origin_lat: 41.178, origin_long: -8.596,
            dest_name: 'Boavista', dest_lat: 41.1579, dest_long: -8.6291,
            products: 'Office supplies', weight_kg: 120, volume_m3: 0.8
        },
        {
            id: 1047, status: 'initiated', attempt: 1,
            origin_name: 'FEUP', origin_lat: 41.178, origin_long: -8.596,
            dest_name: 'Matosinhos', dest_lat: 41.1844, dest_long: -8.6963,
            products: 'Envelope and 1 box', weight_kg: 15, volume_m3: 0.1
        },
        {
            id: 1050, status: 'initiated', attempt: 2,
            origin_name: 'FEUP', origin_lat: 41.178, origin_long: -8.596,
            dest_name: 'Gaia', dest_lat: 41.1239, dest_long: -8.6118,
            products: 'Pallets of drinks', weight_kg: 700, volume_m3: 2
        }
    ],

    // History of completed orders.
    completed: [
        { id: 1031, dest_name: 'Foz do Douro', completed_at: '08/11/2026, 11:42', pod_type: 'signature' },
        { id: 1035, dest_name: 'Campanhã', completed_at: '09/11/2026, 16:05', pod_type: 'photo' }
    ]
};
