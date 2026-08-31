import { extractSelectorSignature } from './selector-signature.js';
import { extractDomSignatures } from './dom-signature.js';

/**
 * Enriches a list of raw CanonicalObservation objects with computed signatures.
 * @param {Array<object>} observations
 * @returns {Array<object>}
 */
export function enrichObservationsWithSignatures(observations) {
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations.map(obs => {
    const selectorSignature = extractSelectorSignature(obs.evidence.locator);
    const domSigs = extractDomSignatures(obs.evidence.renderedHtml, obs.evidence.locator);

    return {
      ...obs,
      signatures: {
        selectorSignature,
        exactHtmlSignature: domSigs.exactHtmlSignature,
        structureSignature: domSigs.structureSignature,
        familySignature: domSigs.familySignature,
        semanticSignature: domSigs.semanticSignature
      }
    };
  });
}
