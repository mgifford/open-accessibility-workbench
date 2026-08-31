/**
 * ARRM (Accessibility Roles and Responsibilities Mapping) role router.
 *
 * The success-criterion → role mapping is a faithful parse of the W3C ARRM
 * matrix (w3c/wai-arrm, draft, CC-BY-4.0), generated into
 * `arrm-wcag-map.generated.js` by `scripts/build-arrm-data.js`. This module does
 * not hand-author mappings and does not present Workbench inferences as W3C
 * ARRM: when a success criterion is not covered by ARRM, the result is labelled
 * with an honest `source` other than `w3c-arrm`.
 */

import { ARRM_WCAG_MAP, ARRM_ROLES_BY_ID, ARRM_METADATA } from './arrm-wcag-map.generated.js';

export { ARRM_METADATA };

/** Canonical ARRM role identities (plus the Workbench Testing/QA extension). */
export const ARRM_ROLES = Object.fromEntries(
  Object.entries(ARRM_ROLES_BY_ID).map(([id, r]) => [
    id.toUpperCase().replace(/-/g, '_'),
    { id, name: r.name, arrm: r.arrm }
  ])
);

function roleName(id) {
  return ARRM_ROLES_BY_ID[id]?.name || id;
}

function toNames(ids = []) {
  return ids.map(roleName);
}

/**
 * Resolves the likely roles for a finding from its WCAG success criteria.
 *
 * @param {string[]} wcagCriteriaList - dotted success criteria, e.g. ["2.4.4"].
 * @param {string} [ruleId] - normalized rule id, used only for the honest
 *   fallback when no success criterion is covered by ARRM.
 * @returns {{
 *   primary: string|null,
 *   coPrimary: string[],
 *   secondary: string[],
 *   contributors: string[],
 *   source: 'w3c-arrm' | 'workbench-inference',
 *   matchedSc: string|null,
 *   wcagLevel: string|null
 * }}
 */
export function getRolesForWcag(wcagCriteriaList = [], ruleId = '') {
  let matched = null;
  let matchedSc = null;

  for (const sc of wcagCriteriaList) {
    if (ARRM_WCAG_MAP[sc]) {
      matched = ARRM_WCAG_MAP[sc];
      matchedSc = sc;
      break;
    }
  }

  if (matched) {
    return {
      primary: matched.primary ? roleName(matched.primary) : null,
      coPrimary: toNames(matched.coPrimary),
      secondary: toNames(matched.secondary),
      contributors: toNames(matched.contributors),
      source: 'w3c-arrm',
      matchedSc,
      wcagLevel: matched.wcagLevel || null
    };
  }

  // No ARRM coverage for this finding's success criteria. Provide a clearly
  // labelled Workbench inference — never presented as W3C ARRM. Kept minimal
  // and honest: front-end development is the safe default owner for a technical
  // finding, with testing as a contributor.
  return {
    primary: roleName('frontend-dev'),
    coPrimary: [],
    secondary: [],
    contributors: [roleName('qa-testing')],
    source: 'workbench-inference',
    matchedSc: null,
    wcagLevel: null
  };
}
