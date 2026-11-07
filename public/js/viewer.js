import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

const params = new URLSearchParams(window.location.search);
const publicationId = params.get('id');
const directPdfUrl = params.get('pdf');

let pageFlip = null;
let currentZoom = 1;
let flipbookDimensions = null;
let flipbookPortrait = false;
let totalPages = 0;
let currentPublication = null;
let fitMode = 'page';
let pdfDocument = null;
let renderToken = 0;
let purchasedPdfUrl = null;
let hasPurchasedCurrentPublication = false;
const renderedPages = new Map();

const PAID_PREVIEW_PAGE_LIMIT = 4;

function isPaidPublication(publication) {
  return Boolean(publication?.is_paid) || Number(publication?.price || 0) > 0;
}

function canReadPage(pageNum) {
  return !isPaidPublication(currentPublication) || hasPurchasedCurrentPublication ||
    pageNum <= Number(currentPublication?.preview_page_limit || PAID_PREVIEW_PAGE_LIMIT);
}

function isHtmlPublication(publication) {
  return publication?.publication_format === 'html' ||
    publication?.storage_type === 'html' ||
    Boolean(publication?.ebook_url);
}

function getHtmlEbookUrl(publication) {
  return publication?.ebook_url || publication?.preview_url || publication?.ebook_entry || null;
}

function getReadablePdfUrl(publication) {
  if (!publication) return null;
  if (isHtmlPublication(publication)) return getHtmlEbookUrl(publication);
  if (publication === currentPublication && hasPurchasedCurrentPublication && purchasedPdfUrl) return purchasedPdfUrl;
  if (isPaidPublication(publication)) return publication.preview_url || publication.pdf_url || null;
  return publication.pdf_url || publication.preview_url || null;
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
  researchIntelligencePanel: document.getElementById('researchIntelligencePanel'),
  researchIntelligenceContent: document.getElementById('researchIntelligenceContent'),
  viewFull: document.getElementById('viewFullBtn'),
  download: document.getElementById('downloadBtn'),
  flipbook: document.getElementById('flipbook'),
  flipbookShell: document.getElementById('flipbookShell'),
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
  darkBackground: document.getElementById('toggleDarkBackground'),
  pageStatus: document.getElementById('pageStatus'),
  viewerModeText: document.getElementById('viewerModeText'),
  ebookShell: document.getElementById('ebookShell'),
  ebookFrame: document.getElementById('ebookFrame'),
  ebookExternalFallback: document.getElementById('ebookExternalFallback'),
  ebookExternalTitle: document.getElementById('ebookExternalTitle'),
  ebookExternalLink: document.getElementById('ebookExternalLink'),
  purchaseForm: document.getElementById('purchaseForm'),
  purchaseEmail: document.getElementById('purchaseEmail'),
  purchaseButton: document.getElementById('purchaseButton'),
  purchaseMessage: document.getElementById('purchaseMessage'),
  savePublication: document.getElementById('savePublicationBtn'),
  aiSummary: document.getElementById('aiSummaryBtn'),
  aiChatPanel: document.getElementById('viewerAiChatPanel'),
  aiChatClose: document.getElementById('viewerAiClose'),
  aiChatContext: document.getElementById('viewerAiContext'),
  aiChatMessages: document.getElementById('viewerAiMessages'),
  aiChatForm: document.getElementById('viewerAiForm'),
  aiChatInput: document.getElementById('viewerAiInput'),
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
  if (!refs.message) return;
  refs.message.textContent = text;
  refs.message.classList.remove('hidden');
}

function hideMessage() {
  refs.message?.classList.add('hidden');
}

function setLoading(isLoading, text = 'Loading flipbook…') {
  if (!refs.loader) return;
  refs.loader.textContent = text;
  refs.loader.classList.toggle('hidden', !isLoading);
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
  const page = Math.min(totalPages, Math.max(1, pageIndex + 1));
  if (refs.pageStatus) refs.pageStatus.textContent = `Page ${page} / ${Math.max(0, totalPages)}`;
  if (totalPages > 0) window.history.replaceState(null, '', `#page/${page}`);
}

function setPurchaseMessage(message, isError = false) {
  if (!refs.purchaseMessage) return;
  refs.purchaseMessage.textContent = message;
  refs.purchaseMessage.classList.remove('hidden');
  refs.purchaseMessage.classList.toggle('error', isError);
}

