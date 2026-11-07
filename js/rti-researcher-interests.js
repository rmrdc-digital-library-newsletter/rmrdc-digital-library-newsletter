(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cache={};
  function ensureModal(){
    if(document.getElementById('rtiInvestorInterestModal')) return document.getElementById('rtiInvestorInterestModal');
    const m=document.createElement('div');m.id='rtiInvestorInterestModal';m.className='modal-backdrop hidden';
    m.innerHTML=`<div class="modal compact-request-modal rti-investor-interest-modal"><div class="modal-head"><div><strong>Investor Interest</strong><div class="modal-kicker">RMRDC-approved technology engagement</div></div><button class="modal-close" type="button" id="rtiInvestorInterestClose">×</button></div><div class="request-body"><div id="rtiInvestorInterestContent"></div><div class="request-actions"><button class="outline-btn" type="button" id="rtiInvestorInterestDismiss">Close</button><button class="primary-btn" type="button" id="rtiInvestorDealRoom">Open Deal Room</button></div></div></div>`;
    document.body.appendChild(m);
    const close=()=>m.classList.add('hidden');m.querySelector('#rtiInvestorInterestClose').onclick=close;m.querySelector('#rtiInvestorInterestDismiss').onclick=close;
    m.querySelector('#rtiInvestorDealRoom').onclick=()=>{const id=m.dataset.requestId;if(id)window.rtiResearcherDeal(id)};
    return m;
  }
  function showInterest(id){
    const x=cache[id];if(!x)return;
    const m=ensureModal();
    m.dataset.requestId=id;
    m.querySelector('#rtiInvestorInterestContent').innerHTML=`<div class="rti-interest-hero"><div class="rti-interest-avatar">${esc((x.investor_name||'I').trim().split(/\s+/).map(v=>v[0]).slice(0,2).join('').toUpperCase())}</div><div><span class="rti-badge">RMRDC APPROVED</span><h3>${esc(x.investor_name||'Investor')}</h3><p>${esc(x.organisation||'Organisation not provided')}</p></div></div><div class="rti-interest-grid"><div><small>Technology</small><strong>${esc(x.technology_title||'Technology')}</strong></div><div><small>Email</small><strong>${esc(x.contact_email||'Controlled until engagement')}</strong></div><div><small>Phone</small><strong>${esc(x.phone||'Controlled until engagement')}</strong></div><div><small>Interest</small><strong>${esc(x.interest_type||'Expression of interest')}</strong></div><div><small>Preferred next step</small><strong>${esc(x.preferred_next_step||'RMRDC review')}</strong></div><div><small>Status</small><strong>${esc(x.status||'approved')}</strong></div></div><div class="rti-interest-note"><strong>Engagement</strong><p>RMRDC has approved this investor interest. Use the Deal Room to continue controlled discussions, due diligence and commercialisation activities.</p></div>`;
    m.querySelector('#rtiInvestorDealRoom').disabled=!x.opportunity_id;
    m.querySelector('#rtiInvestorDealRoom').title=x.opportunity_id?'Open controlled Deal Room':'RMRDC must assign the technology opportunity before Deal Room access is enabled';
    m.classList.remove('hidden');
  }
  async function load(){
    const anchor=document.getElementById('rti-network')||document.getElementById('technologies')||document.querySelector('.portal-content');if(!anchor||document.getElementById('rtiApprovedInvestorPanel'))return;
    const sec=document.createElement('section');sec.className='panel';sec.id='investors';sec.dataset.rtiInvestorPanel='true';
    sec.innerHTML='<div class="panel-head"><div><h3>Interested Investors</h3><p>RMRDC-approved investor interests in your technologies.</p></div><span class="rti-badge">RMRDC APPROVED</span></div><div class="panel-body"><div id="rtiRIState">Loading…</div><div class="table-wrap"><table class="portal-table" id="rtiRITable" style="display:none"><thead><tr><th>Investor</th><th>Technology</th><th>Interest</th><th>Next step</th><th>Status</th><th>Engagement</th></tr></thead><tbody></tbody></table></div></div>';
    if(anchor.id==='rti-network'||anchor.id==='technologies') anchor.parentNode.insertBefore(sec,anchor); else anchor.appendChild(sec);
    try{
      const u=await db.auth.getUser();if(!u?.data?.user){document.getElementById('rtiRIState').textContent='Please sign in.';return;}
      const q=await db.from('investor_requests').select('id,technology_title,investor_name,organisation,contact_email,phone,interest_type,preferred_next_step,status,opportunity_id').eq('researcher_user_id',u.data.user.id).in('status',['approved','submitted_to_investor','viewed','investor_interested','engagement','deal']).order('created_at',{ascending:false});
      if(q.error)throw q.error;if(!q.data?.length){document.getElementById('rtiRIState').textContent='No approved investor interests yet.';return;}
      q.data.forEach(x=>cache[x.id]=x);document.getElementById('rtiRIState').style.display='none';const table=document.getElementById('rtiRITable');table.style.display='table';
      table.querySelector('tbody').innerHTML=q.data.map(x=>`<tr><td><strong>${esc(x.investor_name||'Investor')}</strong><br><small>${esc(x.organisation||'')}</small></td><td><strong>${esc(x.technology_title||'Technology')}</strong></td><td>${esc(x.interest_type||'')}</td><td>${esc(x.preferred_next_step||'')}</td><td><span class="pill green">${esc(x.status)}</span></td><td><button type="button" class="outline-btn small-btn rti-view-interest" data-interest-id="${esc(x.id)}">View Interest</button>${x.opportunity_id?` <button type="button" class="primary-btn small-btn rti-deal-room" data-interest-id="${esc(x.id)}">Deal Room</button>`:''}</td></tr>`).join('');
    }catch(e){document.getElementById('rtiRIState').textContent=e.message||'Unable to load investor interests.'}
  }
  window.rtiViewInvestorInterest=showInterest;
  document.addEventListener('click',e=>{const v=e.target.closest('.rti-view-interest');if(v){e.preventDefault();showInterest(v.dataset.interestId);return;}const d=e.target.closest('.rti-deal-room');if(d){e.preventDefault();window.rtiResearcherDeal(d.dataset.interestId);}});
  window.rtiResearcherDeal=async function(id){try{const q=await db.from('investor_requests').select('id,opportunity_id,investor_user_id,researcher_user_id,status').eq('id',id).single();if(q.error)throw q.error;if(!['approved','submitted_to_investor','viewed','investor_interested','engagement','deal'].includes(q.data.status))throw new Error('Deal Room access is only available after RMRDC approval.');if(!q.data.opportunity_id)throw new Error('RMRDC must assign the technology opportunity before opening the Deal Room.');const ex=await db.from('dealrooms').select('id').eq('opportunity_id',q.data.opportunity_id).eq('investor_user_id',q.data.investor_user_id).limit(1);if(ex.data?.length){location.href='dealroom-researcher.html?id='+ex.data[0].id;return}const d=await db.from('dealrooms').insert({opportunity_id:q.data.opportunity_id,investor_user_id:q.data.investor_user_id,researcher_user_id:q.data.researcher_user_id,stage:'investor_interested'}).select('id').single();if(d.error)throw d.error;location.href='dealroom-researcher.html?id='+d.data.id}catch(e){alert(e.message)}};
  document.addEventListener('DOMContentLoaded',load);
})();
