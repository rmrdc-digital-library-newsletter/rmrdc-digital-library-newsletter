const authForm = document.getElementById('authForm');
const authStatus = document.getElementById('authStatus');
const signOutBtn = document.getElementById('signOutBtn');
const publicationForm = document.getElementById('publicationForm');
const uploadMessage = document.getElementById('uploadMessage');
const bulletinForm = document.getElementById('bulletinForm');
const bulletinMessage = document.getElementById('bulletinMessage');
const adminBulletinList = document.getElementById('adminBulletinList');
const refreshBulletinsBtn = document.getElementById('refreshBulletinsBtn');
const indexAllPublicationsBtn = document.getElementById('indexAllPublicationsBtn');
const publicationIndexMessage = document.getElementById('publicationIndexMessage');
const autoFillPublicationBtn = document.getElementById('autoFillPublicationBtn');
const autoFillStatus = document.getElementById('autoFillStatus');
const isbnLookupBtn = document.getElementById('isbnLookupBtn');
const isbnLookupStatus = document.getElementById('isbnLookupStatus');
const scanIsbnBtn = document.getElementById('scanIsbnBtn');
const isbnScannerModal = document.getElementById('isbnScannerModal');
const closeScannerBtn = document.getElementById('closeScannerBtn');
const startScannerBtn = document.getElementById('startScannerBtn');
const stopScannerBtn = document.getElementById('stopScannerBtn');
const isbnScannerVideo = document.getElementById('isbnScannerVideo');
const scannerStatus = document.getElementById('scannerStatus');
const isbnInput = document.getElementById('isbn');
const doiInput = document.getElementById('doi');
const adminList = document.getElementById('adminList');
const publicationsTable = document.getElementById('publicationsTable');
const subscribersTable = document.getElementById('subscribersTable');
const subscriberControlMessage = document.getElementById('subscriberControlMessage');
const uploadSection = document.getElementById('upload');
const recordsSection = document.getElementById('publications');
const statsSection = document.getElementById('statsSection');
const registerUploadGrid = document.getElementById('registerUploadGrid');
const registerUserForm = document.getElementById('registerUserForm');
const registerMessage = document.getElementById('registerMessage');
const regResearchAreas = document.getElementById('regResearchAreas');
const regTagPreview = document.getElementById('regTagPreview');
const refreshPublicationsBtn = document.getElementById('refreshPublicationsBtn');
const refreshSubscribersBtn = document.getElementById('refreshSubscribersBtn');
const sidebarUserName = document.getElementById('sidebarUserName');
const sidebarRole = document.getElementById('sidebarRole');
const emailNotificationsSection = document.getElementById('emailNotifications');
const analyticsSection = document.getElementById('analytics');
const settingsSection = document.getElementById('settings');
const activityLogsSection = document.getElementById('activityLogs');
const rawMaterialsSection = document.getElementById('rawMaterials');
const researchIntelligenceSection = document.getElementById('researchIntelligence');
const technologyUploadSection = document.getElementById('technologyUpload');
const adminTechnologyForm = document.getElementById('adminTechnologyForm');
const adminTechnologyMessage = document.getElementById('adminTechnologyMessage');
const notificationsTable = document.getElementById('notificationsTable');
const casCampaignForm = document.getElementById('casCampaignForm');
const casCampaignName = document.getElementById('casCampaignName');
const casCampaignSubject = document.getElementById('casCampaignSubject');
const casCampaignBody = document.getElementById('casCampaignBody');
const casCampaignAudience = document.getElementById('casCampaignAudience');
const casCampaignAreas = document.getElementById('casCampaignAreas');
const casCampaignRecipients = document.getElementById('casCampaignRecipients');
const casSubscriberAreaFilter = document.getElementById('casSubscriberAreaFilter');
const casCampaignAudienceSummary = document.getElementById('casCampaignAudienceSummary');
const casCampaignMessage = document.getElementById('casCampaignMessage');
const casCampaignHistory = document.getElementById('casCampaignHistory');
const casCampaignDetailPanel = document.getElementById('casCampaignDetailPanel');
const casCampaignDetailTitle = document.getElementById('casCampaignDetailTitle');
const casCampaignRecipientLog = document.getElementById('casCampaignRecipientLog');
const casRetryFailedBtn = document.getElementById('casRetryFailedBtn');
const casCampaignSendAt = document.getElementById('casCampaignSendAt');
const casCampaignSubmitBtn = document.getElementById('casCampaignSubmitBtn');
const casSendTestBtn = document.getElementById('casSendTestBtn');
const activityTable = document.getElementById('activityTable');
const refreshNotificationsBtn = document.getElementById('refreshNotificationsBtn');
const refreshAnalyticsBtn = document.getElementById('refreshAnalyticsBtn');
const refreshActivityBtn = document.getElementById('refreshActivityBtn');
const authPanel = document.querySelector('.admin-auth-panel');
const registerPanel = document.getElementById('register');
const subscribersPanel = document.getElementById('subscribers');
let currentAdminSection = 'dashboard';
let adminCanAccess = false;
let liveMetricsChannel = null;
let showAllSubscribers = false;
let campaignSubscribers = [];
const selectedCampaignRecipientIdSet = new Set();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function normalizeAreas(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean))];
}

function areaTags(areas = []) {
  const list = Array.isArray(areas) ? areas : normalizeAreas(areas);
  if (!list.length) return '<span class="muted">None</span>';
  return list.map(area => `<span class="area-chip">${escapeHtml(area)}</span>`).join(' ');
}

function setNotice(target, message, isError = false) {
  if (!target) return;
  target.textContent = message;
  target.classList.remove('hidden');
  target.style.background = isError ? '#fff1f1' : '#edf7f1';
  target.style.color = isError ? '#9b1c1c' : '#0d4d2e';
}

function buildCitation({ authors, year, title, type, doi }) {
  const cleanDoi = String(doi || '').replace(/^https?:\/\/doi\.org\//, '').trim();
  return `${authors || 'RMRDC'} (${year || 'n.d.'}). ${title || 'Untitled publication'}. RMRDC ${type || 'Publication'}${cleanDoi ? `. https://doi.org/${cleanDoi}` : '.'}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-NG').format(Number(value || 0));
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return 'Free';
  const amount = Number(value);
  if (Number.isNaN(amount) || amount <= 0) return 'Free';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(amount);
}

async function getProfileRole(userId) {
  const { data, error } = await window.db
    .from('profiles')
    .select('role, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Profile lookup failed:', error);
    return null;
  }
  return data;
}

function setAdminBlockVisible(el, visible) {
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.toggle('admin-section-hidden', !visible);
}

function setActiveSidebar(sectionName) {
  document.querySelectorAll('.admin-menu-v2 a[data-admin-section]').forEach(link => {
    link.classList.toggle('active', link.dataset.adminSection === sectionName);
  });
}

function showAdminSection(sectionName = 'dashboard') {
  currentAdminSection = sectionName;
  setActiveSidebar(sectionName);

  if (!adminCanAccess) {
    setAdminBlockVisible(authPanel, true);
    [statsSection, registerUploadGrid, uploadSection, researchIntelligenceSection, technologyUploadSection, recordsSection, emailNotificationsSection, analyticsSection, settingsSection, activityLogsSection, rawMaterialsSection].forEach(el => setAdminBlockVisible(el, false));
    return;
  }

  setAdminBlockVisible(authPanel, false);
  setAdminBlockVisible(statsSection, sectionName === 'dashboard');
  setAdminBlockVisible(registerUploadGrid, sectionName === 'register' || sectionName === 'subscribers');
  setAdminBlockVisible(uploadSection, sectionName === 'upload');
  setAdminBlockVisible(recordsSection, sectionName === 'publications');
  setAdminBlockVisible(emailNotificationsSection, sectionName === 'emailNotifications');
  setAdminBlockVisible(analyticsSection, sectionName === 'analytics');
  setAdminBlockVisible(settingsSection, sectionName === 'settings');
  setAdminBlockVisible(activityLogsSection, sectionName === 'activityLogs');
  setAdminBlockVisible(rawMaterialsSection, sectionName === 'rawMaterials');
  setAdminBlockVisible(researchIntelligenceSection, sectionName === 'researchIntelligence');
  setAdminBlockVisible(technologyUploadSection, sectionName === 'technologyUpload');

  if (registerPanel && subscribersPanel) {
    registerPanel.classList.toggle('admin-section-hidden', sectionName !== 'register');
    subscribersPanel.classList.toggle('admin-section-hidden', sectionName !== 'subscribers');
  }
}

function toggleAuthorizedUI(canUpload) {
  adminCanAccess = Boolean(canUpload);
  publicationForm?.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = !canUpload; });
  registerUserForm?.querySelectorAll('input, button, select, textarea').forEach(el => { el.disabled = !canUpload; });
  showAdminSection(canUpload ? currentAdminSection : 'dashboard');
}

async function refreshAuthUI() {
  if (!window.db) {
    authStatus.textContent = 'The admin service is temporarily unavailable. Please try again later.';
    toggleAuthorizedUI(false);
    return;
  }

  const { data: { session } } = await window.db.auth.getSession();
  if (!session?.user) {
    authStatus.textContent = 'Not signed in.';
    authForm.classList.remove('hidden');
    toggleAuthorizedUI(false);
    return;
  }

  const profile = await getProfileRole(session.user.id);
  const role = profile?.role || 'viewer';
  const canUpload = ['admin', 'editor'].includes(role);

  authStatus.textContent = `Signed in as ${session.user.email} • Role: ${role}`;
  sidebarUserName.textContent = profile?.full_name || session.user.email || 'Welcome, Admin';
  sidebarRole.textContent = role === 'admin' ? 'Administrator' : role;
  authForm.classList.toggle('hidden', canUpload);
  currentAdminSection = currentAdminSection || 'dashboard';
  toggleAuthorizedUI(canUpload);

  if (!canUpload) {
    setNotice(uploadMessage, 'Your account is signed in, but it does not have editor or admin upload permission.', true);
  } else {
    uploadMessage.classList.add('hidden');
  }
}

async function signIn(email, password) {
  const { error } = await window.db.auth.signInWithPassword({ email, password });
  if (error) {
    authStatus.textContent = 'Sign-in failed. Check your email and password and try again.';
    return;
  }
  authForm.reset();
  await refreshAuthUI();
  await loadDashboardData();
  setupLiveMetrics();
}

