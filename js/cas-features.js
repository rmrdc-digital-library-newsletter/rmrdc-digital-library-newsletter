const CAS_PROFILE_KEY='rmrdc_cas_profile';
function getCasProfile(){ try { return JSON.parse(localStorage.getItem(CAS_PROFILE_KEY)||'null'); } catch { return null; } }
function txt(v=''){ return String(v).toLowerCase(); }
function matchPub(pub, interests){
  const hay = txt([pub.title,pub.authors,pub.abstract,pub.type,pub.year,pub.isbn,pub.doi,...(pub.research_areas||[])].join(' '));
  return interests.some(i => hay.includes(txt(i)));
}
function recCard(pub){
  return `<article class="publication-card card lift"><a class="cover-link" href="viewer.html?id=${encodeURIComponent(pub.id)}"><div class="cover-wrap"><img class="cover-image" src="${pub.cover_url || 'assets/placeholder-cover.svg'}" alt="${pub.title} cover" /></div><div class="card-body"><span class="pill type-pill">${pub.type || 'Publication'}</span><h3 class="pub-title">${pub.title || 'Untitled publication'}</h3><p class="pub-meta">${pub.year || 'N/A'}${pub.authors ? ' • '+pub.authors : ''}</p></div></a></article>`;
}
async function loadPersonalRecommendations(){
  const grid=document.getElementById('recommendationsGrid'), hint=document.getElementById('recommendationHint');
  if(!grid || !hint) return;
  const profile=getCasProfile();
  if(!profile?.research_areas?.length){ hint.textContent='Subscribe and select research interests to receive personalized CAS/SDI recommendations.'; grid.innerHTML=''; return; }
  if(!window.db){ hint.textContent='Supabase is not connected. Recommendations need database access.'; return; }
  const {data,error}=await window.db.from('publications_with_stats').select('*').order('created_at',{ascending:false}).limit(60);
  if(error){ console.error(error); hint.textContent='Could not load recommendations.'; return; }
  const matches=(data||[]).filter(pub=>matchPub(pub, profile.research_areas)).slice(0,4);
  hint.textContent = matches.length ? `Showing recommendations for: ${profile.research_areas.join(', ')}` : 'No matching recommendations yet. Try updating your interests.';
  grid.innerHTML = matches.map(recCard).join('');
}
window.addEventListener('load', loadPersonalRecommendations);