export class EvidencePanel extends HTMLElement {
  set evidence(data) {
    this._data = data;
    this.render();
  }

  render() {
    if (!this._data) return;
    const { locator, renderedHtml, scanner, description } = this._data;
    this.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-4);">
        <h4 style="font-weight: 700; font-size: var(--font-size-base); margin-bottom: var(--space-2);">Scanner Evidence (${scanner || 'Automated'})</h4>
        ${description ? `<p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-2);">${description}</p>` : ''}
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-1);">Locator:</p>
        <pre class="code-block" style="margin-bottom: var(--space-2);"><code>${escapeHtml(locator || '')}</code></pre>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-1);">Rendered HTML:</p>
        <pre class="code-block"><code>${escapeHtml(renderedHtml || '')}</code></pre>
      </div>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

customElements.define('evidence-panel', EvidencePanel);
