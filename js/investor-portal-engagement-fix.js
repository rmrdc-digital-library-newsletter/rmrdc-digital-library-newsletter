/* v3.4.4 final investor engagement/access binding */
(function(){
  function bind(){
    const btn=document.getElementById('investorHeroExpressInterest');
    if(btn && !btn.dataset.bound){
      btn.dataset.bound='1';
      btn.addEventListener('click', async function(){
        const title=document.getElementById('oppHeroTitle')?.textContent || document.getElementById('oppTitle')?.textContent || 'Selected RMRDC technology';
        try{ await window.rtiOpenEOI?.(title,null); }catch(e){ alert(e?.message || 'Unable to open the expression of interest form.'); }
      });
    }
  }
  document.addEventListener('DOMContentLoaded',bind);
  new MutationObserver(bind).observe(document.documentElement,{subtree:true,childList:true});
})();
