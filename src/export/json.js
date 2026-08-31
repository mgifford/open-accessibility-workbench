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
    aiProvenance: {
      generatedByAI: Boolean(aiProvenance.generatedByAI),
      model: aiProvenance.model || null,
      runtime: aiProvenance.runtime || null,
      validation: aiProvenance.validation || null
    },
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
      wcag: t.wcag,
      urgency: t.urgency,
      leverage: t.leverage,
      metrics: t.metrics,
      componentHypothesis: t.componentHypothesis,
      roles: t.roles,
      technologyContext: t.technologyContext,
      blueprint: t.blueprint,
      affectedPages: t.affectedPages
    }))
  };

  return JSON.stringify(exportObj, null, 2);
}
