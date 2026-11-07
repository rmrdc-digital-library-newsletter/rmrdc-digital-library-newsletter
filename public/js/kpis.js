
(function () {
  function animate(id, target) {
    const element = document.getElementById(id);
    if (!element) return;
    const value = Number(target);
    if (!Number.isFinite(value)) {
      element.textContent = '—';
      return;
    }
    element.textContent = Math.round(value).toLocaleString();
  }

  async function loadKPIs() {
    try {
      const metrics = await window.RMRDCLiveMetrics.read();
      animate('kpiPublications', metrics.publications);
      animate('kpiReaders', metrics.users);
      animate('kpiViews', metrics.views);
      animate('kpiDownloads', metrics.downloads);
      animate('kpiMostRead', metrics.mostRead);
      const mostReadTitle = document.getElementById('kpiMostReadTitle');
      if (mostReadTitle) {
        mostReadTitle.textContent = metrics.mostReadTitle
          ? `${metrics.mostReadTitle} · ${Number(metrics.mostRead).toLocaleString()} views`
          : 'No views recorded yet';
      }
    } catch (error) {
      console.error('Could not load homepage metrics:', error);
      ['kpiPublications', 'kpiReaders', 'kpiViews', 'kpiDownloads', 'kpiMostRead'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '—';
      });
      const mostReadTitle = document.getElementById('kpiMostReadTitle');
      if (mostReadTitle) mostReadTitle.textContent = 'Metrics temporarily unavailable';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadKPIs();
    window.RMRDCLiveMetrics?.subscribe(loadKPIs);
  });
})();
