/**
 * Correlates observations from multiple scanner engines that identify the same
 * problem on the same DOM element and page.
 */

export function correlateObservations(observations) {
  if (!Array.isArray(observations)) {
    return [];
  }

  const correlatedMap = new Map();

  for (const obs of observations) {
    const url = obs.page.finalUrl || obs.page.submittedUrl;
    const rule = obs.rule.normalizedRuleId;
    const loc = obs.signatures?.selectorSignature || obs.evidence.locator;
    const key = `${url}::${rule}::${loc}`;

    if (!correlatedMap.has(key)) {
      correlatedMap.set(key, {
        id: `corr-${rule}-${correlatedMap.size + 1}`,
        pageUrl: url,
        pageTitle: obs.page.title,
        normalizedRuleId: rule,
        wcag: [...obs.rule.wcag],
        representativeHtml: obs.evidence.renderedHtml,
        representativeLocator: obs.evidence.locator,
        scanners: [obs.provenance.scanner],
        observations: [obs]
      });
    } else {
      const existing = correlatedMap.get(key);
      if (!existing.scanners.includes(obs.provenance.scanner)) {
        existing.scanners.push(obs.provenance.scanner);
      }
      for (const w of obs.rule.wcag) {
        if (!existing.wcag.includes(w)) {
          existing.wcag.push(w);
        }
      }
      existing.observations.push(obs);
    }
  }

  return Array.from(correlatedMap.values());
}
