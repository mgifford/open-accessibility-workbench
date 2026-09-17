import { profileStore } from '../state/profile.js';
import { workspaceStore } from '../state/workspace.js';
import { CAPABILITY_OPTIONS } from '../roles/capability-profile.js';
import { buildScanScope } from '../analysis/scan-scope.js';
import { renderScanHeader } from './scan-header.js';
import { routeTaskForProfile } from '../roles/route-task.js';
import { escapeHtml, escapeAttr } from '../utils/escape-html.js';

const MAX_PREVIEW = 5;

export class RoleProfile extends HTMLElement {
  connectedCallback() {
    this.unsubscribe = profileStore.subscribe(() => this.render());
    this.unsubscribeWorkspace = workspaceStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.unsubscribeWorkspace) this.unsubscribeWorkspace();
  }

  render() {
    const { selectedCapabilities } = profileStore.state;
    const { loaded, tasks = [] } = workspaceStore.state;
    const scope = buildScanScope(workspaceStore.state);

    this.innerHTML = `
      <section>
      ${renderScanHeader(scope, { compact: true })}
      <div class="card">
        <h2 class="card-title" style="font-size: var(--font-size-2xl);">Capability & Role Profile</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--space-6);">
          Select the areas you have the ability to modify or review. The matched tasks update below as you choose — nothing is hidden or deleted; this only tailors what is surfaced to you.
        </p>

        <form id="profile-form">
          <fieldset style="border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-6); margin-bottom: var(--space-6);">
            <legend style="font-weight: 700; padding: 0 var(--space-2);">What can you change?</legend>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3); margin-top: var(--space-4);">
              ${CAPABILITY_OPTIONS.map((opt, idx) => {
                const checked = selectedCapabilities.includes(opt);
                return `
                  <div style="display: flex; align-items: center; gap: var(--space-2); min-height: var(--min-target-size);">
                    <input type="checkbox" id="cap-${idx}" value="${escapeAttr(opt)}" ${checked ? 'checked' : ''} style="width: 18px; height: 18px;" />
                    <label for="cap-${idx}" style="font-size: var(--font-size-sm); cursor: pointer;">${escapeHtml(opt)}</label>
                  </div>
                `;
              }).join('')}
            </div>
          </fieldset>

          <div style="display: flex; gap: var(--space-4);">
            <button type="button" class="btn btn-secondary" id="clear-profile-btn">Clear Selections</button>
          </div>
        </form>

        ${this.renderMatchPreview(loaded, tasks, selectedCapabilities)}
      </div>
      </section>
    `;

    this.setupListeners();
  }

  /**
   * Live, in-page preview of how the current capability selection maps to the
   * loaded tasks — so toggling a capability shows its effect immediately here,
   * instead of sending the user off to the Tasks view. Findings are never
   * removed; this only reflects which tasks the selected roles can act on.
   */
  renderMatchPreview(loaded, tasks, selectedCapabilities) {
    if (!loaded || tasks.length === 0) {
      return `
        <div aria-live="polite" style="border-top: 1px solid var(--color-border); margin-top: var(--space-4); padding-top: var(--space-4); color: var(--color-text-muted); font-size: var(--font-size-sm);">
          Load a report to see which tasks match your capabilities.
        </div>`;
    }

    const routed = tasks.map(t => ({ task: t, route: routeTaskForProfile(t, selectedCapabilities) }));
    const actionable = routed.filter(r => r.route.relevance !== 'handoff');
    const handoff = routed.length - actionable.length;
    const none = selectedCapabilities.length === 0;

    const heading = none
      ? `All <strong>${tasks.length}</strong> tasks shown — select capabilities above to focus on what you can act on.`
      : `<strong>${actionable.length}</strong> of <strong>${tasks.length}</strong> tasks match your capabilities${handoff ? `; <strong>${handoff}</strong> would need another role (handoff).` : '.'}`;

    const list = actionable.slice(0, MAX_PREVIEW).map(({ task, route }) => `
      <li style="border-bottom: 1px solid var(--color-border); padding: var(--space-2) 0;">
        <a href="#/task/${escapeAttr(task.id)}" style="font-weight: 600; color: var(--color-brand-primary); text-decoration: none;">${escapeHtml(task.title)}</a>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-1);">
          ${escapeHtml(relevanceLabel(route.relevance))}${route.matchedCapabilities?.length ? ` — matches: ${escapeHtml(route.matchedCapabilities.join(', '))}` : ''}
        </div>
      </li>`).join('');

    const more = actionable.length > MAX_PREVIEW
      ? `<p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">+${actionable.length - MAX_PREVIEW} more matched ${actionable.length - MAX_PREVIEW === 1 ? 'task' : 'tasks'}.</p>`
      : '';

    return `
      <div aria-live="polite" style="border-top: 1px solid var(--color-border); margin-top: var(--space-4); padding-top: var(--space-4);">
        <h3 style="font-size: var(--font-size-base); font-weight: 700; margin-bottom: var(--space-2);">Matched tasks</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-3);">${heading}</p>
        ${actionable.length ? `<ul style="list-style: none;">${list}</ul>${more}` : `<p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">No tasks match this selection — every task would be a handoff to another role.</p>`}
        <a href="#/tasks" class="btn btn-secondary" style="margin-top: var(--space-3);">Open these in the Tasks view</a>
      </div>`;
  }

  setupListeners() {
    const checkboxes = this.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        // Re-rendering replaces the checkbox; remember it so we can restore focus
        // after the store notifies and re-renders (spec §7.4: keep focus).
        this._restoreFocusId = cb.id;
        profileStore.toggleCapability(cb.value);
      });
    });

    const clearBtn = this.querySelector('#clear-profile-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._restoreFocusId = 'clear-profile-btn';
        profileStore.setCapabilities([]);
      });
    }

    // Restore focus to the control the user just operated.
    if (this._restoreFocusId) {
      const el = this.querySelector(`#${CSS.escape(this._restoreFocusId)}`);
      if (el) el.focus();
      this._restoreFocusId = null;
    }
  }
}

/** Plain-language label for a task's routing relevance to the selected profile. */
function relevanceLabel(relevance) {
  return ({
    'unfiltered': 'Shown (no profile selected)',
    'direct': 'You can act on this directly',
    'decision': 'Needs a decision you can make',
    'implementation-blocked': 'You can start; another role must finish',
    'review-only': 'You can review this',
    'handoff': 'Handoff to another role'
  })[relevance] || relevance;
}

customElements.define('role-profile', RoleProfile);
