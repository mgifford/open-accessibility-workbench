import { calculateTaskPriority } from './leverage.js';
import { getRolesForWcag } from '../roles/arrm.js';
import { getTechnologyContext } from '../technology/context.js';
import { generateRemediationBlueprint } from '../guidance/remediation.js';

/**
 * Builds actionable RemediationTask objects from PatternClusters and ComponentHypotheses.
 * @param {Array<object>} clusters
 * @param {Array<object>} hypotheses
 * @param {number} totalPages
 * @param {string|null} userConfirmedTech
 * @param {object|null} scanMetadata
 * @returns {Array<object>}
 */
export function buildRemediationTasks(clusters = [], hypotheses = [], totalPages = 1, userConfirmedTech = null, scanMetadata = null) {
  const tasks = [];

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const hypothesis = hypotheses.find(h => h.clusterId === cluster.id) || null;
    const { urgency, leverage } = calculateTaskPriority(cluster, hypothesis, totalPages);
    const roles = getRolesForWcag(cluster.wcag, cluster.ruleId);
    const technologyContext = getTechnologyContext(cluster.observations, userConfirmedTech, scanMetadata);

    const blueprint = generateRemediationBlueprint({
      ruleId: cluster.ruleId,
      cluster,
      componentHypothesis: hypothesis,
      technologyContext,
      wcag: cluster.wcag
    });

    const title = getTaskTitle(cluster, hypothesis);

    tasks.push({
      id: `TASK-${cluster.ruleId}-${i + 1}`,
      title,
      ruleId: cluster.ruleId,
      sourceRuleId: cluster.sourceRuleId,
      upstreamPatternId: cluster.upstreamPatternId,
      wcag: cluster.wcag,
      urgency,
      leverage,
      metrics: {
        observationCount: cluster.occurrencesCount,
        correlatedFindingCount: cluster.occurrencesCount,
        affectedPagesCount: cluster.pagesCount,
        totalPagesCount: totalPages,
        pagesPercentage: cluster.pagesPercentage
      },
      componentHypothesis: hypothesis,
      roles,
      technologyContext,
      blueprint,
      affectedPages: cluster.affectedPages,
      representativeLocator: cluster.representativeLocator,
      representativeHtml: cluster.representativeHtml,
      groupingRationale: cluster.groupingRationale,
      observations: cluster.observations
    });
  }

  // Sort tasks by Leverage (very-high > high > medium > low) then Urgency (critical > high > medium > low)
  const leverageRank = { 'very-high': 4, 'high': 3, 'medium': 2, 'low': 1 };
  const urgencyRank = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };

  return tasks.sort((a, b) => {
    const levDiff = (leverageRank[b.leverage] || 0) - (leverageRank[a.leverage] || 0);
    if (levDiff !== 0) return levDiff;
    return (urgencyRank[b.urgency] || 0) - (urgencyRank[a.urgency] || 0);
  });
}

function getTaskTitle(cluster, hypothesis) {
  if (cluster.ruleId === 'link-name') {
    return hypothesis?.name?.includes('Social')
      ? 'Provide accessible names for shared social media icon links'
      : `Provide discernible accessible text for ${hypothesis?.name || 'links'}`;
  }
  if (cluster.ruleId === 'color-contrast') {
    return `Ensure text elements in ${hypothesis?.name || 'template'} meet 4.5:1 color contrast`;
  }
  if (cluster.ruleId === 'image-alt') {
    return `Provide appropriate text alternatives for images in ${hypothesis?.name || 'content'}`;
  }
  if (cluster.ruleId === 'region') {
    return `Wrap page structure in semantic landmark elements`;
  }
  return `Remediate ${cluster.ruleId} accessibility issues across ${cluster.pagesCount} pages`;
}
