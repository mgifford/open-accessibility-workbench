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
  // Consolidate at the COMPONENT level so a five-pattern shared component yields
  // ONE task, not five. Clusters belonging to the same component hypothesis are
  // merged into a single task-group; clusters with no multi-cluster component
  // form their own group. This makes tasks — not raw patterns — the unit of work.
  const clusterById = new Map(clusters.map(c => [c.id, c]));
  const groups = [];
  const assigned = new Set();

  for (const hyp of hypotheses) {
    const memberIds = Array.isArray(hyp.clusterIds) && hyp.clusterIds.length
      ? hyp.clusterIds
      : (hyp.clusterId ? [hyp.clusterId] : []);
    const members = memberIds.map(id => clusterById.get(id)).filter(Boolean);
    if (members.length === 0) continue;
    // Only consolidate when the component actually spans >1 cluster; a
    // single-cluster hypothesis is just that cluster's own task.
    if (members.length > 1) {
      members.forEach(m => assigned.add(m.id));
      groups.push({ clusters: members, hypothesis: hyp });
    }
  }
  // Remaining clusters (not consolidated) each become their own group, paired
  // with their single-cluster hypothesis if one exists.
  for (const cluster of clusters) {
    if (assigned.has(cluster.id)) continue;
    const hyp = hypotheses.find(
      h => h.clusterId === cluster.id || (Array.isArray(h.clusterIds) && h.clusterIds.includes(cluster.id))
    ) || null;
    groups.push({ clusters: [cluster], hypothesis: hyp });
  }

  const tasks = groups.map((group, i) => buildTaskFromGroup(group, i, totalPages, userConfirmedTech, scanMetadata));

  // Sort by Leverage (very-high > high > medium > low) then Urgency.
  const leverageRank = { 'very-high': 4, 'high': 3, 'medium': 2, 'low': 1 };
  const urgencyRank = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
  return tasks.sort((a, b) => {
    const levDiff = (leverageRank[b.leverage] || 0) - (leverageRank[a.leverage] || 0);
    if (levDiff !== 0) return levDiff;
    return (urgencyRank[b.urgency] || 0) - (urgencyRank[a.urgency] || 0);
  });
}

/**
 * Builds one task from a group of one or more clusters (a consolidated component
 * or a standalone cluster). Aggregates observations, pages, occurrences, WCAG,
 * and rule set across members so nothing is lost.
 */
function buildTaskFromGroup(group, i, totalPages, userConfirmedTech, scanMetadata) {
  const { clusters, hypothesis } = group;
  const primary = clusters[0];

  // Aggregate across member clusters.
  const observations = clusters.flatMap(c => c.observations || []);
  const pageUrls = new Set();
  const wcagSet = new Set();
  const ruleIds = new Set();
  let occurrences = 0;
  for (const c of clusters) {
    (c.affectedPages || []).forEach(u => pageUrls.add(u));
    (c.wcag || []).forEach(w => wcagSet.add(w));
    if (c.ruleId) ruleIds.add(c.ruleId);
    occurrences += c.occurrencesCount || 0;
  }
  const affectedPages = [...pageUrls];
  const wcag = [...wcagSet];
  const pagesCount = affectedPages.length;
  const pagesPercentage = Math.round((pagesCount / Math.max(totalPages, 1)) * 100);

  // Priority: use an aggregate cluster-like object so leverage reflects the whole
  // component (all occurrences and pages), not a single member.
  const aggregate = {
    ...primary,
    wcag,
    occurrencesCount: occurrences,
    pagesCount,
    pagesPercentage,
    affectedPages,
    observations
  };
  const { urgency, leverage } = calculateTaskPriority(aggregate, hypothesis, totalPages);
  const roles = getRolesForWcag(wcag, primary.ruleId);
  const technologyContext = getTechnologyContext(observations, userConfirmedTech, scanMetadata);
  const blueprint = generateRemediationBlueprint({
    ruleId: primary.ruleId,
    cluster: aggregate,
    componentHypothesis: hypothesis,
    technologyContext,
    wcag
  });

  const isConsolidated = clusters.length > 1;
  const title = getTaskTitle(primary, hypothesis);

  // Merge each member's grouping rationale, and add a consolidation line so the
  // task explains why several patterns became one unit of work.
  const groupingRationale = [...new Set(clusters.flatMap(c => c.groupingRationale || []))];
  if (isConsolidated) {
    groupingRationale.unshift(
      `Consolidated ${clusters.length} pattern variants into one component-level task` +
      (hypothesis?.name ? ` (${hypothesis.name})` : '') + '.'
    );
  }

  return {
    id: `TASK-${primary.ruleId}-${i + 1}`,
    title,
    ruleId: primary.ruleId,
    sourceRuleId: primary.sourceRuleId,
    ruleIds: [...ruleIds],
    upstreamPatternId: primary.upstreamPatternId,
    consolidated: isConsolidated,
    patternClusterIds: clusters.map(c => c.id),
    wcag,
    urgency,
    leverage,
    metrics: {
      observationCount: occurrences,
      correlatedFindingCount: occurrences,
      patternVariantCount: clusters.length,
      affectedPagesCount: pagesCount,
      totalPagesCount: totalPages,
      pagesPercentage
    },
    componentHypothesis: hypothesis,
    roles,
    technologyContext,
    blueprint,
    affectedPages,
    representativeLocator: primary.representativeLocator,
    representativeHtml: primary.representativeHtml,
    groupingRationale,
    observations
  };
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