async function uploadFile(bucket, file, folder, options = {}) {
  const fileName = options.keepName
    ? file.name.replace(/\\/g, '/').split('/').pop()
    : `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;

  const cleanName = String(fileName).replace(/\s+/g, '-');
  const path = `${folder}/${cleanName}`.replace(/\/+/g, '/');

  const { error } = await window.db.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: Boolean(options.upsert),
    contentType: file.type || 'application/octet-stream'
  });
  if (error) throw error;

  if (options.private) {
    return { path, publicUrl: null };
  }

  const { data } = window.db.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

async function makePreviewPdfFile(pdfFile, maxPages = 4) {
  if (!window.PDFLib?.PDFDocument) {
    throw new Error('PDF preview library failed to load. Check your internet connection and try again.');
  }

  const sourceBytes = await pdfFile.arrayBuffer();
  const sourcePdf = await PDFLib.PDFDocument.load(sourceBytes);
  const previewPdf = await PDFLib.PDFDocument.create();
  const total = sourcePdf.getPageCount();
  const count = Math.min(maxPages, total);
  const copiedPages = await previewPdf.copyPages(sourcePdf, Array.from({ length: count }, (_, i) => i));
  copiedPages.forEach(page => previewPdf.addPage(page));
  const previewBytes = await previewPdf.save();
  const previewName = pdfFile.name.replace(/\.pdf$/i, '') + '-preview.pdf';
  return new File([previewBytes], previewName, { type: 'application/pdf' });
}

async function createPublication(formData) {
  const { data, error } = await window.db.from('publications').insert(formData).select().single();
  if (error) throw error;
  return data;
}

async function notifyMatchingUsers(publication) {
  try {
    const { data, error } = await window.db.functions.invoke('send-publication-email', { body: { publication } });
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('Notification skipped/failed:', error);
    return { email_sent: 0, whatsapp_sent: 0, matched: 0, warning: 'Notification request failed. Please try again later.' };
  }
}

async function registerResearchUser(payload) {
  const password = payload.password || 'rmrdc123';

  try {
    const { data, error } = await window.db.functions.invoke('create-research-user', { body: { ...payload, password } });
    if (error) throw error;
    return data;
  } catch (functionError) {
    console.warn('Edge Function registration failed; falling back to subscriber-only registration:', functionError);
    const { data, error } = await window.db
      .from('research_subscribers')
      .upsert({
        full_name: payload.full_name,
        email: payload.email,
        organisation: payload.organisation,
        research_areas: payload.research_areas,
        phone: payload.phone,
        email_notifications: payload.email_notifications,
        whatsapp_alerts: payload.whatsapp_alerts,
        is_active: true
      }, { onConflict: 'email' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function countRows(table) {
  const { count, error } = await window.db.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function loadStats() {
  try {
    const metrics = await window.RMRDCLiveMetrics.read();
    const setters = {
      statPublications: metrics.publications,
      statUsers: metrics.users,
      statSubscribers: metrics.subscribers,
      statViews: metrics.views,
      statDownloads: metrics.downloads,
      statMostRead: metrics.mostRead
    };

    Object.entries(setters).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = formatNumber(value);
    });
    const mostReadTitle = document.getElementById('statMostReadTitle');
    if (mostReadTitle) mostReadTitle.textContent = metrics.mostReadTitle || 'No views recorded yet';
  } catch (error) {
    console.error('Could not load admin metrics:', error);
    ['statPublications', 'statUsers', 'statSubscribers', 'statViews', 'statDownloads', 'statMostRead'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.textContent = '—';
    });
    const mostReadTitle = document.getElementById('statMostReadTitle');
    if (mostReadTitle) mostReadTitle.textContent = 'Metrics temporarily unavailable';
  }
}

async function loadRecentSubscribers() {
  if (!window.db || !subscribersTable) return;
  try {
    const { data, error } = await window.db
      .from('research_subscribers')
      .select('id, full_name, email, phone, organisation, research_areas, email_notifications, admin_email_enabled, whatsapp_alerts, created_at')
      .order('created_at', { ascending: false })
      .limit(showAllSubscribers ? 500 : 8);
    if (error) throw error;

    if (!data?.length) {
      subscribersTable.innerHTML = '<tr><td colspan="6">No subscribers yet.</td></tr>';
      return;
    }

    subscribersTable.innerHTML = data.map(sub => `
      <tr>
        <td>${escapeHtml(sub.full_name || '—')}</td>
        <td>${escapeHtml(sub.email || '—')}</td>
        <td>${escapeHtml(sub.organisation || '—')}</td>
        <td>${areaTags(sub.research_areas || [])}</td>
        <td>
          <label class="check-row-v2" title="Admin delivery control. Subscriber opt-in and matching interests are still required.">
            <input type="checkbox" data-email-access-id="${escapeHtml(sub.id)}" ${sub.admin_email_enabled !== false ? 'checked' : ''}>
            Allow publication emails
          </label>
          <small class="muted">${sub.email_notifications !== false ? 'Subscriber opted in' : 'Subscriber opted out'}</small>
        </td>
        <td>${escapeHtml(formatDate(sub.created_at))}</td>
      </tr>
    `).join('');
    const viewAllButton = document.getElementById('refreshSubscribersBtn');
    if (viewAllButton) viewAllButton.textContent = showAllSubscribers ? 'Show recent' : 'View all subscribers';
  } catch (error) {
    console.error(error);
    subscribersTable.innerHTML = '<tr><td colspan="6">Could not load subscribers. Please try again later.</td></tr>';
  }
}

async function loadRecentPublications() {
  if (!window.db) return;
  const { data, error } = await window.db
    .from('publications_with_stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    if (publicationsTable) publicationsTable.innerHTML = '<tr><td colspan="12">Could not load records.</td></tr>';
    if (adminList) adminList.innerHTML = '<p>Could not load records.</p>';
    return;
  }

  if (!data?.length) {
    if (publicationsTable) publicationsTable.innerHTML = '<tr><td colspan="12">No publications yet.</td></tr>';
    if (adminList) adminList.innerHTML = '<p>No publications yet.</p>';
    return;
  }

  const { data: indexRows, error: indexError } = await window.db
    .from('publication_indexing_status')
    .select('publication_id,status,indexed_chunks,started_at')
    .in('publication_id', data.map(pub => pub.id));
  const indexStatus = new Map((indexRows || []).map(row => [row.publication_id, row]));

  if (publicationsTable) {
    publicationsTable.innerHTML = data.map(pub => {
      const status = indexStatus.get(pub.id);
      const isStale = status?.status === 'processing' && status.started_at && Date.now() - new Date(status.started_at).getTime() > 15 * 60 * 1000;
      const state = indexError ? 'unknown' : isStale ? 'failed' : status?.status || 'pending';
      const chunks = Number(status?.indexed_chunks || 0);
      const label = indexError ? 'Unknown' : `${state}${chunks ? ` (${chunks})` : ''}`;
      const retryLabel = state === 'indexed' ? 'Re-index publication' : 'Index or retry publication';
      return `
      <tr data-index-state="${state}">
        <td><div class="pub-cell"><img src="${pub.cover_url || '../assets/placeholder-cover.svg'}" alt="${pub.title} cover"><strong>${pub.title}</strong></div></td>
        <td>${pub.authors || '—'}</td>
        <td>${pub.type || 'Publication'}</td>
        <td>${pub.year || '—'}</td>
        <td>${pub.isbn || '—'}</td>
        <td>${pub.doi || '—'}</td>
        <td>${areaTags(pub.research_areas || [])}</td>
        <td>${formatPrice(pub.price)}</td>
        <td>${formatNumber(pub.view_count)}</td>
        <td>${formatNumber(pub.download_count)}</td>
        <td>${label}</td>
        <td>
          <a class="icon-action" href="../viewer.html?id=${pub.id}" title="Open">↗</a>
          <a class="icon-action" href="edit-publication.html?id=${pub.id}" title="Edit">✎</a>
          <button class="icon-action" type="button" data-index-publication="${pub.id}" title="${retryLabel}" ${state === 'processing' ? 'disabled' : ''}>↻</button>
        </td>
      </tr>
    `;
    }).join('');
  }

  if (adminList) {
    adminList.innerHTML = '';
    data.forEach(pub => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <img src="${pub.cover_url || '../assets/placeholder-cover.svg'}" alt="${pub.title} cover">
        <div>
          <strong>${pub.title}</strong>
          <p class="muted">${pub.type || 'Publication'} • ${pub.year || 'N/A'} • ${pub.authors || 'No authors'}</p>
          <p class="muted">${formatPrice(pub.price)}</p>
        </div>
        <a class="btn btn-secondary" href="../viewer.html?id=${pub.id}">Open</a>
        <a class="btn btn-primary" href="edit-publication.html?id=${pub.id}">Edit</a>
      `;
      adminList.appendChild(row);
    });
  }
}

async function indexOnePublication(publicationId) {
  const { data, error } = await window.db.functions.invoke('index-publication', {
    body: { publication_id: publicationId }
  });
  if (error) throw new Error(error.message || 'Index request failed.');
  if (data?.status !== 'indexed') throw new Error(data?.error || 'Indexing did not complete.');
  return data;
}

publicationsTable?.addEventListener('click', async event => {
  const button = event.target.closest('[data-index-publication]');
  if (!button || button.disabled) return;
  button.disabled = true;
  setNotice(publicationIndexMessage, 'Indexing publication text and Research Intelligence...');
  try {
    const result = await indexOnePublication(button.dataset.indexPublication);
    setNotice(publicationIndexMessage, `Indexed ${result.chunks} evidence chunks.`);
  } catch (error) {
    setNotice(publicationIndexMessage, 'Publication indexing failed. Please try again later.', true);
  } finally {
    await loadRecentPublications();
  }
});

indexAllPublicationsBtn?.addEventListener('click', async () => {
  if (!adminCanAccess || indexAllPublicationsBtn.disabled) return;
  indexAllPublicationsBtn.disabled = true;
  try {
    const { data: publications, error: publicationError } = await window.db
      .from('publications').select('id').order('created_at', { ascending: true });
    if (publicationError) throw publicationError;
    const { data: statuses, error: statusError } = await window.db
      .from('publication_indexing_status').select('publication_id,status');
    if (statusError) throw statusError;
    const byPublication = new Map((statuses || []).map(row => [row.publication_id, row.status]));
    const pending = (publications || []).filter(pub => !['indexed', 'processing'].includes(byPublication.get(pub.id)));
    let completed = 0;
    let failed = 0;

    for (let index = 0; index < pending.length; index += 1) {
      setNotice(publicationIndexMessage, `Indexing publication ${index + 1} of ${pending.length}...`);
      try {
        await indexOnePublication(pending[index].id);
        completed += 1;
      } catch (error) {
        failed += 1;
        console.error(`Publication index failed (${pending[index].id}):`, error);
      }
    }
    setNotice(publicationIndexMessage, `Indexing complete: ${completed} indexed, ${failed} failed, ${publications?.length || 0} total.`);
  } catch (error) {
    setNotice(publicationIndexMessage, 'Could not start publication indexing. Please try again later.', true);
  } finally {
    indexAllPublicationsBtn.disabled = false;
    await loadRecentPublications();
  }
});

