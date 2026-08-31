import { workspaceStore } from '../state/workspace.js';
import { escapeHtml, escapeAttr, safeUrl } from '../utils/escape-html.js';

export class PatternExplorer extends HTMLElement {
  connectedCallback() {
    this.unsubscribe = workspaceStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    const { loaded, clusters, hypotheses } = workspaceStore.state;

    if (!loaded) {
      this.innerHTML = `<section class="card"><p>Please load a report first.</p></section>`;
      return;
    }

    this.innerHTML = `
      <section>
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: var(--font-size-2xl);">Pattern Explorer</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              ${clusters.length} recurring structural patterns identified across scanned pages.
            </p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          ${clusters.map(c => {
            // A component hypothesis may span several pattern clusters; match on
            // any member so every member pattern shows its component relationship.
            const hyp = hypotheses.find(
              h => h.clusterId === c.id || (Array.isArray(h.clusterIds) && h.clusterIds.includes(c.id))
            );
            return `
              <article class="card" style="border-left: 4px solid var(--color-brand-primary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-2);">
                  <div>
                    <h3 style="font-size: var(--font-size-lg); font-weight: 700;">Pattern: ${escapeHtml(c.ruleId)}</h3>
                    <div style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-1);">
                      ${c.upstreamPatternId ? `Authoritative Upstream ID: <code>${escapeHtml(c.upstreamPatternId)}</code>` : 'Synthesized DOM cluster'}
                    </div>
                  </div>
                  <div style="display: flex; gap: var(--space-2);">
                    <span class="badge badge-high">${c.pagesCount} ${c.pagesCount === 1 ? 'page' : 'pages'}</span>
                    <span class="badge badge-medium">${c.occurrencesCount} ${c.occurrencesCount === 1 ? 'occurrence' : 'occurrences'}</span>
                  </div>
                </div>

                <!-- Grouping Rationale -->
                <div style="background-color: var(--color-bg-subtle); padding: var(--space-3); border-radius: var(--radius-md); margin: var(--space-4) 0;">
                  <strong style="font-size: var(--font-size-xs); text-transform: uppercase; color: var(--color-text-secondary);">Why these findings are grouped:</strong>
                  <ul style="margin-left: var(--space-4); margin-top: var(--space-1); font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                    ${c.groupingRationale.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                  </ul>
                </div>

                <!-- Component Hypothesis -->
                ${hyp ? `
                  <div style="margin-bottom: var(--space-4);">
                    <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-brand-primary);">COMPONENT HYPOTHESIS:</span>
                    <strong>${escapeHtml(hyp.name)}</strong> (${escapeHtml(hyp.confidence)} confidence)
                    <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${escapeHtml(hyp.rationale)}</p>
                  </div>
                ` : ''}

                <!-- Representative Snippet -->
                <details style="margin-top: var(--space-3);">
                  <summary style="font-weight: 600; cursor: pointer; color: var(--color-brand-primary);">View Representative Markup & Occurrences</summary>
                  <div style="margin-top: var(--space-3);">
                    <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-1);">Representative Selector:</p>
                    <pre class="code-block" style="margin-bottom: var(--space-2);"><code>${escapeHtml(c.representativeLocator)}</code></pre>
                    <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-1);">Representative HTML:</p>
                    <pre class="code-block" style="margin-bottom: var(--space-3);"><code>${escapeHtml(c.representativeHtml)}</code></pre>

                    <p style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-secondary);">Affected Page URLs:</p>
                    <ul style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-left: var(--space-4); margin-top: var(--space-1);">
                      ${c.affectedPages.map(url => `<li><a href="${escapeAttr(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></li>`).join('')}
                    </ul>
                  </div>
                </details>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }
}


customElements.define('pattern-explorer', PatternExplorer);
