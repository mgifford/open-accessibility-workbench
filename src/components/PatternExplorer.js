import { workspaceStore } from '../state/workspace.js';
import { escapeHtml, escapeAttr, safeUrl } from '../utils/escape-html.js';
import { buildScanScope, rankPatternsByStrength, patternStrength } from '../analysis/scan-scope.js';
import { renderScanHeader } from './scan-header.js';
import { patternFingerprintOf } from '../analysis/fingerprints.js';
import { renderFingerprint, renderFingerprintNote } from './fingerprint.js';
import { resolveRuleDisplay } from '../rules/rule-descriptions.js';
import { groupByRule, isIsolated } from '../analysis/pattern-grouping.js';

const STRENGTH_BADGE = {
  strong: { label: 'Strong pattern', cls: 'badge-high' },
  moderate: { label: 'Moderate pattern', cls: 'badge-medium' },
  isolated: { label: 'Isolated', cls: 'badge-low' }
};

export class PatternExplorer extends HTMLElement {
  connectedCallback() {
    this.unsubscribe = workspaceStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    const { loaded, clusters, hypotheses } = workspaceStore.state;

    if (!loaded) {
      this.innerHTML = `<section class="card"><p>Please load a report first.</p></section>`;
      return;
    }

    const scope = buildScanScope(workspaceStore.state);
    // Highest-confidence recurring patterns lead (strong → moderate → isolated).
    const orderedClusters = rankPatternsByStrength(clusters);
    // Fingerprints exist only when the source report carried them (open-scans
    // JSON does; the rule-only summary CSV does not). Show the explainer only
    // when at least one pattern actually has one.
    const anyFingerprint = orderedClusters.some(c => patternFingerprintOf(c));

    // Group patterns by rule so the view is scannable instead of a flat wall of
    // hundreds of cards. Nothing is hidden — every pattern is inside its group,
    // and one-off (isolated) patterns are tucked behind a per-group toggle. The
    // grouping is presentation only; the underlying clusters are unchanged.
    const groups = groupByRule(orderedClusters);
    const isolatedTotal = orderedClusters.filter(isIsolated).length;

    this.innerHTML = `
      <section>
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: var(--font-size-2xl);">Pattern Explorer</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              ${clusters.length} recurring structural patterns across ${groups.length} ${groups.length === 1 ? 'rule' : 'rules'}, strongest first — patterns that recur across many pages are the highest-confidence signal of a shared, fixable cause.${isolatedTotal ? ` ${isolatedTotal} one-off patterns are collapsed under each rule.` : ''}
            </p>
          </div>
        </div>

        ${renderScanHeader(scope, { compact: true })}
        ${anyFingerprint ? renderFingerprintNote() : ''}

        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          ${groups.map(g => this.renderRuleGroup(g, hypotheses)).join('')}
        </div>
      </section>
    `;
  }

  /** Renders a collapsible group of patterns that share a rule. */
  renderRuleGroup(group, hypotheses) {
    const { display, recurring, isolated } = group;
    const wcagText = display.wcag.length ? ` · WCAG ${escapeHtml(display.wcag.join(', '))}` : '';
    const heading = display.title ? escapeHtml(display.title) : escapeHtml(display.ruleId);
    // Every group opens by default so nothing is hidden two clicks deep. When a
    // group has BOTH recurring and isolated patterns, the recurring ones lead and
    // the one-off tail collapses behind a toggle. When a group is ENTIRELY
    // one-offs (common in small scans), show them directly — collapsing them all
    // would leave the open group empty.
    const collapseTail = recurring.length > 0 && isolated.length > 0;
    const shownDirectly = collapseTail ? recurring : [...recurring, ...isolated];
    return `
      <details open style="border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4);">
        <summary style="cursor: pointer; font-weight: 700; font-size: var(--font-size-lg);">
          ${heading} <span style="font-weight: 400; color: var(--color-text-muted); font-size: var(--font-size-sm);">— ${group.count} ${group.count === 1 ? 'pattern' : 'patterns'}${wcagText}</span>
        </summary>
        <div style="display: flex; flex-direction: column; gap: var(--space-4); margin-top: var(--space-3);">
          ${shownDirectly.map(c => this.renderPatternCard(c, hypotheses)).join('')}
          ${collapseTail ? `
            <details style="margin-top: var(--space-1);">
              <summary style="cursor: pointer; font-size: var(--font-size-sm); color: var(--color-brand-primary);">Show ${isolated.length} one-off ${isolated.length === 1 ? 'pattern' : 'patterns'} (appear once, no shared-template signal)</summary>
              <div style="display: flex; flex-direction: column; gap: var(--space-4); margin-top: var(--space-3);">
                ${isolated.map(c => this.renderPatternCard(c, hypotheses)).join('')}
              </div>
            </details>` : ''}
        </div>
      </details>
    `;
  }

