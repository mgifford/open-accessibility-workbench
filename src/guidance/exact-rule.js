export function getExactRuleGuidance(ruleId) {
  const normalized = ruleId.toLowerCase();
  return {
    ruleId: normalized,
    summary: `Guidance for ${normalized}`,
    decisions: ['Review element context.'],
    implementation: ['Use semantic HTML.'],
    verification: ['Test with keyboard and screen reader.']
  };
}
