import { workspaceStore } from '../state/workspace.js';
import { profileStore } from '../state/profile.js';
import { isTaskRelevantToProfile } from '../roles/route-task.js';
import { escapeHtml, escapeAttr } from '../utils/escape-html.js';

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
          ${engines.length ? `<div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Engines</dt><dd style="font-weight: 600;">${escapeHtml(engines.join(', '))}</dd></div>` : ''}
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
                  <th scope="row" style="padding: var(--space-2); font-weight: 600;">${escapeHtml(r.label)}</th>
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

  /**
   * Renders a useful overview for aggregate/summary reports (the four Oobee
   * summary JSONs and a standalone Open Scans overlap report), which carry no
   * finding-level evidence. All report-derived text is escaped.
   */
  renderSummaryView(s, sourceSummary, overlapData) {
    const header = `
      <div class="card-header">
        <div>
          <h2 class="card-title" style="font-size: var(--font-size-2xl);">Scan Summary</h2>
          <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
            Source: <strong>${escapeHtml(sourceSummary?.system) || 'Unknown'}</strong> — ${escapeHtml(s.format)}
          </p>
        </div>
        <a href="#/import" class="btn btn-secondary">Import another report</a>
      </div>
      <div class="card" style="background-color: var(--color-brand-bg); border-left: 4px solid var(--color-brand-primary); margin-bottom: var(--space-6);">
        This is an <strong>aggregate summary</strong> report. It has no finding-level
        selectors or HTML, so it is shown as counts rather than remediation tasks.
        Load a finding-level report (Open Scans <code>report.json</code> or Oobee
        <code>report.csv</code>) to generate remediation tasks.
      </div>
    `;

    let body = '';
    if (s.kind === 'oobee-items') {
      const c = s.severityCounts;
      body = `
        <div class="card">
          <h3 class="card-title">Issue counts by severity</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); margin-top: var(--space-3);">
              <caption class="sr-only">Oobee item counts by severity category</caption>
              <thead><tr style="text-align: left; border-bottom: 2px solid var(--color-border);">
                <th scope="col" style="padding: var(--space-2);">Severity category</th>
                <th scope="col" style="padding: var(--space-2); text-align: right;">Items</th>
              </tr></thead>
              <tbody>
                <tr style="border-bottom: 1px solid var(--color-border);"><th scope="row" style="padding: var(--space-2);">Must fix</th><td style="padding: var(--space-2); text-align: right;">${c.mustFix}</td></tr>
                <tr style="border-bottom: 1px solid var(--color-border);"><th scope="row" style="padding: var(--space-2);">Good to fix</th><td style="padding: var(--space-2); text-align: right;">${c.goodToFix}</td></tr>
                <tr style="border-bottom: 1px solid var(--color-border);"><th scope="row" style="padding: var(--space-2);">Needs review</th><td style="padding: var(--space-2); text-align: right;">${c.needsReview}</td></tr>
                <tr style="font-weight: 700;"><th scope="row" style="padding: var(--space-2);">Total</th><td style="padding: var(--space-2); text-align: right;">${s.totalItems}</td></tr>
              </tbody>
            </table>
          </div>
          <dl style="display: flex; gap: var(--space-6); flex-wrap: wrap; margin-top: var(--space-4);">
            ${s.totalPagesScanned != null ? `<div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Pages scanned</dt><dd style="font-weight: 600;">${s.totalPagesScanned}</dd></div>` : ''}
            ${s.wcagPassPercentage != null ? `<div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">WCAG pass</dt><dd style="font-weight: 600;">${s.wcagPassPercentage}%</dd></div>` : ''}
          </dl>
        </div>
      `;
    } else if (s.kind === 'oobee-issues') {
      body = `
        <div class="card">
          <h3 class="card-title">Rules by severity (${s.issues.length})</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); margin-top: var(--space-3);">
              <caption class="sr-only">Oobee rules grouped by severity</caption>
              <thead><tr style="text-align: left; border-bottom: 2px solid var(--color-border);">
                <th scope="col" style="padding: var(--space-2);">Rule</th>
                <th scope="col" style="padding: var(--space-2);">Severity</th>
                <th scope="col" style="padding: var(--space-2); text-align: right;">Items</th>
              </tr></thead>
              <tbody>
                ${s.issues.map(i => `
                  <tr style="border-bottom: 1px solid var(--color-border);">
                    <th scope="row" style="padding: var(--space-2); font-weight: 600;">${escapeHtml(i.rule || i.issueId || '—')}</th>
                    <td style="padding: var(--space-2);">${escapeHtml(i.category || '—')}</td>
                    <td style="padding: var(--space-2); text-align: right;">${escapeHtml(i.totalItems ?? '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (s.kind === 'oobee-pages') {
      body = `
        <div class="card">
          <h3 class="card-title">Pages scanned</h3>
          <dl style="display: flex; gap: var(--space-6); flex-wrap: wrap; margin: var(--space-3) 0;">
            <div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Scanned</dt><dd style="font-weight: 600;">${s.scannedPagesCount}</dd></div>
            <div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">With issues</dt><dd style="font-weight: 600;">${s.pagesAffected.length}</dd></div>
            <div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Without issues</dt><dd style="font-weight: 600;">${s.pagesNotAffected.length}</dd></div>
            <div><dt style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Not scanned</dt><dd style="font-weight: 600;">${s.pagesNotScanned.length}</dd></div>
          </dl>
          ${s.pagesAffected.length ? `<p style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-secondary);">Pages with issues:</p>
          <ul style="font-size: var(--font-size-sm); margin-left: var(--space-4);">${s.pagesAffected.slice(0, 20).map(p => `<li>${escapeHtml(p.pageTitle || p.url || p)}</li>`).join('')}</ul>` : ''}
        </div>
      `;
    } else if (s.kind === 'oobee-pages-detail') {
      body = `
        <div class="card">
          <h3 class="card-title">Per-page issue breakdown (${s.pages.length} pages)</h3>
          <ul style="font-size: var(--font-size-sm); margin-left: var(--space-4); margin-top: var(--space-3);">
            ${s.pages.slice(0, 20).map(p => `
              <li style="margin-bottom: var(--space-2);">
                <strong>${escapeHtml(p.pageTitle || p.url || '(page)')}</strong>
                ${Array.isArray(p.typesOfIssues) ? ` — ${p.typesOfIssues.length} issue type(s)` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    } else if (s.kind === 'open-scans-overlap') {
      // Reuse the scan-summary table renderer with just the overlap data.
      body = this.renderScanSummary({ system: sourceSummary?.system, engines: s.overlap.scannersInUse }, s.overlap);
    }

    return `<section>${header}${body}</section>`;
  }

  render() {
    const { loaded, observations, clusters, hypotheses, tasks, sourceSummary, overlapData, summaryData, importNote } = workspaceStore.state;
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

    // Aggregate/summary reports carry no finding-level evidence, so render a
    // dedicated summary view instead of the reduction/task pipeline.
    if (summaryData) {
      this.innerHTML = this.renderSummaryView(summaryData, sourceSummary, overlapData);
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
              Source: <strong>${escapeHtml(sourceSummary?.system) || 'Unknown'}</strong> (Scan: ${escapeHtml(sourceSummary?.scanId) || 'N/A'})
            </p>
          </div>
          <a href="#/tasks" class="btn btn-primary">View All Tasks (${tasks.length})</a>
        </div>

        ${importNote ? `
        <p role="status" style="background: var(--color-brand-bg); color: var(--color-text-primary); border: 1px solid var(--color-border); border-left: 4px solid var(--color-brand-primary); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: var(--font-size-sm);">
          ${escapeHtml(importNote)}
        </p>` : ''}

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
                    <a href="#/task/${escapeAttr(t.id)}" style="font-weight: 600; color: var(--color-brand-primary); text-decoration: none;">${escapeHtml(t.title)}</a>
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
                    <a href="#/task/${escapeAttr(t.id)}" style="font-weight: 600; color: var(--color-brand-primary); text-decoration: none;">${escapeHtml(t.title)}</a>
                    <span class="badge badge-${t.urgency}">${t.urgency}</span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-1);">
                    Primary role: ${escapeHtml(t.roles.primary)}
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
