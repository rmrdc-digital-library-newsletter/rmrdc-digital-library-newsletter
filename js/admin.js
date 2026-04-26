const authForm = document.getElementById('authForm');
const authStatus = document.getElementById('authStatus');
const signOutBtn = document.getElementById('signOutBtn');
const publicationForm = document.getElementById('publicationForm');
const uploadMessage = document.getElementById('uploadMessage');
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
    [statsSection, registerUploadGrid, uploadSection, recordsSection, emailNotificationsSection, analyticsSection, settingsSection, activityLogsSection].forEach(el => setAdminBlockVisible(el, false));
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

  if (registerPanel && subscribersPanel) {
    registerPanel.classList.toggle('admin-section-hidden', sectionName !== 'register');
    subscribersPanel.classList.toggle('admin-section-hidden', sectionName !== 'subscribers');
  }
}

function toggleAuthorizedUI(canUpload) {
  adminCanAccess = Boolean(canUpload);
  publicationForm?.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = !canUpload; });
  registerUserForm?.querySelectorAll('input, button').forEach(el => { el.disabled = !canUpload; });
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
  const cleanName = `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
  const path = `${folder}/${cleanName}`;
  const { error } = await window.db.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
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
    console.warn('Email notification skipped/failed:', error);
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
        is_active: payload.email_notifications
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
      .select('full_name, email, organisation, research_areas, created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) throw error;

    if (!data?.length) {
      subscribersTable.innerHTML = '<tr><td colspan="5">No subscribers yet.</td></tr>';
      return;
    }

    subscribersTable.innerHTML = data.map(sub => `
      <tr>
        <td>${sub.full_name || '—'}</td>
        <td>${sub.email || '—'}</td>
        <td>${sub.organisation || '—'}</td>
        <td>${areaTags(sub.research_areas || [])}</td>
        <td>${formatDate(sub.created_at)}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error(error);
    subscribersTable.innerHTML = '<tr><td colspan="5">Could not load subscribers. Run the research subscriber SQL first.</td></tr>';
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
    if (publicationsTable) publicationsTable.innerHTML = '<tr><td colspan="9">Could not load records.</td></tr>';
    if (adminList) adminList.innerHTML = '<p>Could not load records.</p>';
    return;
  }

  if (!data?.length) {
    if (publicationsTable) publicationsTable.innerHTML = '<tr><td colspan="9">No publications yet.</td></tr>';
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
        showAdminSection('dashboard');
        return;
      }
      showAdminSection(sectionName);
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
      email_notifications: document.getElementById('regEmailNotifications').checked
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

publicationForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setNotice(uploadMessage, 'Uploading publication...');
  try {
    const coverFile = document.getElementById('cover').files[0];
    const pdfFile = document.getElementById('pdf').files[0];
    if (!coverFile || !pdfFile) throw new Error('Both cover image and PDF are required.');

    const rawPrice = document.getElementById('price').value;
    const price = rawPrice === '' ? 0 : Number(rawPrice);
    const isPaid = price > 0;

    const coverUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_COVERS, coverFile, 'covers');

    let pdfUpload;
    let previewUpload;
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

    const payload = {
      title: document.getElementById('title').value.trim(),
      authors: document.getElementById('authors').value.trim(),
      type: document.getElementById('type').value.trim(),
      year: Number(document.getElementById('year').value),
      price,
      is_paid: isPaid,
      storage_type: isPaid ? 'private' : 'public',
      abstract: document.getElementById('abstract').value.trim(),
      cover_url: coverUpload.publicUrl,
      pdf_url: isPaid ? null : pdfUpload.publicUrl,
      pdf_path: isPaid ? pdfUpload.path : null,
      preview_url: previewUpload.publicUrl,
      preview_page_limit: 4,
      research_areas: normalizeAreas(document.getElementById('researchAreas')?.value || '')
    };

    const publication = await createPublication(payload);
    const emailResult = await notifyMatchingUsers(publication);
    publicationForm.reset();
    setNotice(uploadMessage, `Publication uploaded successfully. Matching emails sent: ${emailResult?.sent || 0}.`);
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
  showAdminSection('dashboard');
  if (!window.db) return;
  await refreshAuthUI();
  const { data: { session } } = await window.db.auth.getSession();
  if (session?.user) await loadDashboardData();
})();
