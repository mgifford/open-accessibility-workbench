/**
 * Groups observations using exact keys, and records the ACTUAL basis used so
 * downstream explanations only claim evidence that was really compared:
 * 1. `upstream-pattern-id` — same normalized rule + upstream pattern id.
 * 2. `structure-signature` — same normalized rule + canonical structure signature.
 * 3. `selector-signature` — same normalized rule + selector signature/locator.
 *
 * The basis is per-group: whichever key type formed the group is what is
 * reported. (Grouping by upstream id does NOT assert structural equality.)
 */

export function groupByExactPattern(observations) {
  if (!Array.isArray(observations)) {
    return [];
  }

  const groups = new Map();

  for (const obs of observations) {
    let key;
    let basis;
    if (obs.identity?.sourcePatternId) {
      key = `upstream:${obs.rule.normalizedRuleId}:${obs.identity.sourcePatternId}`;
      basis = 'upstream-pattern-id';
    } else if (obs.signatures?.structureSignature) {
      key = `struct:${obs.rule.normalizedRuleId}:${obs.signatures.structureSignature}`;
      basis = 'structure-signature';
    } else {
      key = `selector:${obs.rule.normalizedRuleId}:${obs.signatures?.selectorSignature || obs.evidence.locator}`;
      basis = 'selector-signature';
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        basis,
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
