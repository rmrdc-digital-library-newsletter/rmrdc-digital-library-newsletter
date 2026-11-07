/* RMRDC v3.4.6 — complete investor approval -> researcher -> Deal Room workflow */
(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current={title:'',opportunityId:null,demoFree:false};
  function findRow(title){return [...document.querySelectorAll('#opportunityRows tr')].find(r=>(r.querySelector('.tech-title')?.textContent||'').trim()===String(title).trim());}
  async function openOpportunity(title){
    const row=findRow(title); current={title,opportunityId:row?.dataset.opportunityId||null,demoFree:row?.dataset.demoFree==='true'};
    window.__currentOpportunityId=current.opportunityId;window.__currentOpportunityDemoFree=current.demoFree;
    const modal=document.getElementById('opportunityModal'); if(!modal)return;
    const h=document.getElementById('oppHeroTitle'); if(h)h.textContent=title; const t=document.getElementById('oppTitle');if(t)t.textContent=title;
    modal.classList.remove('hidden');
    let active=current.demoFree; if(!active) active=await window.RMRDCWorkflow?.activeSubscription?.()||false;
    applyModalAccess(modal,active,current.demoFree);
    const hero=document.getElementById('investorHeroExpressInterest'); if(hero){hero.onclick=()=>window.rtiOpenEOI(title,current.opportunityId,{demoFree:current.demoFree});}
  }
  function applyModalAccess(modal,active,demo){
    modal.querySelector('.rti-modal-lock')?.remove();
    modal.querySelectorAll('.rti-disabled-tab').forEach(b=>{b.disabled=false;b.classList.remove('rti-disabled-tab')});
    const body=modal.querySelector('.modal-body'); if(!body)return;
    if(active)return;
    const lock=document.createElement('div');lock.className='rti-modal-lock';lock.innerHTML='<div class="rti-lock-card"><div class="rti-lock-icon">🔒</div><span class="rti-badge">SUBSCRIBER INTELLIGENCE</span><h3>Unlock the full opportunity profile</h3><p>Free access lets you understand the opportunity. Subscribe to unlock the available technical specifications, production economics, market intelligence, raw-material and supply-chain information, IP details, commercialisation evidence and structured RMRDC engagement.</p><div class="rti-lock-grid"><span>Technical & production intelligence</span><span>Market & investment intelligence</span><span>Raw-material & supply-chain data</span><span>IP, regulatory & commercialisation information</span></div><a class="primary-btn" href="subscribe.html">Subscribe for full access</a></div>';
    body.appendChild(lock);
    body.querySelectorAll('.intel-tabs button:not(:first-child)').forEach(b=>{b.disabled=true;b.classList.add('rti-disabled-tab')});
    body.querySelectorAll('.intel-pane:not(:first-of-type)').forEach(p=>p.style.display='none');
    const first=body.querySelector('#intel-tech'); if(first)first.style.filter='blur(1.8px)';
  }
  function injectResearcherPanel(){
    if(document.getElementById('rtiInvestorInterestPanel'))return;
    const anchor=document.getElementById('rti-network'); if(!anchor)return;
    const sec=document.createElement('section');sec.className='panel';sec.id='rtiInvestorInterestPanel';sec.innerHTML='<div class="panel-head"><div><h3>Interested Investors</h3><p>Investor expressions of interest approved by RMRDC for your technologies.</p></div><span class="rti-badge">RMRDC APPROVED ENGAGEMENT</span></div><div class="panel-body"><div id="rtiResearcherInterestState" class="rti-empty">Loading approved investor interests…</div><div class="table-wrap"><table class="portal-table" id="rtiResearcherInterestTable" style="display:none"><thead><tr><th>Technology</th><th>Investor Name</th><th>Interest</th><th>Next Step</th><th>Status</th><th>Action</th></tr></thead><tbody></tbody></table></div></div>';
    anchor.parentNode.insertBefore(sec,anchor);
    loadResearcherInterests();
  }
  async function loadResearcherInterests(){
    const state=document.getElementById('rtiResearcherInterestState'),table=document.getElementById('rtiResearcherInterestTable'),tb=table?.querySelector('tbody');
    try{const u=await window.db?.auth.getUser();if(!u?.data?.user){state.textContent='Sign in to view approved investor interests.';return;}
      const {data,error}=await window.db.from('investor_requests').select('id,technology_title,investor_name,organisation,interest_type,preferred_next_step,status,created_at,opportunity_id').eq('researcher_user_id',u.data.user.id).in('status',['approved','submitted_to_investor','viewed','investor_interested','engagement','deal']).order('created_at',{ascending:false});if(error)throw error;
      if(!data?.length){state.textContent='No approved investor interests yet.';return;} state.classList.add('hidden');table.style.display='table';tb.innerHTML=data.map(x=>`<tr><td><strong>${esc(x.technology_title||'Technology')}</strong></td><td><strong>${esc(x.investor_name||'Investor')}</strong><br><small>${esc(x.organisation||'')}</small></td><td>${esc(x.interest_type||'Expression of Interest')}</td><td>${esc(x.preferred_next_step||'RMRDC review')}</td><td><span class="pill green">${esc(x.status)}</span></td><td><button class="primary-btn small-btn" onclick="rtiResearcherOpenDeal('${esc(x.id)}','${esc(x.opportunity_id||'')}')">Open Deal Room</button></td></tr>`).join('');
    }catch(e){state.textContent=e?.message||'Unable to load investor interests.'}
  }
  window.rtiResearcherOpenDeal=async function(requestId,oppId){try{const u=await window.db.auth.getUser();if(!u?.data?.user)throw new Error('Please sign in.');const {data:req,error:re}=await window.db.from('investor_requests').select('id,opportunity_id,investor_user_id,researcher_user_id,status,technology_title').eq('id',requestId).single();if(re)throw re;if(!['approved','submitted_to_investor','viewed','investor_interested','engagement','deal'].includes(req.status))throw new Error('Deal Room access is available only after RMRDC approval.');if(!req.opportunity_id)throw new Error('RMRDC must assign this engagement to a technology opportunity before a Deal Room can be opened.');const {data:existing}=await window.db.from('dealrooms').select('id').eq('opportunity_id',req.opportunity_id).eq('investor_user_id',req.investor_user_id).limit(1);if(existing?.length){location.href='dealroom-researcher.html?id='+existing[0].id;return;}const {data,error}=await window.db.from('dealrooms').insert({opportunity_id:req.opportunity_id,investor_user_id:req.investor_user_id,researcher_user_id:req.researcher_user_id,stage:'investor_interested'}).select('id').single();if(error)throw error;location.href='dealroom-researcher.html?id='+data.id}catch(e){alert(e.message)}};
  function ensureDemoBadge(row){if(row&&!row.querySelector('.rti-demo-badge')){const cell=row.querySelector('.tech-title')?.parentElement;if(cell)cell.insertAdjacentHTML('beforeend','<span class="rti-demo-badge">Free demo access</span>')}}
  document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('#opportunityRows tr[data-demo-free="true"]').forEach(ensureDemoBadge);});
  window.openOpportunity=openOpportunity;
})();
