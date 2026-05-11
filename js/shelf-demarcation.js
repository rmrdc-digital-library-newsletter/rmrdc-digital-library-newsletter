(function () {
  const BOOKS_PER_RACK = 6;

  function buildDivider(rackNumber) {
    const div = document.createElement('div');
    div.className = 'shelf-rack-divider';
    div.innerHTML = `
      <span class="rack-line"></span>
      <strong>Shelf Rack ${String(rackNumber).padStart(2, '0')}</strong>
      <span class="rack-line"></span>
    `;
    return div;
  }

  function applyShelfDemarcation() {
    const grid = document.querySelector('.publication-grid');
    if (!grid) return;

    grid.querySelectorAll('.shelf-rack-divider').forEach(item => item.remove());

    const cards = Array.from(grid.querySelectorAll('.publication-card'));
    if (!cards.length) return;

    let rack = 2;
    cards.forEach((card, index) => {
      if (index > 0 && index % BOOKS_PER_RACK === 0) {
        grid.insertBefore(buildDivider(rack), card);
        rack += 1;
      }
    });
  }

  const observer = new MutationObserver(() => {
    clearTimeout(window.__rmrdcShelfDividerTimer);
    window.__rmrdcShelfDividerTimer = setTimeout(applyShelfDemarcation, 80);
  });

  function init() {
    const grid = document.querySelector('.publication-grid');
    if (!grid) {
      setTimeout(init, 200);
      return;
    }

    applyShelfDemarcation();
    observer.observe(grid, { childList: true, subtree: false });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', applyShelfDemarcation);
})();
