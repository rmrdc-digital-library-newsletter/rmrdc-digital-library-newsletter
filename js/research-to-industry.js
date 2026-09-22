/* RMRDC Research-to-Industry v3 workflow */
(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function currentUser(){ if(!window.db) return null; const {data}=await window.db.auth.getUser(); return data?.user||null; }
  async function activeSubscription(){
    const u=await currentUser(); if(!u) return false;
    try{ const {data}=await window.db.from('platform_subscriptions').select('id').eq('user_id',u.id).eq('status','active').or('ends_at.is.null,ends_at.gt.'+new Date().toISOString()).limit(1); return !!data?.length; }catch(e){ return false; }
  }
  async function markViewed(opportunityId){
    const u=await currentUser(); if(!u||!window.db) return;
    await window.db.from('technology_investor_submissions').update({status:'viewed',viewed_at:new Date().toISOString()}).eq('opportunity_id',opportunityId).eq('investor_user_id',u.id).eq('status','submitted');
  }
  async function createRequest(type, opportunityId, message, items){
    const u=await currentUser(); if(!u) throw new Error('Please sign in first.');
    const {error}=await window.db.from('investor_requests').insert({investor_user_id:u.id,opportunity_id:opportunityId||null,request_type:type,message:message||null,requested_items:items||[]});
    if(error) throw error; return true;
  }
  function gateSensitive(root, subscribed){
    root.querySelectorAll('[data-premium]').forEach(el=>{
      el.classList.toggle('premium-locked',!subscribed);
      el.setAttribute('aria-hidden',!subscribed);
    });
    root.querySelectorAll('[data-premium-value]').forEach(el=>{
      if(!subscribed){
        el.dataset.originalText ??= el.textContent;
        const label=el.dataset.lockLabel || 'Subscriber-only information';
        const preview=el.dataset.lockPreview || 'Subscribe to unlock the validated details, supporting evidence and engagement information for this technology.';
        el.innerHTML='<span style=\"font-weight:700\">🔒 '+esc(label)+'</span><br><span style=\"font-size:12px;color:#66756d\">'+esc(preview)+'</span>';
        el.classList.add('premium-value-locked');
      } else if(el.dataset.originalText){
        el.textContent=el.dataset.originalText;
        el.classList.remove('premium-value-locked');
      }
    });
  }
  function showSubscribe(){
    if(window.RMRDCSubscriptionUI?.open){ window.RMRDCSubscriptionUI.open(); return; }
    let gate=document.getElementById('subscriptionGate');
    if(!gate){
      gate=document.createElement('div'); gate.id='subscriptionGate'; gate.className='gate-modal';
      gate.innerHTML='<div class="gate-box"><span class="rti-badge">Subscriber access</span><h2>Unlock full technology intelligence</h2><p>Subscribe to access the available detailed technical, production, market, raw-material, IP and commercialisation information for this technology, plus structured RMRDC-facilitated engagement requests.</p><div class="gate-actions"><a class="primary-btn" href="subscribe.html?tab=register">Subscribe / Sign in</a><button class="outline-btn" type="button">Not now</button></div></div>';
      document.body.appendChild(gate); gate.querySelector('button').onclick=()=>gate.classList.add('hidden');
    }
    gate.classList.remove('hidden');
  }
  window.RMRDCWorkflow={currentUser,activeSubscription,markViewed,createRequest,gateSensitive,showSubscribe,esc};
})();