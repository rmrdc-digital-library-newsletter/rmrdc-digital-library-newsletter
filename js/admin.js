/* =========================================================
   RMRDC CAS PDF TEXT INDEXING FOR AI LIBRARIAN / RAG
   Extracts PDF text after upload and saves it into
   public.publication_chunks for publication-grounded answers.
========================================================= */

async function rmrdcEnsurePdfJs() {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');

  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

  return pdfjs;
}

function rmrdcChunkText(text, maxLength = 1400) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + maxLength, clean.length);

    if (end < clean.length) {
      const sentenceEnd = clean.lastIndexOf('.', end);
      if (sentenceEnd > start + 400) end = sentenceEnd + 1;
    }

    const chunk = clean.slice(start, end).trim();

    if (chunk.length > 50) chunks.push(chunk);

    start = end;
  }

  return chunks;
}

async function rmrdcExtractPdfChunks(file, publicationId) {
  if (!file || !publicationId) return [];

  const pdfjs = await rmrdcEnsurePdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({
    data: arrayBuffer
  }).promise;

  const rows = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map(item => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const pageChunks = rmrdcChunkText(pageText);

    pageChunks.forEach((content, index) => {
      rows.push({
        publication_id: publicationId,
        page_number: pageNumber,
        chunk_index: index,
        content
      });
    });
  }

  return rows;
}

async function rmrdcIndexPublicationPdf(file, publicationId, statusTarget = null) {
  if (!window.db || !file || !publicationId) return;

  try {
    setNotice(statusTarget, 'Indexing PDF text for AI Librarian...');

    await window.db
      .from('publication_chunks')
      .delete()
      .eq('publication_id', publicationId);

    const chunks = await rmrdcExtractPdfChunks(file, publicationId);

    console.log('RMRDC AI chunks extracted:', chunks.length);

    if (!chunks.length) {
      setNotice(statusTarget, 'Publication uploaded, but no readable PDF text was extracted.');
      return;
    }

    for (let i = 0; i < chunks.length; i += 80) {
      const batch = chunks.slice(i, i + 80);

      const { error } = await window.db
        .from('publication_chunks')
        .insert(batch);

      if (error) throw error;
    }

    setNotice(statusTarget, `Publication uploaded and ${chunks.length} AI text chunks indexed.`);
  } catch (error) {
    console.error('PDF text indexing failed:', error);
    setNotice(statusTarget, 'Publication uploaded, but AI text indexing failed. Check browser console.', true);
  }
}


const authForm = document.getElementById('authForm');
const authStatus = document.getElementById('authStatus');
const signOutBtn = document.getElementById('signOutBtn');
const publicationForm = document.getElementById('publicationForm');
const uploadMessage = document.getElementById('uploadMessage');
const bulletinForm = document.getElementById('bulletinForm');
const bulletinMessage = document.getElementById('bulletinMessage');
const adminBulletinList = document.getElementById('adminBulletinList');
const refreshBulletinsBtn = document.getElementById('refreshBulletinsBtn');
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
const notificationsTable = document.getElementById('notificationsTable');
const activityTable = document.getElementById('activityTable');
const refreshNotificationsBtn = document.getElementById('refreshNotificationsBtn');
const refreshAnalyticsBtn = document.getElementById('refreshAnalyticsBtn');
const refreshActivityBtn = document.getElementById('refreshActivityBtn');
const authPanel = document.querySelector('.admin-auth-panel');
const registerPanel = document.getElementById('register');
const subscribersPanel = document.getElementById('subscribers');
let currentAdminSection = 'dashboard';
let adminCanAccess = false;

function normalizeAreas(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean))];
}

