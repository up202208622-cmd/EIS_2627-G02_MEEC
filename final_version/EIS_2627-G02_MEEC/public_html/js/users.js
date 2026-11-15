// ===== Dados de teste (sample test data) =====
// Ainda não há base de dados (só no Sprint 2), por isso as contas de demonstração
// ficam aqui. O Login procura o email nesta lista e é a conta que diz qual é o role:
// o utilizador nunca escolhe o perfil.
// No Sprint 2 isto passa para a tabela User, com password_hash em vez da password.

const DEMO_USERS = [
    { email: 'client@demo.com',       password: 'Client123',  name: 'Ana Costa',     role: 'client'  },
    { email: 'courier@demo.com',      password: 'Courier123', name: 'Rui Martins',   role: 'courier' },
    { email: 'staff@couriercms.com',  password: 'Staff1234',  name: 'Marta Sousa',   role: 'staff'   },
    { email: 'admin@couriercms.com',  password: 'Admin1234',  name: 'Pedro Almeida', role: 'admin'   }
];

// Página de destino de cada role.
const ROLE_PAGES = {
    client: 'client.html',
    courier: 'courier.html',
    staff: 'staff.html',
    admin: 'admin.html'
};

// Domínio dos emails da empresa: só contas de staff e admin o usam.
const COMPANY_DOMAIN = '@couriercms.com';

function findUser(email) {
    const wanted = email.toLowerCase();
    return DEMO_USERS.find(function (user) {
        return user.email === wanted;
    });
}
