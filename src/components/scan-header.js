/**
 * Shared scan-scope header: the domain(s) in scope and the scale of the problem.
 * Rendered at the top of the analysis views (Overview, Patterns, Tasks, Roles)
 * so a user always knows which site these findings belong to and how big the
 * problem is. Returns an HTML string (views compose innerHTML), or '' when no
 * scope is available.
 */

import { escapeHtml, escapeAttr } from '../utils/escape-html.js';

const MAX_DOMAINS_SHOWN = 3;

/**
 * @param {ReturnType<import('../analysis/scan-scope.js').buildScanScope>} scope
 * @param {{ compact?: boolean }} [opts] compact omits the scale line (for
 *   secondary views that only need the domain context).
 */
export function renderScanHeader(scope, opts = {}) {
  if (!scope) return '';
  const { domains = [], totalDomains = 0, scale = {} } = scope;
  const shown = domains.slice(0, MAX_DOMAINS_SHOWN);
  const moreCount = totalDomains - shown.length;

  const domainList = shown.length
    ? shown.map(d => `<span class="scan-header__domain">${escapeHtml(d.domain)}</span>`).join('')
    : '<span class="scan-header__domain scan-header__domain--none">domain not available</span>';
  const moreLabel = moreCount > 0
    ? ` <span class="scan-header__more">+${moreCount} more ${moreCount === 1 ? 'domain' : 'domains'}</span>`
    : '';

  const scaleLine = opts.compact ? '' : renderScaleLine(scale);

  return `
    <div class="scan-header" role="group" aria-label="Scan scope">
      <div class="scan-header__row">
        <span class="scan-header__label">${totalDomains === 1 ? 'Domain' : 'Domains'}:</span>
        ${domainList}${moreLabel}
      </div>
      ${scaleLine}
    </div>
  `;
}

function renderScaleLine(scale) {
  const { totalPages = 0, pagesWithFindings = 0, percentage = null } = scale;
  if (!totalPages) return '';
  const pct = percentage != null ? ` (${percentage}%)` : '';
  return `
    <div class="scan-header__row scan-header__scale">
      <span class="scan-header__label">Scale:</span>
      <span><strong>${pagesWithFindings}</strong> of <strong>${totalPages}</strong> scanned ${totalPages === 1 ? 'page has' : 'pages have'} findings${pct}</span>
    </div>
  `;
}

/**
 * A compact list of the most common recurring patterns, linking to their tasks.
 * Answers "are there simple common patterns that show up a lot?". Rendered as a
 * standalone block (not part of the header bar) so views can place it where it
 * fits. Returns '' when there are no patterns.
 */
export function renderCommonPatterns(patterns = []) {
  if (!Array.isArray(patterns) || patterns.length === 0) return '';
  return `
    <div class="card">
      <h3 class="card-title" style="margin-bottom: var(--space-2);">Most common patterns</h3>
      <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-3);">
        Recurring issues ranked by how many pages they affect — the strongest signal of a shared, fixable pattern.
      </p>
      <ul style="list-style: none; display: flex; flex-direction: column; gap: var(--space-2);">
        ${patterns.map(p => `
          <li style="display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);">
            <a href="#/task/${escapeAttr(p.taskId)}" style="font-weight: 600; color: var(--color-brand-primary); text-decoration: none;">${escapeHtml(p.title)}</a>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); white-space: nowrap;">
              <code>${escapeHtml(p.ruleId)}</code> · ${p.pageCount} ${p.pageCount === 1 ? 'page' : 'pages'}
            </span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}
