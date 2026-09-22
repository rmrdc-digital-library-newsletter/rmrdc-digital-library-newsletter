/* RMRDC v3.4.11 portal interaction hardening */
(function(){
  function normalizeViewButtons(){
    document.querySelectorAll('#opportunityRows button, #techRows button').forEach(btn=>{
      const txt=(btn.textContent||'').trim().toLowerCase();
      if(txt!=='view') return;
      if(btn.dataset.openTitle || btn.dataset.openAsset) return;
      const onclick=btn.getAttribute('onclick')||'';
      let m=onclick.match(/openOpportunity\(['"]([^'"]+)['"]\)/);
      if(m){btn.dataset.openTitle=m[1];btn.removeAttribute('onclick');return;}
      m=onclick.match(/openRMRDCAsset\(['"]([^'"]+)['"]\)/);
      if(m){btn.dataset.openAsset=m[1];btn.removeAttribute('onclick');}
    });
  }
  document.addEventListener('DOMContentLoaded',normalizeViewButtons);
  new MutationObserver(normalizeViewButtons).observe(document.body,{subtree:true,childList:true});
})();
