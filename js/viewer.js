import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

const params = new URLSearchParams(window.location.search);
const publicationId = params.get('id');

const refs = {
  cover: document.getElementById('detailCover'),
  type: document.getElementById('detailType'),
  title: document.getElementById('detailTitle'),
  authors: document.getElementById('detailAuthors'),
  year: document.getElementById('detailYear'),
  price: document.getElementById('detailPrice'),
  views: document.getElementById('detailViews'),
  downloads: document.getElementById('detailDownloads'),
  abstract: document.getElementById('detailAbstract'),
  viewFull: document.getElementById('viewFullBtn'),
  download: document.getElementById('downloadBtn'),
  shell: document.getElementById('viewerCanvasShell'),
  message: document.getElementById('viewerMessage'),
  loading: document.getElementById('viewerLoading'),
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  fitPage: document.getElementById('fitPage'),
  fitWidth: document.getElementById('fitWidth'),
  pageStatus: document.getElementById('pageStatus'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  prevMatch: document.getElementById('prevMatch'),
  nextMatch: document.getElementById('nextMatch'),
  searchStatus: document.getElementById('searchStatus'),
  thumbList: document.getElementById('thumbList'),
  canvas: document.getElementById('pdfCanvas'),
  viewerDocTitle: document.getElementById('viewerDocTitle'),
  viewerDocLine: document.getElementById('viewerDocLine')
};

const ctx = refs.canvas.getContext('2d', { alpha: false });

const state = {
  publication: null,
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  zoom: 1,
  fitMode: 'page',
  renderTask: null,
  pageTextCache: new Map(),
  searchMatches: [],
  currentMatchIndex: -1
};

function showMessage(text, isError = false) {
  refs.message.textContent = text;
  refs.message.classList.remove('hidden');
  refs.message.style.background = isError ? '#ffe6e6' : '#fff7dd';
  refs.message.style.color = isError ? '#8c1d1d' : '#6d560f';
}

function hideMessage() {
  refs.message.classList.add('hidden');
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return 'Free';
  const amount = Number(value);
  if (Number.isNaN(amount) || amount <= 0) return 'Free';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2
  }).format(amount);
}

function updateStatus() {
  refs.pageStatus.textContent = `Page ${Math.max(1, state.currentPage)} / ${Math.max(0, state.totalPages)} • Zoom ${Math.round(state.zoom * 100)}%`;
}

async function incrementMetric(kind, publication) {
  if (!window.db || !publication?.id) return;
  const payload = { publication_id: publication.id, user_agent: navigator.userAgent };
  const table = kind === 'download' ? 'download_events' : 'view_events';
  try {
    await window.db.from(table).insert(payload);
  } catch (e) {
    console.warn(`${kind} metric failed`, e);
  }
}

async function fetchPublication() {
  if (!window.db || !publicationId) {
    showMessage('Missing publication identifier or Supabase configuration.', true);
    return null;
  }

  const { data, error } = await window.db
    .from('publications_with_stats')
    .select('*')
    .eq('id', publicationId)
    .single();

  if (error || !data) {
    console.error(error);
    showMessage('Publication not found.', true);
    return null;
  }
  return data;
}

function hydrateSidebar(publication) {
  refs.cover.src = publication.cover_url || 'assets/placeholder-cover.svg';
  refs.type.textContent = publication.type || 'Publication';
  refs.title.textContent = publication.title || 'Untitled publication';
  refs.authors.textContent = publication.authors || 'No author information';
  refs.year.textContent = publication.year || '—';
  refs.price.textContent = formatPrice(publication.price);
  refs.views.textContent = publication.view_count || 0;
  refs.downloads.textContent = publication.download_count || 0;
  refs.abstract.textContent = publication.abstract || 'No abstract available.';
  refs.viewFull.href = publication.pdf_url;
  refs.viewerDocTitle.textContent = 'Document View';
  refs.viewerDocLine.textContent = `Reading: ${publication.title || 'Untitled publication'} • Published by RMRDC`;
  document.title = `${publication.title || 'Publication Viewer'} | RMRDC Digital Library`;
}

function getFitWidthScale(page) {
  const viewport = page.getViewport({ scale: 1 });
  const shellWidth = refs.shell.clientWidth - 40;
  return Math.max(shellWidth / viewport.width, 0.35);
}

function getFitPageScale(page) {
  const viewport = page.getViewport({ scale: 1 });
  const shellWidth = refs.shell.clientWidth - 40;
  const shellHeight = refs.shell.clientHeight - 40;
  return Math.max(Math.min(shellWidth / viewport.width, shellHeight / viewport.height), 0.35);
}

async function renderCurrentPage() {
  if (!state.pdfDoc) return;
  refs.loading.classList.remove('hidden');

  try {
    const page = await state.pdfDoc.getPage(state.currentPage);

    if (state.fitMode === 'width') state.zoom = getFitWidthScale(page);
    if (state.fitMode === 'page') state.zoom = getFitPageScale(page);

    const viewport = page.getViewport({ scale: state.zoom });
    const outputScale = window.devicePixelRatio || 1;

    refs.canvas.width = Math.floor(viewport.width * outputScale);
    refs.canvas.height = Math.floor(viewport.height * outputScale);
    refs.canvas.style.width = `${Math.floor(viewport.width)}px`;
    refs.canvas.style.height = `${Math.floor(viewport.height)}px`;

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    if (state.renderTask) {
      try { state.renderTask.cancel(); } catch {}
    }

    state.renderTask = page.render({
      canvasContext: ctx,
      viewport,
      transform
    });
    await state.renderTask.promise;
    updateStatus();
    highlightActiveThumb();
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.error(err);
      showMessage('Could not render this page. Use “View Full” for direct viewing.', true);
    }
  } finally {
    state.renderTask = null;
    refs.loading.classList.add('hidden');
  }
}

