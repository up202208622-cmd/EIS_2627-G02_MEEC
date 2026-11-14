// ===== Comum às páginas internas (Login, Equipa) =====
// O home.js também faz isto, mas traz o mapa e os contadores,
// que só existem na Home. Aqui fica só o que todas as páginas precisam.

// ===== Menu em ecrãs pequenos =====
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

navToggle.addEventListener('click', function () {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
});

// ===== Ano no rodapé =====
document.getElementById('year').textContent = new Date().getFullYear();
