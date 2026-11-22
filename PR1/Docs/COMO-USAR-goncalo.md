# Como usar o núcleo (para o grupo)

## Instalar no XAMPP

1. O repositório fica dentro de `C:\xampp\htdocs\` (ex.: `C:\xampp\htdocs\EIS_2627-G02_MEEC`).
2. Copiar `config.example.php` para `config.php` e pôr os dados do MySQL (no XAMPP: `root` sem password).
3. No phpMyAdmin, criar a base de dados `couriercms` e importar o `sql/schema.sql`.
4. Abrir `http://localhost/EIS_2627-G02_MEEC/index.html` (as páginas têm de ser abertas pelo Apache, não com duplo clique, para a API funcionar).
5. Testar a API: `http://localhost/EIS_2627-G02_MEEC/api/stats/public` deve mostrar JSON.

Contas de teste (do `schema.sql`): `client@demo.com / Client123`, `courier@demo.com / Courier123`,
`staff@demo.com / Staff1234`, `admin@demo.com / Admin1234`; as restantes usam `Demo1234`.

## Criar o teu módulo (exemplo com veículos)

1. **Rotas:** cria `api/routes/vehicles.php` (um ficheiro por módulo, sem mexer nos dos outros):
   ```php
   <?php
   use App\Controller\VehicleController;
   use App\Middleware\Auth;

   $router->get('/vehicles',       [VehicleController::class, 'list'],   [Auth::role('courier', 'staff')]);
   $router->post('/vehicles',      [VehicleController::class, 'create'], [Auth::role('courier')]);
   $router->get('/vehicles/{id}',  [VehicleController::class, 'show'],   [Auth::login()]);
   ```
2. **Controller** (`src/Controller/VehicleController.php`, `namespace App\Controller;`): lê o pedido e responde.
   - `$request->all()` / `$request->input('type')` – corpo JSON
   - `$request->intParam('id')` – `{id}` do URL (400 se não for número)
   - `$request->user` – utilizador com sessão (posto pelo middleware)
   - `Response::json($dados, 201)`
3. **Service** (`src/Service/VehicleService.php`): regras. Para erros, `throw ApiException::validation([...])`,
   `ApiException::notFound()`, `ApiException::forbidden()`, `ApiException::conflict('...')`.
   Validação: `$v = new Validator($data); $v->required('plate')->pattern('plate', '/.../', 'msg'); $v->check();`
4. **Repository** (`src/Repository/VehicleRepository.php`): `extends Repository` e usa
   `fetchOne`, `fetchAll`, `fetchValue`, `execute`, `insert`, `transaction`. Sempre com `:marcadores`, nunca a concatenar valores no SQL.

Não é preciso `require`: o autoload encontra a classe pelo namespace (`App\Service\X` → `src/Service/X.php`).

## No JavaScript das páginas

O `js/users.js` (já incluído em todas as páginas) tem agora a ligação à API.
As funções do Sprint 1 continuam: `requireRole('courier')` devolve a sessão como antes,
mas agora confirma também no servidor (`GET /api/me`) e manda para o login se a sessão PHP acabou.
O `data-logout` termina a sessão no servidor.

`DEMO_USERS`, `findUser`, `getAccounts`, `setAccountStatus` ainda existem (secção 4 do `users.js`)
só para as vossas páginas não partirem: quando o vosso módulo ler da API, deixem de os usar.
Contas novas do Register já vão para a tabela `users` (já não aparecem no `localStorage`).

```js
// Página privada (igual ao Sprint 1)
const session = requireRole('courier');

// Pedido à API
try {
    const data = await apiRequest('POST', '/vehicles', { plate: 'AA-00-BB', type: 'van' });
} catch (error) {
    // error.status, error.code, error.message, error.fields
    showServerFieldErrors(error.fields, { plate: 'vehicle-plate' });
}

// Logout: basta pôr data-logout no link (já está nas vossas páginas)
```