async function initializePaystackCheckout(event) {
  event.preventDefault();
  if (!window.db || !currentPublication?.id) {
    setPurchaseMessage('Payment is temporarily unavailable. Please try again later.', true);
    return;
  }

  const email = refs.purchaseEmail?.value.trim() || '';
  if (!email || !refs.purchaseEmail?.checkValidity()) {
    refs.purchaseEmail?.reportValidity();
    return;
  }

  if (refs.purchaseButton) {
    refs.purchaseButton.disabled = true;
    refs.purchaseButton.textContent = 'Preparing secure checkout…';
  }
  setPurchaseMessage('Connecting to Paystack…');

  try {
    const { data, error } = await window.db.functions.invoke('paystack-initialize', {
      body: { publication_id: currentPublication.id, email }
    });
    if (error || !data?.authorization_url) {
      console.error('Could not initialize Paystack payment:', error || data);
      setPurchaseMessage(data?.error || 'Could not start payment. Please try again later.', true);
      return;
    }

    const checkoutUrl = new URL(data.authorization_url);
    if (checkoutUrl.origin !== 'https://checkout.paystack.com') {
      throw new Error('Unexpected checkout destination.');
    }
    window.location.assign(checkoutUrl.toString());
  } catch (error) {
    console.error('Could not start Paystack checkout:', error);
    setPurchaseMessage('Could not start payment. Please try again later.', true);
  } finally {
    if (refs.purchaseButton && window.location.hostname) {
      refs.purchaseButton.disabled = false;
      refs.purchaseButton.textContent = `Pay ${formatPrice(currentPublication?.price)} with Paystack`;
    }
  }
}

async function verifyPaystackReturn(reference) {
  if (!window.db) {
    setPurchaseMessage('Payment completed, but access verification is unavailable. Refresh this page shortly.', true);
    return;
  }

  if (refs.purchaseButton) {
    refs.purchaseButton.disabled = true;
    refs.purchaseButton.textContent = 'Verifying payment…';
  }
  setPurchaseMessage('Verifying your payment securely…');

  try {
    const { data, error } = await window.db.functions.invoke('paystack-verify', {
      body: { reference, publication_id: currentPublication.id }
    });
    if (error || data?.status !== 'success' || !data?.signed_url) {
      console.error('Could not verify Paystack payment:', error || data);
      setPurchaseMessage(data?.error || 'Payment is not confirmed yet. Please retry in a moment.', true);
      if (refs.purchaseButton) refs.purchaseButton.disabled = false;
      return;
    }

    purchasedPdfUrl = data.signed_url;
    hasPurchasedCurrentPublication = true;
    refs.purchaseForm?.classList.add('hidden');
    if (refs.viewFull) {
      refs.viewFull.href = purchasedPdfUrl;
      refs.viewFull.textContent = 'View Full';
      refs.viewFull.classList.remove('is-disabled');
    }
    if (refs.download) {
      refs.download.disabled = false;
      refs.download.textContent = 'Download PDF';
    }
    await renderFlipbook(purchasedPdfUrl, true);
    hideMessage();
  } catch (error) {
    console.error('Could not verify Paystack payment:', error);
    setPurchaseMessage('Could not confirm payment or open the publication. Please retry shortly.', true);
    if (refs.purchaseButton) refs.purchaseButton.disabled = false;
  }
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
  return String(text).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
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

  const { data } = await window.db
    .from('publication_rating_summary')
    .select('*')
    .eq('publication_id', currentPublication.id)
    .maybeSingle();

  const avg = Number(data?.avg_rating || 0);
  const count = Number(data?.rating_count || 0);

  if (refs.avgRating) refs.avgRating.textContent = avg ? avg.toFixed(1) : '0.0';
  if (refs.ratingCount) refs.ratingCount.textContent = `${count} rating${count === 1 ? '' : 's'}`;
  if (refs.avgStars) refs.avgStars.textContent = renderStars(avg);
}

async function fetchMyRating() {
  if (!window.db || !currentPublication?.id) return;

  const { data } = await window.db
    .from('publication_ratings')
    .select('rating')
    .eq('publication_id', currentPublication.id)
    .eq('reader_id', getReaderId())
    .maybeSingle();

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

  const { data, error } = await window.db
    .from('publication_comments')
    .select('*')
    .eq('publication_id', currentPublication.id)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    refs.commentsList.innerHTML = '<p class="muted">Could not load comments.</p>';
    return;
  }

  const comments = data || [];
  if (refs.commentCount) refs.commentCount.textContent = comments.length;

  refs.commentsList.innerHTML = comments.length
    ? comments.map(comment => `
      <article class="comment-item">
        <strong>${escapeHtml(comment.reader_name || 'Reader')}</strong>
        <p>${escapeHtml(comment.comment_text || '')}</p>
        <small>${new Date(comment.created_at).toLocaleString()}</small>
      </article>
    `).join('')
    : '<p class="muted">No comments yet. Be the first to comment.</p>';
}

