/**
 * Exports remediation tasks in standard JSON format.
 *
 * NOTE: this is a task-level export. It does not yet embed each task's
 * constituent observations or their record pointers; full observation-level
 * provenance in exports is a later-phase deliverable. Do not describe this
 * output as carrying full provenance.
 */

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
      affectedPages: t.affectedPages
    }))
  };

  return JSON.stringify(exportObj, null, 2);
}
