import { escapeHtml } from '../utils/escape-html.js';

export class PatternCard extends HTMLElement {
  set pattern(cluster) {
    this._cluster = cluster;
    this.render();
  }

  get pattern() {
    return this._cluster;
  }

  render() {
    if (!this._cluster) return;
    const c = this._cluster;
    this.innerHTML = `
      <div class="card" style="border-left: 4px solid var(--color-brand-primary);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h4 style="font-weight: 700; font-size: var(--font-size-base);">${escapeHtml(c.ruleId)}</h4>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
              ${c.upstreamPatternId ? `ID: ${escapeHtml(c.upstreamPatternId)}` : 'Synthesized DOM cluster'}
            </div>
          </div>
          <div style="display: flex; gap: var(--space-2);">
            <span class="badge badge-high">${c.pagesCount} pages</span>
            <span class="badge badge-medium">${c.occurrencesCount} occurrences</span>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('pattern-card', PatternCard);
