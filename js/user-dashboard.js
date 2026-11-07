// semantic personalized feed enhancement
async function loadSemanticPersonalizedFeed() {
  const profile = getProfile();
  if (!profile?.research_areas?.length || !window.db) return null;

  try {
    const { data, error } = await window.db.functions.invoke('recommend-publications', {
      body: {
        interests: profile.research_areas,
        limit: 12
      }
    });
    if (error) throw error;
    return Array.isArray(data?.recommendations) ? data.recommendations : null;
  } catch (error) {
    console.warn('Semantic personalized feed unavailable:', error.message);
    return null;
  }
}

const savedGrid=document.getElementById('savedGrid'),historyGrid=document.getElementById('historyGrid'),feedGrid=document.getElementById('feedGrid'),feedHint=document.getElementById('feedHint');
function card(pub){return `<article class="publication-card card lift"><a class="cover-link" href="viewer.html?id=${encodeURIComponent(pub.id)}"><div class="cover-wrap"><img class="cover-image" src="${pub.cover_url||'assets/placeholder-cover.svg'}" alt="cover"/></div><div class="card-body"><span class="pill type-pill">${pub.type||'Publication'}</span><h3 class="pub-title">${pub.title||'Untitled publication'}</h3><p class="pub-meta">${pub.year||'N/A'}${pub.authors?' • '+pub.authors:''}</p></div></a></article>`;}
async function renderLocal() {

    // Keep reading history local for now
    const h = window.RMRDCUserFeatures.getHistory();

    // Get logged-in user
    const {
        data: { user }
    } = await window.db.auth.getUser();

    if (!user) return;

    // Load saved publications from Supabase
    const { data: saved, error } = await window.db
        .from("saved_publications_view")
        .select("*")
        .eq("reader_id", user.id)
        .order("saved_at", { ascending: false });

    if (error) {
        console.error(error);
        savedGrid.innerHTML =
            '<p class="empty card">Could not load saved publications.</p>';
    } else {
        savedGrid.innerHTML = saved.length
            ? saved.map(card).join("")
            : '<p class="empty card">No saved publications yet.</p>';
    }

    // Leave history unchanged
    historyGrid.innerHTML = h.length
        ? h.map(card).join("")
        : '<p class="empty card">No reading history yet.</p>';
}
function profile(){try{return JSON.parse(localStorage.getItem('rmrdc_platform_profile')||localStorage.getItem('rmrdc_cas_profile')||'null')}catch{return null}}
function match(pub,interests){const hay=[pub.title,pub.authors,pub.abstract,pub.type,...(pub.research_areas||[])].join(' ').toLowerCase(); return interests.some(i=>hay.includes(String(i).toLowerCase()));}
async function loadFeed(){const p=profile();const interests=p?.research_areas||p?.interests||[]; if(!interests.length){feedHint.textContent='Subscribe and select your research interests to generate a personalized feed.'; return;} if(!window.db){feedHint.textContent='Supabase is not connected.'; return;} const {data,error}=await window.db.from('publications_with_stats').select('*').order('created_at',{ascending:false}).limit(80); if(error){feedHint.textContent='Could not load personalized feed.';return;} const items=(data||[]).filter(pub=>match(pub,interests)).slice(0,12); feedHint.textContent=items.length?`Based on: ${interests.join(', ')}`:'No matching items yet.'; feedGrid.innerHTML=items.length?items.map(card).join(''):'<p class="empty card">No recommended publications found yet.</p>';}
document.querySelectorAll('.dashboard-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.dashboard-tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.querySelectorAll('.dashboard-panel').forEach(p=>p.classList.add('hidden')); document.getElementById(b.dataset.tab+'Panel').classList.remove('hidden');})); async function initializeDashboard() {
    if (!window.db) {
        const local = JSON.parse(localStorage.getItem('rmrdc_platform_profile') || 'null');
        if (local) {
            document.getElementById('dashboardUserName')?.replaceChildren(document.createTextNode(local.full_name || 'RMRDC User'));
            document.getElementById('userName')?.replaceChildren(document.createTextNode(local.full_name || 'RMRDC User'));
            document.getElementById('userRoleLabel')?.replaceChildren(document.createTextNode(`${local.role.replace('_',' ')} workspace`));
        }
        return;
    }
    const { data: { user }, error } = await window.db.auth.getUser();
    if (error || !user) { window.location.href = 'login.html'; return; }

    const identity = await window.RMRDCAuth?.getPlatformIdentity();
    if (!identity) { window.location.href = 'login.html'; return; }
    const name = identity.baseProfile?.full_name || user.email;
    const role = identity.role || 'library_user';
    const labels={researcher:'Your Research Intelligence',investor:'Your Investment Opportunities',library_user:'Your Research Alerts',fabricator:'Your Technology Equipment Opportunities'};
    document.getElementById('dashboardUserName')?.replaceChildren(document.createTextNode(name));
    document.getElementById('userName')?.replaceChildren(document.createTextNode(name));
    document.getElementById('userRoleLabel')?.replaceChildren(document.createTextNode(labels[role] || 'Your RMRDC Intelligence Workspace'));
    localStorage.setItem('rmrdc_platform_profile',JSON.stringify({...(JSON.parse(localStorage.getItem('rmrdc_platform_profile')||'{}')),full_name:name,role,research_areas:identity.baseProfile?.research_areas||[],interests:identity.baseProfile?.research_areas||[]}));
    renderLocal();
    await loadFeed();
}
initializeDashboard();
