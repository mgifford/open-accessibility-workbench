import { workspaceStore } from '../state/workspace.js';
import { profileStore } from '../state/profile.js';
import { isTaskRelevantToProfile } from '../roles/route-task.js';
import { escapeHtml, escapeAttr } from '../utils/escape-html.js';
import { taskStatusStore, TASK_STATUSES, TASK_STATUS_LABELS } from '../state/task-status.js';

export class TaskList extends HTMLElement {
  constructor() {
    super();
    this.filterRole = 'all';
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

    let filtered = tasks;

    // Apply role-relevance or explicit filters
    if (this.filterRole === 'relevant' && selectedCapabilities.length > 0) {
      filtered = filtered.filter(t => isTaskRelevantToProfile(t, selectedCapabilities));
    } else if (this.filterRole !== 'all' && this.filterRole !== 'relevant') {
      filtered = filtered.filter(t => t.roles?.primary?.toLowerCase().includes(this.filterRole));
    }

    if (this.filterUrgency !== 'all') {
      filtered = filtered.filter(t => t.urgency === this.filterUrgency);
    }

    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(t => taskStatusStore.get(t.id) === this.filterStatus);
    }

    const statusCounts = taskStatusStore.summary(tasks.map(t => t.id));

    this.innerHTML = `
      <section>
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: var(--font-size-2xl);">Remediation Tasks</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              ${filtered.length} actionable tasks (from ${tasks.length} total) &bull;
              ${statusCounts.done} done, ${statusCounts['in-progress']} in progress, ${statusCounts['needs-decision']} need a decision, ${statusCounts.open} open
            </p>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="card" style="padding: var(--space-4); margin-bottom: var(--space-6); display: flex; gap: var(--space-4); flex-wrap: wrap; align-items: center;">
          <div>
            <label for="filter-role" style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-secondary); display: block; margin-bottom: var(--space-1);">Role View:</label>
            <select id="filter-role" style="padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
              <option value="all" ${this.filterRole === 'all' ? 'selected' : ''}>All Tasks</option>
              <option value="relevant" ${this.filterRole === 'relevant' ? 'selected' : ''}>Relevant to My Profile</option>
              <option value="content" ${this.filterRole === 'content' ? 'selected' : ''}>Content Authoring</option>
              <option value="visual" ${this.filterRole === 'visual' ? 'selected' : ''}>Visual Design</option>
              <option value="front-end" ${this.filterRole === 'front-end' ? 'selected' : ''}>Front-End Development</option>
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
                <div style="display: flex; gap: var(--space-2); align-items: center;">
                  ${t.consolidated ? `<span class="badge badge-medium">Consolidated: ${t.metrics.patternVariantCount} patterns</span>` : ''}
                  <span class="badge badge-${escapeAttr(t.urgency)}">Urgency: ${escapeHtml(t.urgency)}</span>
                  <span class="badge badge-high">Leverage: ${escapeHtml(t.leverage)}</span>
                </div>
              </div>

              <div style="margin: var(--space-3) 0; font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                ${escapeHtml(t.blueprint.problem)}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-muted);">
                <div>
                  <strong>Primary Role:</strong> ${escapeHtml(t.roles.primary)}
                  ${t.componentHypothesis ? ` | <strong>Component:</strong> ${escapeHtml(t.componentHypothesis.name)}` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-3);">
                  <span><strong>Affected:</strong> ${t.metrics.affectedPagesCount} pages (${t.metrics.observationCount} occurrences)</span>
                  <label style="display: flex; align-items: center; gap: var(--space-1);">
                    <span style="font-weight: 700;">Status</span>
                    <select class="task-status-select" data-task-id="${escapeAttr(t.id)}" style="padding: var(--space-1); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
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
    const roleSelect = this.querySelector('#filter-role');
    const urgencySelect = this.querySelector('#filter-urgency');

    if (roleSelect) {
      roleSelect.addEventListener('change', (e) => {
        this.filterRole = e.target.value;
        this.render();
      });
    }

    if (urgencySelect) {
      urgencySelect.addEventListener('change', (e) => {
        this.filterUrgency = e.target.value;
        this.render();
      });
    }

    const statusSelect = this.querySelector('#filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this.render();
      });
    }

    // Per-task status changes. The store notifies subscribers, which re-renders.
    this.querySelectorAll('.task-status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        taskStatusStore.set(e.target.getAttribute('data-task-id'), e.target.value);
      });
    });
  }
}

customElements.define('task-list', TaskList);
