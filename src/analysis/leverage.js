/**
 * Evaluates Urgency and Leverage as independent visible dimensions.
 * Urgency considers scanner impact and WCAG severity.
 * Leverage considers cross-page recurrence, total occurrences, and component confidence.
 */

export function calculateTaskPriority(cluster, componentHypothesis, totalPages = 1) {
  // 1. Calculate Urgency
  let urgency = 'medium';
  const hasCriticalImpact = cluster.observations.some(o => o.classification.impact === 'critical' || o.classification.sourceCategory === 'mustFix');
  const hasSeriousImpact = cluster.observations.some(o => o.classification.impact === 'serious');
  const isNeedsReview = cluster.observations.every(o => o.classification.sourceCategory === 'needsReview');

  if (hasCriticalImpact) {
    urgency = 'critical';
  } else if (hasSeriousImpact) {
    urgency = 'high';
  } else if (isNeedsReview) {
    urgency = 'medium';
  } else {
    urgency = 'low';
  }

  // 2. Calculate Leverage
  let leverage = 'low';
  const pageRatio = cluster.pagesCount / Math.max(totalPages, 1);
  const totalCount = cluster.occurrencesCount;

  if (pageRatio >= 0.7 || totalCount >= 20 || (componentHypothesis?.confidence === 'high' && cluster.pagesCount > 1)) {
    leverage = 'very-high';
  } else if (pageRatio >= 0.3 || totalCount >= 5 || componentHypothesis?.confidence === 'high') {
    leverage = 'high';
  } else if (cluster.pagesCount > 1 || totalCount >= 2) {
    leverage = 'medium';
  } else {
    leverage = 'low';
  }

  return { urgency, leverage };
}
