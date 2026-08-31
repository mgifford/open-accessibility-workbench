/**
 * Hypothesizes shared components / templates from recurring pattern clusters.
 *
 * Pattern clusters (Level 3) are the finest deterministic grouping and stay
 * fully traceable. A component hypothesis (Level 4) is an *inference* that one
 * reusable implementation generates several of those clusters — e.g. every
 * `social-media-link-icon--<network>` is one social-links component. Grouping is
 * by structural FAMILY signature (per-instance suffixes abstracted away), so
 * distinct-per-occurrence upstream pattern ids do not prevent the reduction,
 * while genuinely different structures stay separate (no over-merge).
 *
 * Every hypothesis carries an explainable, non-numeric confidence with the
 * concrete signals behind it.
 */

/**
 * @param {Array<object>} patternClusters
 * @param {number} [totalPagesInScan=1]
 * @returns {Array<{
 *   id: string, clusterIds: string[], name: string,
 *   confidence: 'high'|'medium'|'low', confidenceSignals: string[],
 *   rationale: string, pagesCount: number, occurrencesCount: number,
 *   ruleIds: string[]
 * }>}
 */
export function buildComponentHypotheses(patternClusters, totalPagesInScan = 1) {
  if (!Array.isArray(patternClusters)) {
    return [];
  }

  // Group clusters by a component key. Clusters that share a structural family
  // signature are candidates for the same reusable component even when their
  // per-occurrence upstream pattern ids differ.
  const groups = new Map();
  for (const cluster of patternClusters) {
    const key = componentKey(cluster);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cluster);
  }

  const hypotheses = [];
  let idx = 0;
  for (const clusters of groups.values()) {
    idx++;
    hypotheses.push(describeComponent(clusters, totalPagesInScan, idx));
  }
  return hypotheses;
}

/**
 * Component grouping key. Prefer the structural family signature (shared across a
 * component's instances); fall back to the representative locator's own family.
 */
function componentKey(cluster) {
  const family =
    cluster.familySignature ||
    cluster.observations?.[0]?.signatures?.familySignature ||
    cluster.representativeHtml;
  return `${familyLocatorRoot(cluster.representativeLocator)}::${family}`;
}

/** Abstracts a locator to its component root, e.g. `.social-media-link-icon--linkedin` -> `.social-media-link-icon`. */
function familyLocatorRoot(locator = '') {
  return String(locator)
    .replace(/--[a-z0-9_]+/gi, '')          // BEM modifier
    .replace(/\[[^\]]*\]/g, '')             // attribute predicates
    .replace(/:nth-child\(\d+\)/gi, '')     // positional
    .trim();
}

function describeComponent(clusters, totalPagesInScan, idx) {
  const pageUrls = new Set();
  const ruleIds = new Set();
  const upstreamIds = new Set();
  let occurrencesCount = 0;

  for (const c of clusters) {
    (c.affectedPages || []).forEach(u => pageUrls.add(u));
    if (c.ruleId) ruleIds.add(c.ruleId);
    occurrencesCount += c.occurrencesCount || 0;
    if (c.upstreamPatternId) upstreamIds.add(c.upstreamPatternId);
  }

  const patternVariants = clusters.length;      // distinct pattern clusters
  const pagesCount = pageUrls.size;
  const rep = clusters[0];
  const locator = (rep.representativeLocator || '').toLowerCase();
  const html = (rep.representativeHtml || '').toLowerCase();

  // Distinguish "the scanner assigned these to ONE upstream pattern" from
  // "these are DISTINCT upstream patterns that share a structural family".
  const sharedUpstreamIdentity = upstreamIds.size === 1 && patternVariants > 1;
  const distinctPatternsOneFamily = upstreamIds.size > 1 && patternVariants > 1;

  // Confidence with explicit signals (spec §13.6 — explainable, not numeric).
  // Every signal reflects something actually measured; occurrences and pattern
  // variants are reported as separate, accurate counts.
  const signals = [];
  if (sharedUpstreamIdentity) {
    signals.push(`same upstream pattern identity (${[...upstreamIds][0]})`);
  } else if (distinctPatternsOneFamily) {
    signals.push(`${patternVariants} distinct upstream patterns share one structural family`);
  } else if (patternVariants > 1) {
    signals.push(`${patternVariants} pattern variants share one structural family`);
  }
  if (occurrencesCount > patternVariants) {
    signals.push(`${occurrencesCount} occurrences across ${patternVariants} pattern ${patternVariants === 1 ? 'variant' : 'variants'}`);
  }
  if (pagesCount > 1) signals.push(`recurs on ${pagesCount} of ${totalPagesInScan} pages`);
  if (ruleIds.size > 1) signals.push(`spans ${ruleIds.size} related rules (${[...ruleIds].join(', ')})`);

  // A shared structural family across multiple variants/pages is the primary
  // high-confidence signal; a single shared upstream id also qualifies.
  const familyReuse = patternVariants > 1 || pagesCount > 1;
  let confidence = 'low';
  if ((familyReuse && pagesCount >= Math.max(2, Math.floor(totalPagesInScan * 0.5))) ||
      (sharedUpstreamIdentity && pagesCount > 1)) {
    confidence = 'high';
  } else if (familyReuse || occurrencesCount >= 3) {
    confidence = 'medium';
  }

  const name = nameComponent(locator, html, ruleIds, patternVariants, confidence);

  const shared = familyReuse;
  const rationale = shared
    ? `${confidence === 'high' ? 'Likely' : 'Possible'} shared component: ${signals.join('; ') || 'recurring structure'}.`
    : 'Isolated element: appears once, with no confirmed shared-template signals.';

  return {
    id: `COMP-${idx}`,
    clusterId: rep.id,               // primary cluster (back-compat for callers)
    clusterIds: clusters.map(c => c.id),
    patternVariants,
    upstreamPatternIds: [...upstreamIds],
    name,
    confidence,
    confidenceSignals: signals,
    rationale,
    pagesCount,
    occurrencesCount,
    ruleIds: [...ruleIds]
  };
}

function nameComponent(locator, html, ruleIds, memberInstances, confidence) {
  const shared = confidence === 'high' ? 'Shared' : 'Probable';
  if (locator.includes('social') || html.includes('social') || html.includes('linkedin') || html.includes('mastodon') || html.includes('facebook')) {
    return `${shared} Social Links Component`;
  }
  if (locator.includes('header') || locator.includes('nav') || locator.includes('menu')) {
    return `${shared} Site Header / Navigation Template`;
  }
  if (locator.includes('footer')) {
    return `${shared} Global Footer Component`;
  }
  if (locator.includes('node__meta') || locator.includes('author') || locator.includes('article') || locator.includes('byline')) {
    return `${shared} Content Teaser / Byline Template`;
  }
  if (memberInstances > 1) {
    return `${shared} Component (${[...ruleIds].join(', ') || 'recurring pattern'})`;
  }
  return 'Isolated Element';
}
