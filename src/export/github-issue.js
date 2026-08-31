/**
 * Prepares GitHub Issue formatted body for handoffs.
 */

export function formatGitHubIssue(task) {
  return `## Accessibility Remediation Task: ${task.title}

### Problem Overview
${task.blueprint.problem}

${task.blueprint.systemicRationale}

### Evidence
- **Rule**: \`${task.ruleId}\` (WCAG: ${task.wcag.join(', ') || 'N/A'})
- **Urgency**: **${task.urgency.toUpperCase()}**
- **Leverage**: **${task.leverage.toUpperCase()}**
- **Affected Pages**: ${task.metrics.affectedPagesCount} (${task.metrics.observationCount} occurrences)
- **Representative Selector**: \`${task.representativeLocator}\`

\`\`\`html
${task.representativeHtml}
\`\`\`

### Role Guidance & Context
- **Likely primary role involvement**: ${task.roles?.primary || 'Needs accessibility triage'} (source: ${task.roles?.source || 'unmapped'})
- **Supporting Roles**: ${(task.roles?.secondary || []).join(', ') || 'None'}
- **Component / Template Scope**: ${task.componentHypothesis?.name || 'Shared Component'}${task.technologyContext && task.technologyContext.name !== 'Unknown' ? `
- **Technology Context**: ${task.technologyContext.name}${task.technologyContext.confirmed ? ' (confirmed)' : ` (${task.technologyContext.confidence} confidence, ${task.technologyContext.source})`}` : ''}

### Decisions Required Before Implementation
${(task.blueprint.humanDecisionsRequired || []).map(d => `- [ ] ${d}`).join('\n')}

### Target Implementation (framework-neutral)
\`\`\`html
${task.blueprint.targetMarkup || '<!-- Refer to WCAG guidance -->'}
\`\`\`${task.blueprint.technologyGuidance ? `

**${task.blueprint.technologyGuidance.technology} note (${task.blueprint.technologyGuidance.basis}):** ${task.blueprint.technologyGuidance.note} _(extends, does not replace, the neutral guidance above)_` : ''}

### Verification Criteria
${(task.blueprint.verificationSteps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}

---
*Created with [Open Accessibility Workbench](https://github.com/mgifford/open-accessibility-workbench)*
`;
}