async function loadEmailNotifications() {
  if (!window.db || !notificationsTable) return;
  try {
    const { data, error } = await window.db
      .from('publication_notifications')
      .select('email, status, error_message, sent_at, created_at, publications(title)')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    if (!data?.length) {
      notificationsTable.innerHTML = '<tr><td colspan="5">No notification records yet.</td></tr>';
      return;
    }
    notificationsTable.innerHTML = data.map(row => `
      <tr>
        <td>${row.email || '—'}</td>
        <td>${row.publications?.title || '—'}</td>
        <td><span class="area-chip">${row.status || 'pending'}</span></td>
        <td>${formatDate(row.sent_at || row.created_at)}</td>
        <td>${row.error_message ? 'Delivery failed. Check notification settings or contact support.' : '—'}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error(error);
    notificationsTable.innerHTML = '<tr><td colspan="5">Could not load notifications. Please try again later.</td></tr>';
  }
}

function campaignSubscriberEligible(sub) {
  return sub?.is_active !== false && sub?.email_notifications !== false &&
    sub?.admin_email_enabled !== false && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(sub?.email || '').trim());
}

function selectedCampaignAreas() {
  return [...(casCampaignAreas?.querySelectorAll('[data-campaign-area]:checked') || [])].map(input => input.value);
}

function selectedCampaignRecipientIds() {
  return [...selectedCampaignRecipientIdSet];
}

function renderCampaignAreas() {
  if (!casCampaignAreas) return;
  const allAreas = [...new Set(campaignSubscribers.filter(campaignSubscriberEligible).flatMap(sub => normalizeAreas(sub.research_areas)))].sort();
  casCampaignAreas.innerHTML = allAreas.length
    ? allAreas.map((area, index) => `<label class="check-row-v2"><input type="checkbox" data-campaign-area value="${escapeHtml(area)}" id="casCampaignArea${index}">${escapeHtml(area)}</label>`).join('')
    : '<span class="muted">No research areas are available yet.</span>';
  if (casSubscriberAreaFilter) {
    const selectedArea = casSubscriberAreaFilter.value;
    casSubscriberAreaFilter.innerHTML = '<option value="">All research areas</option>' +
      allAreas.map(area => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('');
    casSubscriberAreaFilter.value = allAreas.includes(selectedArea) ? selectedArea : '';
  }
}

function renderCampaignRecipients() {
  if (!casCampaignRecipients) return;
  const selected = selectedCampaignRecipientIdSet;
  const query = document.getElementById('casSubscriberSearch')?.value.trim().toLowerCase() || '';
  const selectedArea = casSubscriberAreaFilter?.value || '';
  const visible = campaignSubscribers.filter(sub => {
    const areas = normalizeAreas(sub.research_areas);
    const text = [sub.full_name, sub.email, ...areas].join(' ').toLowerCase();
    return (!selectedArea || areas.includes(selectedArea)) && (!query || text.includes(query));
  });
  casCampaignRecipients.innerHTML = visible.length
    ? visible.map((sub, index) => {
      const eligible = campaignSubscriberEligible(sub);
      return `<label class="check-row-v2"><input type="checkbox" data-campaign-subscriber value="${escapeHtml(sub.id)}" ${selected.has(String(sub.id)) ? 'checked' : ''} ${eligible ? '' : 'disabled'}><span>${escapeHtml(sub.full_name || 'Subscriber')} · ${escapeHtml(sub.email || 'no email')}<small class="muted">${eligible ? escapeHtml(normalizeAreas(sub.research_areas).join(', ') || 'No research areas') : 'Not eligible: check active status, opt-in, admin permission, and email address'}</small></span></label>`;
    }).join('')
    : '<span class="muted">No subscribers match this search.</span>';
}

function updateCampaignAudienceSummary() {
  if (!casCampaignAudienceSummary) return;
  const eligible = campaignSubscribers.filter(campaignSubscriberEligible);
  let count = eligible.length;
  if (casCampaignAudience?.value === 'areas') {
    const areas = new Set(selectedCampaignAreas());
    count = eligible.filter(sub => normalizeAreas(sub.research_areas).some(area => areas.has(area))).length;
  } else if (casCampaignAudience?.value === 'selected') {
    const ids = new Set(selectedCampaignRecipientIds());
    count = eligible.filter(sub => ids.has(String(sub.id))).length;
  }
  casCampaignAudienceSummary.textContent = `${count} eligible recipient${count === 1 ? '' : 's'} selected. Opt-outs and admin-disabled subscribers are excluded.`;
}

async function loadCampaignAudience() {
  if (!window.db || !casCampaignAudienceSummary) return;
  try {
    campaignSubscribers = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await window.db.from('research_subscribers')
        .select('id, full_name, email, research_areas, is_active, email_notifications, admin_email_enabled')
        .order('full_name', { ascending: true }).range(from, from + 499);
      if (error) throw error;
      campaignSubscribers.push(...(data || []));
      if ((data || []).length < 500) break;
    }
    renderCampaignAreas();
    const eligibleIds = new Set(campaignSubscribers.filter(campaignSubscriberEligible).map(sub => String(sub.id)));
    selectedCampaignRecipientIdSet.forEach(id => {
      if (!eligibleIds.has(id)) selectedCampaignRecipientIdSet.delete(id);
    });
    renderCampaignRecipients();
    updateCampaignAudienceSummary();
  } catch (error) {
    console.error('Could not load campaign audience:', error);
    casCampaignAudienceSummary.textContent = 'Could not load subscribers. Please try again later.';
  }
}

async function loadCasCampaignHistory() {
  if (!window.db || !casCampaignHistory) return;
  try {
    const { data, error } = await window.db.from('cas_email_campaigns')
      .select('id, campaign_name, subject, audience_mode, audience_areas, status, recipient_count, sent_count, delivered_count, opened_count, clicked_count, bounced_count, complained_count, skipped_count, failed_count, scheduled_at')
      .order('created_at', { ascending: false }).limit(15);
    if (error) throw error;
    casCampaignHistory.innerHTML = data?.length ? data.map(campaign => {
      const audience = campaign.audience_mode === 'areas' ? (campaign.audience_areas || []).join(', ') : campaign.audience_mode === 'selected' ? 'Selected subscribers' : 'All eligible subscribers';
      return `<tr><td>${escapeHtml(campaign.campaign_name)}<br><small>${escapeHtml(campaign.subject)}</small></td><td>${escapeHtml(audience)}</td><td><span class="area-chip">${escapeHtml(campaign.status)}</span></td><td>${formatNumber(campaign.recipient_count)}</td><td>${formatNumber(campaign.sent_count)}</td><td>${formatNumber(campaign.delivered_count)}</td><td>${formatNumber(campaign.opened_count)}</td><td>${formatNumber(campaign.clicked_count)}</td><td>${formatNumber(campaign.bounced_count)}</td><td>${formatNumber(campaign.complained_count)}</td><td>${formatNumber(campaign.failed_count)}</td><td>${escapeHtml(formatDate(campaign.scheduled_at))}</td><td><button class="btn btn-secondary" type="button" data-view-cas-campaign="${escapeHtml(campaign.id)}" data-campaign-name="${escapeHtml(campaign.campaign_name)}" data-campaign-status="${escapeHtml(campaign.status)}">View</button></td></tr>`;
    }).join('') : '<tr><td colspan="13">No campaigns yet.</td></tr>';
  } catch (error) {
    console.error('Could not load CAS campaign history:', error);
    casCampaignHistory.innerHTML = '<tr><td colspan="13">Could not load campaigns. Please try again later.</td></tr>';
  }
}

async function loadCasCampaignDetails(campaignId, campaignName = 'Campaign recipients', campaignStatus = '') {
  if (!window.db || !casCampaignRecipientLog || !campaignId) return;
  casCampaignDetailPanel?.classList.remove('hidden');
  if (casCampaignDetailPanel) {
    casCampaignDetailPanel.dataset.campaignId = campaignId;
  }
  if (casCampaignDetailTitle) casCampaignDetailTitle.textContent = campaignName;
  try {
    const { data: campaign, error: campaignError } = await window.db.from('cas_email_campaigns')
      .select('status').eq('id', campaignId).maybeSingle();
    if (campaignError) throw campaignError;
    campaignStatus = campaign?.status || campaignStatus;
    if (casCampaignDetailPanel) casCampaignDetailPanel.dataset.campaignStatus = campaignStatus;
    if (casRetryFailedBtn) {
      casRetryFailedBtn.dataset.retryCampaign = campaignId;
      casRetryFailedBtn.classList.toggle('hidden', !['partial', 'failed'].includes(campaignStatus));
    }
    const { data, error } = await window.db.from('cas_email_campaign_recipients')
      .select('email, status, attempt_count, sent_at, email_delivery_status, delivered_at, open_count, opened_at, click_count, clicked_at, bounced_at, complained_at, last_email_event_at, error_message')
      .eq('campaign_id', campaignId).order('id', { ascending: true }).limit(1000);
    if (error) throw error;
    casCampaignRecipientLog.innerHTML = data?.length ? data.map(row => `<tr><td>${escapeHtml(row.email)}</td><td><span class="area-chip">${escapeHtml(row.email_delivery_status || row.status)}</span></td><td>${escapeHtml(formatDate(row.sent_at))}</td><td>${escapeHtml(formatDate(row.delivered_at))}</td><td>${formatNumber(row.open_count)}${row.opened_at ? `<br><small>${escapeHtml(formatDate(row.opened_at))}</small>` : ''}</td><td>${formatNumber(row.click_count)}${row.clicked_at ? `<br><small>${escapeHtml(formatDate(row.clicked_at))}</small>` : ''}</td><td>${row.bounced_at ? escapeHtml(formatDate(row.bounced_at)) : '—'}</td><td>${row.complained_at ? escapeHtml(formatDate(row.complained_at)) : '—'}</td><td>${formatNumber(row.attempt_count)}</td><td>${row.last_email_event_at ? escapeHtml(formatDate(row.last_email_event_at)) : '—'}</td><td>${row.error_message ? 'Delivery failed. Check notification settings or contact support.' : '—'}</td></tr>`).join('') : '<tr><td colspan="11">No recipients found.</td></tr>';
  } catch (error) {
    console.error('Could not load campaign delivery details:', error);
    casCampaignRecipientLog.innerHTML = '<tr><td colspan="11">Could not load recipient details.</td></tr>';
  }
}

function updateCampaignPreview() {
  const subject = document.getElementById('casPreviewSubject');
  const body = document.getElementById('casPreviewBody');
  if (subject) subject.textContent = casCampaignSubject?.value.trim() || 'Your subject will appear here';
  if (body) body.textContent = casCampaignBody?.value || 'Your message preview will appear here.';
  if (casCampaignSubmitBtn) casCampaignSubmitBtn.textContent = casCampaignSendAt?.value ? 'Schedule campaign' : 'Send campaign now';
}

async function loadActivityLogs() {
  if (!window.db || !activityTable) return;
  try {
    const [views, downloads, uploads] = await Promise.all([
      window.db.from('view_events').select('created_at, user_agent, publications(title)').order('created_at', { ascending: false }).limit(10),
      window.db.from('download_events').select('created_at, user_agent, publications(title)').order('created_at', { ascending: false }).limit(10),
      window.db.from('publications').select('created_at, title').order('created_at', { ascending: false }).limit(10)
    ]);
    if (views.error) throw views.error;
    if (downloads.error) throw downloads.error;
    if (uploads.error) throw uploads.error;
    const rows = [
      ...(views.data || []).map(r => ({ ...r, type: 'View' })),
      ...(downloads.data || []).map(r => ({ ...r, type: 'Download' })),
      ...(uploads.data || []).map(r => ({ ...r, type: 'Upload', publications: { title: r.title } }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
    if (!rows.length) {
      activityTable.innerHTML = '<tr><td colspan="4">No activity yet.</td></tr>';
      return;
    }
    activityTable.innerHTML = rows.map(row => `
      <tr>
        <td>${row.type}</td>
        <td>${row.publications?.title || '—'}</td>
        <td>${formatDate(row.created_at)}</td>
        <td>${row.user_agent || '—'}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error(error);
    activityTable.innerHTML = '<tr><td colspan="4">Could not load activity logs.</td></tr>';
  }
}

function mirrorAnalyticsCards() {
  const pairs = { analyticsPublications: 'statPublications', analyticsUsers: 'statUsers', analyticsSubscribers: 'statSubscribers', analyticsViews: 'statViews', analyticsDownloads: 'statDownloads', analyticsMostRead: 'statMostRead' };
  Object.entries(pairs).forEach(([targetId, sourceId]) => {
    const target = document.getElementById(targetId);
    const source = document.getElementById(sourceId);
    if (target && source) target.textContent = source.textContent || '0';
  });
}

function setupSidebarNavigation() {
  document.querySelectorAll('.admin-menu-v2 a[data-admin-section]').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const sectionName = link.dataset.adminSection || 'dashboard';
      if (!adminCanAccess) {
        setNotice(authStatus, 'Please sign in as an admin or editor first.', true);
        const initialSectionFromHash = (window.location.hash || '').replace('#', '') || 'dashboard';
  currentAdminSection = initialSectionFromHash;
  showAdminSection(initialSectionFromHash);
        return;
      }
      showAdminSection(sectionName);
      window.location.hash = sectionName;
      if (sectionName === 'analytics') mirrorAnalyticsCards();
    });
  });
}

