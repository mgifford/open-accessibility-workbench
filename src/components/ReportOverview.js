import { workspaceStore } from '../state/workspace.js';
import { profileStore } from '../state/profile.js';
import { isTaskRelevantToProfile } from '../roles/route-task.js';

export class ReportOverview extends HTMLElement {
  connectedCallback() {
    this.unsubscribeWorkspace = workspaceStore.subscribe(() => this.render());
    this.unsubscribeProfile = profileStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribeWorkspace) this.unsubscribeWorkspace();
    if (this.unsubscribeProfile) this.unsubscribeProfile();
  }

  /**
   * Renders a scan-source summary the user can check against the original
   * report artifacts: engines run, pages scanned, and per-scanner failure
   * counts. Prefers cross-scanner overlap stats (label + failed + duplicates)
   * when present, else the report's own rawTotals. Uses a semantic table.
   */
  renderScanSummary(sourceSummary, overlapData) {
    if (!sourceSummary) return '';

    const engines = sourceSummary.engines || [];
    const totalPages = sourceSummary.totalPages;
    const stats = overlapData?.scannerStats || null;
    const rawTotals = sourceSummary.rawTotals || null;

    // Build rows from overlap scannerStats when available (richest, real
    // upstream shape), otherwise fall back to rawTotals.
    let rows = [];
    if (stats) {
      rows = Object.entries(stats).map(([id, s]) => ({
        label: s.label || id,
        failed: s.failed ?? 0,
        unique: s.uniqueFailed,
        duplicates: s.duplicates
      }));
    } else if (rawTotals) {
      rows = Object.entries(rawTotals)
        .filter(([, v]) => v && typeof v === 'object' && 'failed' in v)
        .map(([id, v]) => ({ label: id, failed: v.failed ?? 0, unique: undefined, duplicates: undefined }));
    }

    if (rows.length === 0 && !totalPages) return '';

    const hasOverlapCols = rows.some(r => r.unique !== undefined || r.duplicates !== undefined);

    return `
      <section class="card" aria-labelledby="scan-summary-title" style="margin-bottom: var(--space-6);">
        <h3 id="scan-summary-title" class="card-title">Scan Source Summary</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin: var(--space-2) 0 var(--space-4);">
          Counts reported by the source scan artifact${overlapData ? ' (including cross-scanner overlap statistics)' : ''}.
          These should agree with the original report.
        </p>
        <dl style="display: flex; gap: var(--space-6); flex-wrap: wrap; margin-bottom: var(--space-4);">
          ${engines.length ? `<div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Engines</dt><dd style="font-weight: 600;">${engines.join(', ')}</dd></div>` : ''}
          ${totalPages ? `<div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Pages scanned</dt><dd style="font-weight: 600;">${totalPages}</dd></div>` : ''}
          ${overlapData?.duplicateFindingTotals != null ? `<div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Duplicate findings</dt><dd style="font-weight: 600;">${overlapData.duplicateFindingTotals}</dd></div>` : ''}
        </dl>
        ${rows.length ? `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm);">
            <caption class="sr-only">Findings failed per scanner engine</caption>
            <thead>
              <tr style="text-align: left; border-bottom: 2px solid var(--color-border);">
                <th scope="col" style="padding: var(--space-2);">Scanner</th>
                <th scope="col" style="padding: var(--space-2); text-align: right;">Failed</th>
                ${hasOverlapCols ? `<th scope="col" style="padding: var(--space-2); text-align: right;">Unique</th><th scope="col" style="padding: var(--space-2); text-align: right;">Duplicates</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr style="border-bottom: 1px solid var(--color-border);">
                  <th scope="row" style="padding: var(--space-2); font-weight: 600;">${r.label}</th>
                  <td style="padding: var(--space-2); text-align: right;">${r.failed}</td>
                  ${hasOverlapCols ? `<td style="padding: var(--space-2); text-align: right;">${r.unique ?? '—'}</td><td style="padding: var(--space-2); text-align: right;">${r.duplicates ?? '—'}</td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${sourceSummary.granularity === 'page' ? `<p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">This is a page-level summary CSV; it does not contain finding-level selectors or HTML.</p>` : ''}
        ` : ''}
      </section>
    `;
  }

  render() {
    const { loaded, observations, clusters, hypotheses, tasks, sourceSummary, overlapData } = workspaceStore.state;
    const { selectedCapabilities } = profileStore.state;

    if (!loaded) {
      this.innerHTML = `
        <section class="card">
          <h2 class="card-title">No Scan Loaded</h2>
          <p style="color: var(--color-text-muted); margin: var(--space-4) 0;">Please import an accessibility scan report to view analysis.</p>
          <a href="#/import" class="btn btn-primary">Go to Import</a>
        </section>
      `;
      return;
    }

    const relevantTasks = tasks.filter(t => isTaskRelevantToProfile(t, selectedCapabilities));
    const highestLeverageTasks = tasks.filter(t => t.leverage === 'very-high' || t.leverage === 'high').slice(0, 3);
    const highestUrgencyTasks = tasks.filter(t => t.urgency === 'critical' || t.urgency === 'high').slice(0, 3);

    this.innerHTML = `
      <section>
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: var(--font-size-2xl);">Remediation Overview</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              Source: <strong>${sourceSummary?.system || 'Unknown'}</strong> (Scan: ${sourceSummary?.scanId || 'N/A'})
            </p>
          </div>
          <a href="#/tasks" class="btn btn-primary">View All Tasks (${tasks.length})</a>
        </div>

        ${this.renderScanSummary(sourceSummary, overlapData)}

        <!-- Reduction Waterfall -->
        <div class="reduction-waterfall" aria-label="Reduction Metrics Waterfall">
          <div class="waterfall-step">
            <div class="waterfall-number">${observations.length}</div>
            <div class="waterfall-label">Observations</div>
          </div>
          <div class="waterfall-arrow" aria-hidden="true">↓</div>
          <div class="waterfall-step">
            <div class="waterfall-number">${clusters.length}</div>
            <div class="waterfall-label">Patterns</div>
          </div>
          <div class="waterfall-arrow" aria-hidden="true">↓</div>
          <div class="waterfall-step">
            <div class="waterfall-number">${hypotheses.filter(h => h.confidence !== 'low').length}</div>
            <div class="waterfall-label">Components</div>
          </div>
          <div class="waterfall-arrow" aria-hidden="true">↓</div>
          <div class="waterfall-step">
            <div class="waterfall-number" style="color: var(--color-brand-primary);">${tasks.length}</div>
            <div class="waterfall-label">Remediation Tasks</div>
          </div>
        </div>

        <!-- Role Relevance Notice -->
        ${selectedCapabilities.length > 0 ? `
          <div style="background-color: var(--color-brand-bg); border-left: 4px solid var(--color-brand-primary); padding: var(--space-4); margin-bottom: var(--space-6); border-radius: var(--radius-sm);">
            <strong>Profile Active:</strong> Showing ${relevantTasks.length} of ${tasks.length} tasks matched to your selected capabilities.
            <a href="#/roles" style="margin-left: var(--space-2); color: var(--color-brand-primary); font-weight: 600;">Adjust Profile</a>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-6);">
          <!-- Highest Leverage Card -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom: var(--space-4);">Highest Leverage Tasks</h3>
            <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-4);">
              Fixing these shared components solves recurring failures across the highest number of pages.
            </p>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: var(--space-3);">
              ${highestLeverageTasks.map(t => `
                <li style="border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2);">
                    <a href="#/task/${t.id}" style="font-weight: 600; color: var(--color-brand-primary); text-decoration: none;">${t.title}</a>
                    <span class="badge badge-high">${t.leverage}</span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-1);">
                    ${t.metrics.affectedPagesCount} pages affected (${t.metrics.observationCount} occurrences)
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Highest Urgency Card -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom: var(--space-4);">Highest Urgency Tasks</h3>
            <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-4);">
              Severe accessibility barriers identified by automated scanner rules.
            </p>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: var(--space-3);">
              ${highestUrgencyTasks.map(t => `
                <li style="border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2);">
                    <a href="#/task/${t.id}" style="font-weight: 600; color: var(--color-brand-primary); text-decoration: none;">${t.title}</a>
                    <span class="badge badge-${t.urgency}">${t.urgency}</span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-1);">
                    Primary role: ${t.roles.primary}
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </section>
    `;
  }
}

customElements.define('report-overview', ReportOverview);
