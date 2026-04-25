import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

const params = new URLSearchParams(window.location.search);
const publicationId = params.get('id');
const directPdfUrl = params.get('pdf');

let pageFlip = null;
let currentZoom = 1;
let totalPages = 0;
let currentPublication = null;
let fitMode = 'page';
let pdfDocument = null;
let renderToken = 0;

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
  loader: document.getElementById('viewerLoader'),
  message: document.getElementById('viewerMessage'),
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  stagePrev: document.getElementById('stagePrev'),
  stageNext: document.getElementById('stageNext'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  fitPage: document.getElementById('fitPage'),
  fitWidth: document.getElementById('fitWidth'),
  fullscreen: document.getElementById('fullscreenBtn'),
  pageStatus: document.getElementById('pageStatus')
};

function showMessage(text) {
  refs.message.textContent = text;
  refs.message.classList.remove('hidden');
}

function hideMessage() {
  refs.message.classList.add('hidden');
}

function setLoading(isLoading, text = 'Loading flipbook…') {
  refs.loader.textContent = text;
  refs.loader.classList.toggle('hidden', !isLoading);
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return 'Free';
  const amount = Number(value);
  if (Number.isNaN(amount) || amount <= 0) return 'Free';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(amount);
}

function updateStatus(pageIndex = 0) {
  const page = Math.min(totalPages, Math.max(1, pageIndex + 1));
  refs.pageStatus.textContent = `Page ${page} / ${Math.max(0, totalPages)}`;
  if (totalPages > 0) window.history.replaceState(null, '', `#page/${page}`);
}

function getInitialPageIndex() {
  const match = window.location.hash.match(/page\/(\d+)/i);
  if (!match) return 0;
  return Math.max(0, Math.min(totalPages - 1, Number(match[1]) - 1));
}

async function incrementMetric(kind, publication) {
  if (!window.db || !publication?.id) return;
  const payload = { publication_id: publication.id, user_agent: navigator.userAgent };
  const table = kind === 'download' ? 'download_events' : 'view_events';
  await window.db.from(table).insert(payload);
}

async function fetchPublication() {
  if (directPdfUrl) {
    return {
      id: null,
      title: params.get('title') || 'PDF Publication',
      authors: params.get('authors') || 'Direct PDF',
      type: 'Publication',
      year: params.get('year') || '—',
      price: 0,
      view_count: 0,
      download_count: 0,
      abstract: 'This document was opened directly from a PDF URL.',
      cover_url: 'assets/placeholder-cover.svg',
      pdf_url: directPdfUrl
    };
  }

  if (!window.db || !publicationId) {
    showMessage('Missing publication identifier or Supabase configuration. You can also open viewer.html?pdf=YOUR_PDF_URL.');
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
  const shellWidth = Math.max(320, refs.shell.clientWidth - 72);
  const shellHeight = Math.max(420, refs.shell.clientHeight - 42);
  const isPortrait = window.matchMedia('(max-width: 760px)').matches;
  const pageAspect = 1.414; // A-series PDF pages are usually height = width * 1.414

  if (isPortrait) {
    const width = Math.min(shellWidth, Math.floor(shellHeight / pageAspect));
    return { width: Math.max(260, width), height: Math.max(360, Math.floor(width * pageAspect)) };
  }

  if (fitMode === 'width') {
    const width = Math.floor(shellWidth / 2);
    return { width: Math.max(300, width), height: Math.max(430, Math.min(shellHeight, Math.floor(width * pageAspect))) };
  }

  const height = Math.floor(shellHeight * 0.96);
  const width = Math.floor(height / pageAspect);
  return { width: Math.max(300, Math.min(Math.floor(shellWidth / 2), width)), height: Math.max(430, height) };
}

async function renderPageToImage(pageNum, scale) {
  const page = await pdfDocument.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.94);
}