async function loadDashboardData() {
  await Promise.allSettled([loadStats(), loadRecentSubscribers(), loadRecentPublications(), loadEmailNotifications(), loadActivityLogs(), loadCampaignAudience(), loadCasCampaignHistory()]);
  mirrorAnalyticsCards();
}

function setupLiveMetrics() {
  liveMetricsChannel?.unsubscribe();
  liveMetricsChannel = window.RMRDCLiveMetrics?.subscribe(async () => {
    await loadStats();
    mirrorAnalyticsCards();
    await loadActivityLogs();
  });
}

authForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!window.db) return;
  await signIn(document.getElementById('email').value, document.getElementById('password').value);
});

signOutBtn?.addEventListener('click', async () => {
  if (window.db) await window.db.auth.signOut();
  adminCanAccess = false;
  currentAdminSection = 'dashboard';
  authForm?.classList.remove('hidden');
  await refreshAuthUI();
});

regResearchAreas?.addEventListener('input', () => {
  const areas = normalizeAreas(regResearchAreas.value);
  regTagPreview.innerHTML = areaTags(areas);
});

registerUserForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setNotice(registerMessage, 'Registering user...');
  try {
    const payload = {
      full_name: document.getElementById('regName').value.trim(),
      email: document.getElementById('regEmail').value.trim().toLowerCase(),
      organisation: document.getElementById('regOrganisation').value.trim(),
      password: document.getElementById('regPassword').value.trim(),
      research_areas: normalizeAreas(document.getElementById('regResearchAreas').value),
      phone: document.getElementById('regPhone')?.value.trim() || null,
      email_notifications: document.getElementById('regEmailNotifications')?.checked ?? true,
      whatsapp_alerts: document.getElementById('regWhatsappAlerts')?.checked ?? true
    };

    if (!payload.full_name || !payload.email || !payload.research_areas.length) {
      throw new Error('Name, email and at least one research area are required.');
    }

    await registerResearchUser(payload);
    registerUserForm.reset();
    regTagPreview.innerHTML = '';
    setNotice(registerMessage, 'User/subscriber registered successfully.');
    await loadDashboardData();
  } catch (error) {
    console.error(error);
    setNotice(registerMessage, 'Registration failed. Check the details and try again later.', true);
  }
});


function getPublicationMode() {
  return document.querySelector('input[name="publicationMode"]:checked')?.value || 'pdf';
}

let publicationModeToggleInitialized = false;

function setupPublicationModeToggle() {
  const pdfFields = document.getElementById('pdfUploadFields');
  const htmlFields = document.getElementById('htmlUploadFields');
  const libraryFields = document.getElementById('libraryPageFields');
  const pdfInput = document.getElementById('pdf');
  const coverInput = document.getElementById('cover');
  const abstractInput = document.getElementById('abstract');
  const libraryPageUrlInput = document.getElementById('libraryPageUrl');

  function update() {
    const mode = getPublicationMode();
    pdfFields?.classList.toggle('hidden', mode !== 'pdf');
    htmlFields?.classList.toggle('hidden', mode !== 'html');
    libraryFields?.classList.toggle('hidden', mode !== 'library');
    if (pdfInput) pdfInput.required = mode === 'pdf';
    if (coverInput) coverInput.required = mode !== 'library';
    if (abstractInput) abstractInput.required = mode !== 'library';
    if (libraryPageUrlInput) libraryPageUrlInput.required = mode === 'library';
  }

  if (!publicationModeToggleInitialized) {
    document.querySelectorAll('input[name="publicationMode"]').forEach(input => {
      input.addEventListener('change', update);
    });
    publicationModeToggleInitialized = true;
  }
  update();
}

setupPublicationModeToggle();

function cleanRelativePath(path = '') {
  return String(path).replace(/^\/+/, '').replace(/\\/g, '/');
}

async function uploadHtmlEbookFolder(files, title) {
  if (!files || !files.length) {
    throw new Error('Please select the HTML eBook folder or paste an existing HTML URL.');
  }

  const safeTitle = createSlug(title || 'ebook');
  const folderId = `${safeTitle}-${Date.now()}`;
  const uploaded = [];

  try {
    for (const file of Array.from(files)) {
      const relative = cleanRelativePath(file.webkitRelativePath || file.name);
      const folderPath = `ebooks/${folderId}/${relative}`.replace(/\/[^/]+$/, '');
      const upload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, file, folderPath, { keepName: true, upsert: true });
      uploaded.push({ file: relative, url: upload.publicUrl, path: upload.path });
    }
  } catch (error) {
    await Promise.allSettled(uploaded.map(item => window.db.storage.from(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS).remove([item.path])));
    throw error;
  }

  return { folderId, uploaded };
}

function findEntryUrl(uploadResult, entryFile) {
  const entry = cleanRelativePath(entryFile || 'index.html').toLowerCase();
  const match = uploadResult.uploaded.find(item => cleanRelativePath(item.file).toLowerCase().endsWith(entry));
  if (!match) {
    throw new Error(`Entry file "${entryFile}" was not found in the uploaded folder. Check the entry file name.`);
  }
  return match.publicUrl || match.url;
}






function setIsbnLookupNotice(text, isError = false) {
  if (!isbnLookupStatus) return;
  isbnLookupStatus.textContent = text;
  isbnLookupStatus.classList.remove('hidden');
  isbnLookupStatus.style.background = isError ? '#fff1f1' : '#edf7f1';
  isbnLookupStatus.style.color = isError ? '#9b1c1c' : '#0d4d2e';
}

