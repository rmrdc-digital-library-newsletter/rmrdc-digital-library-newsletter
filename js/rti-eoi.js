/* RMRDC v3.4.8 — polished investor EOI modal */
(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current={title:'Selected technology', opportunityId:null, demoFree:false};
  function ensureModal(){
    if(document.getElementById('rtiEoiModal')) return document.getElementById('rtiEoiModal');
    const m=document.createElement('div'); m.id='rtiEoiModal'; m.className='rti-eoi-overlay hidden';
    m.innerHTML=`<div class="rti-eoi-dialog" role="dialog" aria-modal="true" aria-labelledby="rtiEoiTitle">
      <button class="rti-eoi-close" type="button" id="rtiEoiClose" aria-label="Close">×</button>
      <div class="rti-eoi-header"><span class="rti-eoi-kicker">RMRDC INVESTOR ENGAGEMENT</span><h2 id="rtiEoiTitle">Expression of Interest</h2><p>Submit your interest in <strong id="rtiEoiTechnology">Selected technology</strong>. RMRDC will review your request before connecting you with the relevant technology team.</p></div>
      <div class="rti-eoi-process"><span><b>1</b> Submit</span><span><b>2</b> RMRDC Review</span><span><b>3</b> Researcher / Technical Team</span><span><b>4</b> Deal Room</span></div>
      <form id="rtiEoiForm" class="rti-eoi-form">
        <section class="rti-eoi-section"><div class="rti-eoi-section-head"><span>01</span><div><h3>Investor details</h3><p>Tell us who is making the enquiry.</p></div></div><div class="rti-eoi-grid">
          <label>Investor name <em>*</em><input name="full_name" required autocomplete="name" placeholder="Full name"></label>
          <label>Organisation / Company <em>*</em><input name="organisation" required autocomplete="organization" placeholder="Organisation name"></label>
          <label>Email address <em>*</em><input name="email" type="email" required autocomplete="email" placeholder="name@company.com"></label>
          <label>Phone number <em>*</em><input name="phone" type="tel" required autocomplete="tel" placeholder="Phone number"></label>
        </div></section>
        <section class="rti-eoi-section"><div class="rti-eoi-section-head"><span>02</span><div><h3>What are you interested in?</h3><p>Select the engagement pathway that best describes your request.</p></div></div><div class="rti-eoi-grid">
          <label>Interest type <em>*</em><select name="interest_type" required><option value="">Select an option</option><option>Investment</option><option>Technology Licensing</option><option>Joint Venture</option><option>Technology Partnership</option><option>Commercialisation</option><option>Manufacturing / Scale-up</option></select></label>
          <label>Estimated investment range<select name="investment_range"><option value="">Prefer not to say</option><option>Below ₦10 million</option><option>₦10–50 million</option><option>₦50–100 million</option><option>₦100–500 million</option><option>Above ₦500 million</option><option>To be determined</option></select></label>
          <label>Preferred next step <em>*</em><select name="next_step" required><option value="">Select an option</option><option>RMRDC briefing</option><option>Technical briefing</option><option>Meeting with researcher / technology owner</option><option>Site / pilot visit</option><option>Due diligence</option><option>Licensing discussion</option><option>JV discussion</option><option>Fabrication / scale-up assessment</option></select></label>
          <label>Expected timeline<select name="timeline"><option value="">Select an option</option><option>Immediately</option><option>Within 3 months</option><option>3–6 months</option><option>6–12 months</option><option>Exploratory</option></select></label>
        </div></section>
        <section class="rti-eoi-section"><div class="rti-eoi-section-head"><span>03</span><div><h3>Your expression of interest</h3><p>Briefly tell RMRDC what you want to evaluate or pursue.</p></div></div><label class="rti-eoi-message">Message <em>*</em><textarea name="message" rows="5" required placeholder="Describe your investment interest, intended application, partnership need, questions or support required from RMRDC."></textarea></label></section>
        <label class="rti-eoi-consent"><input type="checkbox" name="consent" required><span>I consent to RMRDC reviewing this request and contacting me about this technology and the next engagement step. <em>*</em></span></label>
        <input type="hidden" name="technology_title" id="interestTechnology">
        <div id="rtiEoiStatus" class="rti-eoi-status" aria-live="polite"></div>
        <div class="rti-eoi-actions"><button class="rti-eoi-cancel" type="button" id="rtiEoiCancel">Cancel</button><button class="rti-eoi-submit" type="submit" id="rtiEoiSubmit"><span>Send Expression of Interest</span><span aria-hidden="true">→</span></button></div>
        <p class="rti-eoi-footnote">Your request goes to the RMRDC Investment Desk for review. Researcher and Deal Room access are only enabled after the appropriate RMRDC approval.</p>
      </form></div>`;
    document.body.appendChild(m);
    const close=()=>m.classList.add('hidden');
    document.getElementById('rtiEoiClose').onclick=close; document.getElementById('rtiEoiCancel').onclick=close;
    m.addEventListener('click',e=>{if(e.target===m)close()});
    document.getElementById('rtiEoiForm').addEventListener('submit',submit);
    return m;
  }
  async function open(title, opportunityId, opts={}){
    current={title:title||'Selected technology',opportunityId:opportunityId||null,demoFree:!!opts.demoFree};
    let active=false; try{active=current.demoFree || await window.RMRDCWorkflow.activeSubscription()}catch(e){}
    const m=ensureModal(), form=document.getElementById('rtiEoiForm');
    document.getElementById('rtiEoiTechnology').textContent=current.title; document.getElementById('interestTechnology').value=current.title;
    form.reset(); document.getElementById('interestTechnology').value=current.title; document.getElementById('rtiEoiStatus').className='rti-eoi-status'; document.getElementById('rtiEoiStatus').textContent='';
    try{const u=await window.db?.auth.getUser(); if(u?.data?.user){const user=u.data.user; form.elements.email.value=user.email||''; form.elements.full_name.value=user.user_metadata?.full_name||user.user_metadata?.name||'';}}catch(e){}
    m.classList.remove('hidden'); setTimeout(()=>form.elements.full_name?.focus(),80); return true;
  }
  async function submit(ev){
    ev.preventDefault(); const form=ev.currentTarget, btn=document.getElementById('rtiEoiSubmit'), status=document.getElementById('rtiEoiStatus');
    btn.disabled=true; btn.querySelector('span').textContent='Sending…'; status.className='rti-eoi-status'; status.textContent='';
    try{
      if(!window.db) throw new Error('Database connection is not available.');
      const {data:ud,error:ue}=await window.db.auth.getUser(); if(ue||!ud?.user) throw new Error('Please sign in as an investor before sending an expression of interest.');
      const fd=new FormData(form); let opportunityId=current.opportunityId||null;
      if(!opportunityId && current.title){try{const lookup=await window.db.from('technology_opportunities').select('id').eq('title',current.title).limit(1);if(lookup.data?.length)opportunityId=lookup.data[0].id;}catch(e){}}
      const payload={investor_user_id:ud.user.id,opportunity_id:opportunityId,request_type:'expression_of_interest',message:String(fd.get('message')),requested_items:[String(fd.get('interest_type')),String(fd.get('next_step'))],investor_name:String(fd.get('full_name')),organisation:String(fd.get('organisation')),contact_email:String(fd.get('email')),phone:String(fd.get('phone')),interest_type:String(fd.get('interest_type')),investment_range:String(fd.get('investment_range')||''),preferred_next_step:String(fd.get('next_step')),timeline:String(fd.get('timeline')||''),technology_title:current.title,status:'received'};
      const {error}=await window.db.from('investor_requests').insert(payload); if(error)throw error;
      status.className='rti-eoi-status success'; status.innerHTML='<strong>Sent to RMRDC.</strong> Your expression of interest has been received by the RMRDC Investment Desk for review.'; btn.querySelector('span').textContent='Sent successfully';
      setTimeout(()=>document.getElementById('rtiEoiModal').classList.add('hidden'),2400);
    }catch(e){status.className='rti-eoi-status error';status.textContent=e?.message||'Unable to send your expression of interest.';btn.disabled=false;btn.querySelector('span').textContent='Send Expression of Interest';}
  }
  window.rtiOpenEOI=open; window.openInvestorEOI=open;
  document.addEventListener('DOMContentLoaded',()=>{const hero=document.getElementById('investorHeroExpressInterest');if(hero)hero.onclick=()=>open(document.getElementById('oppHeroTitle')?.textContent||'Selected technology',window.__currentOpportunityId||null,{demoFree:window.__currentOpportunityDemoFree});});
})();
