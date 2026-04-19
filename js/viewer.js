import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

const params = new URLSearchParams(window.location.search);
const publicationId = params.get('id');
let pageFlip = null;
let currentZoom = 1;
let totalPages = 0;
let currentPublication = null;
let fitMode = 'page';

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
  flipbook: document.getElementById('flipbook'),
  shell: document.getElementById('flipbookShell'),
  message: document.getElementById('viewerMessage'),
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  fitPage: document.getElementById('fitPage'),
  fitWidth: document.getElementById('fitWidth'),
  pageStatus: document.getElementById('pageStatus')
};

function showMessage(text) {
  refs.message.textContent = text;
  refs.message.classList.remove('hidden');
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
  refs.price.textContent = formatPrice(publication.price);
  refs.views.textContent = publication.view_count || 0;
  refs.downloads.textContent = publication.download_count || 0;
  refs.abstract.textContent = publication.abstract || 'No abstract available.';
  refs.viewFull.href = publication.pdf_url;
}

function buildFlipDimensions() {
  const shellWidth = Math.max(320, refs.shell.clientWidth - 24);
  const shellHeight = Math.max(420, refs.shell.clientHeight - 24);

  if (fitMode === 'width') {
    return {
      width: Math.max(280, Math.floor(shellWidth / 2)),
      height: Math.max(420, Math.floor(shellHeight))
    };
  }

  return {
    width: Math.max(300, Math.floor(shellWidth * 0.44)),
    height: Math.max(420, Math.floor(shellHeight * 0.92))
  };
}

async function renderFlipbook(pdfUrl) {
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  totalPages = pdf.numPages;
  refs.flipbook.innerHTML = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: currentZoom * 1.35 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;

    const pageEl = document.createElement('div');
    pageEl.className = 'flipbook-page';
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/jpeg', 0.94);
    img.alt = `Page ${pageNum}`;
    pageEl.appendChild(img);
    refs.flipbook.appendChild(pageEl);
  }

  if (pageFlip) {
    pageFlip.destroy();
  }

  const dims = buildFlipDimensions();
  pageFlip = new St.PageFlip(refs.flipbook, {
    width: dims.width,
    height: dims.height,
    size: 'stretch',
    minWidth: 280,
    maxWidth: 1400,
    minHeight: 360,
    maxHeight: 1600,
    maxShadowOpacity: 0.25,
    showCover: true,
    mobileScrollSupport: true,
    usePortrait: true,
    autoSize: true
  });

  pageFlip.loadFromHTML(document.querySelectorAll('.flipbook-page'));
  pageFlip.on('flip', (e) => updateStatus(e.data));
  updateStatus(0);
}

refs.prev.addEventListener('click', () => pageFlip?.flipPrev());
refs.next.addEventListener('click', () => pageFlip?.flipNext());
refs.zoomIn.addEventListener('click', async () => {
  currentZoom = Math.min(2.4, currentZoom + 0.15);
  if (currentPublication?.pdf_url) await renderFlipbook(currentPublication.pdf_url);
});
refs.zoomOut.addEventListener('click', async () => {
  currentZoom = Math.max(0.75, currentZoom - 0.15);
  if (currentPublication?.pdf_url) await renderFlipbook(currentPublication.pdf_url);
});
refs.fitPage.addEventListener('click', async () => {
  fitMode = 'page';
  if (currentPublication?.pdf_url) await renderFlipbook(currentPublication.pdf_url);
});
refs.fitWidth.addEventListener('click', async () => {
  fitMode = 'width';
  if (currentPublication?.pdf_url) await renderFlipbook(currentPublication.pdf_url);
});
refs.download.addEventListener('click', async () => {
  if (!currentPublication?.pdf_url) return;
  await incrementMetric('download', currentPublication);
  window.open(currentPublication.pdf_url, '_blank', 'noopener');
});

window.addEventListener('resize', async () => {
  if (currentPublication?.pdf_url) {
    clearTimeout(window.__rmrdcResizeTimer);
    window.__rmrdcResizeTimer = setTimeout(async () => {
      await renderFlipbook(currentPublication.pdf_url);
    }, 180);
  }
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
    showMessage('Flipbook could not load this PDF. Use “View Full” for direct viewing.');
  }
})();
