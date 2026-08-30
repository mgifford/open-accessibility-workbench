/**
 * Client-side hash router for GitHub Pages static deployment.
 */

export class Router {
  constructor(routes = {}, outletId = 'app-root') {
    this.routes = routes;
    this.outletId = outletId;
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  init() {
    this.handleRoute();
  }

  handleRoute() {
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
      return;
    }

    const handler = this.routes[hash] || this.routes['#/import'];
    if (handler) {
      outlet.innerHTML = handler();
    }
  }
}
