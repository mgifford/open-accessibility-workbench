/**
 * Generates rich, deterministic Remediation Blueprints without requiring any AI.
 */

import { getTechnologyGuidance } from './technology-guidance.js';
import { getExactRuleGuidance } from './exact-rule.js';
import { retrieveGuidance } from './retrieve.js';
import { describeRule } from '../rules/rule-descriptions.js';

/**
 * A readable problem statement for a rule the blueprint has no bespoke text for.
 * Prefers the scanner's own plain-English description of the finding, then a
 * verified friendly rule title, and only falls back to naming the rule id when
 * neither is available. Nothing is invented — the description comes from the
 * scanner and the title from a verified rule page.
 */
function genericProblemStatement(ruleId, cluster) {
  const obs = Array.isArray(cluster?.observations) ? cluster.observations : [];
  const scannerDescription = obs.map(o => (o?.evidence?.description || '').trim()).find(Boolean);
  if (scannerDescription) return scannerDescription;

  const friendly = describeRule(cluster?.sourceRuleId) || describeRule(ruleId);
  if (friendly?.title) return `${friendly.title}: this element does not satisfy the rule.`;

  return `Accessibility failure for rule '${ruleId}'.`;
}

/** Decision concern -> the role that typically makes it (guidance, not ownership). */
const DECISION_ROLE = {
  'accessible-name': 'Content Authoring',
  'text-alternative': 'Content Authoring',
  'contrast': 'Visual Design',
  'structure': 'User Experience (UX) Design',
  'form-labeling': 'Content Authoring',
  'target-size': 'Visual Design'
};

export function generateRemediationBlueprint(taskMeta) {
  const {
    ruleId,
    cluster,
    componentHypothesis,
    technologyContext,
    remediationFamily = null,
    wcag = []
  } = taskMeta;

  const pagesCount = cluster.pagesCount || 1;
  const occurrencesCount = cluster.occurrencesCount || 1;
  const isMultiPage = pagesCount > 1;

  // Curated, versioned rule guidance with provenance (spec §9.1). This is the
  // SINGLE SOURCE OF TRUTH for the framework-neutral remediation pattern: the
  // per-rule problem statement, objective, placeholder markup, human decisions,
  // and verification steps all come from public/data/rules/rule-guidance.json
  // (via rule-guidance.generated.js). remediation.js no longer hardcodes them,
  // so the curated block and the remediation pattern can never drift apart.
  const ruleGuidance = getExactRuleGuidance(ruleId);
  const rem = ruleGuidance.curated ? (ruleGuidance.remediation || null) : null;

  let whySystemic = isMultiPage
    ? `This pattern recurs across ${pagesCount} pages (${occurrencesCount} total occurrences), indicating a shared component, template, or global token.`
    : `This failure was observed on a single page, but may affect other instances of this component.`;
  let likelyRootCause = componentHypothesis?.rationale || 'Reused markup structure in site templates.';

  // Deterministic generic defaults for a rule with no curated remediation. The
  // problem statement prefers the scanner's own description, then a verified
  // friendly title, then an honest rule-id fallback — never invented content.
  let problem = genericProblemStatement(ruleId, cluster);
  let whatNeedsToChange = 'Update the element markup or styling to satisfy WCAG criteria.';
  let humanDecisionsRequired = [];
  let targetMarkup = null;
  let verificationSteps = [
    'Inspect the element in the browser Accessibility Tree inspector.',
    'Test with keyboard navigation to verify focusability and tab order.',
    'Verify using a screen reader (VoiceOver, NVDA, or JAWS).',
    'Re-run automated accessibility scans.'
  ];

  // Curated remediation overrides the generic defaults. Target markup is a
  // STRUCTURAL PATTERN with explicit {{ }} placeholders for every value a human
  // must decide; it never invents accessible names, alt text, labels, colours,
  // or design-token architecture (spec §3.5). The curated verification list is
  // the one canonical set of steps (also surfaced as ruleGuidance.verification).
  if (rem) {
    if (rem.problem) problem = rem.problem;
    if (rem.whatNeedsToChange) whatNeedsToChange = rem.whatNeedsToChange;
    if (Array.isArray(rem.humanDecisionsRequired)) humanDecisionsRequired = rem.humanDecisionsRequired;
    if (rem.targetMarkup) targetMarkup = rem.targetMarkup;
  }
  if (ruleGuidance.curated && Array.isArray(ruleGuidance.verification) && ruleGuidance.verification.length) {
    verificationSteps = ruleGuidance.verification;
  }

  // Technology-specific guidance EXTENDS the framework-neutral objective above;
  // it never replaces `whatNeedsToChange` / `targetMarkup`, which remain the
  // generic HTML remediation in every case. It is only populated for a
  // defensibly-known technology (see technology-guidance.js).
  const technologyGuidance = getTechnologyGuidance(
    remediationFamily || familyFromRule(ruleId),
    technologyContext
  );

  const family = remediationFamily || familyFromRule(ruleId);
  const decisionRole = DECISION_ROLE[family] || null;

  // Structured human decisions (spec §9.4): each decision is explicit, with the
  // role that typically makes it and whether it blocks implementation — so
  // missing decisions are never hidden inside prose.
  const humanDecisions = (humanDecisionsRequired || []).map(text => ({
    decision: text,
    requiredRole: decisionRole,
    status: 'unresolved',
    blocksImplementation: true
  }));

  return {
    problem,
    systemicRationale: whySystemic,
    likelyRootCause,
    whatNeedsToChange,         // always framework-neutral
    remediationFamily: family,
    // Retrieved guidance for this task (deterministic order), each item with its
    // source, licence, framework, match type, and retrieval reason (spec §10.6).
    // The blueprint shows which guidance was selected and why; retrieval never
    // silently becomes remediation advice.
    retrievedGuidance: retrieveGuidance({ ruleId, wcag, technologyContext }).results.slice(0, 4),
    humanDecisionsRequired,    // string[] (back-compat)
    humanDecisions,            // structured (spec §9.4)
    ruleGuidance,              // curated guidance with provenance (spec §9.1)
    targetMarkup,              // always framework-neutral (never a source patch)
    sourceAwareCandidate: null, // only populated when source is supplied (spec §9.5)
    technologyGuidance,        // optional, additive framework context or null
    verificationSteps,
    nativeSemanticsFirst: true
  };
}

/** Local rule->family fallback so the blueprint can resolve tech guidance. */
function familyFromRule(ruleId = '') {
  const r = ruleId.toLowerCase();
  if (/link-name|button-name|accessible-name/.test(r)) return 'accessible-name';
  if (/color-contrast/.test(r)) return 'contrast';
  if (/image-alt|alt/.test(r)) return 'text-alternative';
  if (/region|landmark|heading/.test(r)) return 'structure';
  return `rule-${r}`;
}
