import { groupByExactPattern } from './exact-groups.js';

/**
 * Clusters correlated observations into recurring cross-page pattern clusters.
 * Calculates affected pages and occurrences count.
 */
export function clusterPatternOccurrences(observations, totalPagesInScan = 1) {
  if (!Array.isArray(observations)) {
    return [];
  }

  const exactGroups = groupByExactPattern(observations);

  return exactGroups.map((group, idx) => {
    const pageUrls = new Set();
    const scanners = new Set();
    const wcag = new Set();

    for (const obs of group.observations) {
      if (obs.page.submittedUrl) pageUrls.add(obs.page.submittedUrl);
      if (obs.provenance?.scanner) scanners.add(obs.provenance.scanner);
      if (Array.isArray(obs.rule?.wcag)) {
        obs.rule.wcag.forEach(w => wcag.add(w));
      }
    }

    const pagesCount = pageUrls.size;
    const occurrencesCount = group.observations.length;
    const pagesPercentage = Math.round((pagesCount / Math.max(totalPagesInScan, 1)) * 100);

    // Grouping rationale — reports ONLY the basis actually used to form the
    // group, so the explanation never claims evidence that was not compared.
    const rationaleParts = [`Matching rule: ${group.ruleId}`];
    if (group.basis === 'upstream-pattern-id') {
      rationaleParts.push(`Same upstream pattern ID: ${group.upstreamPatternId} (occurrences the scanner assigned to one pattern; structure was not independently compared)`);
    } else if (group.basis === 'structure-signature') {
      rationaleParts.push(`Matching canonical structural DOM signature`);
    } else {
      rationaleParts.push(`Matching selector signature`);
    }
    rationaleParts.push(`Occurs on ${pagesCount} ${pagesCount === 1 ? 'page' : 'pages'} (${occurrencesCount} total ${occurrencesCount === 1 ? 'occurrence' : 'occurrences'})`);

    return {
      id: `PAT-${group.ruleId}-${idx + 1}`,
      ruleId: group.ruleId,
      sourceRuleId: group.sourceRuleId,
      groupingBasis: group.basis,
      upstreamPatternId: group.upstreamPatternId,
      familySignature: group.observations[0]?.signatures?.familySignature || null,
      representativeHtml: group.representativeHtml,
      representativeLocator: group.representativeLocator,
      pagesCount,
      occurrencesCount,
      pagesPercentage,
      affectedPages: Array.from(pageUrls),
      scanners: Array.from(scanners),
      wcag: Array.from(wcag),
      groupingRationale: rationaleParts,
      observations: group.observations
    };
  });
}
