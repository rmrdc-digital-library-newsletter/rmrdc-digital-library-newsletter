(function () {
  function findAnchor(role) {
    return document.querySelector('#discover, #submit, .portal-grid, main');
  }

  async function load() {
    if (!window.db) return;
    const body = document.body;
    const role = body.dataset.portal;
    if (!['investor', 'researcher', 'fabricator', 'library', 'library_user'].includes(role)) return;

    const { data: sessionData } = await db.auth.getSession();
    if (!sessionData?.session) return;

    try {
      const { data, error } = await db.functions.invoke('recommend-technology-opportunities', {
        body: { limit: 6 },
      });
      if (error || !data?.recommendations?.length) return;

      const panel = document.createElement('section');
      panel.className = 'panel rti-recommendations';
      panel.innerHTML = `
        <div class="panel-head"><div><h3>Recommended for you</h3><p>Personalized from your profile and approved opportunities.</p></div><span class="pill green">Personalized</span></div>
        <div class="panel-body"><div class="table-wrap"><table class="portal-table"><thead><tr><th>Opportunity</th><th>Sector</th><th>TRL</th><th>Match</th><th></th></tr></thead><tbody></tbody></table></div></div>`;
      panel.querySelector('tbody').innerHTML = data.recommendations.map(item => `
        <tr>
          <td><strong>${String(item.title || '').replace(/[<>]/g, '')}</strong><br><small>${String(item.reason || '')}</small></td>
          <td>${String(item.sector || item.category || 'Technology')}</td>
          <td>${item.trl ? `TRL ${item.trl}` : 'Not specified'}</td>
          <td><span class="pill green">${item.match_score >= 30 ? 'High' : 'Relevant'}</span></td>
          <td><a class="ghost-btn" href="technology-opportunity.html?id=${encodeURIComponent(item.id)}">View</a></td>
        </tr>`).join('');

      const anchor = findAnchor(role);
      anchor?.parentNode?.insertBefore(panel, anchor.nextSibling);
    } catch (error) {
      console.error('Could not load personalized recommendations:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(load, 400));
})();
