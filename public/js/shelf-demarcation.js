/* RMRDC Knowledge Base bookshelf
   Keep publication cards as the only grid items so each shelf row stays aligned.
   Rack dividers are intentionally not injected into the CSS grid because they
   would consume a column and make a 6-book row appear as 5 + 1.
*/
(function () {
  function refreshShelf() {
    const grid = document.querySelector('.publication-grid');
    if (!grid) return;
    grid.querySelectorAll('.shelf-rack-divider').forEach(item => item.remove());
  }

  function init() {
    const grid = document.querySelector('.publication-grid');
    if (!grid) {
      setTimeout(init, 200);
      return;
    }

    refreshShelf();
    const observer = new MutationObserver(refreshShelf);
    observer.observe(grid, { childList: true, subtree: false });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', refreshShelf);
})();
