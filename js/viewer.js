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
const PAID_PREVIEW_PAGE_LIMIT = 4;

function isPaidPublication(publication) {
  return Boolean(publication?.is_paid) || Number(publication?.price || 0) > 0;
}

function canReadPage(pageNum) {
  return !isPaidPublication(currentPublication) || pageNum <= Number(currentPublication?.preview_page_limit || PAID_PREVIEW_PAGE_LIMIT);
}

function getReadablePdfUrl(publication) {
  if (!publication) return null;
  if (isPaidPublication(publication)) return publication.preview_url || publication.pdf_url;
  return publication.pdf_url || publication.preview_url;
}


function isHtmlPublication(publication) {
  return publication?.publication_format === 'html' || publication?.storage_type === 'html' || Boolean(publication?.ebook_url);
}

function getHtmlEbookUrl(publication) {
  return publication?.ebook_url || publication?.preview_url;
}

const refs = {
  cover: document.getElementById('detailCover'),
  type: document.getElementById('detailType'),
  title: document.getElementById('detailTitle'),
  authors: document.getElementById('detailAuthors'),
  year: document.getElementById('detailYear'),
  price: document.getElementById('detailPrice'),
  isbn: document.getElementById('detailIsbn'),
  doi: document.getElementById('detailDoi'),
  citation: document.getElementById('detailCitation'),
  copyCitation: document.getElementById('copyCitationBtn'),
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
  pageStatus: document.getElementById('pageStatus'),
  viewerModeText: document.getElementById('viewerModeText'),
  ebookShell: document.getElementById('ebookShell'),
  ebookFrame: document.getElementById('ebookFrame'),
  savePublication: document.getElementById('savePublicationBtn'),
  aiSummary: document.getElementById('aiSummaryBtn'),
  aiSummaryPanel: document.getElementById('aiSummaryPanel'),
  aiSummaryContent: document.getElementById('aiSummaryContent'),
  avgRating: document.getElementById('avgRating'),
  ratingCount: document.getElementById('ratingCount'),
  avgStars: document.getElementById('avgStars'),
  starButtons: document.getElementById('starButtons'),
  ratingMessage: document.getElementById('ratingMessage'),
  commentForm: document.getElementById('commentForm'),
  commentName: document.getElementById('commentName'),
  commentText: document.getElementById('commentText'),
  commentsList: document.getElementById('commentsList'),
  commentCount: document.getElementById('commentCount')
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


function getReaderId() {
  let id = localStorage.getItem('rmrdc_reader_id');
  if (!id) {
    id = 'reader-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem('rmrdc_reader_id', id);
  }
  return id;
}

function escapeHtml(text = '') {
  return String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function renderStars(value) {
  const rating = Math.round(Number(value || 0));
  return Array.from({ length: 5 }, (_, index) => index < rating ? '★' : '☆').join('');
}

function formatCitation(publication) {
  if (publication?.citation) return publication.citation;
  const authors = publication?.authors || 'RMRDC';
  const year = publication?.year || 'n.d.';
  const title = publication?.title || 'Untitled publication';
  const type = publication?.type || 'Publication';
  const cleanDoi = String(publication?.doi || '').replace(/^https?:\/\/doi\.org\//, '').trim();
  return `${authors} (${year}). ${title}. RMRDC ${type}${cleanDoi ? `. https://doi.org/${cleanDoi}` : '.'}`;
}

function setMyStars(value) {
  refs.starButtons?.querySelectorAll('button').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.rating) <= Number(value || 0));
  });
}

async function fetchRatingSummary() {
  if (!window.db || !currentPublication?.id) return;
  const { data } = await window.db.from('publication_rating_summary').select('*').eq('publication_id', currentPublication.id).maybeSingle();
  const avg = Number(data?.avg_rating || 0);
  const count = Number(data?.rating_count || 0);
  if (refs.avgRating) refs.avgRating.textContent = avg ? avg.toFixed(1) : '0.0';
  if (refs.ratingCount) refs.ratingCount.textContent = `${count} rating${count === 1 ? '' : 's'}`;
  if (refs.avgStars) refs.avgStars.textContent = renderStars(avg);
}

async function fetchMyRating() {
  if (!window.db || !currentPublication?.id) return;
  const { data } = await window.db.from('publication_ratings').select('rating').eq('publication_id', currentPublication.id).eq('reader_id', getReaderId()).maybeSingle();
  setMyStars(data?.rating || 0);
}