function normalizeIsbnInput(isbn = '') {
  return String(isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
}

function setLookupField(id, value, overwrite = false) {
  const el = document.getElementById(id);
  if (!el || value === undefined || value === null || String(value).trim() === '') return;
  if (overwrite || !String(el.value || '').trim()) el.value = String(value).trim();
}

function extractLookupYear(dateText = '') {
  const match = String(dateText).match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return match ? match[1] : '';
}

function uniqueList(items = []) {
  return [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

function mapLookupSubjects(subjects = []) {
  const raw = subjects.join(' ').toLowerCase();
  const output = [];
  const map = [
    ['food', 'food science'],
    ['beverage', 'beverages'],
    ['tobacco', 'tobacco sector'],
    ['agriculture', 'agro raw materials'],
    ['agro', 'agro raw materials'],
    ['cassava', 'cassava'],
    ['palm oil', 'palm oil'],
    ['mineral', 'mineral raw materials'],
    ['industry', 'industrial development'],
    ['manufacturing', 'manufacturing'],
    ['technology', 'technology'],
    ['policy', 'policy brief'],
    ['raw material', 'raw materials'],
    ['survey', 'industrial survey'],
    ['technical', 'technical report']
  ];
  map.forEach(([key, label]) => {
    if (raw.includes(key) && !output.includes(label)) output.push(label);
  });
  return output.slice(0, 8).join(', ');
}

function scoreMetadata(record) {
  if (!record) return 0;
  let score = 0;
  if (record.title) score += 5;
  if (record.authors) score += 4;
  if (record.year) score += 2;
  if (record.publisher) score += 2;
  if (record.description && record.description.length > 40) score += 4;
  if (record.subjects?.length) score += 2;
  if (record.cover_url) score += 2;
  if (record.doi) score += 2;
  return score;
}

async function fetchOpenLibraryByIsbn(isbn) {
  const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  if (!response.ok) return null;
  const data = await response.json();

  let authors = [];
  if (Array.isArray(data.authors)) {
    authors = await Promise.all(data.authors.slice(0, 5).map(async (author) => {
      try {
        const res = await fetch(`https://openlibrary.org${author.key}.json`);
        if (!res.ok) return '';
        const a = await res.json();
        return a.name || '';
      } catch {
        return '';
      }
    }));
  }

  return {
    source: 'Open Library',
    title: data.title || '',
    authors: authors.filter(Boolean).join(' | '),
    publisher: Array.isArray(data.publishers) ? data.publishers.join(', ') : '',
    year: extractLookupYear(data.publish_date || ''),
    description: typeof data.description === 'string' ? data.description : (data.description?.value || ''),
    subjects: data.subjects || [],
    cover_url: data.covers?.length ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg` : `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  };
}

async function fetchGoogleBooksByIsbn(isbn) {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
  if (!response.ok) return null;
  const data = await response.json();
  const item = data.items?.[0];
  if (!item) return null;

  const info = item.volumeInfo || {};
  return {
    source: 'Google Books',
    title: [info.title, info.subtitle].filter(Boolean).join(': '),
    authors: Array.isArray(info.authors) ? info.authors.join(' | ') : '',
    publisher: info.publisher || '',
    year: extractLookupYear(info.publishedDate || ''),
    description: info.description || '',
    subjects: info.categories || [],
    cover_url: info.imageLinks?.thumbnail ? info.imageLinks.thumbnail.replace('http:', 'https:').replace('&edge=curl', '') : ''
  };
}

async function fetchCrossRefByIsbn(isbn) {
  // CrossRef works best for scholarly books/chapters and may return DOI metadata.
  const response = await fetch(`https://api.crossref.org/works?filter=isbn:${encodeURIComponent(isbn)}&rows=5`);
  if (!response.ok) return null;
  const data = await response.json();
  const item = data.message?.items?.[0];
  if (!item) return null;

  const title = Array.isArray(item.title) ? item.title[0] : '';
  const authors = Array.isArray(item.author)
    ? item.author.map(a => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean).join(' | ')
    : '';
  const year = item.published?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || '';
  const description = Array.isArray(item.abstract) ? item.abstract.join(' ') : (item.abstract || '');

  return {
    source: 'CrossRef',
    title,
    authors,
    publisher: item.publisher || '',
    year,
    description: String(description).replace(/<[^>]*>/g, ''),
    subjects: item.subject || [],
    doi: item.DOI || '',
    cover_url: ''
  };
}

async function fetchLibraryOfCongressByIsbn(isbn) {
  // Library of Congress SRU endpoint. Browser CORS may vary; failures are ignored.
  const url = `https://www.loc.gov/books/?fo=json&c=5&fa=number_isbn:${encodeURIComponent(isbn)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const item = data.results?.[0];
  if (!item) return null;

  return {
    source: 'Library of Congress',
    title: item.title || '',
    authors: Array.isArray(item.contributor) ? item.contributor.join(' | ') : (item.contributor || ''),
    publisher: Array.isArray(item.publisher) ? item.publisher.join(', ') : (item.publisher || ''),
    year: extractLookupYear(item.date || ''),
    description: Array.isArray(item.description) ? item.description.join(' ') : (item.description || ''),
    subjects: item.subject || [],
    cover_url: item.image_url?.[0] || ''
  };
}

function mergeMultiSourceMetadata(records, isbn) {
  const valid = records.filter(Boolean).sort((a, b) => scoreMetadata(b) - scoreMetadata(a));
  const best = valid[0] || {};
  const allSubjects = uniqueList(valid.flatMap(record => record.subjects || []));
  const longestDescription = valid
    .map(record => record.description || '')
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || '';

  return {
    isbn,
    source: valid.map(record => record.source).join(' + '),
    title: best.title || valid.find(r => r.title)?.title || '',
    authors: best.authors || valid.find(r => r.authors)?.authors || '',
    publisher: best.publisher || valid.find(r => r.publisher)?.publisher || '',
    year: best.year || valid.find(r => r.year)?.year || '',
    description: longestDescription,
    subjects: allSubjects,
    research_areas: mapLookupSubjects(allSubjects),
    cover_url: valid.find(r => r.cover_url)?.cover_url || '',
    doi: valid.find(r => r.doi)?.doi || ''
  };
}

function applyIsbnMetadata(metadata, isbn) {
  setLookupField('title', metadata.title, true);
  setLookupField('authors', metadata.authors);
  setLookupField('year', metadata.year);
  setLookupField('isbn', isbn, true);
  setLookupField('doi', metadata.doi);
  setLookupField('abstract', metadata.description);
  setLookupField('researchAreas', metadata.research_areas);

  const type = document.getElementById('type');
  if (type && !type.value) type.value = 'Book';

  let coverUrlInput = document.getElementById('coverUrlFromIsbn');
  if (!coverUrlInput) {
    coverUrlInput = document.createElement('input');
    coverUrlInput.type = 'hidden';
    coverUrlInput.id = 'coverUrlFromIsbn';
    document.getElementById('publicationForm')?.appendChild(coverUrlInput);
  }
  coverUrlInput.value = metadata.cover_url || '';

  const sourceText = metadata.source || 'available sources';
  if (metadata.cover_url) {
    setIsbnLookupNotice(`Metadata found from ${sourceText}. Online cover found, but upload the official RMRDC cover image for best quality.`);
  } else {
    setIsbnLookupNotice(`Metadata found from ${sourceText}. No online cover found; upload cover manually.`);
  }
}

async function lookupIsbnMetadata() {
  try {
    const isbn = normalizeIsbnInput(document.getElementById('isbn')?.value || '');
    if (!isbn || ![10, 13].includes(isbn.length)) {
      throw new Error('Enter a valid ISBN-10 or ISBN-13 first.');
    }

    setIsbnLookupNotice('Searching Open Library, Google Books, CrossRef and Library of Congress...');

    const lookups = await Promise.allSettled([
      fetchOpenLibraryByIsbn(isbn),
      fetchGoogleBooksByIsbn(isbn),
      fetchCrossRefByIsbn(isbn),
      fetchLibraryOfCongressByIsbn(isbn)
    ]);

    const records = lookups
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value);

    if (!records.length) {
      throw new Error('No metadata found for this ISBN. Use Auto Fill Details from PDF/HTML or fill manually.');
    }

    const metadata = mergeMultiSourceMetadata(records, isbn);
    applyIsbnMetadata(metadata, isbn);
  } catch (error) {
    console.error(error);
    setIsbnLookupNotice(error.message || 'Metadata lookup failed.', true);
  }
}

isbnLookupBtn?.addEventListener('click', lookupIsbnMetadata);

document.getElementById('isbn')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault();
    lookupIsbnMetadata();
  }
});


let isbnCodeReader = null;
let isbnScannerControls = null;

function setScannerNotice(text, isError = false) {
  if (!scannerStatus) return;
  scannerStatus.textContent = text;
  scannerStatus.classList.remove('hidden');
  scannerStatus.style.background = isError ? '#fff1f1' : '#edf7f1';
  scannerStatus.style.color = isError ? '#9b1c1c' : '#0d4d2e';
}

function openIsbnScanner() {
  isbnScannerModal?.classList.remove('hidden');
  setScannerNotice('Click Start Camera, then point the camera at the ISBN barcode.');
}

async function loadZxingLibrary() {
  if (window.ZXingBrowser) return window.ZXingBrowser;

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-zxing-browser]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@zxing/browser@latest';
    script.dataset.zxingBrowser = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load ZXing barcode scanner library.'));
    document.head.appendChild(script);
  });

  return window.ZXingBrowser;
}

function normalizeScannedIsbn(value = '') {
  const digits = String(value).replace(/[^0-9Xx]/g, '').toUpperCase();
  if (digits.length === 13 && digits.startsWith('978')) return digits;
  if (digits.length === 13 && digits.startsWith('979')) return digits;
  if (digits.length === 10) return digits;
  return digits;
}

async function startIsbnScanner() {
  try {
    setScannerNotice('Starting camera...');
    const ZXing = await loadZxingLibrary();

    if (!isbnCodeReader) {
      isbnCodeReader = new ZXing.BrowserMultiFormatReader();
    }

    const devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
    if (!devices.length) throw new Error('No camera found on this device.');

    const backCamera = devices.find(device => /back|rear|environment/i.test(device.label));
    const selectedDeviceId = (backCamera || devices[0]).deviceId;

    isbnScannerControls = await isbnCodeReader.decodeFromVideoDevice(
      selectedDeviceId,
      isbnScannerVideo,
      (result, error, controls) => {
        if (!result) return;

        const scanned = normalizeScannedIsbn(result.getText());
        if (![10, 13].includes(scanned.length)) {
          setScannerNotice(`Scanned code "${scanned}" is not a valid ISBN-10/ISBN-13. Try again.`, true);
          return;
        }

        const isbnInput = document.getElementById('isbn');
        if (isbnInput) isbnInput.value = scanned;

        setScannerNotice(`ISBN detected: ${scanned}. Fetching metadata...`);
        stopIsbnScanner();
        isbnScannerModal?.classList.add('hidden');

        if (typeof lookupIsbnMetadata === 'function') {
          lookupIsbnMetadata();
        }
      }
    );

    setScannerNotice('Camera active. Hold the barcode inside the guide box.');
  } catch (error) {
    console.error(error);
    setScannerNotice(error.message || 'Unable to start camera scanner.', true);
  }
}

function stopIsbnScanner() {
  try {
    isbnScannerControls?.stop();
    isbnScannerControls = null;
    if (isbnScannerVideo?.srcObject) {
      isbnScannerVideo.srcObject.getTracks().forEach(track => track.stop());
      isbnScannerVideo.srcObject = null;
    }
    setScannerNotice('Camera stopped.');
  } catch (error) {
    console.warn(error);
  }
}

function closeIsbnScanner() {
  stopIsbnScanner();
  isbnScannerModal?.classList.add('hidden');
}

scanIsbnBtn?.addEventListener('click', openIsbnScanner);
startScannerBtn?.addEventListener('click', startIsbnScanner);
stopScannerBtn?.addEventListener('click', stopIsbnScanner);
closeScannerBtn?.addEventListener('click', closeIsbnScanner);

isbnScannerModal?.addEventListener('click', (event) => {
  if (event.target === isbnScannerModal) closeIsbnScanner();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !isbnScannerModal?.classList.contains('hidden')) {
    closeIsbnScanner();
  }
});

function setAutoFillNotice(text, isError = false) {
  if (!autoFillStatus) return;
  autoFillStatus.textContent = text;
  autoFillStatus.classList.remove('hidden');
  autoFillStatus.style.background = isError ? '#fff1f1' : '#edf7f1';
  autoFillStatus.style.color = isError ? '#9b1c1c' : '#0d4d2e';
}

function setAutoField(id, value) {
  const el = document.getElementById(id);
  if (!el || value === undefined || value === null || String(value).trim() === '') return;
  if (!String(el.value || '').trim()) el.value = String(value).trim();
}

function extractIsbn(text) {
  const m = text.match(/ISBN\s*[:\-]?\s*([0-9Xx\-\s]{10,25})/i);
  return m ? m[1].replace(/\s+/g, '').trim() : '';
}

function extractDoi(text) {
  const m = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return m ? m[0].trim() : '';
}

function extractYear(text) {
  const years = Array.from(text.matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)).map(m => Number(m[1]));
  return years.length ? Math.max(...years.filter(y => y <= new Date().getFullYear() + 1)) : '';
}

function titleFromFile(name='') {
  return String(name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

function extractTitle(text, fallback='') {
  const lines = String(text).split(/\n+/).map(v => v.trim()).filter(Boolean).slice(0, 25);
  const good = lines.filter(l => l.length > 8 && l.length < 160 && !/^(publisher|copyright|isbn|edited by|table of contents)$/i.test(l));
  const titleIndex = good.findIndex(l => /report|study|survey|sector|profile|brief|technical|raw materials/i.test(l));
  if (titleIndex < 0) return good[0] || titleFromFile(fallback);

  let title = good[titleIndex];
  for (let index = titleIndex + 1; index < Math.min(good.length, titleIndex + 3); index += 1) {
    const nextLine = good[index];
    const titleIsIncomplete = /\b(and|of|for|on|in|with|the|a|an)$/i.test(title);
    const nextLineIsUppercase = nextLine === nextLine.toUpperCase() && /[A-Z]/.test(nextLine);
    if (/^(publisher|copyright|isbn|edited by|table of contents|dr\.?\s|prof\.?\s)/i.test(nextLine)) break;
    if (!titleIsIncomplete && !nextLineIsUppercase) break;
    title += ` ${nextLine}`;
  }
  return title;
}

function extractAuthors(text) {
  const lines = String(text).split(/\n+/).map(line => line.trim()).filter(Boolean).slice(0, 30);
  const authorIndex = lines.findIndex(line => /\b(?:Dr|Prof|Professor|Mr|Mrs|Ms)\.?\s*[A-Z]/i.test(line) && line.includes(','));
  if (authorIndex >= 0) {
    let authors = lines[authorIndex];
    while (authors.endsWith(',') && lines[authorIndex + 1]) {
      authors += ` ${lines[authorIndex + 1]}`;
      break;
    }
    return authors.replace(/\s+/g, ' ').trim().replace(/,$/, '');
  }

  const edited = text.match(/edited\s+by\s+(.{5,160})/i);
  if (edited) return edited[1].replace(/\s{2,}/g, ' ').trim();
  const by = text.match(/\b[Bb]y\s+([^\r\n]{5,160})/);
  return by ? by[1].replace(/\s{2,}/g, ' ').trim() : '';
}

function inferAreas(text) {
  const hay = text.toLowerCase();
  const pairs = [['food','food science'],['beverage','beverages'],['tobacco','tobacco sector'],['cassava','cassava'],['palm oil','palm oil'],['agro','agro raw materials'],['mineral','mineral raw materials'],['policy','policy brief'],['technical','technical report'],['industrial','industrial development'],['raw material','raw materials']];
  const out = [];
  pairs.forEach(([k,v]) => { if (hay.includes(k) && !out.includes(v)) out.push(v); });
  return out.slice(0,6).join(', ');
}

async function extractPdfTextAuto(file, maxChars = 50000) {
  if (!file) throw new Error('Please select a PDF first.');
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  // Sample the front matter, evenly spaced pages, and the end so long books
  // contribute methods/results/conclusions as well as the opening pages.
  const selected = new Set();
  for (let page = 1; page <= Math.min(8, pdf.numPages); page += 1) selected.add(page);
  for (let slot = 1; slot <= 12; slot += 1) {
    selected.add(Math.max(1, Math.min(pdf.numPages, Math.round(slot * pdf.numPages / 13))));
  }
  for (let page = Math.max(1, pdf.numPages - 7); page <= pdf.numPages; page += 1) selected.add(page);

  let text = '';
  for (const pageNumber of [...selected].sort((a, b) => a - b)) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(item => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`)
      .join('')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (pageText) text += `\n[PAGE ${pageNumber}]\n${pageText}\n`;
    if (text.length >= maxChars) break;
  }
  return text.slice(0, maxChars);
}

async function extractHtmlTextAuto(files, entryName='index.html') {
  const list = Array.from(files || []);
  if (!list.length) throw new Error('Please select the HTML eBook folder first.');
  const target = String(entryName || 'index.html').toLowerCase();
  const entry = list.find(f => (f.webkitRelativePath || f.name).toLowerCase().replace(/\\/g,'/').endsWith('/'+target)) || list.find(f => f.name.toLowerCase() === target) || list.find(f => f.name.toLowerCase().endsWith('.html'));
  if (!entry) throw new Error('No HTML file found in the selected folder.');
  const doc = new DOMParser().parseFromString(await entry.text(), 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const heads = Array.from(doc.querySelectorAll('h1,h2,h3')).map(h => h.textContent.trim()).join('\n');
  const bodyParts = [];
  const blockTags = new Set(['article', 'blockquote', 'div', 'h1', 'h2', 'h3', 'h4', 'li', 'p', 'section', 'tr']);
  const collectBodyText = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      bodyParts.push(node.nodeValue || '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || ['script', 'style', 'noscript'].includes(node.tagName.toLowerCase())) return;
    if (blockTags.has(node.tagName.toLowerCase())) bodyParts.push('\n');
    if (node.tagName.toLowerCase() === 'br') {
      bodyParts.push('\n');
      return;
    }
    node.childNodes.forEach(collectBodyText);
    if (blockTags.has(node.tagName.toLowerCase())) bodyParts.push('\n');
  };
  if (doc.body) collectBodyText(doc.body);
  const body = bodyParts.join('').replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{2,}/g, '\n').trim();
  return { text: [title, desc, heads, body].join('\n'), title, filename: entry.name };
}

function applyAutoFill(data) {
  const text = data.text || '';
  setAutoField('title', data.title || extractTitle(text, data.filename || ''));
  setAutoField('authors', extractAuthors(text));
  setAutoField('year', extractYear(text));
  setAutoField('isbn', extractIsbn(text));
  setAutoField('doi', extractDoi(text));
  setAutoField('researchAreas', inferAreas(text));
  const type = document.getElementById('type');
  if (type && !type.value) {
    const t = text.toLowerCase();
    type.value = t.includes('policy brief') ? 'Policy Brief' : t.includes('technical') ? 'Technical Report' : (t.includes('survey') || t.includes('rmrdc')) ? 'RMRDC Publication' : 'Book';
  }
}

function getLibraryPageDetails(value) {
  const iframeSource = String(value || '').match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
  const pageUrl = new URL(iframeSource || String(value || '').trim());
  if (pageUrl.origin !== 'https://library.rmrdc.gov.ng' || !pageUrl.pathname.startsWith('/books/')) {
    throw new Error('Use an HTTPS page URL from library.rmrdc.gov.ng.');
  }
  const filename = decodeURIComponent(pageUrl.pathname.split('/').pop() || '');
  const title = filename.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim();
  if (!title) throw new Error('The RMRDC Digital Library page URL needs a publication filename.');
  const coverName = filename.replace(/\.html?$/i, '');
  return {
    url: pageUrl.href,
    title: title.toUpperCase(),
    coverUrl: new URL(`docs/${encodeURIComponent(coverName)}.pdf_1_thumb.jpg`, pageUrl).href
  };
}

const publicationProfileFields = {
  title: 'title',
  authors: 'authors',
  year: 'year',
  type: 'type',
  isbn: 'isbn',
  doi: 'doi',
  abstract: 'abstract',
  research_significance: 'researchSignificance',
  key_findings: 'keyFindings',
  methodology: 'methodology',
  data_resources: 'dataResources',
  research_gaps: 'researchGap',
  research_implications: 'researchImplications',
  context_geography: 'contextGeography',
  keywords: 'keywords',
  limitations: 'researchLimitations',
  recommended_for: 'recommendedFor',
  research_areas: 'researchAreas'
};

async function generatePublicationProfile(sourceText, metadata = {}) {
  if (!window.db) throw new Error('The AI profile service is temporarily unavailable.');
  const { data, error } = await window.db.functions.invoke('generate-publication-profile', {
    body: {
      source_text: String(sourceText || '').slice(0, 50000),
      metadata
    }
  });
  if (error?.name === 'FunctionsFetchError') {
    throw new Error('The AI profile service is temporarily unavailable. Please try again later.');
  }
  if (error) throw new Error('AI profile generation failed. Please try again later.');
  if (!data?.profile) throw new Error('The AI service could not create a publication profile. Please try again later.');
  return data.profile;
}

async function autoFillPublicationDetails() {
  const buttonWasDisabled = autoFillPublicationBtn?.disabled;
  const mode = typeof getPublicationMode === 'function' ? getPublicationMode() : 'pdf';
  if (autoFillPublicationBtn) autoFillPublicationBtn.disabled = true;
  try {
    if (mode === 'library') {
      const details = getLibraryPageDetails(document.getElementById('libraryPageUrl')?.value);
      document.getElementById('libraryPageUrl').value = details.url;
      setAutoField('title', details.title);
      setAutoField('type', 'RMRDC Publication');
      setAutoFillNotice('Title and cover are set from the RMRDC page. It does not expose author, year, or abstract metadata, so enter those manually if known.');
      return;
    }

    setAutoFillNotice('Reading file and extracting details...');
    let extracted;
    const existingFields = new Set(Object.values(publicationProfileFields)
      .filter(id => document.getElementById(id)?.value.trim()));

    if (mode === 'html') {
      const files = document.getElementById('ebookFolder')?.files;
      const entry = document.getElementById('ebookEntry')?.value || 'index.html';
      extracted = await extractHtmlTextAuto(files, entry);
    } else {
      const file = document.getElementById('pdf')?.files?.[0];
      const text = await extractPdfTextAuto(file);
      if (!text.trim()) {
        setAutoField('title', titleFromFile(file.name));
        setAutoFillNotice('This PDF has no selectable text. The filename supplied the title; AI autofill needs a text-searchable PDF. You can still upload it; the server OCR worker can index it if configured.', true);
        return;
      }
      extracted = { text, filename: file?.name || '' };
    }

    applyAutoFill(extracted);
    setAutoFillNotice('Generating an evidence-grounded abstract and research profile...');
    const profile = await generatePublicationProfile(extracted.text, {
      title: document.getElementById('title')?.value.trim(),
      authors: document.getElementById('authors')?.value.trim(),
      year: document.getElementById('year')?.value,
      type: document.getElementById('type')?.value,
      filename: extracted.filename
    });

    let populated = 0;
    for (const [profileKey, fieldId] of Object.entries(publicationProfileFields)) {
      if (existingFields.has(fieldId)) continue;
      const field = document.getElementById(fieldId);
      const value = profile[profileKey];
      if (!field || value === undefined || value === null) continue;
      const normalized = Array.isArray(value) ? value.join(', ') : String(value).trim();
      if (!normalized) continue;
      field.value = normalized;
      populated += 1;
    }

    if (!populated) {
      setAutoFillNotice('Bibliographic details were extracted, but the AI found no additional profile details supported by this document. Please complete the research fields manually.', true);
      return;
    }
    setAutoFillNotice('Bibliographic details, AI-generated abstract and supported research profile extracted. Review every field before uploading.');
  } catch (err) {
    console.error(err);
    setAutoFillNotice(mode === 'library' && err instanceof Error
      ? err.message
      : 'Bibliographic details were extracted, but AI abstract/profile generation failed. Please try again later.', true);
  } finally {
    if (autoFillPublicationBtn) autoFillPublicationBtn.disabled = Boolean(buttonWasDisabled);
  }
}

autoFillPublicationBtn?.addEventListener('click', autoFillPublicationDetails);
document.getElementById('pdf')?.addEventListener('change', () => setAutoFillNotice('PDF selected. Click Auto Fill Details.'));
document.getElementById('ebookFolder')?.addEventListener('change', () => setAutoFillNotice('HTML eBook folder selected. Click Auto Fill Details.'));

publicationForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setNotice(uploadMessage, 'Uploading publication...');
  const submitButton = document.getElementById('uploadBtn');
  if (submitButton) submitButton.disabled = true;
  const uploadedObjects = [];
  let recordCreated = false;
  let indexFailed = false;
  try {
    const mode = getPublicationMode();
    const coverFile = document.getElementById('cover').files[0];
    const pdfFile = document.getElementById('pdf')?.files?.[0] || null;
    const ebookFiles = document.getElementById('ebookFolder')?.files || [];
    const ebookEntry = document.getElementById('ebookEntry')?.value.trim() || 'index.html';
    const ebookExternalUrl = document.getElementById('ebookExternalUrl')?.value.trim() || '';
    const libraryPageUrl = document.getElementById('libraryPageUrl')?.value.trim() || '';

    if (mode !== 'library' && !coverFile) throw new Error('Cover image is required.');
    if (mode === 'pdf' && !pdfFile) throw new Error('PDF document is required.');
    if (mode === 'pdf' && pdfFile) {
      if (!/\.pdf$/i.test(pdfFile.name) || (pdfFile.type && pdfFile.type !== 'application/pdf')) {
        throw new Error('Choose a valid PDF document.');
      }
      if (pdfFile.size > 100 * 1024 * 1024) {
        throw new Error('PDFs must be 100 MB or smaller for OCR and publication indexing.');
      }
      const signature = new TextDecoder().decode(await pdfFile.slice(0, 5).arrayBuffer());
      if (signature !== '%PDF-') throw new Error('The selected file is not a valid PDF.');
    }
    if (mode === 'html' && !ebookFiles.length && !ebookExternalUrl) {
      throw new Error('Please upload an HTML eBook folder or paste an existing HTML eBook URL.');
    }
    if (mode === 'library') {
      try {
        getLibraryPageDetails(libraryPageUrl);
      } catch {
        throw new Error('Enter a valid HTTPS RMRDC Digital Library page URL.');
      }
    }

    const rawPrice = document.getElementById('price').value;
    const price = rawPrice === '' ? 0 : Number(rawPrice);
    const isPaid = price > 0;
    const title = document.getElementById('title').value.trim();

    let coverUrl = mode === 'library'
      ? getLibraryPageDetails(libraryPageUrl).coverUrl
      : new URL('/assets/placeholder-cover.svg', window.location.origin).href;
    if (coverFile) {
      const coverUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_COVERS, coverFile, 'covers');
      uploadedObjects.push({ bucket: window.APP_CONFIG.STORAGE_BUCKET_COVERS, path: coverUpload.path });
      coverUrl = coverUpload.publicUrl;
    }

    let pdfUpload = null;
    let previewUpload = null;
    let ebookUrl = null;
    let ebookEntryUrl = null;
    let ebookStoragePath = null;

    if (mode === 'pdf') {
      if (isPaid) {
        setNotice(uploadMessage, 'Creating public preview PDF...');
        const previewFile = await makePreviewPdfFile(pdfFile, 4);
        previewUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, previewFile, 'previews');
        uploadedObjects.push({ bucket: window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, path: previewUpload.path });

        setNotice(uploadMessage, 'Uploading protected full PDF...');
        pdfUpload = await uploadFile('paid-documents', pdfFile, 'documents', { private: true });
        uploadedObjects.push({ bucket: 'paid-documents', path: pdfUpload.path });
      } else {
        pdfUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, pdfFile, 'documents');
        uploadedObjects.push({ bucket: window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, path: pdfUpload.path });
        previewUpload = { publicUrl: pdfUpload.publicUrl, path: pdfUpload.path };
      }
    }

    if (mode === 'html') {
      if (ebookExternalUrl) {
        ebookUrl = ebookExternalUrl;
        ebookEntryUrl = ebookExternalUrl;
      } else {
        setNotice(uploadMessage, 'Uploading HTML eBook folder and assets...');
        const ebookUpload = await uploadHtmlEbookFolder(ebookFiles, title);
        uploadedObjects.push(...ebookUpload.uploaded.map(item => ({ bucket: window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, path: item.path })));
        ebookEntryUrl = findEntryUrl(ebookUpload, ebookEntry);
        ebookUrl = ebookEntryUrl;
        ebookStoragePath = `ebooks/${ebookUpload.folderId}/`;
      }
      previewUpload = { publicUrl: ebookEntryUrl, path: ebookStoragePath };
    }
    if (mode === 'library') {
      ebookUrl = libraryPageUrl;
      ebookEntryUrl = libraryPageUrl;
      previewUpload = { publicUrl: libraryPageUrl, path: null };
    }

    const { data: { user }, error: userError } = await window.db.auth.getUser();
    if (userError || !user) throw new Error('Your session has expired. Sign in again before uploading.');

    const payload = {
      title,
      authors: document.getElementById('authors').value.trim(),
      type: document.getElementById('type').value.trim(),
      year: Number(document.getElementById('year').value),
      created_by: user.id,
      isbn: document.getElementById('isbn')?.value.trim() || null,
      doi: document.getElementById('doi')?.value.trim() || null,
      citation: buildCitation({
        authors: document.getElementById('authors').value.trim(),
        year: Number(document.getElementById('year').value),
        title,
        type: document.getElementById('type').value.trim(),
        doi: document.getElementById('doi')?.value.trim() || ''
      }),
      price,
      is_paid: mode === 'pdf' ? isPaid : false,
      storage_type: mode === 'pdf' && isPaid ? 'private' : 'public',
      publication_format: mode === 'library' ? 'html' : mode,
      abstract: document.getElementById('abstract').value.trim(),
      research_significance: document.getElementById('researchSignificance')?.value.trim() || null,
      key_findings: document.getElementById('keyFindings')?.value.trim() || null,
      methodology: document.getElementById('methodology')?.value.trim() || null,
      data_resources: document.getElementById('dataResources')?.value.trim() || null,
      research_gaps: document.getElementById('researchGap')?.value.trim() || null,
      research_implications: document.getElementById('researchImplications')?.value.trim() || null,
      context_geography: document.getElementById('contextGeography')?.value.trim() || null,
      keywords: normalizeAreas(document.getElementById('keywords')?.value || ''),
      limitations: document.getElementById('researchLimitations')?.value.trim() || null,
      recommended_for: document.getElementById('recommendedFor')?.value.trim() || null,
      cover_url: coverUrl,
      pdf_url: mode === 'pdf' && !isPaid ? pdfUpload.publicUrl : null,
      pdf_path: mode === 'pdf' && isPaid ? pdfUpload.path : null,
      preview_url: previewUpload?.publicUrl || ebookEntryUrl,
      preview_page_limit: mode === 'pdf' ? 4 : null,
      ebook_url: ebookUrl,
      ebook_entry: ebookEntry,
      ebook_path: ebookStoragePath,
      research_areas: normalizeAreas(document.getElementById('researchAreas')?.value || '')
    };

    const publication = await createPublication(payload);
    recordCreated = true;

    if (publication?.id && mode !== 'library') {
      setNotice(uploadMessage, 'Publication saved. Building searchable page-level evidence and embeddings...');
      try {
        const indexResult = await indexOnePublication(publication.id);
        setNotice(uploadMessage, `Publication saved and searchable: ${indexResult.chunks} evidence chunks indexed.`);
      } catch (indexError) {
        indexFailed = true;
        console.error('Publication saved, but RAG indexing failed:', indexError);
      }
    }

    const emailResult = await notifyMatchingUsers(publication);
    publicationForm.reset();
    setupPublicationModeToggle();
    const emailSent = Number(emailResult?.email_sent ?? emailResult?.sent ?? 0);
    const whatsappSent = Number(emailResult?.whatsapp_sent ?? 0);
    const notificationWarning = emailResult?.warning ||
      (emailResult?.errors?.length ? `${emailResult.errors.length} alert delivery(s) failed; check notification settings and logs.` : '');
    const indexStatus = indexFailed
      ? 'RAG indexing failed; use Index or retry in Manage Publications.'
      : mode === 'library'
        ? 'The source page remains hosted externally and is not indexed by the library assistant.'
        : 'The publication was processed for searchable evidence.';
    const alertStatus = `Alerts sent: ${emailSent} email, ${whatsappSent} WhatsApp.`;
    const noMatches = emailResult?.matched === 0 && !notificationWarning
      ? 'No subscribers currently match this publication’s research areas.'
      : '';
    const savedMessage = mode === 'library'
      ? 'RMRDC Digital Library publication added and embedded.'
      : 'Publication uploaded successfully.';
    setNotice(uploadMessage, `${savedMessage} ${indexStatus} ${alertStatus} ${notificationWarning || noMatches}`.trim(), indexFailed || Boolean(notificationWarning));
    await loadDashboardData();
  } catch (error) {
    console.error('Publication upload failed:', error);
    if (!recordCreated && uploadedObjects.length) {
      await Promise.allSettled(uploadedObjects.map(object => window.db.storage.from(object.bucket).remove([object.path])));
    }
    const errorCode = String(error?.code || '');
    const rawErrorMessage = String(error?.message || '');
    const errorMessage = rawErrorMessage.toLowerCase();
    const constraint = String(error?.constraint || rawErrorMessage.match(/violates check constraint ["']([^"']+)["']/i)?.[1] || '');
    let message = 'Could not save the publication. Please check the required details and try again.';
    if (recordCreated) {
      message = 'The publication was saved, but a later step failed. Check Manage Publications before retrying to avoid adding it twice.';
    } else if (['PGRST204', 'PGRST205', '42703', '42P01'].includes(errorCode)) {
      message = 'The database is missing publication fields required by this upload. Run sql/SUPABASE_PUBLICATION_UPLOAD_UPGRADE.sql in the Supabase SQL Editor, then retry.';
    } else if (errorCode === '23514') {
      message = constraint === 'publications_publication_format_check'
        ? 'The database still has an older publication-format rule. Rerun sql/SUPABASE_PUBLICATION_UPLOAD_UPGRADE.sql in the Supabase SQL Editor; it now replaces that rule to allow HTML publications.'
        : constraint === 'publications_storage_type_check'
          ? 'The database storage rule rejected this publication. Refresh the admin page to use the corrected storage setting, then retry.'
        : 'The database rejected a publication rule. Check the browser console for the constraint name and share it so the schema can be corrected.';
    } else if (errorCode === '23502') {
      const missingColumn = rawErrorMessage.match(/null value in column ["']([^"']+)["']/i)?.[1];
      if (missingColumn === 'created_by') {
        message = 'Your signed-in account was not attached to the upload. Sign out, sign back in as an admin or editor, and retry.';
      } else if (missingColumn === 'pdf_url') {
        message = 'Your Supabase database still requires a PDF URL, which is empty for an embedded library page. Rerun sql/SUPABASE_PUBLICATION_UPLOAD_UPGRADE.sql and confirm it finishes successfully.';
      } else if (missingColumn === 'preview_page_limit') {
        message = 'Your Supabase database requires a PDF page limit for this non-PDF publication. Rerun sql/SUPABASE_PUBLICATION_UPLOAD_UPGRADE.sql to make the field optional, then retry.';
      } else if (missingColumn) {
        message = `Your Supabase database requires "${missingColumn}", but this upload did not provide a value. Check that field in the publication form or share this column name so the schema can be corrected.`;
      } else {
        message = 'The database requires a publication value that was not saved. The browser console may show which database column is missing.';
      }
    } else if (errorCode === '42501' || errorCode === '401') {
      message = 'Your session does not have permission to add publications. Sign in again as an admin or editor.';
    } else if (errorMessage.includes('failed to fetch') || errorMessage.includes('network')) {
      message = 'A connection problem prevented the upload. Check your internet connection and try again.';
    }
    if (errorCode) message += ` Reference: ${errorCode}.`;
    setNotice(uploadMessage, message, true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});



