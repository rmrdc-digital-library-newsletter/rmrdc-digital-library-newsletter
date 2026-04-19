const authForm = document.getElementById('authForm');
const authStatus = document.getElementById('authStatus');
const signOutBtn = document.getElementById('signOutBtn');
const publicationForm = document.getElementById('publicationForm');
const uploadMessage = document.getElementById('uploadMessage');
const adminList = document.getElementById('adminList');

function setNotice(message, isError = false) {
  uploadMessage.textContent = message;
  uploadMessage.classList.remove('hidden');
  uploadMessage.style.background = isError ? '#ffe6e6' : '#eef3fb';
  uploadMessage.style.color = isError ? '#8c1d1d' : '#132238';
}

async function getProfileRole(userId) {
  const { data, error } = await window.db
    .from('profiles')
    .select('role, full_name')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

async function refreshAuthUI() {
  if (!window.db) {
    authStatus.textContent = 'Update ../js/config.js with your Supabase credentials.';
    return;
  }
  const { data: { session } } = await window.db.auth.getSession();
  if (!session?.user) {
    authStatus.textContent = 'Not signed in.';
    signOutBtn.classList.add('hidden');
    publicationForm.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = true);
    return;
  }
  const profile = await getProfileRole(session.user.id);
  authStatus.textContent = `Signed in as ${session.user.email}${profile?.role ? ` • Role: ${profile.role}` : ''}`;
  signOutBtn.classList.remove('hidden');
  const canUpload = ['admin', 'editor'].includes(profile?.role);
  publicationForm.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = !canUpload);
  if (!canUpload) {
    setNotice('Your account is signed in, but it does not have editor or admin upload permission.', true);
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
}

async function uploadFile(bucket, file, folder) {
  const cleanName = `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
  const path = `${folder}/${cleanName}`;
  const { error } = await window.db.storage.from(bucket).upload(path, file, {
    cacheControl: '3600', upsert: false
  });
  if (error) throw error;
  const { data } = window.db.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function createPublication(formData) {
  const { error } = await window.db.from('publications').insert(formData).select().single();
  if (error) throw error;
}

async function loadRecentPublications() {
  if (!window.db) return;
  const { data, error } = await window.db
    .from('publications_with_stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    adminList.innerHTML = '<p>Could not load records.</p>';
    return;
  }

  adminList.innerHTML = '';
  if (!data?.length) {
    adminList.innerHTML = '<p>No publications yet.</p>';
    return;
  }

  data.forEach(pub => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <img src="${pub.cover_url || '../assets/placeholder-cover.svg'}" alt="${pub.title} cover">
      <div>
        <strong>${pub.title}</strong>
        <p class="muted">${pub.type || 'Publication'} • ${pub.year || 'N/A'} • ${pub.authors || 'No authors'}</p>
      </div>
      <a class="btn btn-secondary" href="../viewer.html?id=${pub.id}">Open</a>
    `;
    adminList.appendChild(row);
  });
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!window.db) return;
  await signIn(document.getElementById('email').value, document.getElementById('password').value);
});

signOutBtn.addEventListener('click', async () => {
  await window.db.auth.signOut();
  await refreshAuthUI();
});

publicationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setNotice('Uploading publication...');
  try {
    const coverFile = document.getElementById('cover').files[0];
    const pdfFile = document.getElementById('pdf').files[0];
    if (!coverFile || !pdfFile) throw new Error('Both cover image and PDF are required.');

    const coverUrl = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_COVERS, coverFile, 'covers');
    const pdfUrl = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, pdfFile, 'documents');

    const payload = {
      title: document.getElementById('title').value.trim(),
      authors: document.getElementById('authors').value.trim(),
      type: document.getElementById('type').value.trim(),
      year: Number(document.getElementById('year').value),
      abstract: document.getElementById('abstract').value.trim(),
      cover_url: coverUrl,
      pdf_url: pdfUrl
    };

    await createPublication(payload);
    publicationForm.reset();
    setNotice('Publication uploaded successfully.');
    await loadRecentPublications();
  } catch (error) {
    console.error(error);
    setNotice(error.message || 'Upload failed.', true);
  }
});

(async function init() {
  if (!window.db) return;
  await refreshAuthUI();
  await loadRecentPublications();
})();
