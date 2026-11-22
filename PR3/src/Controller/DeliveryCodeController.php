<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Service\DeliveryCodeService;

final class DeliveryCodeController
{
    public function __construct(private readonly DeliveryCodeService $codes = new DeliveryCodeService())
    {
    }

    // GET /api/orders/{id}/delivery-code  (cliente dono da encomenda) -> .txt
    public function download(Request $request): void
    {
        $file = $this->codes->fileForClient($request->intParam('id'), $request->user);
        Response::textFile($file['filename'], $file['content']);
    }

    // POST /api/orders/{id}/epod  { "code": "123456" }  (estafeta da encomenda)
    public function confirm(Request $request): void
    {
        $result = $this->codes->confirmDelivery(
            $request->intParam('id'),
            (string) $request->input('code', ''),
            $request->user
        );
        Response::json($result);
    }
}
