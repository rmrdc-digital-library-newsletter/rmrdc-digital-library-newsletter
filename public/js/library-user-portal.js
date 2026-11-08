(function(){
  const SAVED_KEY='rmrdc_saved_publications';
  const HISTORY_KEY='rmrdc_reading_history';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const localList=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
  const setLocal=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(error){console.warn('Could not cache library activity:',error)}};
  const initials=name=>(String(name||'Library User').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('')||'LU').toUpperCase();
  const card=(pub,kind)=>`<article class="library-publication"><div class="library-publication-cover">${pub.cover_url?`<img src="${esc(pub.cover_url)}" alt="" style="width:100%;height:100%;object-fit:cover">`:'RMRDC'}</div><div class="library-publication-body"><span class="library-pill">${esc(pub.type||'Publication')}</span><h4>${esc(pub.title||'Untitled publication')}</h4><p>${esc(pub.year||'Research record')}${pub.authors?` | ${esc(pub.authors)}`:''}</p><a href="viewer.html?id=${encodeURIComponent(pub.id||'')}">Open publication</a>${kind==='saved'?`<button type="button" class="library-inline-action" data-remove-saved="${esc(pub.id)}">Remove from saved</button>`:''}</div></article>`;
  const render=(id,items,empty,kind)=>{const root=document.getElementById(id);if(root)root.innerHTML=items.length?items.map(item=>card(item,kind)).join(''):`<p class="library-empty">${empty}</p>`};
  const getCount=()=>Number(document.getElementById('alertCount')?.textContent||0);
  function updateAlertCount(count){['alertCount','alertBadge','headerAlertBadge'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=String(count)})}
  function cacheCompact(rows,key,dateField){setLocal(key,rows.map(row=>({...row,[dateField]:row[dateField]||new Date().toISOString()})).slice(0,100))}
  async function loadActivity(userId){
    const savedFallback=localList(SAVED_KEY),historyFallback=localList(HISTORY_KEY);
    if(!window.db||!userId){render('savedGrid',savedFallback,'No saved publications yet.','saved');render('historyGrid',historyFallback,'No reading history yet.');return}
    const [savedResult,historyResult]=await Promise.all([
      window.db.from('saved_publications').select('publication_id,saved_at,publications(id,title,authors,type,year,cover_url,abstract,research_areas)').eq('reader_id',userId).order('saved_at',{ascending:false}).limit(100),
      window.db.from('reading_history').select('publication_id,viewed_at,publications(id,title,authors,type,year,cover_url,abstract,research_areas)').eq('reader_id',userId).order('viewed_at',{ascending:false}).limit(100)
    ]);
    const normalize=(rows,dateField)=>rows.map(row=>({...row.publications,id:row.publications?.id||row.publication_id,[dateField]:row[dateField]})).filter(row=>row.id);
    if(savedResult.error){console.warn('Could not load saved publications:',savedResult.error.message);render('savedGrid',savedFallback,'No saved publications yet.','saved')}else{const saved=normalize(savedResult.data||[],'saved_at');cacheCompact(saved,SAVED_KEY,'saved_at');render('savedGrid',saved,'No saved publications yet.','saved')}
    if(historyResult.error){console.warn('Could not load reading history:',historyResult.error.message);render('historyGrid',historyFallback,'No reading history yet.')}else{const history=normalize(historyResult.data||[],'viewed_at');cacheCompact(history,HISTORY_KEY,'viewed_at');render('historyGrid',history,'No reading history yet.')}
    const s=document.getElementById('savedCount');if(s)s.textContent=savedResult.error?savedFallback.length:String(savedResult.data?.length||0);
    const h=document.getElementById('historyCount');if(h)h.textContent=historyResult.error?historyFallback.length:String(historyResult.data?.length||0);
  }
  async function loadAlerts(userId){
    const root=document.getElementById('alertsList');if(!root)return;
    if(!window.db||!userId){root.innerHTML='<li class="library-empty">Sign in to receive personal library alerts.</li>';updateAlertCount(0);return}
    const {data,error}=await window.db.from('platform_notifications').select('id,title,message,created_at,read_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(20);
    if(error){console.warn('Could not load alerts:',error.message);root.innerHTML='<li class="library-empty">Alerts could not be loaded. Refresh to try again.</li>';return}
    const list=data||[],unread=list.filter(item=>!item.read_at).length;updateAlertCount(unread);
    const actions=unread?'<li class="library-alert-tools"><button type="button" class="library-inline-action" data-mark-all-alerts>Mark all as read</button></li>':'';
    root.innerHTML=actions+ (list.length?list.map(item=>`<li class="library-alert${item.read_at?' is-read':''}"><div class="library-alert-icon">${item.read_at?'✓':'!'}</div><div class="library-alert-copy"><strong>${esc(item.title||'Library update')}</strong><span>${esc(item.message||'')}<br>${item.created_at?esc(new Date(item.created_at).toLocaleDateString()):''}</span>${!item.read_at?`<button type="button" class="library-inline-action" data-mark-alert="${esc(item.id)}">Mark as read</button>`:''}</div></li>`).join(''):'<li class="library-empty">No current alerts.</li>');
  }
  async function initialize(){
    let identity=null;try{identity=await window.RMRDCAuth?.getPlatformIdentity()}catch(error){console.warn('Could not load library account:',error)}
    const name=identity?.baseProfile?.full_name||identity?.user?.email||'Library User';
    document.getElementById('userName').textContent=name;document.getElementById('heroName').textContent=name;document.getElementById('userAvatar').textContent=initials(name);
    const localSaved=localList(SAVED_KEY),localHistory=localList(HISTORY_KEY);
    render('savedGrid',localSaved,'Loading your saved publications...','saved');render('historyGrid',localHistory,'Loading your reading history...');
    await loadActivity(identity?.user?.id);
    if(!window.db){document.getElementById('feedHint').textContent='Connect your library account to load recommendations.';await loadAlerts(null);return}
    const normalizeAreas=values=>{
      if(Array.isArray(values)) return values;
      if(typeof values==='string') return values.split(',').map(value=>value.trim()).filter(Boolean);
      return [];
    };
    const profileAreas=normalizeAreas(identity?.baseProfile?.research_areas).concat(normalizeAreas(identity?.baseProfile?.interests));
    const detailAreas=normalizeAreas(identity?.detail?.preferred_cas_topics).concat(normalizeAreas(identity?.detail?.subject_areas));
    const metadataAreas=normalizeAreas(identity?.user?.user_metadata?.interests);
    let interestRows=[];
    const interestResult=identity?.user?.id
      ? await window.db.from('user_interests').select('interest').eq('user_id',identity.user.id)
      : {data:null,error:null};
    if(!interestResult.error) interestRows=(interestResult.data||[]).map(row=>row.interest).filter(Boolean);
    const areas=[...profileAreas,...detailAreas,...metadataAreas,...interestRows].map(value=>String(value).trim()).filter(Boolean)
      .filter((value,index,list)=>list.findIndex(item=>item.toLowerCase()===value.toLowerCase())===index);
    let publicationResult=await window.db.from('publications_with_stats').select('id,title,authors,type,year,cover_url,research_areas,abstract').order('created_at',{ascending:false}).limit(80);
    if(publicationResult.error){
      publicationResult=await window.db.from('publications').select('id,title,authors,type,year,cover_url,research_areas,abstract').order('created_at',{ascending:false}).limit(80);
    }
    if(publicationResult.error){
      document.getElementById('feedHint').textContent='Recommendations could not be loaded. Refresh to try again.';
      console.warn('Could not load publication recommendations:',publicationResult.error.message);
      render('feedGrid',[],'No publications are available yet.');
      await loadAlerts(identity?.user?.id);
      return;
    }
    const publications=publicationResult.data||[];
    const ranked=publications.map(publication=>{
      const publicationAreas=[publication.title,publication.authors,publication.type,publication.abstract,...normalizeAreas(publication.research_areas)].filter(Boolean).join(' ').toLowerCase();
      const score=areas.reduce((total,area)=>total+(publicationAreas.includes(area.toLowerCase())?1:0),0);
      return {...publication,_score:score};
    }).sort((a,b)=>b._score-a._score||String(b.year||'').localeCompare(String(a.year||'')));
    const matched=areas.length?ranked.filter(publication=>publication._score>0).slice(0,6):[];
    const recommendations=matched.length?matched:ranked.slice(0,6);
    document.getElementById('recommendationCount').textContent=recommendations.length;
    document.getElementById('feedHint').textContent=areas.length?`Matched to: ${areas.slice(0,5).join(', ')}`:'Latest RMRDC library records';
    render('feedGrid',recommendations,'No recommended publications found yet.');
    await loadAlerts(identity?.user?.id);
  }
  document.addEventListener('click',async event=>{
    const clear=event.target.closest('[data-clear-history]');
    if(clear){const user=await (window.RMRDCUserFeatures?.getReaderId?.().catch(()=>null)||null);if(!user||!window.db){alert('Sign in to manage your reading history.');return}clear.disabled=true;const {error}=await window.db.from('reading_history').delete().eq('reader_id',user);if(error){console.warn(error.message);alert('Reading history could not be cleared. Please try again.');clear.disabled=false;return}setLocal(HISTORY_KEY,[]);await loadActivity(user);return}
    const remove=event.target.closest('[data-remove-saved]');
    if(remove){const id=remove.dataset.removeSaved;const user=await (window.RMRDCUserFeatures?.getReaderId?.().catch(()=>null)||null);if(!user||!window.db){alert('Sign in to manage your saved library.');return}remove.disabled=true;const {error}=await window.db.from('saved_publications').delete().eq('reader_id',user).eq('publication_id',id);if(error){console.warn(error.message);alert('This publication could not be removed. Please try again.');remove.disabled=false;return}const remaining=localList(SAVED_KEY).filter(pub=>pub.id!==id);setLocal(SAVED_KEY,remaining);await loadActivity(user);return}
    const mark=event.target.closest('[data-mark-alert]'),markAll=event.target.closest('[data-mark-all-alerts]');
    if(mark||markAll){const user=await (window.RMRDCUserFeatures?.getReaderId?.().catch(()=>null)||null);if(!user||!window.db)return;const button=mark||markAll;button.disabled=true;let query=window.db.from('platform_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user).is('read_at',null);if(mark)query=query.eq('id',mark.dataset.markAlert);const {error}=await query;if(error){console.warn(error.message);button.disabled=false;alert('The alert could not be updated. Please try again.');return}await loadAlerts(user)}
  });
  document.addEventListener('DOMContentLoaded',initialize);
})();
