/* RMRDC v3.4.6 — Deal Room access gate */
(function () {
  function showGate(main, role, heading, message) {
    const gate = document.createElement('div');
    gate.className = 'rti-dealroom-gate';

    const content = document.createElement('div');
    content.innerHTML = '<div class="rti-lock-icon">🔐</div><span class="rti-badge">RMRDC CONTROLLED ACCESS</span>';
    const title = document.createElement('h2');
    title.textContent = heading;
    const description = document.createElement('p');
    description.textContent = message;
    const link = document.createElement('a');
    link.className = 'primary-btn';
    link.href = role === 'investor' ? 'investor-portal.html' : role === 'researcher' ? 'researcher-portal.html' : 'fabricator-portal.html';
    link.textContent = 'Return to Portal';
    content.append(title, description, link);
    gate.appendChild(content);
    main.replaceChildren(gate);
  }

  async function check() {
    if (!window.db) return;
    const id = new URLSearchParams(location.search).get('id');
    const role = document.body.dataset.role;
    const main = document.querySelector('main');
    if (!main) return;

    if (!id) {
      showGate(main, role, 'No active Deal Room', 'Deal Room access becomes available after an investor expression of interest has been reviewed and approved by RMRDC.');
      return;
    }

    try {
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      if (!auth?.user) return;

      const { data, error } = await db.from('dealrooms')
        .select('id,stage,investor_user_id,researcher_user_id,fabricator_user_id,rmrdc_representative,opportunity_id')
        .eq('id', id)
        .single();
      if (error || !data) throw error || new Error('Deal Room unavailable');

      const isParticipant = [
        data.investor_user_id,
        data.researcher_user_id,
        data.fabricator_user_id,
        data.rmrdc_representative,
      ].includes(auth.user.id);
      if (!isParticipant) throw new Error('Not a Deal Room participant');
    } catch (error) {
      console.error('Deal Room access check failed:', error);
      showGate(main, role, 'Deal Room access is restricted', 'This Deal Room could not be opened. Confirm your access and try again later.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(check, 250));
})();
