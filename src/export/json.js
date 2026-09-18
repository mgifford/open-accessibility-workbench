/**
 * Exports remediation tasks in standard JSON format.
 *
 * Each task embeds a compact record of its constituent observations — the exact
 * source findings it consolidates — so the export carries finding-level
 * provenance: for every observation, its record pointer back into the original
 * scan report, the scanner that reported it, the page, and the element locator.
 * Nothing is invented; every field is copied from the imported observation.
 */

/**
 * Compact, traceable provenance for one observation. Copied verbatim from the
 * imported finding so a reader can follow it back to the exact source record.
 */
function observationProvenance(o = {}) {
  const src = o.source || {};
  return {
    id: o.id || null,
    scanner: o.provenance?.scanner || null,
    // Where this finding lives in the original scan report (e.g.
    // "/results/0/axe/failures/1"), plus the report it came from.
    recordPointer: src.recordPointer || null,
    sourceReport: src.originalRef || null,
    scanId: src.scanId || null,
    page: o.page?.submittedUrl || null,
    locator: o.evidence?.locator || null,
    isDuplicate: Boolean(o.duplicate?.isDuplicate)
  };
}

export function exportTasksToJson(workspaceData, options = {}) {
  const {
    tasks = [],
    observations = [],
    sourceSummary = {},
    aiProvenance = { generatedByAI: false, model: null, runtime: null }
  } = workspaceData;

  const exportObj = {
    workbenchVersion: '0.1.0',
    generatedAt: new Date().toISOString(),
    aiProvenance: aiProvenance.generatedByAI ? {
      generatedByAI: true,
      model: aiProvenance.model || null,
      modelRevision: aiProvenance.modelRevision || null,
      runtime: aiProvenance.runtime || 'transformers.js',
      device: aiProvenance.device || null,
      guidanceSources: aiProvenance.guidanceSources || [],
      validation: aiProvenance.validation || {},
      generatedAt: aiProvenance.generatedAt || null
    } : { generatedByAI: false },
    summary: {
      totalObservations: observations.length,
      totalTasks: tasks.length,
      totalPages: sourceSummary.totalPages || 1
    },
    source: sourceSummary,
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      ruleId: t.ruleId,
      ruleIds: t.ruleIds || [t.ruleId],
      remediationFamily: t.remediationFamily || null,
      consolidated: Boolean(t.consolidated),
      patternClusterIds: t.patternClusterIds || [],
      upstreamPatternId: t.upstreamPatternId || null,
      wcag: t.wcag,
      urgency: t.urgency,
      leverage: t.leverage,
      metrics: t.metrics,
      componentHypothesis: t.componentHypothesis,
      roles: t.roles,
      // Technology context with provenance: source, confidence, evidence, and
      // whether the user confirmed it.
      technologyContext: t.technologyContext,
      blueprint: t.blueprint,
      affectedPages: t.affectedPages,
      // Finding-level provenance: the exact source observations this task
      // consolidates, each traceable back to its record in the scan report.
      observations: (t.observations || []).map(observationProvenance)
    }))
  };

  return JSON.stringify(exportObj, null, 2);
}
