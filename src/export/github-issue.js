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

### Role Ownership & Context
- **Primary Role**: ${task.roles?.primary || 'Front-End Development'}
- **Supporting Roles**: ${(task.roles?.secondary || []).join(', ') || 'None'}
- **Component / Template Scope**: ${task.componentHypothesis?.name || 'Shared Component'}

### Decisions Required Before Implementation
${(task.blueprint.humanDecisionsRequired || []).map(d => `- [ ] ${d}`).join('\n')}

### Target Implementation
\`\`\`html
${task.blueprint.targetMarkup || '<!-- Refer to WCAG guidance -->'}
\`\`\`

### Verification Criteria
${(task.blueprint.verificationSteps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}

---
*Created with [Open Accessibility Workbench](https://github.com/mgifford/open-accessibility-workbench)*
`;
}
