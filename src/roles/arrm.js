/**
 * ARRM (Accessibility Roles and Responsibilities Mapping) role router.
 *
 * The success-criterion → role mapping is a faithful parse of the W3C ARRM
 * matrix (w3c/wai-arrm, draft, CC-BY-4.0), generated into
 * `arrm-wcag-map.generated.js` by `scripts/build-arrm-data.js`.
 *
 * Routing aggregates role assignments across ALL matched success criteria (so
 * the result is order-independent), and every assignment carries criterion-level
 * provenance. Assignments from ARRM and from the Workbench extension keep
 * distinct sources — the Workbench is never presented as W3C-authored. When no
 * mapping covers a finding, the router returns no primary role and flags that
 * accessibility triage is required, rather than inventing an owner.
 */

import { ARRM_WCAG_MAP, ARRM_ROLES_BY_ID, ARRM_METADATA } from './arrm-wcag-map.generated.js';

export { ARRM_METADATA };

/** ARRM draft status (see public/data/arrm/SNAPSHOT.md). */
const ARRM_STATUS = 'draft';

/** Provenance stamped on every ARRM-sourced assignment. */
const ARRM_PROVENANCE = {
  source: 'w3c-arrm',
  sourceUrl: ARRM_METADATA.sourceUrl,
  snapshotDate: ARRM_METADATA.snapshotDate,
  arrmStatus: ARRM_STATUS,
  license: ARRM_METADATA.license
};

/** Provenance for the Workbench Testing/QA extension role. */
const EXTENSION_PROVENANCE = {
  source: 'open-accessibility-workbench-extension',
  sourceUrl: null,
  snapshotDate: ARRM_METADATA.snapshotDate,
  arrmStatus: null,
  license: 'GPL-3.0-or-later',
  basedOn: 'ARRM model'
};

const LEVEL_NAME = { P: 'primary', S: 'secondary', C: 'contributor' };
const LEVEL_RANK = { primary: 3, secondary: 2, contributor: 1 };

function roleName(id) {
  return ARRM_ROLES_BY_ID[id]?.name || id;
}

function isExtensionRole(id) {
  return ARRM_ROLES_BY_ID[id]?.arrm === false;
}

/**
 * Resolves roles for a finding from ALL of its WCAG success criteria.
 *
 * @param {string[]} wcagCriteriaList - dotted success criteria, e.g. ["1.4.3","2.4.4"].
 * @param {string} [ruleId] - normalized rule id (unused for routing; kept for API stability).
 * @returns {{
 *   assignments: Array<{ wcag: string, roleId: string, role: string, responsibility: 'primary'|'secondary'|'contributor', source: string, sourceUrl: string|null, snapshotDate: string|null, arrmStatus: string|null, license: string }>,
 *   primary: string|null, coPrimary: string[], secondary: string[], contributors: string[],
 *   source: 'w3c-arrm' | 'mixed' | 'unmapped',
 *   matchedSc: string[], unmatchedSc: string[],
 *   needsAccessibilityTriage: boolean,
 *   provenance: object
 * }}
 */
export function getRolesForWcag(wcagCriteriaList = [], ruleId = '') {
  const criteria = Array.isArray(wcagCriteriaList) ? wcagCriteriaList : [];
  const assignments = [];
  const matchedSc = [];
  const unmatchedSc = [];

  // Aggregate assignments across EVERY matched criterion (order-independent).
  for (const sc of criteria) {
    const entry = ARRM_WCAG_MAP[sc];
    if (!entry || !entry.roleLevels) { if (sc) unmatchedSc.push(sc); continue; }
    matchedSc.push(sc);
    for (const [roleId, levels] of Object.entries(entry.roleLevels)) {
      for (const lvl of levels) {
        assignments.push({
          wcag: sc,
          roleId,
          role: roleName(roleId),
          responsibility: LEVEL_NAME[lvl] || 'contributor',
          ...(isExtensionRole(roleId) ? EXTENSION_PROVENANCE : ARRM_PROVENANCE)
        });
      }
    }
  }

  if (assignments.length === 0) {
    // No ARRM or curated extension mapping. Do NOT invent an owner — flag for
    // accessibility triage so a human determines the right role(s).
    return {
      assignments: [],
      primary: null, coPrimary: [], secondary: [], contributors: [],
      source: 'unmapped',
      matchedSc: [], unmatchedSc: criteria.filter(Boolean),
      needsAccessibilityTriage: true,
      reason: 'No ARRM or curated Workbench mapping is available for these success criteria.',
      provenance: null
    };
  }

  // Reduce assignments to the highest responsibility each role holds anywhere.
  const bestByRole = new Map();
  for (const a of assignments) {
    const cur = bestByRole.get(a.roleId);
    if (!cur || LEVEL_RANK[a.responsibility] > LEVEL_RANK[cur]) bestByRole.set(a.roleId, a.responsibility);
  }
  const roleOrder = [...bestByRole.keys()].sort(); // deterministic
  const primaries = roleOrder.filter(r => bestByRole.get(r) === 'primary');
  const secondary = roleOrder.filter(r => bestByRole.get(r) === 'secondary').map(roleName);
  const contributors = roleOrder.filter(r => bestByRole.get(r) === 'contributor').map(roleName);

  const anyExtension = assignments.some(a => a.source !== 'w3c-arrm');
  const source = anyExtension ? 'mixed' : 'w3c-arrm';

  return {
    assignments,
    primary: primaries.length ? roleName(primaries[0]) : (secondary[0] || null),
    coPrimary: primaries.slice(1).map(roleName),
    secondary,
    contributors,
    source,
    matchedSc,
    unmatchedSc,
    needsAccessibilityTriage: false,
    provenance: ARRM_PROVENANCE
  };
}
