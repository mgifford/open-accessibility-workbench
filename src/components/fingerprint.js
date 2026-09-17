/**
 * Renders an accessibility fingerprint (display alias + full digest) with a
 * short explanation and a link to the spec. Used on Pattern Explorer (pattern
 * fingerprint) and Task Detail (pattern + representative occurrence). Returns ''
 * when no fingerprint is available so callers can drop it silently.
 */

import { escapeHtml, escapeAttr } from '../utils/escape-html.js';

const SPEC_URL = 'https://mgifford.github.io/ACCESSIBILITY.md/examples/fingerprints/README.html';

/**
 * @param {{ digest: string|null, displayId: string|null, source: string }|null} fp
 * @param {{ label?: string }} [opts] label overrides the default "Fingerprint".
 */
export function renderFingerprint(fp, opts = {}) {
  if (!fp || (!fp.digest && !fp.displayId)) return '';
  const label = opts.label || 'Fingerprint';
  const alias = fp.displayId || fp.digest.slice(0, 12).toUpperCase();
  const origin = fp.source === 'workbench-derived'
    ? 'computed by the Workbench (the source report carried none)'
    : 'from the source scan';
  return `
    <div class="fingerprint">
      <span class="fingerprint__label">${escapeHtml(label)}:</span>
      <code class="fingerprint__alias" title="${escapeAttr(fp.digest || alias)}">${escapeHtml(alias)}</code>
      <span class="fingerprint__origin">(${escapeHtml(origin)})</span>
      ${fp.digest ? `<details class="fingerprint__full"><summary>full digest</summary><code>${escapeHtml(fp.digest)}</code></details>` : ''}
    </div>
  `;
}

/** A one-line explainer + spec link, shown once per view where fingerprints appear. */
export function renderFingerprintNote() {
  return `
    <p class="fingerprint__note">
      Fingerprints are stable identifiers for a finding, so the same issue can be tracked across scans and tools.
      <a href="${SPEC_URL}" target="_blank" rel="noopener noreferrer">About accessibility fingerprints</a>.
    </p>
  `;
}
