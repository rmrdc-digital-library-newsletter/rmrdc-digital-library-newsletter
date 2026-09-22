/* RMRDC Research-to-Industry engagement layer */
(function(){
  const $=s=>document.querySelector(s);
  async function user(){try{return (await window.db?.auth.getUser())?.data?.user||null}catch(e){return null}}
  async function subscribed(){try{return await window.RMRDCWorkflow.activeSubscription()}catch(e){return false}}
  async function submitInvestorRequest(type, opportunityId, message, items){
    const u=await user(); if(!u) throw new Error('Please sign in before submitting an engagement request.');
    const payload={investor_user_id:u.id, opportunity_id:opportunityId||null, request_type:type, message:message||null, requested_items:items||[]};
    const r=await window.db.from('investor_requests').insert(payload); if(r.error) throw r.error; return r;
  }
  async function requestFabrication(opportunityId, requirements){
    const u=await user(); if(!u) throw new Error('Please sign in before requesting fabrication support.');
    const r=await window.db.from('fabrication_requests').insert({opportunity_id:opportunityId||null,requester_user_id:u.id,request_type:'fabrication',requirements:requirements||'Engineering/fabrication support requested'});
    if(r.error) throw r.error; return r;
  }
  async function openDealRoom(opportunityId){
    const u=await user(); if(!u) throw new Error('Please sign in before opening a Deal Room.');
    const r=await window.db.from('dealrooms').insert({opportunity_id:opportunityId,investor_user_id:u.id,stage:'investor_interested'}).select('id').single();
    if(r.error) throw r.error; return r.data;
  }
  function toast(msg){
    let t=$('#rtiToast'); if(!t){t=document.createElement('div');t.id='rtiToast';t.style.cssText='position:fixed;right:24px;bottom:24px;z-index:9999;background:#123b2a;color:#fff;padding:14px 18px;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);font-size:14px;max-width:380px';document.body.appendChild(t)}
    t.textContent=msg;t.style.display='block';clearTimeout(window.__rtiToast);window.__rtiToast=setTimeout(()=>t.style.display='none',4200);
  }
  function lockCards(root, active){
    root.querySelectorAll('[data-rti-premium]').forEach(el=>{
      if(active){el.classList.remove('rti-locked');el.removeAttribute('aria-label');}
      else{el.classList.add('rti-locked');el.setAttribute('aria-label','Subscriber information locked');}
    });
  }
  window.RTIEngagement={user,subscribed,submitInvestorRequest,requestFabrication,openDealRoom,toast,lockCards};
})();
