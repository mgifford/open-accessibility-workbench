/**
 * Exports remediation tasks in W3C JSON-LD format with full semantic schema.
 */

export function exportTasksToJsonLd(workspaceData) {
  const {
    tasks = [],
    observations = [],
    sourceSummary = {},
    aiProvenance = { generatedByAI: false, model: null, runtime: null }
  } = workspaceData;

  const jsonLd = {
    '@context': 'https://open-accessibility-workbench.org/ns/v1.jsonld',
    '@type': 'AccessibilityRemediationPlan',
    workbenchVersion: '0.1.0',
    generatedAt: new Date().toISOString(),
    aiProvenance: {
      generatedByAI: Boolean(aiProvenance.generatedByAI),
      model: aiProvenance.model || null,
      runtime: aiProvenance.runtime || null
    },
    scannedSource: {
      '@type': 'AccessibilityScanReport',
      system: sourceSummary.system || 'unknown',
      scanId: sourceSummary.scanId || 'unknown',
      totalPages: sourceSummary.totalPages || 1
    },
    remediationTasks: tasks.map(t => ({
      '@type': 'RemediationTask',
      identifier: t.id,
      name: t.title,
      wcagCriteria: t.wcag.map(sc => `https://www.w3.org/WAI/WCAG22/Understanding/${sc.replace('.', '')}`),
      urgencyLevel: t.urgency,
      leverageLevel: t.leverage,
      assignedRoles: {
        primary: t.roles?.primary || 'Front-End Development',
        secondary: t.roles?.secondary || [],
        guidanceSource: t.roles?.source || 'W3C ARRM'
      },
      componentHypothesis: t.componentHypothesis ? {
        name: t.componentHypothesis.name,
        confidence: t.componentHypothesis.confidence,
        rationale: t.componentHypothesis.rationale
      } : null,
      actionableBlueprint: {
        problemStatement: t.blueprint.problem,
        rootCause: t.blueprint.likelyRootCause,
        remediationSummary: t.blueprint.whatNeedsToChange,
        humanDecisionsRequired: t.blueprint.humanDecisionsRequired,
        verificationSteps: t.blueprint.verificationSteps
      }
    }))
  };

  return JSON.stringify(jsonLd, null, 2);
}
