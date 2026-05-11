(function () {
  function prefix() {
    return location.pathname.includes('/raw-materials/') ? '../' : '';
  }

  function closeMenu() {
    document.getElementById('siteMenuOverlay')?.classList.add('hidden');
    document.querySelector('.site-menu-toggle')?.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    let overlay = document.getElementById('siteMenuOverlay');
    if (!overlay) {
      const p = prefix();
      overlay = document.createElement('div');
      overlay.id = 'siteMenuOverlay';
      overlay.className = 'site-menu-overlay hidden';
      overlay.innerHTML = `
        <div class="site-menu-panel">
          <div class="site-menu-head">
            <strong>RMRDC CAS Menu</strong>
            <button type="button" id="closeSiteMenu">×</button>
          </div>
          <a href="${p}about.html">About Us</a>
          <a href="${p}contact.html">Contact Us</a>
          <a href="${p}help.html">Help / How to Use</a>
          <a href="${p}subscribe.html">Subscribe / Login</a>
          <a href="${p}user-dashboard.html">User Dashboard</a>
          <a href="${p}ai-librarian.html">AI Librarian</a>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => { if (e.target === overlay) closeMenu(); });
      document.getElementById('closeSiteMenu')?.addEventListener('click', closeMenu);
    }
    overlay.classList.remove('hidden');
    document.querySelector('.site-menu-toggle')?.setAttribute('aria-expanded', 'true');
  }

  document.addEventListener('click', e => {
    if (e.target.closest('.site-menu-toggle')) openMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
})();