function areaTags(areas = []) {
  const list = Array.isArray(areas) ? areas : normalizeAreas(areas);
  if (!list.length) return '<span class="muted">None</span>';
  return list.map(area => `<span class="area-chip">${area}</span>`).join(' ');
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
    [statsSection, registerUploadGrid, uploadSection, recordsSection, emailNotificationsSection, analyticsSection, settingsSection, activityLogsSection, rawMaterialsSection].forEach(el => setAdminBlockVisible(el, false));
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
    authStatus.textContent = 'Update ../js/config.js with your Supabase credentials.';
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
    authStatus.textContent = error.message;
    return;
  }
  authForm.reset();
  await refreshAuthUI();
  await loadDashboardData();
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
    return { sent: 0, matched: 0, warning: error.message };
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
  const setters = {
    statPublications: 0,
    statUsers: 0,
    statSubscribers: 0,
    statViews: 0,
    statDownloads: 0
  };

  try { setters.statPublications = await countRows('publications'); } catch (_) {}
  try { setters.statUsers = await countRows('profiles'); } catch (_) {}
  try { setters.statSubscribers = await countRows('research_subscribers'); } catch (_) {}
  try { setters.statViews = await countRows('view_events'); } catch (_) {}
  try { setters.statDownloads = await countRows('download_events'); } catch (_) {}

  Object.entries(setters).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatNumber(value);
  });
}

async function loadRecentSubscribers() {
  if (!window.db || !subscribersTable) return;
  try {
    const { data, error } = await window.db
      .from('research_subscribers')
      .select('full_name, email, phone, organisation, research_areas, email_notifications, whatsapp_alerts, created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) throw error;

    if (!data?.length) {
      subscribersTable.innerHTML = '<tr><td colspan="7">No subscribers yet.</td></tr>';
      return;
    }

    subscribersTable.innerHTML = data.map(sub => `
      <tr>
        <td>${sub.full_name || '—'}</td>
        <td>${sub.email || '—'}</td>
        <td>${sub.phone || '—'}</td>
        <td>${sub.organisation || '—'}</td>
        <td>${areaTags(sub.research_areas || [])}</td>
        <td>
          <span class="area-chip">${sub.email_notifications !== false ? 'Email' : 'No email'}</span>
          <span class="area-chip">${sub.whatsapp_alerts !== false ? 'WhatsApp' : 'No WhatsApp'}</span>
        </td>
        <td>${formatDate(sub.created_at)}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error(error);
    subscribersTable.innerHTML = '<tr><td colspan="7">Could not load subscribers. Run the research subscriber SQL first.</td></tr>';
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
    if (publicationsTable) publicationsTable.innerHTML = '<tr><td colspan="11">Could not load records.</td></tr>';
    if (adminList) adminList.innerHTML = '<p>Could not load records.</p>';
    return;
  }

  if (!data?.length) {
    if (publicationsTable) publicationsTable.innerHTML = '<tr><td colspan="11">No publications yet.</td></tr>';
    if (adminList) adminList.innerHTML = '<p>No publications yet.</p>';
    return;
  }

  if (publicationsTable) {
    publicationsTable.innerHTML = data.map(pub => `
      <tr>
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
        <td><a class="icon-action" href="../viewer.html?id=${pub.id}" title="Open">↗</a></td>
      </tr>
    `).join('');
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
      `;
      adminList.appendChild(row);
    });
  }
}

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
        <td>${row.error_message || '—'}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error(error);
    notificationsTable.innerHTML = '<tr><td colspan="5">Could not load notifications. Run the notification SQL first.</td></tr>';
  }
}

async function loadActivityLogs() {
  if (!window.db || !activityTable) return;
  try {
    const [views, downloads] = await Promise.all([
      window.db.from('view_events').select('created_at, user_agent, publications(title)').order('created_at', { ascending: false }).limit(10),
      window.db.from('download_events').select('created_at, user_agent, publications(title)').order('created_at', { ascending: false }).limit(10)
    ]);
    if (views.error) throw views.error;
    if (downloads.error) throw downloads.error;
    const rows = [
      ...(views.data || []).map(r => ({ ...r, type: 'View' })),
      ...(downloads.data || []).map(r => ({ ...r, type: 'Download' }))
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
  const pairs = { analyticsPublications: 'statPublications', analyticsUsers: 'statUsers', analyticsSubscribers: 'statSubscribers', analyticsViews: 'statViews', analyticsDownloads: 'statDownloads' };
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
  await Promise.allSettled([loadStats(), loadRecentSubscribers(), loadRecentPublications(), loadEmailNotifications(), loadActivityLogs()]);
  mirrorAnalyticsCards();
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
    setNotice(registerMessage, error.message || 'Registration failed.', true);
  }
});


