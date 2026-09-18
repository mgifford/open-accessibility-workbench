/**
 * Client-side hash router for GitHub Pages static deployment.
 */

/** Human-readable names for the polite route-change announcement. */
const ROUTE_LABELS = {
  '#/import': 'Import',
  '#/overview': 'Overview',
  '#/patterns': 'Patterns',
  '#/tasks': 'Tasks',
  '#/roles': 'Roles and context',
  '#/export': 'Export',
  '#/about': 'About'
};

export class Router {
  constructor(routes = {}, outletId = 'app-root') {
    this.routes = routes;
    this.outletId = outletId;
    // `isInitial` suppresses focus movement on first paint (the user has not
    // navigated yet — see WCAG-friendly focus rules); hashchange navigations
    // are user-initiated and DO move focus to the new view.
    window.addEventListener('hashchange', () => this.handleRoute(false));
  }

  init() {
    this.handleRoute(true);
  }

  handleRoute(isInitial = false) {
    const hash = window.location.hash || '#/import';
    const outlet = document.getElementById(this.outletId);
    if (!outlet) return;

    // Update main nav active link
    const navLinks = document.querySelectorAll('nav.main-nav a');
    navLinks.forEach(link => {
      const linkHash = link.getAttribute('href');
      if (linkHash && (hash === linkHash || (linkHash !== '#/import' && hash.startsWith(linkHash)))) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    // Check dynamic routes e.g. #/task/:id
    if (hash.startsWith('#/task/')) {
      const taskId = hash.replace('#/task/', '');
      outlet.innerHTML = `<task-detail task-id="${taskId}"></task-detail>`;
      this.afterNavigate('Task detail', outlet, isInitial);
      return;
    }

    const handler = this.routes[hash] || this.routes['#/import'];
    if (handler) {
      outlet.innerHTML = handler();
    }
    this.afterNavigate(ROUTE_LABELS[hash] || 'View', outlet, isInitial);
  }

  /**
   * On a user-initiated navigation, politely announce the new view and land the
   * user at the TOP of the page — like a fresh page load — with the header and
   * navigation visible. Focus moves to the header (programmatically focusable)
   * rather than <main>, so keyboard and screen-reader users start above the new
   * content instead of below the nav at the H1. Skipped on the initial paint.
   */
  afterNavigate(label, outlet, isInitial) {
    const announcer = document.getElementById('live-announcer');
    if (announcer) {
      announcer.textContent = `${label} view loaded.`;
    }
    if (isInitial) return;

    // Focus the top-of-page header without letting focus() scroll it partially
    // into view, then explicitly reset the scroll so the very top (header + nav)
    // is shown. Falls back to <main> if the header is not present/focusable.
    const header = document.getElementById('app-header');
    const target = header && typeof header.focus === 'function' ? header : outlet;
    if (target && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
    if (typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
  }
}
