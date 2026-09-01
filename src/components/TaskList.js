import { workspaceStore } from '../state/workspace.js';
import { profileStore } from '../state/profile.js';
import { routeTaskForProfile } from '../roles/route-task.js';
import { escapeHtml, escapeAttr } from '../utils/escape-html.js';
import { taskStatusStore, TASK_STATUSES, TASK_STATUS_LABELS } from '../state/task-status.js';
import { renderRoleGuidance } from '../roles/render-role-guidance.js';

/** Decision concern a remediation family requires (mirrors route-task.js). */
const DECISION_CONCERN = {
  'accessible-name': 'content',
  'text-alternative': 'content',
  'contrast': 'contrast',
  'structure': 'structure',
  'form-labeling': 'content',
  'target-size': 'visual'
};

export class TaskList extends HTMLElement {
  constructor() {
    super();
    this.filterView = 'all';
    this.filterUrgency = 'all';
    this.filterStatus = 'all';
  }

  connectedCallback() {
    this.unsubscribeWorkspace = workspaceStore.subscribe(() => this.render());
    this.unsubscribeProfile = profileStore.subscribe(() => this.render());
    this.unsubscribeStatus = taskStatusStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribeWorkspace) this.unsubscribeWorkspace();
    if (this.unsubscribeProfile) this.unsubscribeProfile();
    if (this.unsubscribeStatus) this.unsubscribeStatus();
  }

  render() {
    const { loaded, tasks } = workspaceStore.state;
    const { selectedCapabilities } = profileStore.state;

    if (!loaded) {
      this.innerHTML = `<section class="card"><p>Please load a report first.</p></section>`;
      return;
    }

    // Pre-compute each task's routing verdict once (deterministic, no mutation).
    const routed = tasks.map(t => ({ task: t, route: routeTaskForProfile(t, selectedCapabilities) }));

    // Role-aware views (spec §7.6). Predicates reflect ACTUAL workflow data — a
    // task's remediation-family decision concern, its unresolved decisions, and
    // its lifecycle status — not merely which role appears somewhere. Each is a
    // reversible filter; nothing is deleted, and the hidden count is shown below.
    const decisionConcern = (t) => DECISION_CONCERN[t.remediationFamily] || null;
    const hasUnresolvedDecision = (t) => (t.blueprint?.humanDecisionsRequired?.length || 0) > 0;
    const viewPredicates = {
      'all': () => true,
      'relevant': ({ route }) => route.relevance !== 'handoff',
      'needs-content': ({ task }) => hasUnresolvedDecision(task) && decisionConcern(task) === 'content',
      'needs-design': ({ task }) => hasUnresolvedDecision(task) && ['contrast', 'visual', 'structure', 'behavior'].includes(decisionConcern(task)),
      'ready-dev': ({ task }) => taskStatusStore.get(task.id) === 'ready' && !hasUnresolvedDecision(task),
      'needs-a11y-review': ({ task }) => taskStatusStore.get(task.id) === 'needs-verification',
      'ready-verification': ({ task }) => taskStatusStore.get(task.id) === 'needs-verification',
      'needs-another-role': ({ route }) => route.relevance === 'handoff'
    };
    const predicate = viewPredicates[this.filterView] || viewPredicates['all'];

    let filteredRouted = routed.filter(predicate);
    if (this.filterUrgency !== 'all') {
      filteredRouted = filteredRouted.filter(({ task }) => task.urgency === this.filterUrgency);
    }
    if (this.filterStatus !== 'all') {
      filteredRouted = filteredRouted.filter(({ task }) => taskStatusStore.get(task.id) === this.filterStatus);
    }
    const filtered = filteredRouted.map(r => r.task);
    const routeByTaskId = new Map(routed.map(r => [r.task.id, r.route]));
    const hiddenCount = tasks.length - filtered.length;

    const statusCounts = taskStatusStore.summary(tasks.map(t => t.id));

    this.innerHTML = `
      <section>
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: var(--font-size-2xl);">Remediation Tasks</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              ${filtered.length} actionable tasks (from ${tasks.length} total) &bull;
              ${statusCounts.done} done, ${statusCounts['in-progress']} in progress, ${statusCounts['needs-verification']} awaiting verification, ${statusCounts.blocked} blocked, ${statusCounts['needs-decision']} need a decision, ${statusCounts.new + statusCounts.ready} not started
            </p>
            ${hiddenCount > 0 ? `<p style="font-size: var(--font-size-sm);">
              <strong>${hiddenCount}</strong> ${hiddenCount === 1 ? 'task is' : 'tasks are'} hidden by the current view.
              <button type="button" id="view-all-btn" class="btn btn-secondary" style="margin-left: var(--space-2);">View all</button>
            </p>` : ''}
          </div>
        </div>

        <div id="filter-announcer" role="status" aria-live="polite" class="sr-only"></div>

        <!-- Filter Controls -->
        <div class="card" style="padding: var(--space-4); margin-bottom: var(--space-6); display: flex; gap: var(--space-4); flex-wrap: wrap; align-items: center;">
          <div>
            <label for="filter-view" style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-secondary); display: block; margin-bottom: var(--space-1);">View:</label>
            <select id="filter-view" style="padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
              <option value="all" ${this.filterView === 'all' ? 'selected' : ''}>All remediation tasks</option>
              <option value="relevant" ${this.filterView === 'relevant' ? 'selected' : ''}>Relevant to my work</option>
              <option value="needs-content" ${this.filterView === 'needs-content' ? 'selected' : ''}>Needs content decision</option>
              <option value="needs-design" ${this.filterView === 'needs-design' ? 'selected' : ''}>Needs design decision</option>
              <option value="ready-dev" ${this.filterView === 'ready-dev' ? 'selected' : ''}>Ready for development</option>
              <option value="needs-a11y-review" ${this.filterView === 'needs-a11y-review' ? 'selected' : ''}>Needs accessibility review</option>
              <option value="ready-verification" ${this.filterView === 'ready-verification' ? 'selected' : ''}>Ready for verification</option>
              <option value="needs-another-role" ${this.filterView === 'needs-another-role' ? 'selected' : ''}>Needs another role</option>
            </select>
          </div>

          <div>
            <label for="filter-urgency" style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-secondary); display: block; margin-bottom: var(--space-1);">Urgency:</label>
            <select id="filter-urgency" style="padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
              <option value="all" ${this.filterUrgency === 'all' ? 'selected' : ''}>All Urgencies</option>
              <option value="critical" ${this.filterUrgency === 'critical' ? 'selected' : ''}>Critical</option>
              <option value="high" ${this.filterUrgency === 'high' ? 'selected' : ''}>High</option>
              <option value="medium" ${this.filterUrgency === 'medium' ? 'selected' : ''}>Medium</option>
            </select>
          </div>

          <div>
            <label for="filter-status" style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-secondary); display: block; margin-bottom: var(--space-1);">Status:</label>
            <select id="filter-status" style="padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Statuses</option>
              ${TASK_STATUSES.map(s => `<option value="${s}" ${this.filterStatus === s ? 'selected' : ''}>${TASK_STATUS_LABELS[s]}</option>`).join('')}
            </select>
          </div>

          <div style="align-self: flex-end;">
            <label style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm);">
              <input type="checkbox" id="persist-status" ${taskStatusStore.persist ? 'checked' : ''} />
              Save task statuses locally on this device
            </label>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1); max-width: 32ch;">
              Stores only task statuses for this report in your browser. Your report
              contents are never saved. Untick to turn off and clear.
            </p>
          </div>
        </div>

        <!-- Task List -->
        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          ${filtered.map(t => `
            <article class="card" style="margin-bottom: 0;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-2);">
                <div>
                  <a href="#/task/${escapeAttr(t.id)}" style="font-size: var(--font-size-lg); font-weight: 700; color: var(--color-brand-primary); text-decoration: none;">${escapeHtml(t.title)}</a>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1);">
                    Rule: <code>${escapeHtml(t.ruleId)}</code> (WCAG ${escapeHtml(t.wcag.join(', ')) || 'N/A'})
                  </div>
                </div>
                <div style="display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap;">
                  ${t.consolidated ? `<span class="badge badge-medium">Consolidated: ${t.metrics.patternVariantCount} patterns</span>` : ''}
                  <span class="badge badge-${escapeAttr(t.urgency)}" title="How severe/pressing the barrier is">Urgency: ${escapeHtml(t.urgency)}</span>
                  <span class="badge badge-high" title="How many occurrences/pages this fix addresses">Leverage: ${escapeHtml(t.leverage)}</span>
                  ${t.componentHypothesis ? `<span class="badge badge-medium" title="Confidence that these patterns share one component">Shared-component confidence: ${escapeHtml(t.componentHypothesis.confidence)}</span>` : ''}
                </div>
              </div>

              <div style="margin: var(--space-3) 0; font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                ${escapeHtml(t.blueprint.problem)}
              </div>

              ${renderRelevance(routeByTaskId.get(t.id))}

              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-muted);">
                <div>
                  ${renderRoleGuidance(t.roles)}
                  ${t.componentHypothesis ? ` | <strong>Component:</strong> ${escapeHtml(t.componentHypothesis.name)}` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
                  <span><strong>Affected:</strong> ${t.metrics.affectedPagesCount} pages (${t.metrics.observationCount} occurrences)</span>
                  <label style="display: flex; align-items: center; gap: var(--space-1); max-width: 100%;">
                    <span style="font-weight: 700;">Status</span>
                    <select class="task-status-select" data-task-id="${escapeAttr(t.id)}" style="max-width: 100%; padding: var(--space-1); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                      ${TASK_STATUSES.map(s => `<option value="${s}" ${taskStatusStore.get(t.id) === s ? 'selected' : ''}>${TASK_STATUS_LABELS[s]}</option>`).join('')}
                    </select>
                  </label>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `;

    this.setupListeners();
  }

  setupListeners() {
    const viewSelect = this.querySelector('#filter-view');
    const urgencySelect = this.querySelector('#filter-urgency');

    if (viewSelect) {
      viewSelect.addEventListener('change', (e) => {
        this.filterView = e.target.value;
        this._pendingAnnounce = `View changed to ${e.target.options[e.target.selectedIndex].text}.`;
        this._restoreFocusId = 'filter-view';
        this.render();
      });
    }

    if (urgencySelect) {
      urgencySelect.addEventListener('change', (e) => {
        this.filterUrgency = e.target.value;
        this._restoreFocusId = 'filter-urgency';
        this.render();
      });
    }

    const statusSelect = this.querySelector('#filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this._restoreFocusId = 'filter-status';
        this.render();
      });
    }

    const viewAllBtn = this.querySelector('#view-all-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        this.filterView = 'all';
        this.filterUrgency = 'all';
        this.filterStatus = 'all';
        this._pendingAnnounce = 'Showing all tasks.';
        this.render();
      });
    }

    // Per-task status changes. Re-rendering replaces the whole list, so remember
    // which control changed and restore focus to it afterwards (no lost place for
    // keyboard/SR users), and announce the change politely.
    this.querySelectorAll('.task-status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const taskId = e.target.getAttribute('data-task-id');
        const label = TASK_STATUS_LABELS[e.target.value] || e.target.value;
        this._restoreFocusTaskId = taskId;
        this._pendingAnnounce = `Task status changed to ${label}.`;
        taskStatusStore.set(taskId, e.target.value);
      });
    });

    // Persistence opt-in.
    const persistToggle = this.querySelector('#persist-status');
    if (persistToggle) {
      persistToggle.addEventListener('change', (e) => {
        taskStatusStore.setPersistence(e.target.checked);
        this._pendingAnnounce = e.target.checked
          ? 'Task statuses will be saved locally on this device.'
          : 'Local task-status saving turned off and cleared.';
      });
    }

    // Restore focus to a status control after a status-driven re-render.
    if (this._restoreFocusTaskId) {
      const target = this.querySelector(`.task-status-select[data-task-id="${CSS.escape(this._restoreFocusTaskId)}"]`);
      if (target) target.focus();
      this._restoreFocusTaskId = null;
    }

    // Restore focus to a filter control after a filter-driven re-render, so a
    // keyboard/SR user keeps their place (spec §7.4: no lost focus).
    if (this._restoreFocusId) {
      const el = this.querySelector(`#${CSS.escape(this._restoreFocusId)}`);
      if (el) el.focus();
      this._restoreFocusId = null;
    }

    // Announce applied filter / status change politely, WITHOUT moving focus for
    // filter changes (spec §7.4).
    if (this._pendingAnnounce) {
      const announcer = this.querySelector('#filter-announcer');
      if (announcer) announcer.textContent = this._pendingAnnounce;
      this._pendingAnnounce = null;
    }
  }
}