function getPublicationMode() {
  return document.querySelector('input[name="publicationMode"]:checked')?.value || 'pdf';
}

function setupPublicationModeToggle() {
  const pdfFields = document.getElementById('pdfUploadFields');
  const htmlFields = document.getElementById('htmlUploadFields');
  const pdfInput = document.getElementById('pdf');

  function update() {
    const mode = getPublicationMode();
    pdfFields?.classList.toggle('hidden', mode !== 'pdf');
    htmlFields?.classList.toggle('hidden', mode !== 'html');
    if (pdfInput) pdfInput.required = mode === 'pdf';
  }

  document.querySelectorAll('input[name="publicationMode"]').forEach(input => {
    input.addEventListener('change', update);
  });
  update();
}

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

  for (const file of Array.from(files)) {
    const relative = cleanRelativePath(file.webkitRelativePath || file.name);
    const folderPath = `ebooks/${folderId}/${relative}`.replace(/\/[^/]+$/, '');
    const originalName = file.name;
    const upload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, file, folderPath, { keepName: true, upsert: true });
    uploaded.push({ file: relative, url: upload.publicUrl, path: upload.path });
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

function cleanAutoText(text = '') {
  return String(text).replace(/\s+/g, ' ').replace(/[•·]/g, ' ').trim();
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
  return good.find(l => /report|study|survey|sector|profile|brief|technical|raw materials/i.test(l)) || good[0] || titleFromFile(fallback);
}

function extractAuthors(text) {
  const edited = text.match(/edited\s+by\s+(.{5,160})/i);
  if (edited) return edited[1].replace(/\s{2,}/g, ' ').trim();
  const by = text.match(/\bby\s+([A-Z][A-Za-z.\s,&\-|]{5,160})/);
  return by ? by[1].replace(/\s{2,}/g, ' ').trim() : '';
}

function extractAbstract(text) {
  const clean = cleanAutoText(text);
  const exec = clean.toLowerCase().indexOf('executive summary');
  if (exec >= 0) return clean.slice(exec, exec + 900);
  const fore = clean.toLowerCase().indexOf('foreword');
  if (fore >= 0) return clean.slice(fore, fore + 750);
  return clean.slice(0, 800);
}

function inferAreas(text) {
  const hay = text.toLowerCase();
  const pairs = [['food','food science'],['beverage','beverages'],['tobacco','tobacco sector'],['cassava','cassava'],['palm oil','palm oil'],['agro','agro raw materials'],['mineral','mineral raw materials'],['policy','policy brief'],['technical','technical report'],['industrial','industrial development'],['raw material','raw materials']];
  const out = [];
  pairs.forEach(([k,v]) => { if (hay.includes(k) && !out.includes(v)) out.push(v); });
  return out.slice(0,6).join(', ');
}

async function extractPdfTextAuto(file, maxPages = 8) {
  if (!file) throw new Error('Please select a PDF first.');
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += '\n' + content.items.map(item => item.str).join(' ');
  }
  return text;
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
  const body = doc.body?.innerText || doc.body?.textContent || '';
  return { text: [title, desc, heads, body].join('\n'), title, filename: entry.name };
}

function applyAutoFill(data) {
  const text = data.text || '';
  setAutoField('title', data.title || extractTitle(text, data.filename || ''));
  setAutoField('authors', extractAuthors(text) || 'RMRDC');
  setAutoField('year', extractYear(text));
  setAutoField('isbn', extractIsbn(text));
  setAutoField('doi', extractDoi(text));
  setAutoField('abstract', extractAbstract(text));
  setAutoField('researchAreas', inferAreas(text));
  const type = document.getElementById('type');
  if (type && !type.value) {
    const t = text.toLowerCase();
    type.value = t.includes('policy brief') ? 'Policy Brief' : t.includes('technical') ? 'Technical Report' : (t.includes('survey') || t.includes('rmrdc')) ? 'RMRDC Publication' : 'Book';
  }
}

