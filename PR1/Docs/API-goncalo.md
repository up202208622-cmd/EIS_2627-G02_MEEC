# API – Núcleo, Autenticação, Estatísticas e WP5 (Gonçalo)

Para o Rafael juntar ao `API.md`. Todas as rotas começam em `/api`.
Corpo e respostas em JSON (exceto o download do `.txt`).

## Formato de erro comum (para todos os módulos)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid.",
             "fields": { "email": "Invalid email (e.g. name@domain.com)." } } }
```

`fields` só aparece em erros de validação (422) e de duplicados (409).

| HTTP | Quando |
|---|---|
| 400 | JSON mal formado, id inválido no URL |
| 401 | Sem sessão, ou email/password errados |
| 403 | Com sessão mas sem permissão (papel errado), conta pendente |
| 404 | Rota ou recurso não existe |
| 405 | Rota existe mas com outro método |
| 409 | Choca com o estado atual (email já usado, já entregue) |
| 422 | Dados inválidos (erros por campo) |
| 423 | Código de entrega bloqueado (demasiadas tentativas) |
| 500 / 503 | Erro interno / base de dados em baixo |

## Autenticação

| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| POST | `/auth/register` | público | `{name, username, email, phone, nif, password, password2?, employee_number?}` | 201 `{user}` · 409 · 422 |
| POST | `/auth/login` | público | `{email, password}` | 200 `{user}` · 401 `INVALID_CREDENTIALS` · 403 `ACCOUNT_PENDING` / `ACCOUNT_REJECTED` |
| POST | `/auth/logout` | público | – | 204 |
| GET | `/me` | com sessão | – | 200 `{user}` · 401 |
| PUT | `/me` | com sessão | `{name, username, email, phone, nif, current_password?, new_password?, new_password2?}` | 200 `{user}` · 409 · 422 |

`user` = `{id, name, username, email, phone, nif, role, status, employee_number, created_at}` (nunca o hash da password).

Regras do registo: o papel nunca vem do cliente. Sem `employee_number` → `client` (ativo). `CRR-xxxx` → `courier` (pendente). `STF-xxxx` → `staff` (pendente, email tem de ser `@couriercms.com`). `ADM-...` é recusado.

## Estatísticas públicas (Home)

| Método | Rota | Acesso | Resposta |
|---|---|---|---|
| GET | `/stats/public` | público | `{routes_today, active_couriers, registered_clients, vehicles_by_type: {"Van": 5, ...}, couriers_by_vehicle_type: {"Van": 2, ...}}` |

`routes_today` = rotas `planned` ou `in_progress` mais as que acabaram hoje. Os dois mapas usam as vistas `v_vehicles_by_type` e `v_couriers_by_type` do `schema.sql`.

## WP5 – Código de entrega

| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| GET | `/orders/{id}/delivery-code` | cliente dono | – | 200 ficheiro `.txt` · 404 · 409 `CODE_NOT_READY` |
| POST | `/orders/{id}/epod` | estafeta da encomenda | `{code}` | 200 `{order_id, status: "Completed"}` · 404 · 409 `ALREADY_DELIVERED` / `ORDER_NOT_DELIVERABLE` (Cancelled, RTO) · 422 código errado · 423 `CODE_LOCKED` |

Na entrega: `delivery_codes.used_at`, `orders.status = 'Completed'` e `orders.delivered_at` mudam juntos (transação).
Alteração ao `schema.sql`: nova coluna `delivery_codes.failed_attempts` (limite de 5 tentativas).

Interface PHP para o Miguel (WP3), quando o estafeta aceita:

```php
$code = (new \App\Service\DeliveryCodeService())->generate($orderId);   // string de 6 dígitos
```

É idempotente: chamar duas vezes para a mesma encomenda devolve o mesmo código.
