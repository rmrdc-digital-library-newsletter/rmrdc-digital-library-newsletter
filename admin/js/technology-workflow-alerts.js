(function () {
  async function waitForApproval(id) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await window.db.from('technology_opportunities').select('visibility').eq('id', id).maybeSingle();
      if (result.data?.visibility === 'approved') return true;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const rows = document.getElementById('rows');
    if (!rows) return;
    rows.addEventListener('click', async event => {
      const button = event.target.closest('[data-action="approve"]');
      if (!button || button.textContent.trim() !== 'Approve') return;
      const approved = await waitForApproval(button.dataset.id);
      if (!approved) return;
      const result = await window.db.functions.invoke('notify-technology-workflow', {
        body: { event: 'approved', opportunity_id: button.dataset.id },
      });
      if (result.error) console.warn('Investor approval alert failed', result.error);
    }, true);
  });
})();
