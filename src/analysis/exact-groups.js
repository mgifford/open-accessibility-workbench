/**
 * Groups observations using exact keys:
 * 1. Upstream pattern ID if present (e.g. Open Scans patternId).
 * 2. Or same normalized rule + selector signature.
 * 3. Or same normalized rule + structure signature.
 */

export function groupByExactPattern(observations) {
  if (!Array.isArray(observations)) {
    return [];
  }

  const groups = new Map();

  for (const obs of observations) {
    let key;
    if (obs.identity?.sourcePatternId) {
      key = `upstream:${obs.rule.normalizedRuleId}:${obs.identity.sourcePatternId}`;
    } else if (obs.signatures?.structureSignature) {
      key = `struct:${obs.rule.normalizedRuleId}:${obs.signatures.structureSignature}`;
    } else {
      key = `selector:${obs.rule.normalizedRuleId}:${obs.signatures?.selectorSignature || obs.evidence.locator}`;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        ruleId: obs.rule.normalizedRuleId,
        sourceRuleId: obs.rule.sourceRuleId,
        upstreamPatternId: obs.identity?.sourcePatternId || null,
        representativeHtml: obs.evidence.renderedHtml,
        representativeLocator: obs.evidence.locator,
        observations: []
      });
    }

    groups.get(key).observations.push(obs);
  }

  return Array.from(groups.values());
}
