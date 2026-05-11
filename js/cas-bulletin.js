const bulletinGrid = document.getElementById('bulletinGrid');
const bulletinSearch = document.getElementById('bulletinSearch');
const bulletinSectorFilter = document.getElementById('bulletinSectorFilter');
let allBulletins = [];

function fmtDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function bulletinCard(item) {
  const sectors = (item.sectors || []).map(s => `<span>${s}</span>`).join('');
  const pubs = (item.publications || []).slice(0, 4).map(pub => `<li>${pub.title || pub}</li>`).join('');
  return `
    <article class="bulletin-card card">
      <div class="bulletin-card-top">
        <span class="bulletin-type">${item.bulletin_type || 'CAS Bulletin'}</span>
        <small>${fmtDate(item.created_at)}</small>
      </div>
      <h3>${item.title}</h3>
      <p>${item.summary || ''}</p>
      <div class="bulletin-tags">${sectors}</div>
      ${pubs ? `<div class="bulletin-list"><strong>Featured updates</strong><ul>${pubs}</ul></div>` : ''}
      <button class="btn btn-secondary bulletin-read-btn" type="button" data-id="${item.id}">Read Bulletin</button>
      <div id="bulletinFull-${item.id}" class="bulletin-full hidden">${(item.body || '').replace(/\n/g, '<br>')}</div>
    </article>
  `;
}

function renderBulletins() {
  const q = (bulletinSearch.value || '').toLowerCase();
  const sector = bulletinSectorFilter.value;
  const items = allBulletins.filter(item => {
    const hay = [item.title, item.summary, item.body, ...(item.sectors || [])].join(' ').toLowerCase();
    const matchQ = !q || hay.includes(q);
    const matchSector = !sector || (item.sectors || []).includes(sector);
    return matchQ && matchSector;
  });

  bulletinGrid.innerHTML = items.length ? items.map(bulletinCard).join('') : '<p class="empty card">No CAS bulletins found yet.</p>';
}

function populateSectors() {
  const sectors = [...new Set(allBulletins.flatMap(item => item.sectors || []))].sort();
  bulletinSectorFilter.innerHTML = '<option value="">All sectors</option>' + sectors.map(s => `<option value="${s}">${s}</option>`).join('');
}

async function loadBulletins() {
  if (!window.db) {
    bulletinGrid.innerHTML = '<p class="empty card">Supabase is not connected.</p>';
    return;
  }

  const { data, error } = await window.db
    .from('cas_bulletins')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    console.error(error);
    bulletinGrid.innerHTML = '<p class="empty card">Could not load CAS bulletins.</p>';
    return;
  }

  allBulletins = data || [];
  populateSectors();
  renderBulletins();
}

bulletinGrid.addEventListener('click', event => {
  const btn = event.target.closest('.bulletin-read-btn');
  if (!btn) return;
  const full = document.getElementById(`bulletinFull-${btn.dataset.id}`);
  full?.classList.toggle('hidden');
  btn.textContent = full?.classList.contains('hidden') ? 'Read Bulletin' : 'Hide Bulletin';
});

bulletinSearch?.addEventListener('input', renderBulletins);
bulletinSectorFilter?.addEventListener('change', renderBulletins);
loadBulletins();
