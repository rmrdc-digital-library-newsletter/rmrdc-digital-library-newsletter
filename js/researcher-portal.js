/* RMRDC Researcher Portal personalization — database aligned */
(function(){
  let currentUserId = null;
  let liveChannel = null;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  async function getProfile(){
    if(window.db){try{const identity=await window.RMRDCAuth?.getPlatformIdentity();if(identity){currentUserId=identity.user.id;const detail=identity.detail||{};return {role:identity.role,full_name:identity.baseProfile?.full_name,organisation:identity.baseProfile?.organisation,location:detail.location||'',interests:identity.baseProfile?.research_areas||[],role_data:detail,email:identity.user.email};}}catch(e){console.warn('Researcher profile lookup failed',e)}}
    return null;
  }
  const firstName=n=>String(n||'').trim().split(/\s+/)[0]||'Researcher';
  const initials=n=>(String(n||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('')||'R').toUpperCase();
  async function personalize(){const p=await getProfile();if(!p)return;const name=p.full_name||p.email||'Researcher';document.querySelectorAll('.profile-menu strong').forEach(el=>el.textContent=name);document.querySelectorAll('.profile-menu .avatar').forEach(el=>el.textContent=initials(name));document.querySelectorAll('.welcome-row h2').forEach(el=>el.textContent=`Welcome back, ${firstName(name)}! 👋`);document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=name);document.querySelectorAll('[data-user-organisation]').forEach(el=>el.textContent=p.organisation||'');}
  const fieldValue=(modal,label)=>{const field=[...modal.querySelectorAll('.form-field')].find(x=>(x.querySelector('label')?.textContent||'').trim().toLowerCase().includes(label));return field?.querySelector('input,textarea,select')?.value?.trim()||'';};
  const listValue=value=>value.split(',').map(x=>x.trim()).filter(Boolean);
  async function submitTechnology(modal){
    const user=await window.db?.auth.getUser();
    if(!user?.data?.user)throw new Error('Please sign in before submitting a technology.');
    const title=fieldValue(modal,'technology title');
    if(!title)throw new Error('Technology title is required.');
    const trlText=fieldValue(modal,'technology readiness level');
    const trlMatch=trlText.match(/TRL\s+(\d+)/i);
    const payload={title,sector:fieldValue(modal,'industrial sector'),trl:trlMatch?Number(trlMatch[1]):null,short_summary:fieldValue(modal,'problem solved'),problem_addressed:fieldValue(modal,'problem solved'),technical_specifications:fieldValue(modal,'machinery / equipment'),raw_materials:listValue(fieldValue(modal,'raw materials required')),raw_material_locations:listValue(fieldValue(modal,'states / locations')),raw_material_availability:fieldValue(modal,'availability'),production_cost:Number(fieldValue(modal,'estimated production cost').replace(/[^0-9.]/g,''))||null,estimated_investment:Number(fieldValue(modal,'capital required').replace(/[^0-9.]/g,''))||null,market_size:Number(fieldValue(modal,'market size').replace(/[^0-9.]/g,''))||null,patent_ip_status:fieldValue(modal,'ip / patent status'),engagement_models:listValue(fieldValue(modal,'engagement preferences')),researcher_name:fieldValue(modal,'principal investigator'),created_by:user.data.user.id,visibility:'under_review'};
    const {data,error}=await window.db.from('technology_opportunities').insert(payload).select('id').single();
    if(error)throw error;
    await window.db.functions.invoke('notify-technology-workflow',{body:{event:'submitted',opportunity_id:data.id}}).catch(error=>console.warn('Staff email notification failed',error));
    return data;
  }
  async function loadResearcherData(){
    if(!window.db||!currentUserId)return;
    const [opportunitiesResult, interestsResult, viewsResult] = await Promise.all([
      window.db.from('technology_opportunities').select('id,title,sector,trl,visibility,created_at,updated_at').eq('created_by',currentUserId).order('created_at',{ascending:false}),
      window.db.from('researcher_investor_interests').select('id,status,created_at').eq('researcher_user_id',currentUserId),
      window.db.from('view_events').select('*',{count:'exact',head:true})
    ]);
    if(opportunitiesResult.error)throw opportunitiesResult.error;
    if(interestsResult.error && interestsResult.error.code!=='42P01')throw interestsResult.error;
    if(viewsResult.error)throw viewsResult.error;
    const opportunities=opportunitiesResult.data||[];
    const interests=interestsResult.data||[];
    const published=opportunities.filter(item=>item.visibility==='approved').length;
    const underReview=opportunities.filter(item=>item.visibility==='under_review').length;
    document.getElementById('researcherSubmissionCount').textContent=opportunities.length.toLocaleString();
    document.getElementById('researcherSubmissionHint').textContent=`${published} Published • ${underReview} Under Review`;
    document.getElementById('researcherViewCount').textContent=(viewsResult.count||0).toLocaleString();
    document.getElementById('researcherInterestCount').textContent=interests.length.toLocaleString();
    document.getElementById('researcherOpportunityCount').textContent=opportunities.filter(item=>item.visibility==='approved').length.toLocaleString();
    renderTechnologies(opportunities);
  }
  function subscribeToResearcherChanges(){
    if(!window.db||!currentUserId)return;
    liveChannel=window.db.channel(`researcher-portal-${currentUserId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'technology_opportunities',filter:`created_by=eq.${currentUserId}`},()=>loadResearcherData().catch(console.warn))
      .on('postgres_changes',{event:'*',schema:'public',table:'researcher_investor_interests',filter:`researcher_user_id=eq.${currentUserId}`},()=>loadResearcherData().catch(console.warn))
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'view_events'},()=>loadResearcherData().catch(console.warn))
      .subscribe();
  }
  function renderTechnologies(items){
    const rows=document.getElementById('techRows');if(!rows)return;
    if(!items.length){rows.innerHTML='<tr><td colspan="7">No technologies have been submitted from this account yet.</td></tr>';return;}
    rows.innerHTML=items.map(item=>{const status=item.visibility==='approved'?'Published':item.visibility==='under_review'?'Under Review':item.visibility||'Draft';return `<tr data-status="${escapeHtml(status)}"><td><div class="tech-cell"><div class="tech-thumb"></div><div><div class="tech-title">${escapeHtml(item.title)}</div><div class="tech-sub">${escapeHtml(item.sector||'Research technology')}</div></div></div></td><td><span class="pill green">${item.trl?`TRL ${escapeHtml(item.trl)}`:'Not set'}</span></td><td><span class="pill ${status==='Published'?'green':'blue'}"><i class="dot"></i>${escapeHtml(status)}</span></td><td>—</td><td>—</td><td>${escapeHtml(new Date(item.created_at).toLocaleDateString())}</td><td><a class="ghost-btn" href="intelligence.html?id=${encodeURIComponent(item.id)}">View</a></td></tr>`;}).join('');
  }
  function bindSubmission(){const modal=document.getElementById('researchModal');if(!modal)return;const submit=[...modal.querySelectorAll('button')].find(x=>x.textContent.trim().toLowerCase()==='submit for review');if(!submit)return;submit.addEventListener('click',async event=>{event.preventDefault();if(submit.disabled)return;submit.disabled=true;try{await submitTechnology(modal);closeResearchModal();await loadResearcherData();if(typeof showToast==='function')showToast('Technology submitted to RMRDC for approval.');}catch(error){alert(error.message||'Unable to submit technology.');}finally{submit.disabled=false;}});}
  document.addEventListener('DOMContentLoaded',async()=>{const profile=await getProfile();if(!profile)return;personalize();bindSubmission();try{await loadResearcherData();subscribeToResearcherChanges();}catch(error){console.error('Researcher data lookup failed',error);document.getElementById('researcherSubmissionHint').textContent='Unable to load live data.';}});
})();
