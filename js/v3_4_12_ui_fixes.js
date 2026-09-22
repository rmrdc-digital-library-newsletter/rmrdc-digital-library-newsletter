(function(){
  function dedupeExpress(){
    const modal=document.getElementById('opportunityModal'); if(!modal)return;
    const buttons=[...modal.querySelectorAll('button')].filter(b=>b.textContent.trim().toLowerCase()==='express interest');
    buttons.slice(1).forEach(b=>b.remove());
  }
  document.addEventListener('click',()=>setTimeout(dedupeExpress,0));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(dedupeExpress,100));
})();
