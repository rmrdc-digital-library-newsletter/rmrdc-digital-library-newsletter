import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

const params = new URLSearchParams(window.location.search);
const publicationId = params.get('id');
let pageFlip = null;
let currentZoom = 1;
let totalPages = 0;
let currentPublication = null;

const refs = {
  cover: document.getElementById('detailCover'),
  type: document.getElementById('detailType'),
  title: document.getElementById('detailTitle'),
  authors: document.getElementById('detailAuthors'),
  year: document.getElementById('detailYear'),
  views: document.getElementById('detailViews'),
  downloads: document.getElementById('detailDownloads'),
  abstract: document.getElementById('detailAbstract'),
  directPdf: document.getElementById('directPdfLink'),
  download: document.getElementById('downloadBtn'),
  flipbook: document.getElementById('flipbook'),
  shell: document.getElementById('flipbookShell'),
  message: document.getElementById('viewerMessage'),
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  pageStatus: document.getElementById('pageStatus')
};

function showMessage(text) {
  refs.message.textContent = text;
  refs.message.classList.remove('hidden');
}

function updateStatus(pageIndex = 0) {
  refs.pageStatus.textContent = `Page ${Math.max(1, pageIndex + 1)} / ${Math.max(0, totalPages)}`;
}

async function incrementMetric(kind, publication) {
  if (!window.db || !publication?.id) return;
  const payload = { publication_id: publication.id, user_agent: navigator.userAgent };
  const table = kind === 'download' ? 'download_events' : 'view_events';
  await window.db.from(table).insert(payload);
}

async function fetchPublication() {
  if (!window.db || !publicationId) {
    showMessage('Missing publication identifier or Supabase configuration.');
    return null;
  }

  const { data, error } = await window.db
    .from('publications_with_stats')
    .select('*')
    .eq('id', publicationId)
    .single();

  if (error || !data) {
    console.error(error);
    showMessage('Publication not found.');
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
  refs.views.textContent = publication.view_count || 0;
  refs.downloads.textContent = publication.download_count || 0;
  refs.abstract.textContent = publication.abstract || 'No abstract available.';
  refs.directPdf.href = publication.pdf_url;
}

async function renderFlipbook(pdfUrl) {
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  totalPages = pdf.numPages;
  refs.flipbook.innerHTML = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: currentZoom * 1.25 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;

    const pageEl = document.createElement('div');
    pageEl.className = 'flipbook-page';
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/jpeg', 0.92);
    img.alt = `Page ${pageNum}`;
    pageEl.appendChild(img);
    refs.flipbook.appendChild(pageEl);
  }

  if (pageFlip) {
    pageFlip.destroy();
  }

  pageFlip = new St.PageFlip(refs.flipbook, {
    width: 420,
    height: 560,
    size: 'stretch',
    minWidth: 280,
    maxWidth: 920,
    minHeight: 360,
    maxHeight: 1200,
    maxShadowOpacity: 0.3,
    showCover: true,
    mobileScrollSupport: true
  });

  pageFlip.loadFromHTML(document.querySelectorAll('.flipbook-page'));
  pageFlip.on('flip', (e) => updateStatus(e.data));
  updateStatus(0);
}

refs.prev.addEventListener('click', () => pageFlip?.flipPrev());
refs.next.addEventListener('click', () => pageFlip?.flipNext());
refs.zoomIn.addEventListener('click', async () => {
  currentZoom = Math.min(2.2, currentZoom + 0.2);
  if (currentPublication?.pdf_url) await renderFlipbook(currentPublication.pdf_url);
});
refs.zoomOut.addEventListener('click', async () => {
  currentZoom = Math.max(0.8, currentZoom - 0.2);
  if (currentPublication?.pdf_url) await renderFlipbook(currentPublication.pdf_url);
});
refs.download.addEventListener('click', async () => {
  if (!currentPublication?.pdf_url) return;
  await incrementMetric('download', currentPublication);
  window.open(currentPublication.pdf_url, '_blank', 'noopener');
});

(async function init() {
  currentPublication = await fetchPublication();
  if (!currentPublication) return;
  hydrateSidebar(currentPublication);
  await incrementMetric('view', currentPublication);
  try {
    await renderFlipbook(currentPublication.pdf_url);
  } catch (err) {
    console.error(err);
    showMessage('Flipbook could not load this PDF. Use “Open PDF” for direct viewing.');
  }
})();
