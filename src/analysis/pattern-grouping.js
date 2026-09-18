/**
 * Presentation-only grouping for the Pattern Explorer.
 *
 * The underlying pattern clusters are never merged or dropped — this only
 * arranges them by rule so a long list is scannable, and separates recurring
 * patterns from isolated one-offs so the long tail can be collapsed.
 */

import { resolveRuleDisplay } from '../rules/rule-descriptions.js';

/** True when a pattern appears once with no shared-template signal. */
export function isIsolated(cluster) {
  return (cluster?.pagesCount || 0) <= 1 && (cluster?.occurrencesCount || 0) <= 1;
}

/**
 * Groups already-ranked clusters by rule id, preserving the incoming (strength)
 * order within each group. Groups are ordered by their strongest member so the
 * most actionable rules lead. Each group separates recurring patterns from
 * isolated one-offs for the collapse toggle.
 *
 * @param {Array<object>} orderedClusters - clusters, pre-sorted by strength.
 * @returns {Array<{ key: string, display: object, clusters: object[], count: number, recurring: object[], isolated: object[] }>}
 */
export function groupByRule(orderedClusters = []) {
  const map = new Map();
  for (const c of orderedClusters) {
    const key = c.ruleId || c.sourceRuleId || 'unknown';
    if (!map.has(key)) {
      map.set(key, { key, display: resolveRuleDisplay(c), clusters: [] });
    }
    map.get(key).clusters.push(c);
  }
  const groups = [...map.values()].map(g => ({
    ...g,
    count: g.clusters.length,
    recurring: g.clusters.filter(c => !isIsolated(c)),
    isolated: g.clusters.filter(isIsolated)
  }));
  // Strongest groups first: those with recurring patterns, then by pattern count.
  groups.sort((a, b) => (b.recurring.length - a.recurring.length) || (b.count - a.count));
  return groups;
}
