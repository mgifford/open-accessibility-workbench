/**
 * Deterministic capability routing.
 *
 * Distinguishes three things a person's capabilities may let them do on a task:
 *   - DECIDE      make the human decision the task requires (e.g. choose a colour,
 *                 write link text) — decision authority;
 *   - IMPLEMENT   carry out an approved change (e.g. edit CSS, edit a template);
 *   - VERIFY      check the result (automated / manual / AT testing).
 *
 * Being able to implement a change is NOT the same as authority to make the
 * decision behind it. A CSS-only user can implement a colour token but does not
 * choose the accessible colour; they are relevant implementation work that is
 * blocked by a design decision, not the decision-maker.
 *
 * Routing never changes a task's evidence — it only informs ordering, emphasis,
 * filtering, and handoff. It is guidance, not organizational ownership.
 */

/**
 * Capability -> the facet(s) it grants. A capability may grant decision authority
 * for some concerns, implementation for others, or verification.
 */
const CAPABILITY_FACETS = {
  'Page content and media':      { decide: ['content'], implement: ['content'] },
  'HTML/templates/components':   { implement: ['markup', 'structure'] },
  'CSS/design tokens':           { implement: ['contrast', 'visual'] },
  'JavaScript/interactions':     { implement: ['behavior'] },
  'CMS configuration':           { implement: ['content', 'markup'] },
  'Design systems/components':   { implement: ['visual', 'markup'] },
  'Visual design':               { decide: ['contrast', 'visual'], implement: ['visual'] },
  'UX/interaction design':       { decide: ['behavior', 'structure'] },
  'Product/business requirements': { decide: ['product'] },
  'Governance/process':          { decide: ['product'] },
  'Automated/manual testing':    { verify: ['any'] },
  'I can review but not change the site': { verify: ['any'] }
};

/**
 * The decision concern a remediation family requires. Families not listed need
 * no distinct decision beyond implementation.
 */
const FAMILY_DECISION = {
  'accessible-name': 'content',   // what should the name say?
  'text-alternative': 'content',  // what does the image convey?
  'contrast': 'contrast',         // which accessible colour?
  'structure': 'structure',       // which landmark/heading structure?
  'form-labeling': 'content',
  'target-size': 'visual'
};

/** The implementation concern a remediation family involves. */
const FAMILY_IMPLEMENT = {
  'accessible-name': 'markup',
  'text-alternative': 'content',
  'contrast': 'contrast',
  'structure': 'markup',
  'form-labeling': 'markup',
  'target-size': 'visual'
};

function facetsFor(cap) {
  return CAPABILITY_FACETS[cap] || {};
}

function grants(caps, facet, concern) {
  return caps.some(c => {
    const f = facetsFor(c)[facet];
    return Array.isArray(f) && (f.includes(concern) || f.includes('any'));
  });
}

function capsGranting(caps, facet, concern) {
  return caps.filter(c => {
    const f = facetsFor(c)[facet];
    return Array.isArray(f) && (f.includes(concern) || f.includes('any'));
  });
}

/**
 * Deterministic routing verdict for a task under a capability profile.
 *
 * @param {object} task
 * @param {string[]} [userCapabilities]
 * @returns {{
 *   relevance: 'direct'|'implementation-blocked'|'decision'|'review-only'|'handoff'|'unfiltered',
 *   matchedCapabilities: string[], unmatchedCapabilities: string[], reason: string[]
 * }}
 */
