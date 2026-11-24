<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Service\DispatchService;

// ===== WP3 – fila de despacho (Miguel) =====
final class DispatchController
{
    public function __construct(private readonly DispatchService $dispatch = new DispatchService())
    {
    }

    // GET /api/courier/offers/current   (a Courier page pergunta a cada 5 s)
    public function current(Request $request): void
    {
        Response::json($this->dispatch->currentOffer((int) $request->user['id']));
    }

    // POST /api/courier/offers/{id}/accept
    public function accept(Request $request): void
    {
        Response::json($this->dispatch->accept((int) $request->user['id'], $request->intParam('id')));
    }

    // POST /api/courier/offers/{id}/decline
    public function decline(Request $request): void
    {
        Response::json($this->dispatch->decline((int) $request->user['id'], $request->intParam('id')));
    }

    // GET /api/staff/dispatch
    public function overview(Request $request): void
    {
        Response::json($this->dispatch->overview());
    }
}
