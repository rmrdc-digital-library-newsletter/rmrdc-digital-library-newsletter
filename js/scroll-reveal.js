/* RMRDC modern scroll reveal: rise -> overshoot -> settle. */
(function () {
  'use strict';

  function init() {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var selectors = [
      'main > section',
      'main > .section',
      'main > .container > section',
      'main > .container > .section',
      '.ri-section',
      '.ri-kpis',
      '.hero',
      '.page-header',
      '.section-head',
      '.section-heading',
      '.category-card',
      '.category-grid > *',
      '.publication-card',
      '.publication-grid > *',
      '.shelf-item',
      '.shelf-grid > *',
      '.card-grid > *',
      '.cards-grid > *',
      '.deal-card',
      '.kpi-card',
      '.stat-card',
      '.feature-card',
      '.portal-card',
      '.info-card',
      '.panel',
      '.table-wrap',
      '.opportunity-card',
      '.stakeholder-card',
      '.profile-main',
      '.profile-side',
      '.validation-callout',
      '.subscription-plan',
      '.project-card'
    ];

    var seen = new Set();
    var observer;

    function collect() {
      var nodes = [];
      selectors.forEach(function (selector) {
        document.querySelectorAll(selector).forEach(function (el) {
          if (seen.has(el)) return;
          if (el.closest('[hidden], [aria-hidden="true"]')) return;
          seen.add(el);
          el.classList.add('scroll-reveal');
          nodes.push(el);

          var parent = el.parentElement;
          if (parent && (
            parent.classList.contains('category-grid') ||
            parent.classList.contains('publication-grid') ||
            parent.classList.contains('card-grid') ||
            parent.classList.contains('cards-grid') ||
            parent.classList.contains('shelf-grid') ||
            parent.classList.contains('project-cards') ||
            parent.classList.contains('stakeholder-grid') ||
            parent.classList.contains('opportunity-grid') ||
            parent.classList.contains('subscription-plans')
          )) parent.classList.add('scroll-reveal-group');
        });
      });
      return nodes;
    }

    function reveal(nodes) {
      nodes.forEach(function (el) {
        if (!el.classList.contains('is-visible')) el.classList.add('is-visible');
      });
    }

    var nodes = collect();
    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveal(nodes);
      return;
    }

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -6% 0px'
    });

    nodes.forEach(function (el) { observer.observe(el); });

    /* Watch for publication cards/sections created after the page loads. */
    var timer;
    var mutationObserver = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        collect().forEach(function (el) { observer.observe(el); });
      }, 100);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
