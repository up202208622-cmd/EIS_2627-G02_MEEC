<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Service\StatsService;

final class StatsController
{
    public function __construct(private readonly StatsService $stats = new StatsService())
    {
    }

    // GET /api/stats/public  (sem login: é para a Home)
    public function publicStats(Request $request): void
    {
        Response::json($this->stats->publicStats());
    }
}
