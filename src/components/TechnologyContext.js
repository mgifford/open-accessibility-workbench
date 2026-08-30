export class TechnologyContextComponent extends HTMLElement {
  set context(ctx) {
    this._ctx = ctx;
    this.render();
  }

  render() {
    if (!this._ctx) return;
    const { name, category, confidence, source, evidence } = this._ctx;
    this.innerHTML = `
      <div style="background-color: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: var(--font-size-xs); text-transform: uppercase; color: var(--color-text-secondary);">Technology Context</strong>
          <span class="badge badge-${confidence === 'high' ? 'low' : 'medium'}">${confidence} confidence</span>
        </div>
        <div style="font-size: var(--font-size-lg); font-weight: 700; margin-top: var(--space-1);">${name} (${category})</div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1);">Source: ${source}</div>
        ${evidence?.length ? `<ul style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-left: var(--space-4); margin-top: var(--space-2);">${evidence.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
      </div>
    `;
  }
}

customElements.define('technology-context', TechnologyContextComponent);
