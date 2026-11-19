<?php
// ===== Configuração (exemplo) =====
// Copia este ficheiro para config.php e põe lá os teus dados.
// O config.php está no .gitignore: passwords nunca vão para o Git.
// No XAMPP, por defeito, o MySQL tem utilizador "root" sem password.

return [
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'name'     => 'couriercms',
        'user'     => 'root',
        'password' => '',
    ],

    // true só no teu PC: as respostas de erro 500 trazem a mensagem técnica.
    // Na entrega fica false, para não mostrar detalhes internos a quem usa a API.
    'debug' => true,

    'session' => [
        'name' => 'COURIERSESSID',
    ],
];
