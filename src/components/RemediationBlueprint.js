export class RemediationBlueprintComponent extends HTMLElement {
  set blueprint(bp) {
    this._bp = bp;
    this.render();
  }

  render() {
    if (!this._bp) return;
    const bp = this._bp;
    this.innerHTML = `
      <div class="card">
        <h3 class="card-title" style="margin-bottom: var(--space-4);">Remediation Blueprint</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-3);">${bp.whatNeedsToChange}</p>
        ${bp.targetMarkup ? `<pre class="code-block" style="margin-bottom: var(--space-4);"><code>${escapeHtml(bp.targetMarkup)}</code></pre>` : ''}
        ${bp.humanDecisionsRequired?.length ? `
          <div style="background-color: var(--color-urgency-medium-bg); padding: var(--space-3); border-radius: var(--radius-sm); margin-bottom: var(--space-3);">
            <strong style="font-size: var(--font-size-xs); color: var(--color-urgency-medium);">HUMAN DECISIONS REQUIRED:</strong>
            <ul style="font-size: var(--font-size-xs); margin-left: var(--space-4); margin-top: var(--space-1);">${bp.humanDecisionsRequired.map(d => `<li>${d}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

customElements.define('remediation-blueprint', RemediationBlueprintComponent);