async function saveRating(rating) {
  if (!window.db || !currentPublication?.id) return;
  const { error } = await window.db.from('publication_ratings').upsert({
    publication_id: currentPublication.id,
    reader_id: getReaderId(),
    rating: Number(rating),
    updated_at: new Date().toISOString()
  }, { onConflict: 'publication_id,reader_id' });
  if (error) {
    console.error(error);
    if (refs.ratingMessage) refs.ratingMessage.textContent = 'Could not save rating.';
    return;
  }
  setMyStars(rating);
  if (refs.ratingMessage) refs.ratingMessage.textContent = 'Rating saved. Thank you.';
  await fetchRatingSummary();
}

async function fetchComments() {
  if (!window.db || !currentPublication?.id || !refs.commentsList) return;
  const { data, error } = await window.db.from('publication_comments').select('*').eq('publication_id', currentPublication.id).order('created_at', { ascending: false }).limit(25);
  if (error) {
    refs.commentsList.innerHTML = '<p class="muted">Could not load comments.</p>';
    return;
  }
  const comments = data || [];
  refs.commentCount.textContent = comments.length;
  refs.commentsList.innerHTML = comments.length ? comments.map(comment => `
    <article class="comment-item">
      <strong>${escapeHtml(comment.reader_name || 'Reader')}</strong>
      <p>${escapeHtml(comment.comment_text || '')}</p>
      <small>${new Date(comment.created_at).toLocaleString()}</small>
    </article>
  `).join('') : '<p class="muted">No comments yet. Be the first to comment.</p>';
}

function attachInteractionEvents() {
  refs.starButtons?.querySelectorAll('button').forEach(button => button.addEventListener('click', () => saveRating(button.dataset.rating)));
  refs.copyCitation?.addEventListener('click', async () => {
    const text = refs.citation?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      refs.copyCitation.textContent = 'Copied';
      setTimeout(() => refs.copyCitation.textContent = 'Copy', 1200);
    } catch {
      alert(text);
    }
  });
  refs.commentForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const commentText = refs.commentText.value.trim();
    if (!commentText || !window.db || !currentPublication?.id) return;
    const { error } = await window.db.from('publication_comments').insert({
      publication_id: currentPublication.id,
      reader_id: getReaderId(),
      reader_name: refs.commentName.value.trim() || 'Reader',
      comment_text: commentText
    });
    if (error) {
      alert('Could not save comment.');
      return;
    }
    refs.commentText.value = '';
    await fetchComments();
  });
}


function renderHtmlEbook(publication) {
  const ebookUrl = getHtmlEbookUrl(publication);
  if (!ebookUrl) {
    showMessage('This HTML eBook does not have a readable entry URL.');
    return;
  }

  refs.flipbookShell?.classList.add('hidden');
  refs.ebookShell?.classList.remove('hidden');
  refs.prevPage.disabled = true;
  refs.nextPage.disabled = true;
  refs.zoomIn.disabled = true;
  refs.zoomOut.disabled = true;
  refs.fitPage.disabled = true;
  refs.fitWidth.disabled = true;
  refs.stagePrev.disabled = true;
  refs.stageNext.disabled = true;
  refs.pageStatus.textContent = 'HTML eBook';
  if (refs.viewerModeText) refs.viewerModeText.textContent = 'Stable HTML/CD-ROM eBook viewer.';
  if (refs.ebookFrame) refs.ebookFrame.src = ebookUrl;
  if (refs.viewFull) refs.viewFull.href = ebookUrl;
  if (refs.download) refs.download.textContent = 'Open eBook';
}

async function loadInteractions() {
  await Promise.all([fetchRatingSummary(), fetchMyRating(), fetchComments()]);
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
  if (refs.isbn) refs.isbn.textContent = publication.isbn || '—';
  if (refs.doi) refs.doi.textContent = publication.doi || '—';
  if (refs.citation) refs.citation.textContent = formatCitation(publication);
  refs.views.textContent = publication.view_count || 0;
  refs.downloads.textContent = publication.download_count || 0;
  refs.abstract.textContent = publication.abstract || 'No abstract available.';
  const isHtml = isHtmlPublication(publication);
  const paid = isPaidPublication(publication) && !isHtml;

  if (isHtml) {
    const ebookUrl = getHtmlEbookUrl(publication) || '#';
    refs.viewFull.href = ebookUrl;
    refs.viewFull.textContent = 'Open eBook';
    refs.viewFull.classList.remove('is-disabled');
    refs.download.disabled = false;
    refs.download.textContent = 'Open eBook';
  } else {
    refs.viewFull.href = paid ? '#' : (publication.pdf_url || publication.preview_url || '#');
    refs.viewFull.textContent = paid ? 'Full copy available in library' : 'View Full';
    refs.viewFull.classList.toggle('is-disabled', paid);
    refs.download.disabled = paid;
    refs.download.textContent = paid ? 'Subscription required' : 'Download PDF';
  }

  if (paid) {
    showMessage(`Paid publication preview: only the first ${publication.preview_page_limit || PAID_PREVIEW_PAGE_LIMIT} pages are available online. Subscribe or visit the RMRDC Library to access the full copy.`);
  }
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

    if (!canReadPage(pageNum)) {
      pageEl.classList.add('locked-page');
      const lockOverlay = document.createElement('div');
      lockOverlay.className = 'locked-page-overlay';
      lockOverlay.innerHTML = `
        <div class="lock-card">
          <div class="lock-icon">🔒</div>
          <strong>Preview limit reached</strong>
          <p>This is a paid publication. Subscribe or visit the RMRDC Library to access the full copy.</p>
          <span>Online preview includes pages 1–${PAID_PREVIEW_PAGE_LIMIT}</span>
        </div>
      `;
      pageEl.appendChild(lockOverlay);
    }

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
  if (isPaidPublication(currentPublication)) {
    showMessage(`Paid publication preview: only the first ${publication.preview_page_limit || PAID_PREVIEW_PAGE_LIMIT} pages are available online. Subscribe or visit the RMRDC Library to access the full copy.`);
  }
}

