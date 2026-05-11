(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
    });
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    document.getElementById('installAppBtn')?.classList.remove('hidden');
  });

  document.addEventListener('click', async event => {
    const btn = event.target.closest('#installAppBtn');
    if (!btn || !deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.classList.add('hidden');
  });
})();
