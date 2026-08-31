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
   * On a user-initiated navigation, politely announce the new view and move
   * keyboard focus to the main region so keyboard and screen-reader users land
   * in the new content. Skipped on the initial paint.
   */
  afterNavigate(label, outlet, isInitial) {
    const announcer = document.getElementById('live-announcer');
    if (announcer) {
      announcer.textContent = `${label} view loaded.`;
    }
    if (!isInitial && typeof outlet.focus === 'function') {
      // outlet is <main tabindex="-1">, so it is programmatically focusable.
      outlet.focus();
    }
  }
}
