export class ValidationResultsComponent extends HTMLElement {
  set results(res) {
    this._res = res;
    this.render();
  }

  render() {
    if (!this._res) return;
    const { passed, status, errors = [], warnings = [] } = this._res;
    this.innerHTML = `
      <div style="background-color: var(--color-bg-subtle); padding: var(--space-3); border-radius: var(--radius-sm); font-size: var(--font-size-xs);">
        <strong style="color: ${passed ? 'var(--color-urgency-low)' : 'var(--color-urgency-critical)'};">
          ${passed ? '✓ Check Passed' : '✗ Check Failed'}:
        </strong>
        <span style="margin-left: var(--space-1);">${status}</span>
        ${errors.length ? `<ul style="color: var(--color-urgency-critical); margin-left: var(--space-4); margin-top: var(--space-1);">${errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
        ${warnings.length ? `<ul style="color: var(--color-urgency-medium); margin-left: var(--space-4); margin-top: var(--space-1);">${warnings.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      </div>
    `;
  }
}

customElements.define('validation-results', ValidationResultsComponent);
