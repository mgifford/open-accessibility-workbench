import { workspaceStore } from '../state/workspace.js';
import { profileStore } from '../state/profile.js';
import { isTaskRelevantToProfile } from '../roles/route-task.js';
import { escapeHtml, escapeAttr } from '../utils/escape-html.js';

export class TaskList extends HTMLElement {
  constructor() {
    super();
    this.filterRole = 'all';
    this.filterUrgency = 'all';
  }

  connectedCallback() {
    this.unsubscribeWorkspace = workspaceStore.subscribe(() => this.render());
    this.unsubscribeProfile = profileStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribeWorkspace) this.unsubscribeWorkspace();
    if (this.unsubscribeProfile) this.unsubscribeProfile();
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

    this.innerHTML = `
      <section>
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: var(--font-size-2xl);">Remediation Tasks</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              ${filtered.length} actionable tasks (from ${tasks.length} total)
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
                <div style="display: flex; gap: var(--space-2);">
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
                <div>
                  <strong>Affected:</strong> ${t.metrics.affectedPagesCount} pages (${t.metrics.observationCount} occurrences)
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
  }
}

customElements.define('task-list', TaskList);
