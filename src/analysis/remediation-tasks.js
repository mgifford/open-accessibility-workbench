import { calculateTaskPriority } from './leverage.js';
import { getRolesForWcag } from '../roles/arrm.js';
import { getTechnologyContext } from '../technology/context.js';
import { generateRemediationBlueprint } from '../guidance/remediation.js';
import { contentHash as shortHash } from './source-registry.js';

/**
 * Builds actionable RemediationTask objects from PatternClusters and ComponentHypotheses.
 * @param {Array<object>} clusters
 * @param {Array<object>} hypotheses
 * @param {number} totalPages
 * @param {string|null} userConfirmedTech
 * @param {object|null} scanMetadata
 * @returns {Array<object>}
 */
/**
 * Maps a normalized rule id to a REMEDIATION FAMILY — the implementation action
 * a fix requires. Clusters consolidate into one task only when they share a
 * component AND a remediation family, so a component with two different required
 * changes (e.g. accessible names + colour contrast) yields two tasks, not one.
 */
export function remediationFamily(ruleId = '') {
  const r = ruleId.toLowerCase();
  if (/link-name|button-name|input-button-name|aria-command-name|accessible-name/.test(r)) return 'accessible-name';
  if (/color-contrast/.test(r)) return 'contrast';
  if (/image-alt|input-image-alt|role-img-alt|alt/.test(r)) return 'text-alternative';
  if (/region|landmark|heading-order/.test(r)) return 'structure';
  if (/label|form-field/.test(r)) return 'form-labeling';
  if (/html-has-lang|lang|valid-lang/.test(r)) return 'language';
  if (/target-size/.test(r)) return 'target-size';
  return `rule-${r}`; // rule-specific family fallback
}

export function buildRemediationTasks(clusters = [], hypotheses = [], totalPages = 1, userConfirmedTech = null, scanMetadata = null, workspaceId = null) {
  // Consolidate by (component, remediation-family). Clusters of a component that
  // require the SAME implementation action merge into one task; clusters of the
  // same component requiring a DIFFERENT action become separate tasks. Clusters
  // with no multi-cluster component form their own family-scoped group.
  const clusterById = new Map(clusters.map(c => [c.id, c]));
  const componentOf = new Map(); // clusterId -> hypothesis (multi-cluster only)
  for (const hyp of hypotheses) {
    const memberIds = Array.isArray(hyp.clusterIds) && hyp.clusterIds.length
      ? hyp.clusterIds : (hyp.clusterId ? [hyp.clusterId] : []);
    if (memberIds.filter(id => clusterById.has(id)).length > 1) {
      for (const id of memberIds) if (clusterById.has(id)) componentOf.set(id, hyp);
    }
  }

  // Group key = component id (or standalone cluster id) + remediation family.
  const groupMap = new Map();
  for (const cluster of clusters) {
    const hyp = componentOf.get(cluster.id) || null;
    const family = remediationFamily(cluster.ruleId);
    const scope = hyp ? hyp.id : `cluster:${cluster.id}`;
    const key = `${scope}::${family}`;
    if (!groupMap.has(key)) groupMap.set(key, { key, family, clusters: [], hypothesis: hyp });
    groupMap.get(key).clusters.push(cluster);
  }

  // Deterministic ordering: sort clusters within each group, and sort the groups
  // themselves, by stable identity — so output is independent of input order.
  const groups = [...groupMap.values()];
  for (const g of groups) g.clusters.sort(clusterSortKey);
  groups.sort((a, b) => a.key.localeCompare(b.key));

  const tasks = groups.map(group => buildTaskFromGroup(group, totalPages, userConfirmedTech, scanMetadata, workspaceId));

  // Sort by Leverage then Urgency for presentation; ties broken by stable id so
  // the displayed order is also deterministic.
  const leverageRank = { 'very-high': 4, 'high': 3, 'medium': 2, 'low': 1 };
  const urgencyRank = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
  return tasks.sort((a, b) => {
    const levDiff = (leverageRank[b.leverage] || 0) - (leverageRank[a.leverage] || 0);
    if (levDiff !== 0) return levDiff;
    const urgDiff = (urgencyRank[b.urgency] || 0) - (urgencyRank[a.urgency] || 0);
    if (urgDiff !== 0) return urgDiff;
    return a.id.localeCompare(b.id);
  });
}

/** Stable sort key for clusters within a task group (independent of input order). */
function clusterSortKey(a, b) {
  const ka = a.upstreamPatternId || a.representativeLocator || a.id || '';
  const kb = b.upstreamPatternId || b.representativeLocator || b.id || '';
  return String(ka).localeCompare(String(kb));
}

/**
 * Builds one task from a group of one or more clusters (a consolidated component
 * or a standalone cluster). Aggregates observations, pages, occurrences, WCAG,
 * and rule set across members so nothing is lost.
 */
function buildTaskFromGroup(group, totalPages, userConfirmedTech, scanMetadata, workspaceId) {
  const { clusters, hypothesis, family } = group;
  const primary = clusters[0]; // stable: clusters were sorted by identity

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

  // Stable, report-scoped task id derived from DURABLE evidence: the
  // workspace/source-report id + the sorted member pattern/cluster identities +
  // the remediation family. It does not depend on input order, so status stays
  // attached to the same work across re-analysis, and never collides between
  // reports (different workspaceId -> different id).
  const memberKeys = clusters
    .map(c => c.upstreamPatternId || c.representativeLocator || c.id)
    .filter(Boolean)
    .sort();
  const wsId = workspaceId
    || observations.find(o => o.source?.sourceReportId)?.source.sourceReportId
    || 'ws';
  const id = `TASK-${wsId}-${family}-${shortHash(memberKeys.join('|'))}`;

  return {
    id,
    title,
    ruleId: primary.ruleId,
    sourceRuleId: primary.sourceRuleId,
    ruleIds: [...ruleIds].sort(),
    remediationFamily: family,
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
