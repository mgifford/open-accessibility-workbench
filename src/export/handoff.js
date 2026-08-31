/**
 * Handoff content for a single task (spec §9.7 / §7.7). Explains WHY the task
 * needs another role and packages everything that role needs to act. This is
 * routing guidance, never organizational ownership.
 */

/**
 * Builds a structured handoff for a task.
 * @param {object} task
 * @param {string[]} [userCapabilities] - to explain why it exceeds the user's caps
 * @returns {object}
 */
export function buildHandoff(task, userCapabilities = []) {
  const roles = task.roles || {};
  const bp = task.blueprint || {};
  const decisions = Array.isArray(bp.humanDecisions) && bp.humanDecisions.length
    ? bp.humanDecisions
    : (bp.humanDecisionsRequired || []).map(d => ({ decision: d, requiredRole: roles.primary || null, status: 'unresolved', blocksImplementation: true }));

  return {
    taskId: task.id,
    problem: bp.problem || task.title,
    whyItMatters: bp.systemicRationale || '',
    evidence: {
      representativeLocator: task.representativeLocator || '',
      representativeHtml: task.representativeHtml || '',
      observationCount: task.metrics?.observationCount ?? (task.observations?.length || 0)
    },
    affectedPages: task.affectedPages || [],
    possibleSharedComponent: task.componentHypothesis
      ? { name: task.componentHypothesis.name, confidence: task.componentHypothesis.confidence }
      : null,
    unresolvedDecisions: decisions,
    suggestedRoles: {
      primary: roles.primary || null,
      coPrimary: roles.coPrimary || [],
      secondary: roles.secondary || [],
      source: roles.source || 'unmapped',
      needsAccessibilityTriage: Boolean(roles.needsAccessibilityTriage)
    },
    remediationObjective: bp.whatNeedsToChange || '',
    verificationCriteria: bp.verificationSteps || [],
    sourceReportReferences: [...new Set((task.observations || []).map(o => o.source?.originalRef).filter(Boolean))],
    whyHandoff: explainHandoff(task, userCapabilities)
  };
}

function explainHandoff(task, caps) {
  const primary = task.roles?.primary;
  if (!primary) return 'This task has no ARRM/Workbench role mapping and needs accessibility triage.';
  if (!caps || caps.length === 0) return `Completion likely requires input from ${primary}.`;
  return `Your selected capabilities do not cover this task; completion likely requires input from ${primary}.`;
}

/** Renders a handoff as Markdown (also usable as plain text). */
export function handoffToMarkdown(h) {
  const lines = [
    `## Accessibility remediation handoff: ${h.taskId}`,
    '',
    `### Problem`, h.problem, '',
    `### Why it matters`, h.whyItMatters || '_See problem._', '',
    `### Why this is a handoff`, h.whyHandoff, '',
    `### Suggested roles`,
    `- Likely primary role involvement: ${h.suggestedRoles.primary || 'Needs accessibility triage'} (source: ${h.suggestedRoles.source})`,
    ...(h.suggestedRoles.secondary.length ? [`- Supporting: ${h.suggestedRoles.secondary.join(', ')}`] : []),
    '',
    `### Unresolved decisions`,
    ...(h.unresolvedDecisions.length
      ? h.unresolvedDecisions.map(d => `- [ ] ${d.decision}${d.requiredRole ? ` — needs ${d.requiredRole}` : ''}${d.blocksImplementation ? ' (blocks implementation)' : ''}`)
      : ['- None recorded.']),
    '',
    `### Remediation objective`, h.remediationObjective || '_See guidance._', '',
    `### Evidence`,
    `- Representative selector: \`${h.evidence.representativeLocator}\``,
    `- Occurrences: ${h.evidence.observationCount}`,
    `- Affected pages: ${h.affectedPages.length}`,
    ...(h.possibleSharedComponent ? [`- Possible shared component: ${h.possibleSharedComponent.name} (${h.possibleSharedComponent.confidence} confidence)`] : []),
    '',
    `### Verification criteria`,
    ...(h.verificationCriteria.length ? h.verificationCriteria.map((v, i) => `${i + 1}. ${v}`) : ['1. Re-run the automated rule and verify with the keyboard and a screen reader.']),
    '',
    `### Source report references`,
    ...(h.sourceReportReferences.length ? h.sourceReportReferences.map(r => `- ${r}`) : ['- (none recorded)'])
  ];
  return lines.join('\n');
}