function goToPage(pageNum) {
  if (!state.pdfDoc || pageNum < 1 || pageNum > state.totalPages) return;
  state.currentPage = pageNum;
  renderCurrentPage();
}

async function getPageText(pageNumber) {
  if (state.pageTextCache.has(pageNumber)) return state.pageTextCache.get(pageNumber);
  const page = await state.pdfDoc.getPage(pageNumber);
  const text = await page.getTextContent();
  const combined = text.items.map(item => item.str).join(' ');
  state.pageTextCache.set(pageNumber, combined);
  return combined;
}

async function searchDocument() {
  const query = refs.searchInput.value.trim().toLowerCase();
  state.searchMatches = [];
  state.currentMatchIndex = -1;

  if (!query) {
    refs.searchStatus.textContent = 'Enter a search term';
    return;
  }

  refs.searchStatus.textContent = 'Searching…';

  for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
    const text = (await getPageText(pageNum)).toLowerCase();
    if (text.includes(query)) state.searchMatches.push(pageNum);
  }

  if (!state.searchMatches.length) {
    refs.searchStatus.textContent = 'No matches found';
    return;
  }

  state.currentMatchIndex = 0;
  refs.searchStatus.textContent = `${state.searchMatches.length} page match(es)`;
  goToPage(state.searchMatches[0]);
}

function goToMatch(direction) {
  if (!state.searchMatches.length) return;
  state.currentMatchIndex += direction;
  if (state.currentMatchIndex < 0) state.currentMatchIndex = state.searchMatches.length - 1;
  if (state.currentMatchIndex >= state.searchMatches.length) state.currentMatchIndex = 0;
  goToPage(state.searchMatches[state.currentMatchIndex]);
}

async function buildThumbnails() {
  refs.thumbList.innerHTML = '';
  for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.22 });
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = Math.floor(viewport.width);
    thumbCanvas.height = Math.floor(viewport.height);
    thumbCanvas.className = 'thumb-canvas';

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'thumb-item';
    item.dataset.page = String(pageNum);

    const label = document.createElement('span');
    label.className = 'thumb-label';
    label.textContent = `Page ${pageNum}`;

    item.appendChild(thumbCanvas);
    item.appendChild(label);
    item.addEventListener('click', () => goToPage(pageNum));
    refs.thumbList.appendChild(item);

    const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: thumbCtx, viewport }).promise;
  }
  highlightActiveThumb();
}

function highlightActiveThumb() {
  refs.thumbList.querySelectorAll('.thumb-item').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.page) === state.currentPage);
  });
}

let touchStartX = null;
refs.shell.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
}, { passive: true });

refs.shell.addEventListener('touchend', (e) => {
  if (touchStartX === null) return;
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(diff) > 60) {
    if (diff < 0) goToPage(state.currentPage + 1);
    else goToPage(state.currentPage - 1);
  }
  touchStartX = null;
}, { passive: true });

refs.prev.addEventListener('click', () => goToPage(state.currentPage - 1));
refs.next.addEventListener('click', () => goToPage(state.currentPage + 1));

refs.zoomIn.addEventListener('click', async () => {
  if (!state.pdfDoc) return;
  state.fitMode = 'manual';
  state.zoom = Math.min(3.5, state.zoom + 0.15);
  await renderCurrentPage();
});

refs.zoomOut.addEventListener('click', async () => {
  if (!state.pdfDoc) return;
  state.fitMode = 'manual';
  state.zoom = Math.max(0.35, state.zoom - 0.15);
  await renderCurrentPage();
});

refs.fitPage.addEventListener('click', async () => {
  state.fitMode = 'page';
  await renderCurrentPage();
});

refs.fitWidth.addEventListener('click', async () => {
  state.fitMode = 'width';
  await renderCurrentPage();
});

refs.searchBtn.addEventListener('click', searchDocument);
refs.prevMatch.addEventListener('click', () => goToMatch(-1));
refs.nextMatch.addEventListener('click', () => goToMatch(1));
refs.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchDocument();
});

refs.download.addEventListener('click', async () => {
  if (!state.publication?.pdf_url) return;
  await incrementMetric('download', state.publication);
  window.open(state.publication.pdf_url, '_blank', 'noopener');
});

window.addEventListener('resize', () => {
  if (!state.pdfDoc) return;
  if (state.fitMode === 'page' || state.fitMode === 'width') {
    clearTimeout(window.__viewerResizeTimer);
    window.__viewerResizeTimer = setTimeout(renderCurrentPage, 120);
  }
});

(async function init() {
  state.publication = await fetchPublication();
  if (!state.publication) return;

  hydrateSidebar(state.publication);
  await incrementMetric('view', state.publication);

  try {
    state.pdfDoc = await pdfjsLib.getDocument(state.publication.pdf_url).promise;
    state.totalPages = state.pdfDoc.numPages;
    state.currentPage = 1;
    updateStatus();
    await renderCurrentPage();
    await buildThumbnails();
  } catch (err) {
    console.error(err);
    showMessage('Document viewer could not load this PDF. Use “View Full” for direct viewing.', true);
  }
})();