async function rerender() {
  const readableUrl = getReadablePdfUrl(currentPublication);
  if (readableUrl) await renderFlipbook(readableUrl, false);
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
refs.savePublication?.addEventListener('click', () => saveCurrentPublication(currentPublication));
refs.aiSummary?.addEventListener('click', () => generateAISummary(currentPublication));

refs.viewFull.addEventListener('click', (event) => {
  if (isHtmlPublication(currentPublication)) return;

  if (isPaidPublication(currentPublication)) {
    event.preventDefault();
    showMessage('This is a paid publication. Please subscribe or visit the RMRDC Library to access the full copy.');
  }
});

refs.download.addEventListener('click', async () => {
  if (isHtmlPublication(currentPublication)) {
    const ebookUrl = getHtmlEbookUrl(currentPublication);
    if (!ebookUrl) return;
    await incrementMetric('download', currentPublication);
    window.open(ebookUrl, '_blank', 'noopener');
    return;
  }

  if (!getReadablePdfUrl(currentPublication)) return;
  if (isPaidPublication(currentPublication)) {
    showMessage('Downloads are disabled for paid publications. Please subscribe or visit the RMRDC Library for the full copy.');
    return;
  }
  await incrementMetric('download', currentPublication);
  window.open(currentPublication.pdf_url, '_blank', 'noopener');
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') pageFlip?.flipPrev();
  if (event.key === 'ArrowRight') pageFlip?.flipNext();
});

window.addEventListener('resize', () => {
  if (!isHtmlPublication(currentPublication) && getReadablePdfUrl(currentPublication)) {
    clearTimeout(window.__rmrdcResizeTimer);
    window.__rmrdcResizeTimer = setTimeout(() => rerender().catch(console.error), 250);
  }
});

document.addEventListener('fullscreenchange', () => {
  setTimeout(() => rerender().catch(console.error), 250);
});

attachInteractionEvents();


async function recordReadingHistory(publication) {
  if (window.RMRDCUserFeatures?.recordReadingHistory) await window.RMRDCUserFeatures.recordReadingHistory(publication);
}
async function saveCurrentPublication(publication) {
  if (window.RMRDCUserFeatures?.savePublication) await window.RMRDCUserFeatures.savePublication(publication);
}
async function generateAISummary(publication) {
  if (!refs.aiSummaryContent || !refs.aiSummaryPanel) return;
  refs.aiSummaryPanel.classList.remove('hidden');
  refs.aiSummaryContent.textContent = 'Generating smart summary from publication metadata and available indexed text...';
  try {
    if (!window.db) throw new Error('Supabase is not connected.');
    const { data, error } = await window.db.functions.invoke('ai-summary', { body: { publication_id: publication.id } });
    if (error) throw error;
    refs.aiSummaryContent.innerHTML = (data?.summary || 'No summary generated.').replace(/
/g, '<br>');
  } catch (error) {
    refs.aiSummaryContent.textContent = error.message || 'AI summary is not configured. Deploy the ai-summary Edge Function.';
  }
}

(async function init() {
  currentPublication = await fetchPublication();
  if (!currentPublication) return;
  hydrateSidebar(currentPublication);
  await incrementMetric('view', currentPublication);
  await recordReadingHistory(currentPublication);
  await loadInteractions();

  if (isHtmlPublication(currentPublication)) {
    setLoading(false);
    renderHtmlEbook(currentPublication);
    return;
  }

  try {
    await renderFlipbook(getReadablePdfUrl(currentPublication), true);
  } catch (err) {
    console.error(err);
    setLoading(false);
    showMessage('Flipbook could not load this PDF. Check that the PDF URL is public and allows browser access, or use “View Full” for direct viewing.');
  }
})();
