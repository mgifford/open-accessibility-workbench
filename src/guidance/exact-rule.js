/**
 * Curated, versioned deterministic rule guidance (spec §9.1).
 *
 * Each guidance block identifies its provenance and is clearly Workbench
 * guidance — NOT scanner documentation. It separates the human DECISIONS a
 * fix requires from the IMPLEMENTATION steps and the VERIFICATION steps, never
 * inventing alternative text, names, labels, colours, or product behaviour, and
 * never claiming one implementation satisfies every failure under a criterion.
 */

import { RULE_GUIDANCE as ruleGuidance } from './rule-guidance.generated.js';

const META = ruleGuidance._meta;
const RULES = ruleGuidance.rules;

/** Provenance stamped on every guidance block. */
export const GUIDANCE_PROVENANCE = {
  source: META.source,
  sourceUrl: META.sourceUrl,
  license: META.license,
  revision: META.revision,
  basedOn: META.basedOn,
  kind: 'workbench-guidance' // never "scanner documentation"
};

/**
 * @param {string} ruleId - normalized rule id
 * @returns {{
 *   rule: string, wcag: string[], summary: string,
 *   decisions: string[], implementation: string[], verification: string[],
 *   provenance: typeof GUIDANCE_PROVENANCE, curated: boolean
 * }}
 */
export function getExactRuleGuidance(ruleId) {
  const normalized = String(ruleId || '').toLowerCase().trim();
  const curated = RULES[normalized];

  if (curated) {
    return { ...curated, provenance: GUIDANCE_PROVENANCE, curated: true };
  }

  // No curated guidance for this rule. Return an honest, non-invented fallback
  // that still separates decisions from implementation and verification.
  return {
    rule: normalized || 'unknown',
    wcag: [],
    summary: 'No curated guidance is available for this rule yet; general accessibility practice applies.',
    decisions: ['Review the element in context to determine what the fix must achieve.'],
    implementation: [
      'Prefer native HTML semantics that satisfy the requirement.',
      'Consult the scanner’s own help link and WCAG Understanding for this rule.'
    ],
    verification: [
      'Inspect the element in the browser accessibility tree.',
      'Test with the keyboard and a screen reader.',
      'Re-run the automated rule.'
    ],
    provenance: { ...GUIDANCE_PROVENANCE, kind: 'workbench-guidance (generic fallback)' },
    curated: false
  };
}