function attachInteractionEvents() {
  refs.starButtons?.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => saveRating(button.dataset.rating));
  });

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
    const commentText = refs.commentText?.value.trim();
    if (!commentText || !window.db || !currentPublication?.id) return;

    const { error } = await window.db.from('publication_comments').insert({
      publication_id: currentPublication.id,
      reader_id: getReaderId(),
      reader_name: refs.commentName?.value.trim() || 'Reader',
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
    setLoading(false);
    showMessage('This HTML eBook does not have a readable entry URL.');
    return;
  }

  refs.flipbookShell?.classList.add('hidden');
  refs.ebookShell?.classList.remove('hidden');

  ['prev', 'next', 'zoomIn', 'zoomOut', 'fitPage', 'fitWidth', 'stagePrev', 'stageNext'].forEach(key => {
    if (refs[key]) refs[key].disabled = true;
  });

  if (refs.pageStatus) refs.pageStatus.textContent = 'HTML eBook';
  const sourceUrl = new URL(ebookUrl, window.location.href);
  const isRmrdcLibraryPage = sourceUrl.hostname === 'library.rmrdc.gov.ng';
  if (refs.viewerModeText) {
    refs.viewerModeText.textContent = isRmrdcLibraryPage
      ? 'Open this RMRDC Digital Library publication at its source.'
      : 'Stable HTML/CD-ROM eBook viewer.';
  }
  refs.ebookExternalFallback?.classList.toggle('hidden', !isRmrdcLibraryPage);
  if (refs.ebookExternalTitle) refs.ebookExternalTitle.textContent = publication.title || 'Open this publication at its source';
  if (refs.ebookExternalLink) refs.ebookExternalLink.href = sourceUrl.href;
  if (refs.ebookFrame) {
    refs.ebookFrame.classList.toggle('hidden', isRmrdcLibraryPage);
    refs.ebookFrame.title = publication.title || 'HTML eBook';
    if (isRmrdcLibraryPage) {
      refs.ebookFrame.removeAttribute('src');
    } else {
      refs.ebookFrame.src = sourceUrl.href;
    }
  }

  if (refs.viewFull) {
    refs.viewFull.href = ebookUrl;
    refs.viewFull.textContent = 'Open eBook';
    refs.viewFull.classList.remove('is-disabled');
  }

  if (refs.download) {
    refs.download.disabled = false;
    refs.download.textContent = 'Open eBook';
  }
}

async function loadInteractions() {
  await Promise.all([
    fetchRatingSummary().catch(console.warn),
    fetchMyRating().catch(console.warn),
    fetchComments().catch(console.warn)
  ]);
}

