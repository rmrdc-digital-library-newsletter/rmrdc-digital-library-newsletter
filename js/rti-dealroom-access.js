/* RMRDC v3.4.6 — Deal Room access gate */
(function(){
  async function check(){
    if(!window.db)return;
    const id=new URLSearchParams(location.search).get('id');
    const role=document.body.dataset.role;
    const main=document.querySelector('main');
    if(!id){
      const n=document.createElement('div');n.className='rti-dealroom-gate';n.innerHTML='<div><div class="rti-lock-icon">🔐</div><span class="rti-badge">CONTROLLED DEAL ROOM</span><h2>No active Deal Room</h2><p>Deal Room access becomes available after an investor expression of interest has been reviewed and approved by RMRDC.</p><a class="primary-btn" href="'+(role==='investor'?'investor-portal.html':'researcher-portal.html')+'">Return to Portal</a></div></div>';main.innerHTML=n.outerHTML;return;}
    try{const u=await db.auth.getUser();if(!u?.data?.user)return;let q=db.from('dealrooms').select('id,stage,investor_user_id,researcher_user_id,fabricator_user_id,rmrdc_representative,opportunity_id').eq('id',id).single();const {data,error}=await q;if(error||!data)throw new Error('This Deal Room is not available.');const uid=u.data.user.id;const member=[data.investor_user_id,data.researcher_user_id,data.fabricator_user_id,data.rmrdc_representative].includes(uid);if(!member)throw new Error('You are not a participant in this controlled Deal Room.');}
    catch(e){const n=document.createElement('div');n.className='rti-dealroom-gate';n.innerHTML='<div><div class="rti-lock-icon">🔐</div><span class="rti-badge">RMRDC CONTROLLED ACCESS</span><h2>Deal Room access is restricted</h2><p>'+String(e.message||'Access denied').replace(/[<>]/g,'')+'</p><a class="primary-btn" href="'+(role==='investor'?'investor-portal.html':role==='researcher'?'researcher-portal.html':'fabricator-portal.html')+'">Return to Portal</a></div></div>';main.innerHTML=n.outerHTML;}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(check,250));
})();
