import { technologyStore, TECHNOLOGY_OPTIONS } from '../state/technology.js';
import { workspaceStore } from '../state/workspace.js';
import { getTechnologyContext } from '../technology/context.js';
import { escapeHtml, escapeAttr } from '../utils/escape-html.js';

/**
 * Displays the resolved technology context and lets the user confirm, reject,
 * replace, or return to Unknown, and inspect the evidence used. Detection is
 * advisory — the user is always in control, and framework-neutral guidance
 * remains available regardless.
 *
 * With an explicit `context` property it shows that; otherwise it derives the
 * current workspace-level resolved context from the loaded observations plus the
 * technology store, so it works standalone on the "Roles & Context" route.
 */
export class TechnologyContextComponent extends HTMLElement {
  set context(ctx) { this._ctx = ctx; this.render(); }

  connectedCallback() {
    this._unsubTech = technologyStore.subscribe(() => this.render());
    this._unsubWs = workspaceStore.subscribe(() => this.render());
    this.render();
  }
  disconnectedCallback() {
    if (this._unsubTech) this._unsubTech();
    if (this._unsubWs) this._unsubWs();
  }

  _resolveContext() {
    if (this._ctx) return this._ctx;
    const ws = workspaceStore.state;
    const tech = technologyStore.state;
    if (!ws.loaded) return null;
    return getTechnologyContext(ws.observations || [], tech.confirmed || null, ws.scanMetadata || null, tech.rejected || []);
  }

  render() {
    const ctx = this._resolveContext();
    if (!ctx) {
      this.innerHTML = `<div style="color: var(--color-text-muted); font-size: var(--font-size-sm);">Load a report to see its technology context.</div>`;
      return;
    }
    const { name, category, confidence, source, evidence, confirmed } = ctx;
    const state = technologyStore.state;

    const confidenceBadge = confidence === 'none'
      ? '<span class="badge badge-medium">no framework detected</span>'
      : `<span class="badge badge-medium">${escapeHtml(confidence)} confidence</span>`;

    this.innerHTML = `
      <div style="background-color: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);">
          <strong style="font-size: var(--font-size-xs); text-transform: uppercase; color: var(--color-text-secondary);">Technology Context</strong>
          ${confidenceBadge}
        </div>
        <div style="font-size: var(--font-size-lg); font-weight: 700; margin-top: var(--space-1);">
          ${escapeHtml(name)}${category ? ` <span style="font-weight: 400; color: var(--color-text-muted);">(${escapeHtml(category)})</span>` : ''}
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1);">
          ${confirmed ? 'Confirmed by you' : `Source: ${escapeHtml(source)}`}${confirmed ? '' : ' — detected, not confirmed'}
        </div>

        ${evidence?.length ? `
          <details style="margin-top: var(--space-2);">
            <summary style="cursor: pointer; font-size: var(--font-size-xs); font-weight: 600;">Inspect evidence</summary>
            <ul style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-left: var(--space-4); margin-top: var(--space-1);">
              ${evidence.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
            </ul>
          </details>` : ''}

        <div style="margin-top: var(--space-3); display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center;">
          ${!confirmed && confidence !== 'none' ? `<button type="button" class="btn btn-secondary" id="tech-confirm">Confirm ${escapeHtml(name)}</button>` : ''}
          ${!confirmed && confidence !== 'none' ? `<button type="button" class="btn btn-secondary" id="tech-reject">Reject</button>` : ''}
          <label style="font-size: var(--font-size-sm); display: flex; align-items: center; gap: var(--space-1);">
            Set technology:
            <select id="tech-replace" style="padding: var(--space-1); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
              <option value="">— choose —</option>
              ${TECHNOLOGY_OPTIONS.map(o => `<option value="${escapeAttr(o)}" ${state.confirmed === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
            </select>
          </label>
          ${state.confirmed ? `<button type="button" class="btn btn-secondary" id="tech-reset">Return to auto/Unknown</button>` : ''}
        </div>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">
          Framework-neutral HTML guidance is always available; a confirmed technology only adds context.
        </p>
      </div>
    `;

    this.setup();
  }

  setup() {
    const confirmBtn = this.querySelector('#tech-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', () => technologyStore.confirm(this._ctx.name));

    const rejectBtn = this.querySelector('#tech-reject');
    if (rejectBtn) rejectBtn.addEventListener('click', () => technologyStore.reject(this._ctx.name));

    const replaceSel = this.querySelector('#tech-replace');
    if (replaceSel) replaceSel.addEventListener('change', (e) => {
      if (e.target.value) technologyStore.confirm(e.target.value);
    });

    const resetBtn = this.querySelector('#tech-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => technologyStore.reset());
  }
}

customElements.define('technology-context', TechnologyContextComponent);