async function incrementMetric(kind, publication) {
  if (!window.db || !publication?.id) return;
  const table = kind === 'download' ? 'download_events' : 'view_events';
  await window.db.from(table).insert({
    publication_id: publication.id,
    user_agent: navigator.userAgent
  });
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
      pdf_url: directPdfUrl,
      publication_format: 'pdf'
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
  const abstract = publication.abstract || '';
  const containsDocumentFrontMatter = /\b(?:publisher:|all rights reserved|no part of this publication may be reproduced|printed by:)\b/i.test(abstract);
  const extractedTitle = containsDocumentFrontMatter
    ? abstract.match(/^(.+?)(?=\s+(?:Dr\.?|Prof\.?))/i)?.[1]?.trim()
    : '';
  const displayTitle = extractedTitle || publication.title || 'Untitled publication';

  if (refs.cover) refs.cover.src = publication.cover_url || 'assets/placeholder-cover.svg';
  if (refs.type) refs.type.textContent = publication.type || 'Publication';
  if (refs.title) refs.title.textContent = displayTitle;
  if (refs.authors) refs.authors.textContent = publication.authors || 'No author information';
  if (refs.year) refs.year.textContent = publication.year || '—';
  if (refs.price) refs.price.textContent = formatPrice(publication.price);
  if (refs.isbn) refs.isbn.textContent = publication.isbn || '—';
  if (refs.doi) refs.doi.textContent = publication.doi || '—';
  if (refs.citation) refs.citation.textContent = formatCitation(publication);
  if (refs.views) refs.views.textContent = publication.view_count || 0;
  if (refs.downloads) refs.downloads.textContent = publication.download_count || 0;
  const purchaseAvailable = isPaidPublication(publication) && Boolean(publication.pdf_path) && !isHtmlPublication(publication);
  refs.purchaseForm?.classList.toggle('hidden', !purchaseAvailable);
  if (refs.purchaseButton && purchaseAvailable) {
    refs.purchaseButton.textContent = `Pay ${formatPrice(publication.price)} with Paystack`;
  }
  if (refs.abstract) {
    refs.abstract.textContent = containsDocumentFrontMatter
      ? displayTitle
      : abstract || 'No abstract available.';
  }
  if (refs.researchIntelligencePanel && refs.researchIntelligenceContent) {
    const items = [
      ['Why it matters', publication.research_significance],
      ['Key findings', publication.key_findings],
      ['Methodology', publication.methodology],
      ['Data / resources', publication.data_resources],
      ['Research gaps', publication.research_gaps],
      ['Implications', publication.research_implications],
      ['Context', publication.context_geography],
      ['Limitations', publication.limitations],
      ['Recommended for', publication.recommended_for]
    ].filter(([,v]) => v);
    refs.researchIntelligenceContent.innerHTML = items.length
      ? items.map(([label,value]) => `<article><strong>${escapeHtml(label)}</strong><p>${escapeHtml(value)}</p></article>`).join('')
      : '<p class="muted">This publication has not yet been enriched with the extended research intelligence profile.</p>';
    refs.researchIntelligencePanel.classList.toggle('hidden', !items.length);
  }

  const isHtml = isHtmlPublication(publication);
  const paid = isPaidPublication(publication) && !isHtml;

  if (isHtml) {
    const ebookUrl = getHtmlEbookUrl(publication) || '#';

    if (refs.viewFull) {
      refs.viewFull.href = ebookUrl;
      refs.viewFull.textContent = 'Open eBook';
      refs.viewFull.classList.remove('is-disabled');
    }

    if (refs.download) {
      refs.download.disabled = false;
      refs.download.textContent = 'Open eBook';
    }
  } else {
    const pdfUrl = getReadablePdfUrl(publication) || '#';

    if (refs.viewFull) {
      refs.viewFull.href = paid ? '#' : pdfUrl;
      refs.viewFull.textContent = paid
        ? (purchaseAvailable ? 'Purchase to unlock full copy' : 'Full copy available in library')
        : 'View Full';
      refs.viewFull.classList.toggle('is-disabled', paid);
    }

    if (refs.download) {
      refs.download.disabled = paid;
      refs.download.textContent = paid
        ? (purchaseAvailable ? 'Purchase required' : 'Subscription required')
        : 'Download PDF';
    }
  }

  if (paid) {
    showMessage(`Paid publication preview: only the first ${publication.preview_page_limit || PAID_PREVIEW_PAGE_LIMIT} pages are available online. Subscribe or visit the RMRDC Library to access the full copy.`);
  }
}

function buildFlipDimensions() {
  const shellStyle = refs.shell ? window.getComputedStyle(refs.shell) : null;
  const horizontalPadding = shellStyle
    ? parseFloat(shellStyle.paddingLeft) + parseFloat(shellStyle.paddingRight)
    : 0;
  const verticalPadding = shellStyle
    ? parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom)
    : 0;
  const shellWidth = Math.max(1, (refs.shell?.clientWidth || 900) - horizontalPadding);
  const shellHeight = Math.max(1, (refs.shell?.clientHeight || 700) - verticalPadding);
  const isPortrait = window.matchMedia('(max-width: 760px)').matches;
  const pageAspect = 1.414;

  if (isPortrait) {
    const width = Math.min(shellWidth, Math.floor(shellHeight / pageAspect));
    return {
      width: Math.max(1, width),
      height: Math.max(1, Math.floor(width * pageAspect))
    };
  }

  const width = Math.min(Math.floor(shellWidth / 2), Math.floor(shellHeight / pageAspect));

  return {
    width: Math.max(1, width),
    height: Math.max(1, Math.floor(width * pageAspect))
  };
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

async function ensurePageFlipLibrary() {
  if (window.St?.PageFlip) return;

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pageflip]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js';
    script.dataset.pageflip = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('PageFlip library could not be loaded.'));
    document.head.appendChild(script);
  });
}