function techVal(id){ return document.getElementById(id)?.value?.trim() || null; }
function techNum(id){ const v=Number(document.getElementById(id)?.value); return Number.isFinite(v) && v>0 ? v : null; }
function techArray(id){ return String(document.getElementById(id)?.value || '').split(',').map(v=>v.trim()).filter(Boolean); }

adminTechnologyForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (!adminCanAccess) throw new Error('Please sign in as an administrator or editor.');
    setNotice(adminTechnologyMessage, 'Saving technology draft...');
    const u = await window.db.auth.getUser();
    const user = u?.data?.user;
    if (!user) throw new Error('Your session has expired. Please sign in again.');
    const engagement_models = [...document.querySelectorAll('.admin-tech-engagement:checked')].map(x=>x.value);
    const payload = {
      title: techVal('adminTechTitle'), sector: techVal('adminTechSector'), category: techVal('adminTechCategory'),
      trl: techNum('adminTechTrl'), institution: techVal('adminTechInstitution'), researcher_name: techVal('adminTechResearcher'),
      problem_addressed: techVal('adminTechProblem'), technical_specifications: techVal('adminTechSpecification'),
      product_consistency: techVal('adminTechConsistency'), shelf_life: techVal('adminTechShelfLife'), input_output_yield: techVal('adminTechYield'),
      production_capacity: techVal('adminTechCapacity'), machinery_equipment: techVal('adminTechMachinery'), energy_requirement: techVal('adminTechEnergy'),
      utilities_requirement: techVal('adminTechUtilities'), waste_environmental_profile: techVal('adminTechWaste'), laboratory_pilot_evidence: techVal('adminTechEvidence'),
      production_cost_text: techVal('adminTechProductionCost'), raw_material_cost: techVal('adminTechRawCost'), operating_cost: techVal('adminTechOperatingCost'),
      estimated_investment: techNum('adminTechInvestment'), expected_selling_price: techVal('adminTechSellingPrice'), profit_margin: techVal('adminTechMargin'),
      market_size: techNum('adminTechMarket'), expected_demand_cagr: techVal('adminTechDemand'), payback_period: techVal('adminTechPayback'),
      import_substitution_opportunity: techVal('adminTechImportSub'), market_summary: techVal('adminTechMarketSummary'),
      raw_materials: techArray('adminTechMaterials'), raw_material_locations: techArray('adminTechLocations'), raw_material_availability: techVal('adminTechAvailability'),
      raw_material_quantity: techVal('adminTechQuantity'), raw_material_seasonality: techVal('adminTechSeasonality'), supplier_count: techVal('adminTechSuppliers'),
      raw_material_market_price: techVal('adminTechMaterialPrice'), transport_storage: techVal('adminTechLogistics'), raw_material_bottlenecks: techVal('adminTechBottlenecks'),
      patent_ip_status: techVal('adminTechIp'), patent_reference: techVal('adminTechPatentRef'), patent_ownership: techVal('adminTechPatentOwner'),
      freedom_to_operate: techVal('adminTechFto'), licensing_terms: techVal('adminTechLicensing'), existing_licensees: techVal('adminTechLicensees'),
      nda_arrangement: techVal('adminTechNda'), regulatory_status: techVal('adminTechRegulatory'), international_standards: techVal('adminTechStandards'),
      environmental_compliance: techVal('adminTechCompliance'), prototype_status: techVal('adminTechPrototype'), pilot_plant_availability: techVal('adminTechPilot'),
      demonstration_results: techVal('adminTechDemo'), existing_partnerships: techVal('adminTechPartnerships'), fabrication_requirements: techVal('adminTechFabrication'),
      scale_up_requirements: techVal('adminTechScaleup'), engagement_models, technical_support_after_engagement: techVal('adminTechSupport'),
      short_summary: techVal('adminTechProblem'), created_by: user.id, visibility: 'draft'
    };
    const {data,error}=await window.db.from('technology_opportunities').insert(payload).select().single();
    if(error) throw error;
    adminTechnologyForm.reset();
    setNotice(adminTechnologyMessage, `Technology draft saved successfully${data?.id ? ` • ID: ${data.id}` : ''}. It is not investor-facing until RMRDC approves it.`);
  } catch(err){ console.error(err); setNotice(adminTechnologyMessage, 'Technology save failed. Please try again later.', true); }
});