  /** Renders one pattern-cluster card (unchanged content, extracted for grouping). */
  renderPatternCard(c, hypotheses) {
    const strength = STRENGTH_BADGE[patternStrength(c)];
    const fingerprint = patternFingerprintOf(c);
    // A component hypothesis may span several pattern clusters; match on
    // any member so every member pattern shows its component relationship.
    const hyp = hypotheses.find(
      h => h.clusterId === c.id || (Array.isArray(h.clusterIds) && h.clusterIds.includes(c.id))
    );
    return `
              <article class="card" style="border-left: 4px solid var(--color-brand-primary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-2);">
                  <div>
                    ${(() => {
                      const d = resolveRuleDisplay(c);
                      const idText = escapeHtml(d.ruleId);
                      const ruleLink = d.sourceUrl
                        ? `<a href="${escapeAttr(safeUrl(d.sourceUrl))}" target="_blank" rel="noopener noreferrer"><code>${idText}</code></a>`
                        : `<code>${idText}</code>`;
                      const wcagText = d.wcag.length ? ` · WCAG ${escapeHtml(d.wcag.join(', '))}` : '';
                      return `
                        <h3 style="font-size: var(--font-size-lg); font-weight: 700;">Pattern: ${d.title ? escapeHtml(d.title) : idText}</h3>
                        <div style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-1);">
                          Rule: ${ruleLink}${wcagText}
                        </div>
                        ${d.description ? `<div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-1);">${escapeHtml(d.description)}</div>` : ''}`;
                    })()}
                    <div style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-1);">
                      ${c.upstreamPatternId ? `Authoritative Upstream ID: <code>${escapeHtml(c.upstreamPatternId)}</code>` : 'Synthesized DOM cluster'}
                    </div>
                    ${renderFingerprint(fingerprint, { label: 'Pattern fingerprint' })}
                  </div>
                  <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
                    <span class="badge ${strength.cls}" title="Confidence this is a recurring pattern, based on how many pages it affects">${strength.label}</span>
                    <span class="badge badge-high">${c.pagesCount} ${c.pagesCount === 1 ? 'page' : 'pages'}</span>
                    <span class="badge badge-medium">${c.occurrencesCount} ${c.occurrencesCount === 1 ? 'occurrence' : 'occurrences'}</span>
                  </div>
                </div>

                <!-- Grouping Rationale -->
                <div style="background-color: var(--color-bg-subtle); padding: var(--space-3); border-radius: var(--radius-md); margin: var(--space-4) 0;">
                  <strong style="font-size: var(--font-size-xs); text-transform: uppercase; color: var(--color-text-secondary);">Why these findings are grouped:</strong>
                  <ul style="margin-left: var(--space-4); margin-top: var(--space-1); font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                    ${c.groupingRationale.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                  </ul>
                </div>

                <!-- Component Hypothesis -->
                ${hyp ? `
                  <div style="margin-bottom: var(--space-4);">
                    <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-brand-primary);">COMPONENT HYPOTHESIS:</span>
                    <strong>${escapeHtml(hyp.name)}</strong> (${escapeHtml(hyp.confidence)} confidence)
                    <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${escapeHtml(hyp.rationale)}</p>
                  </div>
                ` : ''}

                <!-- Representative Snippet -->
                <details style="margin-top: var(--space-3);">
                  <summary style="font-weight: 600; cursor: pointer; color: var(--color-brand-primary);">View Representative Markup & Occurrences</summary>
                  <div style="margin-top: var(--space-3);">
                    <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-1);">Representative Selector:</p>
                    <pre class="code-block" style="margin-bottom: var(--space-2);"><code>${escapeHtml(c.representativeLocator)}</code></pre>
                    <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-1);">Representative HTML:</p>
                    <pre class="code-block" style="margin-bottom: var(--space-3);"><code>${escapeHtml(c.representativeHtml)}</code></pre>

                    <p style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-secondary);">Affected Page URLs:</p>
                    <ul style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-left: var(--space-4); margin-top: var(--space-1);">
                      ${c.affectedPages.map(url => `<li><a href="${escapeAttr(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></li>`).join('')}
                    </ul>
                  </div>
                </details>
              </article>
            `;
  }
}

customElements.define('pattern-explorer', PatternExplorer);
