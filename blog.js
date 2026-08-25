/* Divino Journal — minimal shared behaviour for blog pages. */
(function () {
    'use strict';


    // Keep the shared language preference in step with the homepage toggle,
    // which reads the same key. The toggle itself is a real link between the
    // English and Italian URLs, so each language stays separately indexable.
    document.querySelectorAll('[data-lang-switch]').forEach(function (link) {
        link.addEventListener('click', function () {
            try {
                localStorage.setItem('divino-language', link.getAttribute('data-lang-switch'));
            } catch (e) {}
        });
    });

    var toggle = document.getElementById('nav-toggle');
    var menu = document.getElementById('mobile-nav');
    if (!toggle || !menu) return;

    var label = toggle.querySelector('.sr-only');

    function setOpen(open) {
        menu.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
        if (label) label.textContent = open ? 'Close menu' : 'Open menu';
    }

    toggle.addEventListener('click', function () {
        setOpen(!menu.classList.contains('open'));
    });

    // Close on outside click and on Escape, so the menu never traps a reader.
    document.addEventListener('click', function (event) {
        if (!menu.classList.contains('open')) return;
        if (menu.contains(event.target) || toggle.contains(event.target)) return;
        setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu.classList.contains('open')) {
            setOpen(false);
            toggle.focus();
        }
    });
})();
