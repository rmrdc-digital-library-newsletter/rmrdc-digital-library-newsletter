const state = {
  publications: [],
  filtered: []
};

const el = {
  search: document.getElementById('searchInput'),
  type: document.getElementById('typeFilter'),
  year: document.getElementById('yearFilter'),
  sort: document.getElementById('sortFilter'),
  clear: document.getElementById('clearFilters'),
  grid: document.getElementById('grid'),
  empty: document.getElementById('emptyState'),
  results: document.getElementById('resultsText'),
  total: document.getElementById('statTotal'),
  types: document.getElementById('statTypes'),
  years: document.getElementById('statYears'),
  template: document.getElementById('publicationCardTemplate')
};

document.getElementById('yearNow').textContent = new Date().getFullYear();

function normalize(text = '') {
  return String(text).toLowerCase().trim();
}

function populateFilters(items) {
  const types = [...new Set(items.map(i => i.type).filter(Boolean))].sort();
  const years = [...new Set(items.map(i => i.year).filter(Boolean))].sort((a, b) => b - a);

  el.type.innerHTML = '<option value="">All types</option>' + types.map(v => `<option value="${v}">${v}</option>`).join('');
  el.year.innerHTML = '<option value="">All years</option>' + years.map(v => `<option value="${v}">${v}</option>`).join('');

  el.total.textContent = items.length;
  el.types.textContent = types.length;
  el.years.textContent = years.length;
}

function applyFilters() {
  const query = normalize(el.search.value);
  const type = el.type.value;
  const year = el.year.value;
  const sort = el.sort.value;

  let items = [...state.publications].filter(item => {
    const haystack = normalize([item.title, item.authors, item.abstract, item.type, item.year].join(' '));
    const matchesQuery = !query || haystack.includes(query);
    const matchesType = !type || item.type === type;
    const matchesYear = !year || String(item.year) === year;
    return matchesQuery && matchesType && matchesYear;
  });

  items.sort((a, b) => {
    switch (sort) {
      case 'oldest': return Number(a.year || 0) - Number(b.year || 0);
      case 'title-asc': return (a.title || '').localeCompare(b.title || '');
      case 'title-desc': return (b.title || '').localeCompare(a.title || '');
      case 'popular': return Number(b.view_count || 0) - Number(a.view_count || 0);
      case 'newest':
      default:
        return Number(b.year || 0) - Number(a.year || 0);
    }
  });

  state.filtered = items;
  renderGrid();
}

function renderGrid() {
  el.grid.innerHTML = '';
  el.results.textContent = `${state.filtered.length} publication${state.filtered.length === 1 ? '' : 's'} found`;
  el.empty.classList.toggle('hidden', state.filtered.length !== 0);

  state.filtered.forEach(pub => {
    const node = el.template.content.cloneNode(true);
    node.querySelector('.cover-link').href = `viewer.html?id=${encodeURIComponent(pub.id)}`;
    const img = node.querySelector('.cover-image');
    img.src = pub.cover_url || 'assets/placeholder-cover.svg';
    img.alt = `${pub.title} cover`;
    node.querySelector('.type-pill').textContent = pub.type || 'Publication';
    node.querySelector('.pub-title').textContent = pub.title || 'Untitled publication';
    node.querySelector('.pub-meta').textContent = `${pub.year || 'N/A'}${pub.authors ? ' • ' + pub.authors : ''}`;
    el.grid.appendChild(node);
  });
}

async function fetchPublications() {
  if (!window.db) {
    el.results.textContent = 'Update js/config.js with your Supabase credentials to load publications.';
    return;
  }

  const { data, error } = await window.db
    .from('publications_with_stats')
    .select('*')
    .order('year', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    el.results.textContent = 'Could not load publications.';
    return;
  }

  state.publications = data || [];
  populateFilters(state.publications);
  applyFilters();
}

[el.search, el.type, el.year, el.sort].forEach(input => input?.addEventListener('input', applyFilters));
el.clear?.addEventListener('click', () => {
  el.search.value = '';
  el.type.value = '';
  el.year.value = '';
  el.sort.value = 'newest';
  applyFilters();
});

fetchPublications();
