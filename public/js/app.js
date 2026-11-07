
function shelfEscape(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[ch]));
}

function shelfFormatAreas(pub) {
  const areas = Array.isArray(pub.research_areas) ? pub.research_areas : [];
  return areas.slice(0, 5).map(area => `<span>${shelfEscape(area)}</span>`).join('');
}

function openShelfDetail(pub, selectedNode) {
  document.querySelectorAll('.publication-card.is-selected').forEach(card => card.classList.remove('is-selected'));
  selectedNode?.classList.add('is-selected');

  document.getElementById('shelfDetailPanel')?.remove();

  const panel = document.createElement('article');
  panel.id = 'shelfDetailPanel';
  panel.className = 'shelf-detail-panel';

  const format = pub.publication_format === 'html' || pub.ebook_url ? 'HTML eBook' : 'Flipbook';
  const doi = pub.doi ? `<p class="shelf-detail-extra"><strong>DOI:</strong> ${shelfEscape(pub.doi)}</p>` : '';
  const isbn = pub.isbn ? `<p class="shelf-detail-extra"><strong>ISBN:</strong> ${shelfEscape(pub.isbn)}</p>` : '';
  const rating = pub.avg_rating ? `⭐ ${Number(pub.avg_rating).toFixed(1)} ${pub.rating_count ? `(${pub.rating_count})` : ''}` : 'No rating yet';
  const views = pub.view_count || 0;
  const downloads = pub.download_count || 0;

  panel.innerHTML = `
    <img class="shelf-detail-cover" src="${shelfEscape(pub.cover_url || 'assets/placeholder-cover.svg')}" alt="${shelfEscape(pub.title || 'Publication cover')}" />
    <div class="shelf-detail-main">
      <h3>${shelfEscape(pub.title || 'Untitled publication')}</h3>
      <p class="shelf-detail-meta">${shelfEscape(pub.year || 'N/A')} ${pub.authors ? '• ' + shelfEscape(pub.authors) : ''}</p>
      <div class="shelf-detail-badges">
        <span>${shelfEscape(pub.type || 'Publication')}</span>
        <span>${format}</span>
        ${shelfFormatAreas(pub)}
      </div>
      <p class="shelf-detail-abstract">${shelfEscape((pub.abstract || 'No abstract available.').slice(0, 520))}${pub.abstract && pub.abstract.length > 520 ? '…' : ''}</p>
      <div class="shelf-detail-actions">
        <a class="btn btn-primary" href="viewer.html?id=${encodeURIComponent(pub.id)}">Read Online</a>
        <a class="btn btn-secondary" href="viewer.html?id=${encodeURIComponent(pub.id)}#summary">AI Summary</a>
        <button class="btn btn-secondary" type="button" onclick="navigator.clipboard?.writeText('${shelfEscape(pub.citation || pub.title || '')}')">Copy Citation</button>
      </div>
    </div>
    <div class="shelf-detail-side">
      <button class="shelf-detail-close" type="button" aria-label="Close details">×</button>
      ${isbn}
      ${doi}
      <p class="shelf-detail-extra"><strong>Engagement:</strong> ${views} views • ${downloads} downloads</p>
      <p class="shelf-detail-extra"><strong>Rating:</strong> ${rating}</p>
      <p class="shelf-view-note">Only covers are shown on the shelf. Click any cover to preview details before reading.</p>
    </div>
  `;

  const allCards = [...document.querySelectorAll('.publication-card')];
  const selectedIndex = allCards.indexOf(selectedNode);
  const columns = getComputedStyle(el.grid).gridTemplateColumns.split(' ').length || 1;
  const insertAfterIndex = Math.min(allCards.length - 1, selectedIndex + (columns - (selectedIndex % columns)) - 1);
  allCards[insertAfterIndex]?.after(panel);

  panel.querySelector('.shelf-detail-close')?.addEventListener('click', () => {
    panel.remove();
    selectedNode?.classList.remove('is-selected');
  });

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const state = {
  publications: [],
  filtered: [],
  page: 1,
  pageSize: 0
};

const el = {
  search: document.getElementById('searchInput'),
  type: document.getElementById('typeFilter'),
  year: document.getElementById('yearFilter'),
  sort: document.getElementById('sortFilter'),
  clear: document.getElementById('clearFilters'),
  grid: document.getElementById('grid'),
  empty: document.getElementById('emptyState'),
  pagination: document.getElementById('publicationPagination'),
  previousPage: document.getElementById('shelfPreviousPage'),
  nextPage: document.getElementById('shelfNextPage'),
  pageStatus: document.getElementById('shelfPageStatus'),
  total: document.getElementById('statTotal'),
  types: document.getElementById('statTypes'),
  years: document.getElementById('statYears'),
  mostRead: document.getElementById('statMostRead'),
  mostReadTitle: document.getElementById('statMostReadTitle'),
  template: document.getElementById('publicationCardTemplate')
};

document.getElementById('yearNow').textContent = new Date().getFullYear();

function normalize(text = '') {
  return String(text).toLowerCase().trim();
}

function animateCount(element, target, duration = 900) {
  if (!element) return;
  const numericTarget = Number(target || 0);
  if (!Number.isFinite(numericTarget)) {
    element.textContent = target;
    return;
  }

  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(numericTarget * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}


function renderStars(value) {
  const rating = Math.round(Number(value || 0));
  return Array.from({ length: 5 }, (_, index) => index < rating ? '★' : '☆').join('');
}

function formatCitation(pub) {
  if (pub.citation) return pub.citation;
  const authors = pub.authors || 'RMRDC';
  const year = pub.year || 'n.d.';
  const title = pub.title || 'Untitled publication';
  const type = pub.type || 'Publication';
  const doi = pub.doi ? ` https://doi.org/${String(pub.doi).replace(/^https?:\/\/doi\.org\//, '')}` : '';
  return `${authors} (${year}). ${title}. RMRDC ${type}.${doi}`;
}

function populateFilters(items) {
  const types = [...new Set(items.map(i => i.type).filter(Boolean))].sort();
  const years = [...new Set(items.map(i => i.year).filter(Boolean))].sort((a, b) => b - a);

  el.type.innerHTML = '<option value="">All areas</option>' + types.map(v => `<option value="${v}">${v}</option>`).join('');
  el.year.innerHTML = '<option value="">All years</option>' + years.map(v => `<option value="${v}">${v}</option>`).join('');

  animateCount(el.total, items.length);
  animateCount(el.types, types.length);
  animateCount(el.years, years.length);

  const mostRead = [...items].sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0))[0];
  if (el.mostRead) animateCount(el.mostRead, mostRead ? Number(mostRead.view_count || 0) : 0);
  if (el.mostReadTitle) el.mostReadTitle.textContent = mostRead ? `Most Read: ${String(mostRead.title || 'Publication').slice(0, 24)}${String(mostRead.title || '').length > 24 ? '…' : ''}` : 'Most Read';
}