refreshPublicationsBtn?.addEventListener('click', loadRecentPublications);
refreshSubscribersBtn?.addEventListener('click', async () => {
  showAllSubscribers = !showAllSubscribers;
  await loadRecentSubscribers();
});
subscribersTable?.addEventListener('change', async event => {
  const control = event.target.closest('[data-email-access-id]');
  if (!control || !window.db) return;
  const subscriberId = control.dataset.emailAccessId;
  const requestedValue = control.checked;
  control.disabled = true;
  setNotice(subscriberControlMessage, 'Saving email recipient setting...');
  try {
    const { error } = await window.db
      .from('research_subscribers')
      .update({ admin_email_enabled: requestedValue })
      .eq('id', subscriberId);
    if (error) throw error;
    setNotice(subscriberControlMessage, requestedValue
      ? 'Email delivery enabled for this subscriber. Their opt-in and research interests still apply.'
      : 'Email delivery disabled for this subscriber.');
  } catch (error) {
    console.error('Could not update subscriber email eligibility:', error);
    setNotice(subscriberControlMessage, 'Could not update email eligibility. Please try again later.', true);
    await loadRecentSubscribers();
  } finally {
    control.disabled = false;
  }
});
refreshNotificationsBtn?.addEventListener('click', async () => {
  await Promise.allSettled([loadEmailNotifications(), loadCasCampaignHistory(), loadCampaignAudience()]);
  if (casCampaignDetailPanel?.dataset.campaignId) {
    await loadCasCampaignDetails(casCampaignDetailPanel.dataset.campaignId, casCampaignDetailTitle?.textContent || 'Campaign recipients', casCampaignDetailPanel.dataset.campaignStatus || '');
  }
});
casCampaignHistory?.addEventListener('click', async event => {
  const button = event.target.closest('[data-view-cas-campaign]');
  if (!button) return;
  await loadCasCampaignDetails(button.dataset.viewCasCampaign, button.dataset.campaignName, button.dataset.campaignStatus);
});
casRetryFailedBtn?.addEventListener('click', async () => {
  const campaignId = casRetryFailedBtn.dataset.retryCampaign;
  if (!campaignId || !window.db || casRetryFailedBtn.disabled) return;
  casRetryFailedBtn.disabled = true;
  try {
    const { data, error } = await window.db.functions.invoke('send-cas-email-campaigns', {
      body: { action: 'retry_failed', campaign_id: campaignId },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Could not retry failed recipients.');
    setNotice(casCampaignMessage, `Retry queued for ${formatNumber(data.retried)} failed recipient(s).`);
    await loadCasCampaignHistory();
    await loadCasCampaignDetails(campaignId, casCampaignDetailTitle?.textContent || 'Campaign recipients', 'queued');
  } catch (error) {
    setNotice(casCampaignMessage, 'Could not retry failed recipients. Please try again later.', true);
  } finally {
    casRetryFailedBtn.disabled = false;
  }
});
casCampaignAudience?.addEventListener('change', () => {
  document.getElementById('casCampaignAreasWrap')?.classList.toggle('hidden', casCampaignAudience.value !== 'areas');
  document.getElementById('casCampaignRecipientsWrap')?.classList.toggle('hidden', casCampaignAudience.value !== 'selected');
  updateCampaignAudienceSummary();
});
casCampaignAreas?.addEventListener('change', updateCampaignAudienceSummary);
casCampaignRecipients?.addEventListener('change', event => {
  const input = event.target.closest('[data-campaign-subscriber]');
  if (input) {
    if (input.checked) selectedCampaignRecipientIdSet.add(String(input.value));
    else selectedCampaignRecipientIdSet.delete(String(input.value));
  }
  updateCampaignAudienceSummary();
});
document.getElementById('casSubscriberSearch')?.addEventListener('input', renderCampaignRecipients);
casSubscriberAreaFilter?.addEventListener('change', renderCampaignRecipients);
document.getElementById('casSelectVisibleRecipients')?.addEventListener('click', () => {
  casCampaignRecipients?.querySelectorAll('[data-campaign-subscriber]:not(:disabled)').forEach(input => {
    input.checked = true;
    selectedCampaignRecipientIdSet.add(String(input.value));
  });
  updateCampaignAudienceSummary();
});
document.getElementById('casClearRecipients')?.addEventListener('click', () => {
  const search = document.getElementById('casSubscriberSearch');
  if (search) search.value = '';
  if (casSubscriberAreaFilter) casSubscriberAreaFilter.value = '';
  selectedCampaignRecipientIdSet.clear();
  renderCampaignRecipients();
  updateCampaignAudienceSummary();
});
[casCampaignName, casCampaignSubject, casCampaignBody, casCampaignSendAt].forEach(input => {
  input?.addEventListener('input', updateCampaignPreview);
});
casSendTestBtn?.addEventListener('click', async () => {
  if (!window.db || casSendTestBtn.disabled) return;
  casSendTestBtn.disabled = true;
  setNotice(casCampaignMessage, 'Sending test email...');
  try {
    const { data, error } = await window.db.functions.invoke('send-cas-email-campaigns', {
      body: {
        action: 'send_test', email: document.getElementById('casTestEmail')?.value,
        campaign_name: casCampaignName?.value, subject: casCampaignSubject?.value,
        message: casCampaignBody?.value,
      }
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Test email failed.');
    setNotice(casCampaignMessage, 'Test email accepted by the email provider. Check your inbox and spam folder.');
  } catch (error) {
    setNotice(casCampaignMessage, 'Could not send the test email. Please try again later.', true);
  } finally {
    casSendTestBtn.disabled = false;
  }
});
casCampaignForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!window.db || casCampaignSubmitBtn?.disabled) return;
  updateCampaignAudienceSummary();
  const audienceMode = casCampaignAudience?.value || 'all';
  const areas = selectedCampaignAreas();
  const subscriberIds = selectedCampaignRecipientIds();
  const eligibleCount = campaignSubscribers.filter(campaignSubscriberEligible).length;
  const selectedCount = audienceMode === 'areas'
    ? campaignSubscribers.filter(sub => campaignSubscriberEligible(sub) && normalizeAreas(sub.research_areas).some(area => areas.includes(area))).length
    : audienceMode === 'selected'
      ? campaignSubscribers.filter(sub => campaignSubscriberEligible(sub) && subscriberIds.includes(String(sub.id))).length
      : eligibleCount;
  if (!selectedCount) {
    setNotice(casCampaignMessage, 'No eligible recipients in this audience. Review the interests, opt-ins, and subscriber switches.', true);
    return;
  }
  casCampaignSubmitBtn.disabled = true;
  setNotice(casCampaignMessage, 'Saving campaign and adding recipients to the delivery queue...');
  try {
    const scheduledAt = casCampaignSendAt?.value ? new Date(casCampaignSendAt.value).toISOString() : null;
    const { data, error } = await window.db.functions.invoke('send-cas-email-campaigns', {
      body: {
        action: 'create_campaign', campaign_name: casCampaignName?.value,
        subject: casCampaignSubject?.value, message: casCampaignBody?.value,
        audience_mode: audienceMode, areas, subscriber_ids: subscriberIds,
        scheduled_at: scheduledAt,
      }
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Campaign could not be queued.');
    const deliveryTime = scheduledAt ? `scheduled for ${formatDate(scheduledAt)}` : 'queued for immediate delivery';
    setNotice(casCampaignMessage, `Campaign ${deliveryTime} to ${data.recipient_count} eligible subscriber(s). Delivery progress appears below.`);
    casCampaignForm.reset();
    selectedCampaignRecipientIdSet.clear();
    document.getElementById('casCampaignAreasWrap')?.classList.add('hidden');
    document.getElementById('casCampaignRecipientsWrap')?.classList.add('hidden');
    casCampaignAudience.value = 'all';
    renderCampaignRecipients();
    updateCampaignPreview();
    updateCampaignAudienceSummary();
    await loadCasCampaignHistory();
  } catch (error) {
    console.error('CAS campaign queue failed:', error);
    setNotice(casCampaignMessage, 'Campaign could not be queued. Please try again later.', true);
  } finally {
    casCampaignSubmitBtn.disabled = false;
  }
});
refreshAnalyticsBtn?.addEventListener('click', async () => { await loadStats(); mirrorAnalyticsCards(); });
refreshActivityBtn?.addEventListener('click', loadActivityLogs);

(async function init() {
  setupSidebarNavigation();
  const initialSectionFromHash = (window.location.hash || '').replace('#', '') || 'dashboard';
  currentAdminSection = initialSectionFromHash;
  showAdminSection(initialSectionFromHash);
  if (!window.db) return;
  await refreshAuthUI();
  const { data: { session } } = await window.db.auth.getSession();
  if (session?.user) {
    await loadDashboardData();
    setupLiveMetrics();
  }
})();


function setBulletinNotice(text, isError = false) {
  if (!bulletinMessage) return;
  bulletinMessage.textContent = text;
  bulletinMessage.classList.remove('hidden');
  bulletinMessage.style.background = isError ? '#fff1f1' : '#edf7f1';
  bulletinMessage.style.color = isError ? '#9b1c1c' : '#0d4d2e';
}

function splitBulletinList(text = '') {
  return String(text).split(/\n|,/).map(v => v.trim()).filter(Boolean);
}

async function loadAdminBulletins() {
  if (!adminBulletinList || !window.db) return;
  const { data, error } = await window.db
    .from('cas_bulletins')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    adminBulletinList.innerHTML = '<p class="empty card">Could not load bulletins.</p>';
    return;
  }

  adminBulletinList.innerHTML = (data || []).map(item => `
    <article class="admin-list-card card">
      <div>
        <strong>${item.title}</strong>
        <p>${item.bulletin_type || 'CAS Bulletin'} • ${item.status}</p>
      </div>
      <span>${new Date(item.created_at).toLocaleDateString()}</span>
    </article>
  `).join('') || '<p class="empty card">No bulletins created yet.</p>';
}

async function notifyBulletinSubscribers(bulletin) {
  if (!window.db) return { skipped: true };
  const { data, error } = await window.db.functions.invoke('send-cas-bulletin', {
    body: { bulletin_id: bulletin.id }
  });
  if (error) throw error;
  return data;
}

bulletinForm?.addEventListener('submit', async event => {
  event.preventDefault();

  try {
    setBulletinNotice('Saving CAS bulletin...');

    const payload = {
      title: document.getElementById('bulletinTitle').value.trim(),
      bulletin_type: document.getElementById('bulletinType').value,
      sectors: splitBulletinList(document.getElementById('bulletinSectors').value).map(v => v.toLowerCase()),
      summary: document.getElementById('bulletinSummary').value.trim(),
      body: document.getElementById('bulletinBody').value.trim(),
      publications: splitBulletinList(document.getElementById('bulletinPublicationIds').value).map(title => ({ title })),
      status: document.getElementById('publishBulletinNow').checked ? 'published' : 'draft'
    };

    const { data, error } = await window.db.from('cas_bulletins').insert(payload).select().single();
    if (error) throw error;

    if (document.getElementById('sendBulletinAlerts').checked) {
      setBulletinNotice('Bulletin saved. Sending alerts to matching subscribers...');
      await notifyBulletinSubscribers(data);
    }

    bulletinForm.reset();
    setBulletinNotice('CAS bulletin saved successfully.');
    await loadAdminBulletins();
  } catch (error) {
    console.error(error);
    setBulletinNotice('Could not save the CAS bulletin. Please try again later.', true);
  }
});

refreshBulletinsBtn?.addEventListener('click', loadAdminBulletins);
loadAdminBulletins();
