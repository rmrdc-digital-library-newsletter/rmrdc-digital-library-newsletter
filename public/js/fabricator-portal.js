(function(){
  const normalizeAreas=value=>{
    if(Array.isArray(value)) return value;
    if(typeof value==='string') return value.split(/[,;]/).map(item=>item.trim()).filter(Boolean);
    return [];
  };

  async function personalize(){
    const table=document.querySelector('table.portal-table');
    if(!table)return;
    let profile=null;
    try{
      const identity=await window.RMRDCAuth?.getPlatformIdentity();
      if(identity){
        profile={
          interests:[
            ...normalizeAreas(identity.baseProfile?.research_areas),
            ...normalizeAreas(identity.baseProfile?.interests),
            ...normalizeAreas(identity.detail?.specialisations),
            ...normalizeAreas(identity.detail?.equipment),
            ...normalizeAreas(identity.detail?.services_offered),
            ...normalizeAreas(identity.user?.user_metadata?.interests)
          ],
          location:identity.detail?.geographic_coverage||identity.baseProfile?.location||''
        };
      }
    }catch(error){console.warn('Fabricator profile lookup failed:',error)}

    const headers=[...table.querySelectorAll('thead th')];
    const matchColumn=headers.findIndex(header=>header.textContent.toLowerCase().includes('match'));
    if(matchColumn<0)return;
    let matched=0;
    [...table.querySelectorAll('tbody tr')].forEach(row=>{
      const texts=[...row.cells].map(cell=>cell.textContent||'').join(' ').toLowerCase();
      const interests=[...new Set((profile?.interests||[]).map(String))];
      const score=interests.length?interests.filter(interest=>texts.includes(interest.toLowerCase())).length/interests.length*100:0;
      const existing=Number(String(row.cells[matchColumn]?.textContent||'').replace(/\D/g,''));
      const finalScore=Math.max(existing||0,Math.round(score));
      if(row.cells[matchColumn]){
        row.cells[matchColumn].innerHTML=`<span class="pill ${finalScore>=85?'green':finalScore>=70?'blue':'gray'}">${finalScore}%</span>`;
        if(interests.length) row.cells[matchColumn].title=`Matched to: ${interests.filter(interest=>texts.includes(interest.toLowerCase())).join(', ') || 'curated opportunity'}`;
      }
      if(finalScore>=70)matched++;
    });
    const stat=document.querySelector('.stats-row .stat-card strong');
    if(stat && profile?.interests?.length)stat.textContent=String(matched);
  }
  document.addEventListener('DOMContentLoaded',personalize);
})();
