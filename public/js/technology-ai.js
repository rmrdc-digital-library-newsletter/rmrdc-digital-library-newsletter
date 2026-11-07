/* Investor-facing technology chat. The Edge Function enforces access before retrieval. */
(function () {
  function install() {
    const modal = document.getElementById('opportunityModal');
    const actions = modal?.querySelector('.hero-actions');
    if (!modal || !actions || actions.querySelector('[data-technology-ai]')) return;

    const button = document.createElement('button');
    button.className = 'outline-btn';
    button.type = 'button';
    button.dataset.technologyAi = 'true';
    button.textContent = 'Ask AI';
    button.addEventListener('click', openChat);
    actions.appendChild(button);
  }

  function openChat() {
    const existing = document.getElementById('technologyAiDialog');
    if (existing) {
      existing.classList.remove('hidden');
      existing.querySelector('input')?.focus();
      return;
    }

    const dialog = document.createElement('div');
    dialog.id = 'technologyAiDialog';
    dialog.className = 'gate-modal';
    dialog.innerHTML = '<div class="gate-box" style="max-width:620px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h2 style="margin:0">Ask AI about this technology</h2><button type="button" class="outline-btn" data-ai-close>Close</button></div><p>Answers use only access-authorized RMRDC document evidence and include source pages where available.</p><form data-ai-form><input required placeholder="Ask about raw materials, TRL, process, markets or IP" style="width:100%;padding:11px;border:1px solid #dce5e0;border-radius:7px"><button class="primary-btn" style="margin-top:10px">Ask</button></form><div data-ai-answer style="white-space:pre-wrap;margin-top:14px;color:#46564d"></div></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-ai-close]').addEventListener('click', () => dialog.classList.add('hidden'));
    dialog.querySelector('[data-ai-form]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const answer = dialog.querySelector('[data-ai-answer]');
      const question = dialog.querySelector('input').value.trim();
      const technologyId = document.getElementById('opportunityModal')?.dataset.technologyId
        || window.__currentOpportunityId;
      answer.textContent = 'Retrieving authorized RMRDC evidence...';

      try {
        if (!window.db) throw new Error('AI service unavailable');
        let resolvedTechnologyId = technologyId;
        if (!resolvedTechnologyId) {
          const title = document.getElementById('oppHeroTitle')?.textContent.trim();
          const lookup = await window.db.from('technology_opportunities').select('id').eq('title', title).maybeSingle();
          if (lookup.error || !lookup.data?.id) throw new Error('Technology unavailable');
          resolvedTechnologyId = lookup.data.id;
        }

        const result = await window.db.functions.invoke('technology-ai', {
          body: { technology_id: resolvedTechnologyId, question },
        });
        if (result.error || !result.data?.answer) throw new Error('AI service unavailable');
        answer.textContent = result.data.answer
          + (result.data.sources?.length
            ? `\n\nSources:\n${result.data.sources.map(source => `${source.filename}, page ${source.page}`).join('\n')}`
            : '');
      } catch (error) {
        console.error('Technology AI request failed:', error);
        answer.textContent = 'The technology AI service is temporarily unavailable. Please try again later.';
      }
    });
    dialog.querySelector('input')?.focus();
  }

  document.addEventListener('DOMContentLoaded', install);
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-title]')) setTimeout(install, 0);
  });
})();
