(function () {
  const rows = document.getElementById('technologyRows');
  const message = document.getElementById('technologyMessage');
  const form = document.getElementById('technologyForm');
  const search = document.getElementById('technologySearch');
  const status = document.getElementById('technologyStatus');
  let userId = null;
  let technologies = [];
  let channel = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const showMessage = (text, error = false) => { message.textContent = text; message.classList.remove('hidden'); message.classList.toggle('error', error); };

  function render() {
    const query = search.value.trim().toLowerCase();
    const filter = status.value;
    const visible = technologies.filter(item => (!filter || item.visibility === filter) && (!query || `${item.title} ${item.sector}`.toLowerCase().includes(query)));
    if (!visible.length) {
      rows.innerHTML = '<tr><td colspan="5" class="portal-empty">No technologies have been submitted yet.</td></tr>';
      return;
    }
    rows.innerHTML = visible.map(item => `<tr><td><strong>${escapeHtml(item.title)}</strong><br /><small>${escapeHtml(item.short_summary || '')}</small></td><td>${escapeHtml(item.sector || '—')}</td><td>${item.trl ? `TRL ${escapeHtml(item.trl)}` : '—'}</td><td><span class="pill ${item.visibility === 'approved' ? 'green' : 'blue'}">${escapeHtml(item.visibility || 'draft')}</span></td><td>${escapeHtml(new Date(item.created_at).toLocaleDateString())}</td></tr>`).join('');
  }

  async function loadData() {
    const [technologyResult, interestResult, viewResult] = await Promise.all([
      window.db.from('technology_opportunities').select('id,title,sector,trl,visibility,short_summary,created_at').eq('created_by', userId).order('created_at', { ascending: false }),
      window.db.from('researcher_investor_interests').select('id', { count: 'exact', head: true }).eq('researcher_user_id', userId),
      window.db.from('view_events').select('*', { count: 'exact', head: true })
    ]);
    if (technologyResult.error) throw technologyResult.error;
    if (interestResult.error && interestResult.error.code !== '42P01') throw interestResult.error;
    if (viewResult.error) throw viewResult.error;
    technologies = technologyResult.data || [];
    const published = technologies.filter(item => item.visibility === 'approved').length;
    document.getElementById('submissionCount').textContent = technologies.length.toLocaleString();
    document.getElementById('publishedCount').textContent = published.toLocaleString();
    document.getElementById('interestCount').textContent = (interestResult.count || 0).toLocaleString();
    document.getElementById('viewCount').textContent = (viewResult.count || 0).toLocaleString();
    document.getElementById('submissionHint').textContent = technologies.length ? `${technologies.length - published} awaiting review` : 'No submissions yet';
    render();
  }

  async function init() {
    if (!window.db) return window.location.replace('researcher-login.html');
    const { data: { user }, error } = await window.db.auth.getUser();
    if (error || !user) return window.location.replace('researcher-login.html');
    const { data: profile, error: profileError } = await window.db.from('profiles').select('full_name,organisation,role').eq('id', user.id).maybeSingle();
    if (profileError || profile?.role !== 'researcher') return window.location.replace('researcher-login.html');
    userId = user.id;
    const name = profile.full_name || user.email;
    document.getElementById('researcherName').textContent = name;
    document.getElementById('researcherAvatar').textContent = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('welcomeTitle').textContent = `Welcome, ${name.split(/\s+/)[0]}`;
    document.getElementById('researcherInstitution').textContent = profile.organisation || 'Your RMRDC research-to-industry workspace.';
    document.body.classList.remove('portal-pending');
    await loadData();
    channel = window.db.channel(`researcher-workspace-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'technology_opportunities', filter: `created_by=eq.${user.id}` }, () => loadData().catch(console.warn)).subscribe();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = document.getElementById('submitTechnology');
    submit.disabled = true;
    showMessage('Submitting for RMRDC review...');
    try {
      const data = Object.fromEntries(new FormData(form));
      const { error } = await window.db.from('technology_opportunities').insert({ ...data, trl: data.trl ? Number(data.trl) : null, raw_materials: String(data.raw_materials || '').split(',').map(item => item.trim()).filter(Boolean), created_by: userId, visibility: 'under_review' });
      if (error) throw error;
      form.reset();
      showMessage('Technology submitted for RMRDC review.');
      await loadData();
    } catch (error) {
      showMessage(error.message || 'Submission failed.', true);
    } finally { submit.disabled = false; }
  });
  search.addEventListener('input', render);
  status.addEventListener('change', render);
  document.getElementById('researcherSignOut')?.addEventListener('click', async event => { event.preventDefault(); await window.db.auth.signOut(); window.location.replace('researcher-login.html'); });
  document.getElementById('openSubmit')?.addEventListener('click', () => document.getElementById('submit').scrollIntoView({ behavior: 'smooth' }));
  document.getElementById('openSubmitSecondary')?.addEventListener('click', () => document.getElementById('submit').scrollIntoView({ behavior: 'smooth' }));
  init().catch(error => { console.error('Researcher portal failed to load:', error); window.location.replace('researcher-login.html'); });
})();