async function renderFlipbook(pdfUrl, forceReloadPdf = false) {
  const token = ++renderToken;
  hideMessage();
  setLoading(true, 'Loading PDF…');

  if (!pdfDocument || forceReloadPdf) {
    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false });
    pdfDocument = await loadingTask.promise;
  }

  totalPages = pdfDocument.numPages;
  refs.flipbook.innerHTML = '';
  updateStatus(0);

  const dims = buildFlipDimensions();
  const renderScale = Math.max(1.2, Math.min(3, (dims.width / 595) * 1.85 * currentZoom));

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    if (token !== renderToken) return;
    setLoading(true, `Rendering page ${pageNum} of ${totalPages}…`);
    const pageEl = document.createElement('div');
    pageEl.className = 'flipbook-page';
    pageEl.dataset.page = String(pageNum);

    const img = document.createElement('img');
    img.src = await renderPageToImage(pageNum, renderScale);
    img.alt = `Page ${pageNum}`;
    pageEl.appendChild(img);
    refs.flipbook.appendChild(pageEl);
  }

  if (token !== renderToken) return;
  if (pageFlip) pageFlip.destroy();

  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  pageFlip = new St.PageFlip(refs.flipbook, {
    width: dims.width,
    height: dims.height,
    size: 'fixed',
    minWidth: 260,
    maxWidth: 1800,
    minHeight: 360,
    maxHeight: 2200,
    drawShadow: true,
    flippingTime: 850,
    maxShadowOpacity: 0.45,
    showCover: false,
    usePortrait: isMobile,
    mobileScrollSupport: true,
    startZIndex: 10,
    autoSize: false
  });

  pageFlip.loadFromHTML(refs.flipbook.querySelectorAll('.flipbook-page'));
  pageFlip.on('flip', (e) => updateStatus(e.data));

  const initialPage = getInitialPageIndex();
  if (initialPage > 0) pageFlip.flip(initialPage, 'top');
  updateStatus(initialPage);
  setLoading(false);
}

async function rerender() {
  if (currentPublication?.pdf_url) await renderFlipbook(currentPublication.pdf_url, false);
}

refs.prev.addEventListener('click', () => pageFlip?.flipPrev());
refs.next.addEventListener('click', () => pageFlip?.flipNext());
refs.stagePrev.addEventListener('click', () => pageFlip?.flipPrev());
refs.stageNext.addEventListener('click', () => pageFlip?.flipNext());
refs.zoomIn.addEventListener('click', async () => { currentZoom = Math.min(2.5, currentZoom + 0.15); await rerender(); });
refs.zoomOut.addEventListener('click', async () => { currentZoom = Math.max(0.7, currentZoom - 0.15); await rerender(); });
refs.fitPage.addEventListener('click', async () => { fitMode = 'page'; await rerender(); });
refs.fitWidth.addEventListener('click', async () => { fitMode = 'width'; await rerender(); });
refs.fullscreen.addEventListener('click', async () => {
  if (!document.fullscreenElement) await refs.shell.requestFullscreen?.();
  else await document.exitFullscreen?.();
});
refs.download.addEventListener('click', async () => {
  if (!currentPublication?.pdf_url) return;
  await incrementMetric('download', currentPublication);
  window.open(currentPublication.pdf_url, '_blank', 'noopener');
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') pageFlip?.flipPrev();
  if (event.key === 'ArrowRight') pageFlip?.flipNext();
});

window.addEventListener('resize', () => {
  if (currentPublication?.pdf_url) {
    clearTimeout(window.__rmrdcResizeTimer);
    window.__rmrdcResizeTimer = setTimeout(() => rerender().catch(console.error), 250);
  }
});

document.addEventListener('fullscreenchange', () => {
  setTimeout(() => rerender().catch(console.error), 250);
});

(async function init() {
  currentPublication = await fetchPublication();
  if (!currentPublication) return;
  hydrateSidebar(currentPublication);
  await incrementMetric('view', currentPublication);
  try {
    await renderFlipbook(currentPublication.pdf_url, true);
  } catch (err) {
    console.error(err);
    setLoading(false);
    showMessage('Flipbook could not load this PDF. Check that the PDF URL is public and allows browser access, or use “View Full” for direct viewing.');
  }
})();