/**
 * Renders ARRM role guidance preserving primary / secondary / contributor
 * distinctions (spec §7.2) — never as organizational ownership — and labels the
 * source (W3C ARRM vs Workbench inference, spec §7.3).
 */
/**
 * Renders the capability-routing verdict for a task. Relevance is communicated
 * with a text label and a reason — not colour alone (spec §7.4).
 */
function renderRelevance(route) {
  if (!route || route.relevance === 'unfiltered') return '';
  const labels = {
    'direct': 'Direct — you can act on this',
    'decision': 'You can make the required decision',
    'implementation-blocked': 'Implementation work — blocked by a decision',
    'review-only': 'Review only',
    'handoff': 'Likely needs another role — prepare a handoff'
  };
  const label = labels[route.relevance] || route.relevance;
  const reasons = (route.reason || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');
  return `
    <div style="margin: var(--space-2) 0; padding: var(--space-2) var(--space-3); background-color: var(--color-bg-subtle); border-left: 3px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-xs);">
      <strong>Relevance:</strong> ${escapeHtml(label)}
      ${reasons ? `<ul style="margin: var(--space-1) 0 0 var(--space-4);">${reasons}</ul>` : ''}
    </div>
  `;
}

/** True if a role name appears in any of the task's ARRM role tiers. */
function roleInvolved(task, keyword) {
  const roles = task.roles || {};
  const all = [roles.primary, ...(roles.coPrimary || []), ...(roles.secondary || []), ...(roles.contributors || [])].filter(Boolean);
  return all.some(r => r.includes(keyword));
}

customElements.define('task-list', TaskList);
