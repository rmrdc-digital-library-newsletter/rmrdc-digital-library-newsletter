(function(){
  function openSubscriptionModal(context){
    let modal=document.getElementById('subscriptionChoiceModal');
    if(!modal){
      modal=document.createElement('div'); modal.id='subscriptionChoiceModal'; modal.className='subscription-choice-overlay';
      modal.innerHTML=`<div class="subscription-choice-modal" role="dialog" aria-modal="true" aria-labelledby="subChoiceTitle">
        <button class="subscription-choice-close" aria-label="Close">×</button>
        <div class="subscription-choice-head"><span class="subscription-kicker">RMRDC INTELLIGENCE ACCESS</span><h2 id="subChoiceTitle">Unlock the information behind the opportunity</h2><p>Choose the access level that matches how you use RMRDC research and technology intelligence.</p></div>
        <div class="subscription-plans compact-plans">
          <article class="subscription-plan"><div class="plan-icon">◉</div><h3>Discovery</h3><p class="plan-price">Free</p><p>Explore the platform and discover technologies, patents, TIC products and opportunities.</p><ul><li>Smart search</li><li>Basic technology profiles</li><li>Public RMRDC information</li></ul><span class="plan-current">Current access</span></article>
          <article class="subscription-plan featured"><span class="plan-ribbon">RECOMMENDED</span><div class="plan-icon">◆</div><h3>Intelligence Access</h3><p class="plan-price">Subscriber</p><p>Unlock the available intelligence needed to evaluate technologies and engage RMRDC.</p><ul><li>Technical & production intelligence</li><li>Market & raw-material information</li><li>IP & commercialisation information</li><li>Investor engagement requests</li><li>RMRDC-facilitated matching</li></ul><a class="btn btn-primary plan-cta" href="subscribe.html?tab=register">Subscribe / Create Account</a></article>
          <article class="subscription-plan"><div class="plan-icon">▣</div><h3>Institutional</h3><p class="plan-price">RMRDC Partner</p><p>For organisations requiring broader intelligence, structured engagement and institutional access.</p><ul><li>Advanced intelligence access</li><li>Technology matching</li><li>Deal Room participation</li><li>Institutional engagement</li></ul><a class="btn btn-outline plan-cta" href="contact.html">Contact RMRDC</a></article>
        </div>
        <div class="subscription-assurance"><span>🔒</span><div><strong>Controlled access</strong><p>Subscription unlocks information according to RMRDC's approved access level. Sensitive researcher and commercial information remains protected.</p></div></div>
      </div>`;
      document.body.appendChild(modal);
      const close=()=>modal.classList.add('hidden'); modal.querySelector('.subscription-choice-close').onclick=close; modal.addEventListener('click',e=>{if(e.target===modal)close()});
      document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    }
    modal.classList.remove('hidden');
  }
  window.RMRDCSubscriptionUI={open:openSubscriptionModal};
})();