export function routeTaskForProfile(task, userCapabilities = []) {
  const caps = Array.isArray(userCapabilities) ? userCapabilities : [];

  if (caps.length === 0) {
    return { relevance: 'unfiltered', matchedCapabilities: [], unmatchedCapabilities: [], reason: ['No capability profile selected; showing all tasks.'] };
  }

  const family = task?.remediationFamily || task?.blueprint?.remediationFamily || null;
  const decisionConcern = family ? FAMILY_DECISION[family] : null;
  const implementConcern = family ? (FAMILY_IMPLEMENT[family] || 'markup') : 'markup';
  const hasUnresolvedDecision = (task?.blueprint?.humanDecisionsRequired?.length || 0) > 0;

  const canDecide = decisionConcern ? grants(caps, 'decide', decisionConcern) : false;
  const canImplement = grants(caps, 'implement', implementConcern);
  const canVerify = grants(caps, 'verify', 'any');

  const matched = [
    ...(decisionConcern ? capsGranting(caps, 'decide', decisionConcern) : []),
    ...capsGranting(caps, 'implement', implementConcern),
    ...capsGranting(caps, 'verify', 'any')
  ];
  const matchedSet = [...new Set(matched)];
  const unmatched = caps.filter(c => !matchedSet.includes(c) && c !== 'I can review but not change the site');

  const roles = task?.roles || {};
  const primaryRoles = [roles.primary, ...(roles.coPrimary || [])].filter(Boolean);
  const reason = [];

  // Can make the decision (and, if needed, implement): fully actionable.
  if (canDecide && (canImplement || !family)) {
    reason.push('You can make the decision this task needs and carry out the change.');
    return { relevance: 'direct', matchedCapabilities: matchedSet, unmatchedCapabilities: unmatched, reason };
  }

  // Can make the decision but not implement: still a decision owner.
  if (canDecide) {
    reason.push('You can make the decision this task needs; implementation may require another capability.');
    return { relevance: 'decision', matchedCapabilities: matchedSet, unmatchedCapabilities: unmatched, reason };
  }

  // Can implement, but the task needs a decision you cannot make: relevant
  // implementation work, blocked by that decision.
  if (canImplement && decisionConcern && (hasUnresolvedDecision || true)) {
    reason.push('You can implement this change once the required decision is made.');
    reason.push(`Completion likely requires input from ${describeDecider(decisionConcern)} to make the ${decisionConcern} decision.`);
    return { relevance: 'implementation-blocked', matchedCapabilities: matchedSet, unmatchedCapabilities: unmatched, reason };
  }

  // Can implement and no distinct decision is required: actionable.
  if (canImplement) {
    reason.push('You can carry out this change; no separate decision is required.');
    return { relevance: 'direct', matchedCapabilities: matchedSet, unmatchedCapabilities: unmatched, reason };
  }

  // Verification/review only.
  if (canVerify) {
    reason.push('You can verify or review this task; likely primary role involvement rests with another capability.');
    if (primaryRoles.length) reason.push(`Likely primary role involvement: ${primaryRoles.join(', ')}.`);
    return { relevance: 'review-only', matchedCapabilities: matchedSet, unmatchedCapabilities: unmatched, reason };
  }

  // Nothing matches: this task likely needs another role.
  reason.push('Your selected capabilities do not cover this task.');
  if (primaryRoles.length) reason.push(`Completion likely requires input from ${primaryRoles.join(', ')}.`);
  reason.push('Prepare a handoff to the suggested role.');
  return { relevance: 'handoff', matchedCapabilities: [], unmatchedCapabilities: caps.filter(c => c !== 'I can review but not change the site'), reason };
}

/** Human-readable description of who makes a given decision concern. */
function describeDecider(concern) {
  switch (concern) {
    case 'content': return 'Content Authoring';
    case 'contrast': return 'Visual Design';
    case 'visual': return 'Visual Design';
    case 'structure': return 'UX / Interaction Design';
    case 'behavior': return 'UX / Interaction Design';
    case 'product': return 'Business';
    default: return 'another role';
  }
}

/**
 * Back-compatible boolean: is a task relevant to a profile? Relevant = not a pure
 * handoff. Findings are NEVER removed — this only informs filtering.
 */
export function isTaskRelevantToProfile(task, userCapabilities = []) {
  const { relevance } = routeTaskForProfile(task, userCapabilities);
  return relevance !== 'handoff';
}