async function autoFillPublicationDetails() {
  try {
    setAutoFillNotice('Reading file and extracting details...');
    const mode = typeof getPublicationMode === 'function' ? getPublicationMode() : 'pdf';
    if (mode === 'html') {
      const files = document.getElementById('ebookFolder')?.files;
      const entry = document.getElementById('ebookEntry')?.value || 'index.html';
      applyAutoFill(await extractHtmlTextAuto(files, entry));
    } else {
      const file = document.getElementById('pdf')?.files?.[0];
      const text = await extractPdfTextAuto(file);
      applyAutoFill({ text, filename: file?.name || '' });
    }
    setAutoFillNotice('Details extracted. Please review and correct fields before uploading.');
  } catch (err) {
    console.error(err);
    setAutoFillNotice(err.message || 'Auto fill failed. Fill details manually.', true);
  }
}

autoFillPublicationBtn?.addEventListener('click', autoFillPublicationDetails);
document.getElementById('pdf')?.addEventListener('change', () => setAutoFillNotice('PDF selected. Click Auto Fill Details.'));
document.getElementById('ebookFolder')?.addEventListener('change', () => setAutoFillNotice('HTML eBook folder selected. Click Auto Fill Details.'));

publicationForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setNotice(uploadMessage, 'Uploading publication...');
  try {
    const mode = getPublicationMode();
    const coverFile = document.getElementById('cover').files[0];
    const pdfFile = document.getElementById('pdf')?.files?.[0] || null;
    const ebookFiles = document.getElementById('ebookFolder')?.files || [];
    const ebookEntry = document.getElementById('ebookEntry')?.value.trim() || 'index.html';
    const ebookExternalUrl = document.getElementById('ebookExternalUrl')?.value.trim() || '';

    if (!coverFile) throw new Error('Cover image is required.');
    if (mode === 'pdf' && !pdfFile) throw new Error('PDF document is required.');
    if (mode === 'html' && !ebookFiles.length && !ebookExternalUrl) {
      throw new Error('Please upload an HTML eBook folder or paste an existing HTML eBook URL.');
    }

    const rawPrice = document.getElementById('price').value;
    const price = rawPrice === '' ? 0 : Number(rawPrice);
    const isPaid = price > 0;
    const title = document.getElementById('title').value.trim();

    const coverUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_COVERS, coverFile, 'covers');

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

        setNotice(uploadMessage, 'Uploading protected full PDF...');
        pdfUpload = await uploadFile('paid-documents', pdfFile, 'documents', { private: true });
      } else {
        pdfUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, pdfFile, 'documents');
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
        ebookEntryUrl = findEntryUrl(ebookUpload, ebookEntry);
        ebookUrl = ebookEntryUrl;
        ebookStoragePath = `ebooks/${ebookUpload.folderId}/`;
      }
      previewUpload = { publicUrl: ebookEntryUrl, path: ebookStoragePath };
    }

    const payload = {
      title,
      authors: document.getElementById('authors').value.trim(),
      type: document.getElementById('type').value.trim(),
      year: Number(document.getElementById('year').value),
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
      storage_type: mode === 'pdf' ? (isPaid ? 'private' : 'public') : 'html',
      publication_format: mode,
      abstract: document.getElementById('abstract').value.trim(),
      cover_url: coverUpload.publicUrl,
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

    if (mode === 'pdf' && pdfFile && publication?.id) {
      await rmrdcIndexPublicationPdf(pdfFile, publication.id, uploadMessage);
    }

    const emailResult = await notifyMatchingUsers(publication);
    publicationForm.reset();
    setupPublicationModeToggle();
    setNotice(uploadMessage, `Publication uploaded successfully. Matching alerts sent: ${emailResult?.sent || emailResult?.email_sent || 0}.`);
    await loadDashboardData();
  } catch (error) {
    console.error(error);
    setNotice(uploadMessage, error.message || 'Upload failed.', true);
  }
});

refreshPublicationsBtn?.addEventListener('click', loadRecentPublications);
refreshSubscribersBtn?.addEventListener('click', loadRecentSubscribers);
refreshNotificationsBtn?.addEventListener('click', loadEmailNotifications);
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
  if (session?.user) await loadDashboardData();
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
    setBulletinNotice(error.message || 'Could not save CAS bulletin.', true);
  }
});

refreshBulletinsBtn?.addEventListener('click', loadAdminBulletins);
loadAdminBulletins();
