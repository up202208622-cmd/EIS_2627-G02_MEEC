<?php
declare(strict_types=1);

namespace App\Core;

// ===== Router (encaminhador) =====
// Todos os pedidos entram pelo api/index.php. O Router compara o método e o caminho
// com a lista de rotas e chama o Controller certo, como uma rececionista que lê
// o pedido e encaminha a pessoa para o gabinete certo.
//
// Uma rota tem: método, padrão (pode ter {parametros}), handler e middleware.
//   $router->get('/orders/{id}/delivery-code', [DeliveryCodeController::class, 'download'], [Auth::role('client')]);
final class Router
{
    private array $routes = [];

    public function get(string $pattern, array $handler, array $middleware = []): void
    {
        $this->add('GET', $pattern, $handler, $middleware);
    }

    public function post(string $pattern, array $handler, array $middleware = []): void
    {
        $this->add('POST', $pattern, $handler, $middleware);
    }

    public function put(string $pattern, array $handler, array $middleware = []): void
    {
        $this->add('PUT', $pattern, $handler, $middleware);
    }

    public function patch(string $pattern, array $handler, array $middleware = []): void
    {
        $this->add('PATCH', $pattern, $handler, $middleware);
    }

    public function delete(string $pattern, array $handler, array $middleware = []): void
    {
        $this->add('DELETE', $pattern, $handler, $middleware);
    }

    private function add(string $method, string $pattern, array $handler, array $middleware): void
    {
        // '/orders/{id}' -> expressão regular '#^/orders/(?P<id>[^/]+)$#'
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = compact('method', 'pattern', 'regex', 'handler', 'middleware');
    }

    public function dispatch(Request $request): void
    {
        $allowedMethods = [];

        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path, $matches)) {
                continue;
            }
            if ($route['method'] !== $request->method) {
                $allowedMethods[] = $route['method'];   // o caminho existe, mas com outro método
                continue;
            }

            // Guardar só os parâmetros com nome ({id}), não os índices numéricos.
            $request->params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

            // Middleware: corre antes do Controller e pode travar o pedido (lança ApiException).
            foreach ($route['middleware'] as $middleware) {
                $middleware($request);
            }

            [$class, $method] = $route['handler'];
            (new $class())->$method($request);
            return;
        }

        if ($allowedMethods !== []) {
            header('Allow: ' . implode(', ', array_unique($allowedMethods)));
            throw new ApiException('METHOD_NOT_ALLOWED', 'Method not allowed for this route.', 405);
        }
        throw ApiException::notFound('Route not found: ' . $request->method . ' ' . $request->path, 'ROUTE_NOT_FOUND');
    }
}
