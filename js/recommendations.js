(function () {
  function getQueryPublicationId() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function esc(value = '') {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
  }

  function normalize(value = '') {
    return String(value || '').toLowerCase();
  }

  function tokens(pub) {
    return normalize([
      pub.title,
      pub.authors,
      pub.type,
      pub.abstract,
      pub.year,
      pub.isbn,
      pub.doi,
      ...(pub.research_areas || [])
    ].join(' ')).split(/[^a-z0-9]+/).filter(w => w.length > 2);
  }

  function scoreKeywordSimilarity(source, candidate) {
    const sourceTokens = new Set(tokens(source));
    const candidateTokens = tokens(candidate);
    let score = 0;

    candidateTokens.forEach(t => {
      if (sourceTokens.has(t)) score += 1;
    });

    const srcAreas = (source.research_areas || []).map(normalize);
    const candAreas = (candidate.research_areas || []).map(normalize);
    candAreas.forEach(area => {
      if (srcAreas.includes(area)) score += 8;
    });

    if (normalize(source.type) && normalize(source.type) === normalize(candidate.type)) score += 4;
    if (candidate.view_count) score += Math.min(6, Number(candidate.view_count) / 10);
    if (candidate.avg_rating) score += Number(candidate.avg_rating);

    return score;
  }

  function card(pub) {
    const format = pub.publication_format === 'html' || pub.ebook_url ? 'HTML eBook' : 'Flipbook';
    return `
      <article class="related-publication-card">
        <a href="viewer.html?id=${encodeURIComponent(pub.id)}">
          <img src="${esc(pub.cover_url || 'assets/placeholder-cover.svg')}" alt="${esc(pub.title || 'Publication')} cover" />
          <div>
            <span>${esc(pub.type || 'Publication')} • ${format}</span>
            <strong>${esc(pub.title || 'Untitled publication')}</strong>
            <small>${esc(pub.year || 'N/A')}${pub.authors ? ' • ' + esc(pub.authors) : ''}</small>
          </div>
        </a>
      </article>
    `;
  }

  async function getCurrentPublication(id) {
    const { data, error } = await window.db.from('publications_with_stats').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function loadKeywordFallback(source) {
    const { data, error } = await window.db.from('publications_with_stats').select('*').neq('id', source.id).limit(80);
    if (error) throw error;

    return (data || [])
      .map(pub => ({ pub, score: scoreKeywordSimilarity(source, pub) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(item => item.pub);
  }

  async function loadSemanticRecommendations(source) {
    try {
      const { data, error } = await window.db.functions.invoke('recommend-publications', {
        body: { publication_id: source.id, limit: 8 }
      });
      if (error) throw error;
      if (Array.isArray(data?.recommendations) && data.recommendations.length) {
        return data.recommendations;
      }
      return [];
    } catch (error) {
      console.warn('Semantic recommendation function unavailable, using keyword fallback:', error.message);
      return [];
    }
  }

  async function loadRelatedPublications() {
    const grid = document.getElementById('relatedPublicationsGrid');
    const panel = document.getElementById('relatedPublicationsPanel');
    if (!grid || !panel) return;

    if (!window.db) {
      grid.innerHTML = '<p class="empty">Supabase is not connected.</p>';
      return;
    }

    const id = getQueryPublicationId();
    if (!id) {
      grid.innerHTML = '<p class="empty">No publication selected.</p>';
      return;
    }

    try {
      const source = await getCurrentPublication(id);
      let recommendations = await loadSemanticRecommendations(source);

      if (!recommendations.length) {
        recommendations = await loadKeywordFallback(source);
      }

      grid.innerHTML = recommendations.length
        ? recommendations.map(card).join('')
        : '<p class="empty">No related publications found yet.</p>';
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<p class="empty">Could not load related publications.</p>';
    }
  }

  window.RMRDCRecommendations = { loadRelatedPublications };
  document.addEventListener('DOMContentLoaded', loadRelatedPublications);
})();
