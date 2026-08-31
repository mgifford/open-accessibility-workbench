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
        primary: t.roles?.primary || null,
        coPrimary: t.roles?.coPrimary || [],
        secondary: t.roles?.secondary || [],
        contributors: t.roles?.contributors || [],
        guidanceSource: t.roles?.source || 'unmapped',
        needsAccessibilityTriage: Boolean(t.roles?.needsAccessibilityTriage),
        assignments: t.roles?.assignments || []
      },
      technologyContext: t.technologyContext ? {
        name: t.technologyContext.name,
        category: t.technologyContext.category || null,
        confidence: t.technologyContext.confidence,
        source: t.technologyContext.source,
        confirmed: Boolean(t.technologyContext.confirmed),
        evidence: t.technologyContext.evidence || []
      } : null,
      componentHypothesis: t.componentHypothesis ? {
        name: t.componentHypothesis.name,
        confidence: t.componentHypothesis.confidence,
        rationale: t.componentHypothesis.rationale
      } : null,
      actionableBlueprint: {
        problemStatement: t.blueprint.problem,
        rootCause: t.blueprint.likelyRootCause,
        remediationSummary: t.blueprint.whatNeedsToChange,
        curatedGuidance: t.blueprint.ruleGuidance ? {
          summary: t.blueprint.ruleGuidance.summary,
          decisions: t.blueprint.ruleGuidance.decisions,
          implementation: t.blueprint.ruleGuidance.implementation,
          verification: t.blueprint.ruleGuidance.verification,
          provenance: t.blueprint.ruleGuidance.provenance
        } : null,
        retrievedGuidance: (t.blueprint.retrievedGuidance || []).map(r => ({
          title: r.title, source: r.source, sourceUrl: r.sourceUrl, license: r.license,
          framework: r.framework, matchType: r.matchType, retrievalReason: r.retrievalReason
        })),
        technologyGuidance: t.blueprint.technologyGuidance || null,
        humanDecisions: t.blueprint.humanDecisions || null,
        humanDecisionsRequired: t.blueprint.humanDecisionsRequired,
        verificationSteps: t.blueprint.verificationSteps
      }
    }))
  };

  return JSON.stringify(jsonLd, null, 2);
}
