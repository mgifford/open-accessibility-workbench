/**
 * Handoff content for a single task (spec §9.7 / §7.7). Explains WHY the task
 * needs another role and packages everything that role needs to act. This is
 * routing guidance, never organizational ownership.
 */

import { routeTaskForProfile } from '../roles/route-task.js';

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

  const route = routeTaskForProfile(task, userCapabilities || []);

  // Resolvable source-record references: a recipient can walk each back to the
  // exact original finding (sourceReportId + recordPointer), with scanner + page.
  const seen = new Set();
  const sourceReportReferences = [];
  for (const o of task.observations || []) {
    const key = `${o.source?.sourceReportId || ''}|${o.source?.recordPointer || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sourceReportReferences.push({
      sourceReportId: o.source?.sourceReportId || null,
      originalRef: o.source?.originalRef || null,
      recordPointer: o.source?.recordPointer || null,
      scanner: o.provenance?.scanner || null,
      pageUrl: o.page?.submittedUrl || o.page?.finalUrl || null
    });
  }

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
    sourceReportReferences,
    // Routing verdict from the SAME engine as the task list — they never disagree.
    relevance: route.relevance,
    whyHandoff: (route.reason || []).join(' ')
  };
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
    ...(h.evidence.representativeHtml ? ['- Representative markup:', '```html', h.evidence.representativeHtml, '```'] : []),
    ...(h.possibleSharedComponent ? [`- Possible shared component: ${h.possibleSharedComponent.name} (${h.possibleSharedComponent.confidence} confidence)`] : []),
    '',
    `### Affected pages (${h.affectedPages.length})`,
    ...(h.affectedPages.length ? h.affectedPages.map(u => `- ${u}`) : ['- (none recorded)']),
    '',
    `### Verification criteria`,
    ...(h.verificationCriteria.length ? h.verificationCriteria.map((v, i) => `${i + 1}. ${v}`) : ['1. Re-run the automated rule and verify with the keyboard and a screen reader.']),
    '',
    `### Source report references`,
    ...(h.sourceReportReferences.length
      ? h.sourceReportReferences.map(r => `- report \`${r.sourceReportId || r.originalRef || '?'}\` · record \`${r.recordPointer || '?'}\` · scanner ${r.scanner || '?'}${r.pageUrl ? ` · ${r.pageUrl}` : ''}`)
      : ['- (none recorded)'])
  ];
  return lines.join('\n');
}