async function renderFlipbook(pdfUrl, forceReloadPdf = false) {
  const token = ++renderToken;
  const previousPageIndex = pageFlip?.getCurrentPageIndex?.();

  console.log('RMRDC viewer PDF URL:', pdfUrl);

  if (!pdfUrl) {
    setLoading(false);
    showMessage('No PDF URL was found for this publication.');
    return;
  }

  hideMessage();
  setLoading(true, 'Loading PDF…');

  if (!refs.flipbook) {
    throw new Error('Flipbook container was not found.');
  }

  refs.flipbookShell?.classList.remove('hidden');
  refs.ebookShell?.classList.add('hidden');

  if (!pdfDocument || forceReloadPdf) {
    pdfDocument = null;

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      withCredentials: false,
      disableAutoFetch: false,
      disableStream: false
    });

    pdfDocument = await loadingTask.promise;
  }

  totalPages = pdfDocument.numPages || 0;

  if (!totalPages) {
    throw new Error('PDF loaded, but no pages were found.');
  }
  if (token !== renderToken) return;

  const initialPage = Number.isInteger(previousPageIndex)
    ? Math.min(totalPages - 1, previousPageIndex)
    : getInitialPageIndex();
  // PageFlip owns its page nodes. Tear down the old instance before adding
  // replacement pages, or destroy() can remove the freshly rendered book.
  if (pageFlip) {
    pageFlip.destroy();
    pageFlip = null;
  }
  refs.flipbook.innerHTML = '';
  updateStatus(initialPage);

  const dims = buildFlipDimensions();
  flipbookDimensions = dims;
  flipbookPortrait = window.matchMedia('(max-width: 760px)').matches;
  const renderScale = Math.max(1.2, Math.min(3, (dims.width / 595) * 1.85));

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    if (token !== renderToken) return;
    setLoading(true, `Rendering page ${pageNum} of ${totalPages}…`);
    const pageEl = document.createElement('div');
    pageEl.className = 'flipbook-page';
    pageEl.dataset.page = String(pageNum);

    const img = document.createElement('img');
    img.alt = `Page ${pageNum}`;
    const cacheKey = `${pdfUrl}:${pageNum}`;
    let pageImage = renderedPages.get(cacheKey);
    if (!pageImage) {
      pageImage = await renderPageToImage(pageNum, renderScale);
      if (token !== renderToken) return;
      renderedPages.set(cacheKey, pageImage);
    }
    img.src = pageImage;
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
          <span>Online preview includes pages 1–${currentPublication?.preview_page_limit || PAID_PREVIEW_PAGE_LIMIT}</span>
        </div>
      `;

      pageEl.appendChild(lockOverlay);
    }

    refs.flipbook.appendChild(pageEl);
  }

  if (token !== renderToken) return;

  await ensurePageFlipLibrary();

  const isMobile = window.matchMedia('(max-width: 760px)').matches;

  pageFlip = new window.St.PageFlip(refs.flipbook, {
    width: dims.width,
    height: dims.height,
    size: 'fixed',
    minWidth: 1,
    maxWidth: 1800,
    minHeight: 1,
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
  setReaderZoom(currentZoom);
  pageFlip.on('flip', e => updateStatus(e.data));

  if (initialPage > 0) pageFlip.flip(initialPage, 'top');

  updateStatus(initialPage);
  setLoading(false);

  if (isPaidPublication(currentPublication)) {
    showMessage(`Paid publication preview: only the first ${currentPublication?.preview_page_limit || PAID_PREVIEW_PAGE_LIMIT} pages are available online. Subscribe or visit the RMRDC Library to access the full copy.`);
  }
}

async function rerender() {
  if (isHtmlPublication(currentPublication)) return;

  const readableUrl = getReadablePdfUrl(currentPublication);
  if (readableUrl) await renderFlipbook(readableUrl, false);
}

function setReaderZoom(zoom) {
  currentZoom = Math.max(0.7, Math.min(2.5, zoom));
  if (!refs.flipbook || !flipbookDimensions || !refs.flipbookShell) return;

  const shellStyle = window.getComputedStyle(refs.flipbookShell);
  const horizontalPadding = parseFloat(shellStyle.paddingLeft) + parseFloat(shellStyle.paddingRight);
  const verticalPadding = parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom);
  const availableWidth = Math.max(1, refs.flipbookShell.clientWidth - horizontalPadding);
  const availableHeight = Math.max(1, refs.flipbookShell.clientHeight - verticalPadding);
  const spreadWidth = flipbookDimensions.width * (flipbookPortrait ? 1 : 2);
  const fitScale = Math.min(
    availableWidth / spreadWidth,
    availableHeight / flipbookDimensions.height
  );
  const reader = refs.flipbookShell.closest('.viewer-main');
  const verticalOffset = 0;

  const fittedReaderScale = fitScale * 1.1;
  refs.flipbook.style.transform = `translateY(${verticalOffset}px) scale(${fittedReaderScale * currentZoom})`;
}

function setReaderDarkBackground(enabled) {
  const reader = refs.flipbookShell?.closest('.viewer-main');
  reader?.classList.toggle('reader-dark-background', enabled);
  if (refs.darkBackground) {
    refs.darkBackground.setAttribute('aria-pressed', String(enabled));
    refs.darkBackground.textContent = enabled ? 'Light background' : 'Dark background';
  }
}

function getTouchDistance(touches) {
  const deltaX = touches[0].clientX - touches[1].clientX;
  const deltaY = touches[0].clientY - touches[1].clientY;
  return Math.hypot(deltaX, deltaY);
}

refs.prev?.addEventListener('click', () => pageFlip?.flipPrev());
refs.next?.addEventListener('click', () => pageFlip?.flipNext());
refs.stagePrev?.addEventListener('click', () => pageFlip?.flipPrev());
refs.stageNext?.addEventListener('click', () => pageFlip?.flipNext());

refs.zoomIn?.addEventListener('click', () => setReaderZoom(currentZoom + 0.15));
refs.zoomOut?.addEventListener('click', () => setReaderZoom(currentZoom - 0.15));
refs.darkBackground?.addEventListener('click', () => {
  const reader = refs.flipbookShell?.closest('.viewer-main');
  setReaderDarkBackground(!reader?.classList.contains('reader-dark-background'));
});

refs.flipbookShell?.addEventListener('wheel', event => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setReaderZoom(currentZoom * (event.deltaY < 0 ? 1.1 : 0.9));
}, { passive: false });

let pinchStart = null;
refs.flipbookShell?.addEventListener('touchstart', event => {
  if (event.touches.length === 2) {
    const distance = getTouchDistance(event.touches);
    if (distance > 0) pinchStart = { distance, zoom: currentZoom };
    event.stopPropagation();
  }
}, { passive: true, capture: true });

refs.flipbookShell?.addEventListener('touchmove', event => {
  if (!pinchStart || event.touches.length !== 2) return;
  event.preventDefault();
  event.stopPropagation();
  setReaderZoom(pinchStart.zoom * getTouchDistance(event.touches) / pinchStart.distance);
}, { passive: false, capture: true });

const clearPinch = event => {
  if (event.touches.length < 2) pinchStart = null;
};
refs.flipbookShell?.addEventListener('touchend', clearPinch, { passive: true });
refs.flipbookShell?.addEventListener('touchcancel', clearPinch, { passive: true });

refs.fitPage?.addEventListener('click', async () => {
  fitMode = 'page';
  await rerender();
});

refs.fitWidth?.addEventListener('click', async () => {
  fitMode = 'width';
  await rerender();
});

refs.fullscreen?.addEventListener('click', async () => {
  const reader = refs.fullscreen.closest('.viewer-main');
  if (!reader) return;
  if (reader.classList.contains('reader-expanded')) {
    reader.classList.remove('reader-expanded');
    document.body.classList.remove('reader-expanded-open');
    setReaderDarkBackground(false);
    refs.fullscreen.textContent = 'Fullscreen';
    requestAnimationFrame(() => setReaderZoom(currentZoom));
    return;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await reader.requestFullscreen();
  } catch (error) {
    // Embedded previews and some browser settings deny the Fullscreen API.
    // Expand the reader within the page so the same control still works.
    console.warn('Using expanded reader because fullscreen was unavailable:', error);
    reader.classList.add('reader-expanded');
    document.body.classList.add('reader-expanded-open');
    refs.fullscreen.textContent = 'Exit Fullscreen';
    requestAnimationFrame(() => setReaderZoom(currentZoom));
  }
});

refs.savePublication?.addEventListener('click', () => saveCurrentPublication(currentPublication));
function setViewerChatOpen(isOpen) {
  if (!refs.aiChatPanel || !refs.aiSummary) return;
  refs.aiChatPanel.classList.toggle('hidden', !isOpen);
  refs.aiChatPanel.setAttribute('aria-hidden', String(!isOpen));
  refs.aiSummary.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) {
    refs.aiChatPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => refs.aiChatInput?.focus(), 250);
  }
}

function addViewerChatMessage(role, text, sources = []) {
  const message = document.createElement('article');
  message.className = `ai-message ${role === 'assistant' ? 'bot' : 'user'}`;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  message.appendChild(paragraph);
  if (sources.length) {
    const sourceList = document.createElement('div');
    sourceList.className = 'ai-answer-sources';
    const heading = document.createElement('strong');
    heading.textContent = 'Sources';
    sourceList.appendChild(heading);
    sources.forEach(source => {
      if (!source?.publication_id || !source?.title) return;
      const link = document.createElement('a');
      const page = Number(source.page);
      link.href = `viewer.html?id=${encodeURIComponent(source.publication_id)}${page > 0 ? `#page/${Math.floor(page)}` : ''}`;
      link.textContent = `${source.title}${source.year ? `, ${source.year}` : ''}${page > 0 ? ` - p. ${Math.floor(page)}` : ' - Research Intelligence Profile'}`;
      link.target = '_blank';
      link.rel = 'noopener';
      sourceList.appendChild(link);
    });
    if (sourceList.querySelector('a')) message.appendChild(sourceList);
  }
  refs.aiChatMessages?.appendChild(message);
  if (refs.aiChatMessages) refs.aiChatMessages.scrollTop = refs.aiChatMessages.scrollHeight;
  return message;
}

refs.aiSummary?.addEventListener('click', () => {
  if (!currentPublication?.id) return;
  setViewerChatOpen(refs.aiChatPanel?.classList.contains('hidden'));
});
refs.aiChatClose?.addEventListener('click', () => {
  setViewerChatOpen(false);
  refs.aiSummary?.focus();
});
refs.aiChatForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const question = refs.aiChatInput?.value.trim();
  if (!question || !currentPublication?.id || !window.db) return;

  addViewerChatMessage('user', question);
  refs.aiChatInput.value = '';
  const pending = addViewerChatMessage('assistant', 'Searching RMRDC publications and research profiles…');
  const sendButton = refs.aiChatForm.querySelector('button[type="submit"]');
  if (sendButton) sendButton.disabled = true;
  try {
    const publicationContext = `Current publication: ${currentPublication.title || 'Untitled'} (ID: ${currentPublication.id}). Prefer evidence about this publication. If the available evidence does not cover the question, say so clearly.\n\nQuestion: ${question}`;
    const { data, error } = await window.db.functions.invoke('ai-librarian', {
      body: { question: publicationContext, publication_id: currentPublication.id }
    });
    if (error || !data?.answer) throw new Error('The RMRDC Research Assistant is temporarily unavailable. Please try again.');
    pending.querySelector('p').textContent = data.answer;
    if (Array.isArray(data.sources)) {
      data.sources.forEach(source => {
        if (!source?.publication_id || !source?.title) return;
        const link = document.createElement('a');
        const page = Number(source.page);
        link.href = `viewer.html?id=${encodeURIComponent(source.publication_id)}${page > 0 ? `#page/${Math.floor(page)}` : ''}`;
        link.textContent = `${source.title}${source.year ? `, ${source.year}` : ''}${page > 0 ? ` - p. ${Math.floor(page)}` : ' - Research Intelligence Profile'}`;
        link.target = '_blank';
        link.rel = 'noopener';
        const sourceList = pending.querySelector('.ai-answer-sources') || document.createElement('div');
        if (!sourceList.childElementCount) {
          sourceList.className = 'ai-answer-sources';
          const heading = document.createElement('strong');
          heading.textContent = 'Sources';
          sourceList.appendChild(heading);
          pending.appendChild(sourceList);
        }
        sourceList.appendChild(link);
      });
    }
    if (!data.evidenceFound) pending.classList.add('no-evidence');
  } catch (error) {
    pending.querySelector('p').textContent = 'The RMRDC Research Assistant is temporarily unavailable. Please try again.';
    pending.classList.add('error');
  } finally {
    if (sendButton) sendButton.disabled = false;
    refs.aiChatInput?.focus();
  }
});

refs.viewFull?.addEventListener('click', event => {
  if (isHtmlPublication(currentPublication)) return;

  if (isPaidPublication(currentPublication) && !hasPurchasedCurrentPublication) {
    event.preventDefault();
    refs.purchaseEmail?.focus();
    setPurchaseMessage('Purchase this publication to open the full copy.');
  }
});

refs.purchaseForm?.addEventListener('submit', initializePaystackCheckout);

refs.download?.addEventListener('click', async () => {
  if (isHtmlPublication(currentPublication)) {
    const ebookUrl = getHtmlEbookUrl(currentPublication);
    if (!ebookUrl) return;
    await incrementMetric('download', currentPublication);
    window.open(ebookUrl, '_blank', 'noopener');
    return;
  }

  const pdfUrl = getReadablePdfUrl(currentPublication);
  if (!pdfUrl) return;

  if (isPaidPublication(currentPublication) && !hasPurchasedCurrentPublication) {
    refs.purchaseEmail?.focus();
    setPurchaseMessage('Purchase this publication to download the full copy.');
    return;
  }

  await incrementMetric('download', currentPublication);
  window.open(pdfUrl, '_blank', 'noopener');
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('.viewer-main.reader-expanded')) {
    document.querySelector('.viewer-main.reader-expanded').classList.remove('reader-expanded');
    document.body.classList.remove('reader-expanded-open');
    setReaderDarkBackground(false);
    if (refs.fullscreen) refs.fullscreen.textContent = 'Fullscreen';
    requestAnimationFrame(() => setReaderZoom(currentZoom));
  }
  if (event.key === 'ArrowLeft') pageFlip?.flipPrev();
  if (event.key === 'ArrowRight') pageFlip?.flipNext();
});

function scheduleReaderLayout() {
  clearTimeout(window.__rmrdcResizeTimer);
  if (!isHtmlPublication(currentPublication) && getReadablePdfUrl(currentPublication)) {
      const reader = refs.shell?.closest('.viewer-main');
      if (document.fullscreenElement || reader?.classList.contains('reader-expanded')) return;
      window.__rmrdcResizeTimer = setTimeout(() => rerender().catch(console.error), 250);
  }
}

let ignoreFullscreenResizeUntil = 0;
window.addEventListener('resize', () => {
  setReaderZoom(currentZoom);
  if (Date.now() < ignoreFullscreenResizeUntil) return;
  scheduleReaderLayout();
});
document.addEventListener('fullscreenchange', () => {
  clearTimeout(window.__rmrdcResizeTimer);
  ignoreFullscreenResizeUntil = Date.now() + 1000;
  if (!document.fullscreenElement) setReaderDarkBackground(false);
  if (refs.fullscreen) refs.fullscreen.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
  requestAnimationFrame(() => setReaderZoom(currentZoom));
});

attachInteractionEvents();

async function recordReadingHistory(publication) {
  if (window.RMRDCUserFeatures?.recordReadingHistory) {
    await window.RMRDCUserFeatures.recordReadingHistory(publication);
  }
}

async function saveCurrentPublication(publication) {
  if (window.RMRDCUserFeatures?.savePublication) {
    await window.RMRDCUserFeatures.savePublication(publication);
  }
}

(async function init() {
  currentPublication = await fetchPublication();

  if (!currentPublication) {
    setLoading(false);
    return;
  }

  hydrateSidebar(currentPublication);
  if (refs.aiChatContext) {
    refs.aiChatContext.textContent = `Ask questions about “${currentPublication.title || 'this publication'}”. Answers use indexed RMRDC research evidence and show their sources.`;
  }

  // Analytics and optional interactions must never hold the reader open.
  incrementMetric('view', currentPublication).catch(console.warn);
  recordReadingHistory(currentPublication).catch(console.warn);
  loadInteractions().catch(console.warn);

  if (isHtmlPublication(currentPublication)) {
    setLoading(false);
    renderHtmlEbook(currentPublication);
    return;
  }

  const readablePdfUrl = getReadablePdfUrl(currentPublication);

  if (!readablePdfUrl) {
    setLoading(false);
    showMessage('No PDF file URL is available for this publication.');
    return;
  }

  try {
    await renderFlipbook(readablePdfUrl, true);
    const paymentReference = params.get('reference');
    if (paymentReference) await verifyPaystackReturn(paymentReference);
  } catch (err) {
    console.error('RMRDC viewer error:', err);
    setLoading(false);
    showMessage(
      'Flipbook could not load this PDF. Use “View Full” for direct viewing and check browser console for the exact error.'
    );
  }
})();
