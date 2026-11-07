(function () {
  const count = async table => {
    const { count: total, error } = await window.db.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Could not load ${table} count: ${error.message}`);
    return Number(total || 0);
  };

  async function read() {
    if (!window.db) throw new Error('Metrics service is unavailable.');

    const [publications, users, subscribers] = await Promise.all([
      count('publications'),
      count('profiles'),
      count('research_subscribers')
    ]);
    const pageSize = 1000;
    let offset = 0;
    let views = 0;
    let downloads = 0;
    let mostRead = 0;
    let mostReadTitle = '';

    while (true) {
      const { data, error } = await window.db
        .from('publications_with_stats')
        .select('id,title,view_count,download_count')
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw new Error(`Could not load publication metrics: ${error.message}`);
      const page = data || [];
      for (const publication of page) {
        const publicationViews = Number(publication.view_count) || 0;
        views += publicationViews;
        downloads += Number(publication.download_count) || 0;
        if (publicationViews > mostRead) {
          mostRead = publicationViews;
          mostReadTitle = publication.title || '';
        }
      }

      if (page.length < pageSize) break;
      offset += pageSize;
    }

    return { publications, users, subscribers, views, downloads, mostRead, mostReadTitle };
  }

  function subscribe(onChange) {
    if (!window.db) return null;
    const channel = window.db.channel('rmrdc-live-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'view_events' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'download_events' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publications' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'research_subscribers' }, onChange)
      .subscribe();
    return channel;
  }

  window.RMRDCLiveMetrics = { read, subscribe };
})();