function applyFilters() {
  const query = normalize(el.search.value);
  const type = el.type.value;
  const year = el.year.value;
  const sort = el.sort.value;

  let items = [...state.publications].filter(item => {
    const haystack = normalize([item.title, item.authors, item.abstract, item.type, item.year, item.isbn, item.doi, item.citation].join(' '));
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
  state.page = 1;
  renderGrid();
}

function shelfColumns() {
  const template = getComputedStyle(el.grid).gridTemplateColumns;
  return Math.max(1, template.split(/\s+/).filter(Boolean).length);
}

function renderShelfPagination(total, pageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  state.page = Math.min(state.page, pageCount);
  if (el.pageStatus) el.pageStatus.textContent = `Page ${state.page} of ${pageCount}`;
  if (el.pagination) el.pagination.classList.toggle('hidden', pageCount <= 1);
  if (el.previousPage) el.previousPage.disabled = state.page <= 1;
  if (el.nextPage) el.nextPage.disabled = state.page >= pageCount;
}

function showPublicationsUnavailable() {
  const heading = el.empty?.querySelector('h3');
  const message = el.empty?.querySelector('p');
  if (heading) heading.textContent = 'Publications are temporarily unavailable';
  if (message) message.textContent = 'Please try again later.';
  el.grid.innerHTML = '';
  el.empty?.classList.remove('hidden');
  el.pagination?.classList.add('hidden');
}

function renderGrid() {
  el.grid.innerHTML = '';
  const emptyHeading = el.empty.querySelector('h3');
  const emptyMessage = el.empty.querySelector('p');
  if (emptyHeading) emptyHeading.textContent = 'No research outputs found';
  if (emptyMessage) emptyMessage.textContent = 'Try adjusting your search or filters.';
  el.empty.classList.toggle('hidden', state.filtered.length !== 0);
  const columns = shelfColumns();
  const pageSize = columns * 8;
  state.pageSize = pageSize;
  renderShelfPagination(state.filtered.length, pageSize);
  const start = (state.page - 1) * pageSize;
  const pageItems = state.filtered.slice(start, start + pageSize);

  pageItems.forEach(pub => {
    const node = el.template.content.cloneNode(true);
    node.querySelector('.cover-link').href = `viewer.html?id=${encodeURIComponent(pub.id)}`;
    const img = node.querySelector('.cover-image');
    img.src = pub.cover_url || 'assets/placeholder-cover.svg';
    img.alt = `${pub.title} cover`;
    img.loading = 'lazy';
    img.decoding = 'async';
    node.querySelector('.type-pill').textContent = pub.type || 'Publication';
    node.querySelector('.pub-title').textContent = pub.title || 'Untitled publication';
    node.querySelector('.pub-meta').textContent = `${pub.year || 'N/A'}${pub.authors ? ' • ' + pub.authors : ''}`;

    const cardBody = node.querySelector('.card-body');

    const ids = document.createElement('div');
    ids.className = 'pub-identifiers';
    ids.innerHTML = `
      ${pub.isbn ? `<span>ISBN: ${pub.isbn}</span>` : ''}
      ${pub.doi ? `<span>DOI: ${pub.doi}</span>` : ''}
    `;
    if (pub.isbn || pub.doi) cardBody.appendChild(ids);

    const avg = Number(pub.avg_rating || 0);
    const count = Number(pub.rating_count || 0);
    const ratingWrap = document.createElement('div');
    ratingWrap.className = 'pub-card-rating';
    ratingWrap.innerHTML = avg ? `${renderStars(avg)} <span>${avg.toFixed(1)} (${count})</span>` : `<span class="muted">No ratings yet</span>`;
    cardBody.appendChild(ratingWrap);

    const citation = document.createElement('details');
    citation.className = 'citation-preview';
    citation.innerHTML = `<summary>Citation</summary><p>${formatCitation(pub)}</p>`;
    cardBody.appendChild(citation);

    const actions = document.createElement('div');
    actions.className = 'pub-card-actions';
    actions.innerHTML = `
      <span class="read-online">Read Online</span>
      <span>${pub.publication_format === 'html' || pub.ebook_url ? 'HTML eBook' : 'Flipbook'}</span>
    `;
    cardBody.appendChild(actions);

    el.grid.appendChild(node);
  });
}

el.previousPage?.addEventListener('click', () => {
  if (state.page <= 1) return;
  state.page -= 1;
  renderGrid();
  el.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

el.nextPage?.addEventListener('click', () => {
  const pageCount = Math.ceil(state.filtered.length / state.pageSize);
  if (state.page >= pageCount) return;
  state.page += 1;
  renderGrid();
  el.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const newPageSize = shelfColumns() * 8;
    if (newPageSize !== state.pageSize) renderGrid();
  });
});

async function fetchPublications() {
  if (!window.db) {
    showPublicationsUnavailable();
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const { data, error } = await window.db
      .from('publications_with_stats')
      .select('*')
      .order('year', { ascending: false })
      .order('created_at', { ascending: false })
      .abortSignal(controller.signal);

    if (error) {
      console.error('Could not load publications:', error);
      showPublicationsUnavailable();
      return;
    }

    state.publications = data || [];
    populateFilters(state.publications);
    applyFilters();
  } catch (error) {
    console.error('Could not load publications:', error);
    showPublicationsUnavailable();
  } finally {
    window.clearTimeout(timeout);
  }
}

document.querySelectorAll('.library-area-card').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.library-area-card').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    const type = button.dataset.type;
    el.type.value = type === 'all' ? '' : type;
    applyFilters();
  });
});

el.type?.addEventListener('change', () => {
  const selected = el.type.value || 'all';
  document.querySelectorAll('.library-area-card').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === selected || (!el.type.value && btn.dataset.type === 'all'));
  });
});

[el.search, el.type, el.year, el.sort].forEach(input => input?.addEventListener('input', applyFilters));
el.clear?.addEventListener('click', () => {
  el.search.value = '';
  el.type.value = '';
  el.year.value = '';
  el.sort.value = 'newest';
  document.querySelectorAll('.library-area-card').forEach(btn => btn.classList.toggle('active', btn.dataset.type === 'all'));
  applyFilters();
});

fetchPublications();

const slides = document.querySelectorAll('.hero-slideshow .slide');
let currentSlide = 0;

function changeSlide() {
  if (slides.length < 2) return;
  slides[currentSlide].classList.remove('active');
  currentSlide++;
  if (currentSlide >= slides.length) {
    currentSlide = 0;
  }
  slides[currentSlide].classList.add('active');
}

setInterval(changeSlide, 5000);

window.addEventListener('load', function () {
  const loader = document.getElementById('loader');
  if (!loader) return;

  setTimeout(function () {
    loader.classList.add('hide');
  }, 500);
});
