# API – Vehicles, certificates, alerts, courier accounts and dispatch (WP3)

Owner: **Miguel Moreira** · Sprint 2 · for Rafael's `API.md`

- Routes in `api/routes/vehicles.php` and `api/routes/dispatch.php` (Gonçalo's router, all under `/api`).
- JSON in and out, except file uploads (`multipart/form-data`) and certificate downloads.
- Errors use the core's format: `{ "error": { "code", "message", "fields"? } }` (422 has `fields`).
- Uses `sql/schema.sql` as it is: tables `vehicles`, `vehicle_types`, `users`, `orders`, `payments`, `dispatch_offers`, `delivery_codes`. **No schema changes.**

## Vehicle object

```json
{
  "id": 5,
  "courier": { "id": 5, "name": "Sofia Ribeiro", "employee_number": "CRR-1002" },
  "vehicle_type": { "id": 3, "name": "Van", "max_weight_kg": 1000, "max_vol_m3": 8 },
  "license_plate": "67-ST-21",
  "model": "Citroën Berlingo",
  "approval_status": "approved",
  "disapproval_reason": null,
  "reviewed_at": "2026-10-06 11:20:00",
  "created_at": "2026-10-02 12:00:00",
  "documents": {
    "insurance":  { "expiry_date": "2027-06-30", "state": "valid", "days_left": 218, "has_file": true, "file_url": "/vehicles/5/documents/insurance" },
    "inspection": { "expiry_date": "2027-03-14", "state": "valid", "days_left": 110, "has_file": true, "file_url": "/vehicles/5/documents/inspection" }
  },
  "doc_updated_at": "2026-10-02 12:00:00",
  "doc_checked": true,
  "usable": true
}
```

- `state`: `valid` · `expiring` (3 days or less) · `expired`.
- `doc_checked: false` means the courier uploaded a new certificate that Staff has not checked yet (RF-37).
- `usable`: approved **and** neither certificate expired. Only usable vehicles get dispatch offers.

## 1. Courier

| Method | Route | Role | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/vehicle-types` | logged in | – | `200 { "vehicle_types": [{ "id", "name", "max_weight_kg", "max_vol_m3" }] }` |
| GET | `/courier/vehicles` | courier | – | `200 { "vehicles": [Vehicle] }` (own vehicles) |
| POST | `/courier/vehicles` | courier | multipart: `vehicle_type_id`, `license_plate`, `model`, `insurance_expiry_date`, `insurance_file`, `inspection_expiry_date`, `inspection_file` | `201 { "vehicle": Vehicle }` (`pending`) · 422 |
| POST | `/courier/vehicles/{id}/documents` | courier (owner) | multipart: `doc_type` (`insurance` \| `inspection`), `expiry_date`, `file` | `200 { "vehicle": Vehicle + "resubmitted" }` · 404 · 422 |
| GET | `/courier/alerts` | courier | – | `200 { "alerts": [Alert] }` |
| GET | `/vehicles/{id}/documents/{type}` | owner courier, staff, admin | – | the PDF/JPG/PNG file · 404 |

- Plate: Portuguese format (`AA-00-AA`, `00-AA-00`, `00-00-AA`, `AA-00-00`; `12ab34` is accepted and becomes `12-AB-34`), unique.
- Dates: `YYYY-MM-DD`, in the future. Files: PDF, JPG or PNG, max 5 MB (type checked by content).
- A new certificate on an **approved** vehicle keeps it approved and sets `doc_checked = 0`.
  On a **disapproved** vehicle it goes back to `pending` (`resubmitted: true`).

## 2. Staff – vehicles and alerts (RF-26, 27, 28, 37, 38)

| Method | Route | Role | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/staff/vehicles?status=pending` | staff, admin | – | `200 { "vehicles": [Vehicle] }`. `status`: `pending` \| `approved` \| `disapproved` \| `all` |
| POST | `/staff/vehicles/{id}/approve` | staff, admin | – | `200 { "vehicle" }` · 409 `DOCUMENT_EXPIRED` / `ALREADY_DECIDED` |
| POST | `/staff/vehicles/{id}/disapprove` | staff, admin | `{ "reason": "..." }` | `200 { "vehicle" }` · 422 · 409. Works on pending **and** approved vehicles (RF-38) |
| POST | `/staff/vehicles/{id}/documents-checked` | staff, admin | – | `200 { "vehicle" }` · 409 `NOTHING_TO_CHECK` |
| GET | `/staff/alerts` | staff, admin | – | `200 { "summary", "alerts": [Alert] }` |

```json
{
  "summary": { "pending_vehicles": 4, "unchecked_documents": 1, "expired": 0, "expiring": 1, "pending_couriers": 3 },
  "alerts": [
    { "kind": "updated", "vehicle": { "id": 5, "license_plate": "67-ST-21", "model": "Citroën Berlingo", "approval_status": "approved" },
      "courier": { "id": 5, "name": "Sofia Ribeiro" }, "doc_type": null, "uploaded_at": "2026-11-24 15:32:00",
      "insurance_expiry_date": "2027-06-30", "inspection_expiry_date": "2028-03-14" },
    { "kind": "expiring", "vehicle": { "...": "..." }, "courier": { "...": "..." },
      "doc_type": "insurance", "expiry_date": "2026-11-26", "days_left": 2 }
  ]
}
```

`kind`: `expired` (first) · `updated` (new certificate to check) · `expiring`. Staff only sees approved vehicles; the courier sees all of his.

## 3. Courier accounts (RF-39)

| Method | Route | Role | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/staff/accounts?role=courier&status=pending` | staff (`role=courier`), admin (`courier` or `staff`) | – | `200 { "accounts": [{ "id", "name", "username", "email", "phone", "nif", "employee_number", "role", "status", "created_at" }] }` |
| POST | `/staff/accounts/{id}/approve` | staff → couriers · admin → couriers and staff | – | `200 { "account" }` (`active`) · 403 · 409 |
| POST | `/staff/accounts/{id}/reject` | same | – | `200 { "account" }` (`rejected`) · 403 · 409 |

Guilherme can use the same endpoints with `role=staff` on the Admin page.

## 4. Dispatch queue (WP3)

- **Waiting order:** `orders.status = 'Pending'`, no courier, and a `payments` row with `kind = 'order'` and `status = 'paid'` (WP1).
- **Nearest available courier:** straight-line distance (Haversine) from his last delivery to the pickup point.
  - "Last delivery" is the destination of his last `Completed` order; if there is none, `users.last_lat/last_long`; if those are empty, FEUP.
  - Available means: active account, an approved vehicle with both certificates valid, a vehicle type that carries the declared weight and volume, no other offer waiting, and he did not refuse or ignore this order in the last 10 minutes.
- **60 seconds to answer.** If he refuses or the time runs out, the order goes to the next courier.
- **On accept:** `orders.courier_id` is set and the status becomes `Initiated`, and `DeliveryCodeService::generate()` (WP5) runs, all in one transaction. The courier does **not** receive the code; the client downloads it.
- **No cron:** every call to `/courier/offers/current` or `/staff/dispatch` moves the queue forward. On MySQL, `GET_LOCK` makes sure only one request does it at a time.

| Method | Route | Role | Response |
| --- | --- | --- | --- |
| GET | `/courier/offers/current` | courier | `200 { "offer": Offer \| null }` (the Courier page calls this every 5 s) |
| POST | `/courier/offers/{id}/accept` | courier (the one offered) | `200 { "order_id", "status": "Initiated" }` · 404 · 409 `OFFER_CLOSED` / `ORDER_TAKEN` |
| POST | `/courier/offers/{id}/decline` | courier (the one offered) | `200 { "order_id", "status": "declined" }` · 404 · 409 |
| GET | `/staff/dispatch` | staff, admin | `200 { "queue": [...], "recent": [...], "offer_seconds": 60, "retry_minutes": 10 }` |

```json
{ "id": 12, "order_id": 6, "pickup": { "lat": 41.158, "long": -8.629 }, "dropoff": { "lat": 41.1239, "long": -8.6118 },
  "trip_km": 7.3, "weight_kg": 12.5, "volume_m3": 0.04, "distance_km": 1.96, "expires_at": "2026-11-24 15:28:02", "seconds_left": 60 }
```

Each `queue` item has `order_id`, `waiting_since`, `weight_kg`, `volume_m3`, `refusals`, `offer` (`{ id, courier, distance_km, seconds_left }` or null) and `status`: `offered` · `waiting` · `no_courier`.

For Rafael (WP2): use `GET /courier/vehicles` (field `usable`) to fill the vehicle select on the route page, and the `fleet:order-assigned` event (sent by `js/courier-fleet.js` when an order is accepted) to refresh his list.
