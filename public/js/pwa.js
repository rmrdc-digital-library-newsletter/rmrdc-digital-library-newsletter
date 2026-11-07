(function(){
  // Service workers require an http/https origin. Do not attempt registration
  // when the application is opened directly with file:// during local testing.
  if('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('PWA service worker unavailable:',err.message)));
  }
  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;document.getElementById('installAppBtn')?.classList.remove('hidden')});
  document.addEventListener('click',async event=>{const btn=event.target.closest('#installAppBtn');if(!btn||!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;btn.classList.add('hidden')});
})();
