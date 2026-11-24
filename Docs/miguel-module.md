# Módulo do Miguel – veículos, certificados, aprovações, alertas e despacho (WP3)

Endpoints: `Docs/API-miguel.md`. Usa o núcleo do Gonçalo (Router, Request, Response, ApiException,
Validator, Repository, Auth) e o `sql/schema.sql` do Rafael **sem alterações**.

## Ficheiros (todos novos, nenhum é de outro membro)

```
api/routes/vehicles.php          rotas: veículos, certificados, alertas, contas de estafeta
api/routes/dispatch.php          rotas: WP3
src/Controller/                  VehicleController, AccountApprovalController, DispatchController
src/Service/                     VehicleService, VehicleAlertService, AccountApprovalService, DispatchService,
                                 DocumentStorage, ExpiryRules, Geo, Clock
src/Repository/                  VehicleRepository, AccountApprovalRepository, DispatchRepository
uploads/.htaccess                o Apache não serve os certificados diretamente (só pela API)
uploads/docs/                    certificados (os enviados não vão para o Git; ficam os 18 exemplos do schema.sql)
staff.html, css/staff.css        Staff page ligada à API (substitui a da main)
js/staff.js                      veículos, alertas, contas de estafeta, fila de despacho
js/staff-orders.js, js/staff-data.js   encomendas, rotas e e-POD: ainda dados de exemplo
js/fleet-common.js               apiUpload() (ficheiros) + datas; usa o apiRequest() do users.js
js/courier-fleet.js, css/courier-fleet.css   bloco "My vehicles" + aviso da proposta (60 s) para a Courier page
tests/run.php                    81 testes com o núcleo do Gonçalo e o schema.sql do Rafael (em SQLite)
tests/sqlite_schema.php          converte o schema.sql para SQLite (só para os testes)
tests/check_sql_params.php       confirma que nenhuma query repete um :marcador (o MySQL não deixa)
```

## Testar

```
php tests/run.php
php tests/check_sql_params.php
```

Correm sem MySQL, mas precisam do núcleo do Gonçalo e do WP5 já na `main`, porque usam `src/Core` e o `DeliveryCodeService`.
No XAMPP, depois de importar o `schema.sql`, entra como `staff@demo.com / Staff1234` ou `sofia.ribeiro@demo.com / Demo1234`.

## Ligar à Courier page (para o Rafael, 3 mudanças no `courier.html`)

1. No `<head>`, depois do `courier.css`: `<link rel="stylesheet" href="css/courier-fleet.css">`
2. Na secção "Documents" (`<section class="courier-section" id="vehicles">`), trocar o painel estático
   `<section class="panel" id="documents">…</section>` por `<div id="fleet-panel"></div>`.
3. Depois do `courier.js`: `<script src="js/fleet-common.js"></script>` e `<script src="js/courier-fleet.js"></script>`

O `courier.js` deixa de precisar das partes do Sprint 1 sobre documentos: `renderDocs`, `openDocsForm`, os alertas,
o `alert-dialog` e o aviso "Vehicle documents expired". O bloco novo trata disso com os dados reais.
O aviso da proposta aparece sozinho em qualquer secção.

## O que avisar aos outros

| A quem | O quê |
| --- | --- |
| Gonçalo | Falta o `api/.htaccess` no PR1. Sem ele, no Apache, `api/me` etc. dão 404. Conteúdo: `RewriteEngine On` · `RewriteCond %{REQUEST_FILENAME} !-f` · `RewriteRule ^ index.php [QSA,L]` |
| Gonçalo | O `config.php` não está no `.gitignore` da main (o `config.example.php` diz que está) |
| Gonçalo | Os ficheiros dos PRs estão dentro de `PR1/`, `PR2/`, `PR3/`: no merge têm de ir para a raiz (`api/`, `src/`, `js/`) |
| Gonçalo | O `markOrderDelivered()` podia também atualizar `users.last_lat/last_long`. Não é obrigatório, porque o WP3 já usa a última encomenda `Completed` |
| Rafael | As 3 mudanças no `courier.html` (em cima). Para o select de veículos da rota: `GET /api/courier/vehicles`, campo `usable` |
| Rafael | Marcar RF-26 a RF-30 e RF-35 a RF-39 no `Requirements.xlsx` |
| Guilherme | Para aprovar staff na Admin page pode usar `GET /api/staff/accounts?role=staff` e `POST /api/staff/accounts/{id}/approve` |

## Decisões que convém saber explicar na oral

**Três camadas.** O Controller lê o `Request` e responde com `Response::json`. O Service tem as regras. O Repository (que estende o `Repository` do Gonçalo) só tem SQL com `:marcadores`. Os testes chamam os Services diretamente.

**"Check expiry dates".** Não se aprova um veículo com o seguro ou a inspeção expirados (409 `DOCUMENT_EXPIRED`). Um veículo aprovado com um certificado expirado deixa de ser `usable`: não recebe propostas e pode ser tirado de serviço (RF-38).

**Certificados.** Como no schema do Rafael, as datas e os ficheiros são colunas de `vehicles`:
- Um certificado novo num veículo aprovado põe `doc_checked = 0`. O Staff vê-o nos alertas e carrega em "Mark as checked" (RF-37).
- Num veículo recusado, um certificado novo devolve-o a `pending`.
- Os ficheiros têm nome aleatório. O tipo é verificado pelo conteúdo (`finfo`) e o limite é 5 MB.
- O `uploads/.htaccess` bloqueia o acesso direto: só a API os entrega, e só ao dono, ao Staff e ao Admin. Aos outros responde 404, para nem confirmar que o veículo existe.

**Alertas sem tabela.** Calculam-se sempre a partir das datas e do `doc_checked`, por isso nunca ficam desatualizados.

**Despacho (WP3):**
1. Encomenda paga e `Pending` sem estafeta.
2. Estafetas disponíveis: têm um veículo aprovado, válido e com o tipo certo para o peso e o volume, e nenhuma outra proposta pendente.
3. O mais perto (Haversine) desde a última entrega.
4. `dispatch_offers` com `expires_at` = agora + 60 s.
5. Recusa ou silêncio: o seguinte. Quem recusou só volta a receber a mesma encomenda passados 10 minutos, para nunca ficar presa.
6. Aceitar põe `courier_id` e `Initiated` e chama `DeliveryCodeService::generate()`, tudo numa transação: se o código falhar, nada muda. O código vai para o cliente, não para o estafeta.

**Sem cron.** O XAMPP não tem tarefas agendadas. A fila anda sempre que a Courier page pergunta pela proposta (a cada 5 s) ou o Staff abre a fila.

**Pedidos ao mesmo tempo:**
- No MySQL, `GET_LOCK('couriercms_dispatch')` garante que só um pedido de cada vez cria propostas.
- Aceitar, recusar, aprovar e verificar são `UPDATE ... WHERE status = '...'` e só contam com `rowCount() === 1`. Por isso não se aceita uma proposta expirada nem se aprova duas vezes.

**Prepared statements nativos.** O Gonçalo pôs `ATTR_EMULATE_PREPARES = false`, por isso cada `:marcador` aparece uma vez por query. O `tests/check_sql_params.php` confirma isso.
