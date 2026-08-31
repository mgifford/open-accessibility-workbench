import { escapeHtml } from '../utils/escape-html.js';
import { ARRM_METADATA } from './arrm.js';

/**
 * Single source-aware role-guidance renderer used by BOTH the task list and task
 * detail, so role presentation is consistent everywhere (spec §7.2/§7.3/§7.6
 * review #6). Preserves primary / co-primary / secondary / contributor
 * distinctions as guidance — never ownership — and labels the source honestly
 * (W3C ARRM, W3C ARRM + Workbench extension, or unmapped). `detailed` adds
 * matched success criteria and snapshot provenance.
 */
export function renderRoleGuidance(roles = {}, { detailed = false } = {}) {
  if (!roles || roles.needsAccessibilityTriage || roles.source === 'unmapped') {
    return `<div>No ARRM or curated Workbench mapping is available — <strong>needs accessibility triage</strong> to determine the role(s). <span style="color: var(--color-text-muted);">(unmapped)</span></div>`;
  }

  const parts = [];
  if (roles.primary) parts.push(`<strong>Likely primary role involvement:</strong> ${escapeHtml(roles.primary)}`);
  if (roles.coPrimary && roles.coPrimary.length) parts.push(`<strong>Also primary:</strong> ${escapeHtml(roles.coPrimary.join(', '))}`);
  if (roles.secondary && roles.secondary.length) parts.push(`<strong>Likely secondary involvement:</strong> ${escapeHtml(roles.secondary.join(', '))}`);
  if (roles.contributors && roles.contributors.length) parts.push(`<strong>Possible contributor:</strong> ${escapeHtml(roles.contributors.join(', '))}`);

  const sourceLabel = roles.source === 'mixed'
    ? 'W3C ARRM + Workbench extension'
    : (roles.source === 'w3c-arrm' ? 'W3C ARRM' : 'Workbench inference');

  let provenance = `<div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1);">Source: ${escapeHtml(sourceLabel)}`;
  if (detailed) {
    if (Array.isArray(roles.matchedSc) && roles.matchedSc.length) {
      provenance += ` &bull; WCAG: ${escapeHtml(roles.matchedSc.join(', '))}`;
    }
    provenance += ` &bull; snapshot ${escapeHtml(ARRM_METADATA.snapshotDate)} &bull; ${escapeHtml(ARRM_METADATA.license)}`;
    provenance += ` &bull; <a href="${escapeHtml(ARRM_METADATA.sourceUrl)}" target="_blank" rel="noopener noreferrer">ARRM (draft)</a>`;
  }
  provenance += '</div>';

  return `<div style="font-size: var(--font-size-sm);">${parts.join(' &bull; ')}</div>${provenance}
    <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1);">Guidance for routing, not an assignment of who must do the work.</div>`;
}
