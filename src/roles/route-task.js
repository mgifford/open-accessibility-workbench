/**
 * Deterministic capability routing.
 *
 * Combines a task's ARRM role guidance (primary / secondary / contributor) with
 * the user's selected capabilities to produce a relevance verdict and an
 * explanation — WITHOUT changing the task's evidence. Capability selection
 * affects ordering, emphasis, filtering, and handoff only.
 *
 * Non-goals (spec §7 non-goals): this does not assign organizational or legal
 * ownership; ARRM is routing guidance, not a statement of who must do the work.
 */

/** Which capabilities let a person act in each ARRM role. */
const ROLE_CAPABILITIES = {
  'Content Authoring': ['Page content and media', 'CMS configuration'],
  'Visual Design': ['Visual design', 'CSS/design tokens', 'Design systems/components'],
  'User Experience (UX) Design': ['UX/interaction design', 'Product/business requirements'],
  'Front-End Development': ['HTML/templates/components', 'CSS/design tokens', 'JavaScript/interactions', 'Design systems/components', 'CMS configuration'],
  'Business': ['Product/business requirements', 'Governance/process'],
  'Testing / QA': ['Automated/manual testing']
};

const REVIEW_ONLY = 'I can review but not change the site';

/**
 * Returns the capabilities that let a person act in the given role name.
 * Uses substring matching so role display-name variants still resolve.
 */
function capabilitiesForRole(roleName) {
  if (!roleName) return [];
  for (const [name, caps] of Object.entries(ROLE_CAPABILITIES)) {
    if (roleName.includes(name) || name.includes(roleName)) return caps;
  }
  // Fallbacks by keyword for looser role strings.
  if (/content/i.test(roleName)) return ROLE_CAPABILITIES['Content Authoring'];
  if (/visual/i.test(roleName)) return ROLE_CAPABILITIES['Visual Design'];
  if (/ux|interaction/i.test(roleName)) return ROLE_CAPABILITIES['User Experience (UX) Design'];
  if (/development|front-end|frontend/i.test(roleName)) return ROLE_CAPABILITIES['Front-End Development'];
  if (/test|qa/i.test(roleName)) return ROLE_CAPABILITIES['Testing / QA'];
  if (/business|governance|product/i.test(roleName)) return ROLE_CAPABILITIES['Business'];
  return [];
}

/**
 * Deterministic routing verdict for a task under a capability profile.
 *
 * @param {object} task
 * @param {string[]} [userCapabilities]
 * @returns {{
 *   relevance: 'direct'|'supporting'|'review-only'|'handoff'|'unfiltered',
 *   matchedCapabilities: string[],
 *   unmatchedCapabilities: string[],
 *   reason: string[]
 * }}
 */
export function routeTaskForProfile(task, userCapabilities = []) {
  const caps = Array.isArray(userCapabilities) ? userCapabilities : [];
  const roles = task?.roles || {};

  // No profile: everything is shown, unranked by capability.
  if (caps.length === 0) {
    return { relevance: 'unfiltered', matchedCapabilities: [], unmatchedCapabilities: [], reason: ['No capability profile selected; showing all tasks.'] };
  }

  // Primary + coPrimary roles = "direct" work; secondary = "supporting";
  // contributor = "review-only" involvement.
  const primaryRoles = [roles.primary, ...(roles.coPrimary || [])].filter(Boolean);
  const secondaryRoles = roles.secondary || [];
  const contributorRoles = roles.contributors || [];

  const primaryCaps = new Set(primaryRoles.flatMap(capabilitiesForRole));
  const secondaryCaps = new Set(secondaryRoles.flatMap(capabilitiesForRole));
  const contributorCaps = new Set(contributorRoles.flatMap(capabilitiesForRole));

  const matchedPrimary = caps.filter(c => primaryCaps.has(c));
  const matchedSecondary = caps.filter(c => secondaryCaps.has(c) && !primaryCaps.has(c));
  const matchedContributor = caps.filter(c => contributorCaps.has(c) && !primaryCaps.has(c) && !secondaryCaps.has(c));
  const matched = [...matchedPrimary, ...matchedSecondary, ...matchedContributor];
  const unmatched = caps.filter(c => !primaryCaps.has(c) && !secondaryCaps.has(c) && !contributorCaps.has(c) && c !== REVIEW_ONLY);

  const reason = [];

  if (matchedPrimary.length > 0) {
    reason.push(`You can act on the primary role for this task (${primaryRoles.join(', ')}).`);
    // Surface unresolved decisions that still need another role.
    const decisions = task?.blueprint?.humanDecisionsRequired || [];
    if (decisions.length > 0) reason.push(`A human decision is still required: ${decisions[0]}`);
    return { relevance: 'direct', matchedCapabilities: matched, unmatchedCapabilities: unmatched, reason };
  }

  if (matchedSecondary.length > 0) {
    reason.push(`Your capabilities support this task in a secondary role (${secondaryRoles.join(', ')}).`);
    reason.push(`The primary role (${primaryRoles.join(', ') || 'another role'}) is likely needed to complete it.`);
    return { relevance: 'supporting', matchedCapabilities: matched, unmatchedCapabilities: unmatched, reason };
  }

  if (matchedContributor.length > 0) {
    reason.push(`Your capabilities let you contribute to or review this task (${contributorRoles.join(', ')}).`);
    reason.push(`Another role owns the change (${primaryRoles.join(', ') || 'primary role'}).`);
    return { relevance: 'review-only', matchedCapabilities: matched, unmatchedCapabilities: unmatched, reason };
  }

  if (caps.includes(REVIEW_ONLY)) {
    reason.push('You can review but not change the site; this task is shown for review.');
    return { relevance: 'review-only', matchedCapabilities: [], unmatchedCapabilities: unmatched, reason };
  }

  // No capability matches this task's roles: it belongs to someone else.
  reason.push(`This task's roles (${[...primaryRoles, ...secondaryRoles].join(', ') || 'unknown'}) are outside your selected capabilities.`);
  reason.push('Consider preparing a handoff to the suggested role.');
  return { relevance: 'handoff', matchedCapabilities: [], unmatchedCapabilities: caps.filter(c => c !== REVIEW_ONLY), reason };
}

/**
 * Back-compatible boolean: is a task relevant to a profile? "Relevant" means it
 * is not a pure handoff (direct, supporting, review-only, or unfiltered all
 * remain visible). Findings are NEVER removed — this only informs filtering.
 */
export function isTaskRelevantToProfile(task, userCapabilities = []) {
  const { relevance } = routeTaskForProfile(task, userCapabilities);
  return relevance !== 'handoff';
}
