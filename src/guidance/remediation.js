/**
 * Generates rich, deterministic Remediation Blueprints without requiring any AI.
 */

import { getTechnologyGuidance } from './technology-guidance.js';
import { getExactRuleGuidance } from './exact-rule.js';
import { retrieveGuidance } from './retrieve.js';

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

  let problem = `Accessibility failure for rule '${ruleId}'.`;
  let whySystemic = isMultiPage
    ? `This pattern recurs across ${pagesCount} pages (${occurrencesCount} total occurrences), indicating a shared component, template, or global token.`
    : `This failure was observed on a single page, but may affect other instances of this component.`;
  let likelyRootCause = componentHypothesis?.rationale || 'Reused markup structure in site templates.';
  let whatNeedsToChange = 'Update the element markup or styling to satisfy WCAG criteria.';
  let humanDecisionsRequired = [];
  let targetMarkup = null;
  let verificationSteps = [
    'Inspect the element in the browser Accessibility Tree inspector.',
    'Test with keyboard navigation to verify focusability and tab order.',
    'Verify using a screen reader (VoiceOver, NVDA, or JAWS).',
    'Re-run automated accessibility scans.'
  ];

  if (ruleId === 'link-name') {
    problem = 'Links do not have discernible, accessible text communicating their destination.';
    whatNeedsToChange = 'Provide accessible text for the link using visible text or an aria-label attribute.';
    humanDecisionsRequired = [
      'Confirm the human-readable destination name for each link (e.g. "Visit Drupal Asheville on LinkedIn").',
      'Determine whether to use visually hidden text (.sr-only) or aria-label.'
    ];
    targetMarkup = `<a href="..." class="social-link" aria-label="Visit our profile on LinkedIn">\n  <span class="icon-linkedin" aria-hidden="true"></span>\n</a>`;
    verificationSteps = [
      'Inspect the computed accessible name in the browser DevTools Accessibility tab.',
      'Tab to the link and verify the screen reader announces the link purpose clearly.',
      'Re-run automated axe check to verify link-name passes.'
    ];
  } else if (ruleId === 'color-contrast') {
    problem = 'Elements have insufficient color contrast between text and background.';
    whatNeedsToChange = 'Adjust the text color or background color token in the theme stylesheet to meet the minimum 4.5:1 ratio.';
    humanDecisionsRequired = [
      'Consult with Visual Design to select an approved brand color palette token that achieves at least 4.5:1 contrast.',
      'Confirm if font size/weight can be adjusted if 3:1 ratio is preferred for large text.'
    ];
    targetMarkup = `/* In theme stylesheet / design tokens */\n:root {\n  --color-brand-primary: #d44d10; /* Adjusted for 4.5:1 contrast against white */\n}`;
    verificationSteps = [
      'Inspect contrast ratio using browser DevTools color picker.',
      'Verify readability in operating system High Contrast / Forced Colors mode.',
      'Re-run automated color-contrast check.'
    ];
  } else if (ruleId === 'image-alt') {
    problem = 'Images missing alt attribute prevent non-sighted users from understanding image content.';
    whatNeedsToChange = 'Add an appropriate alt attribute to every <img> element.';
    humanDecisionsRequired = [
      'Determine whether the image is informative (requires descriptive alt text) or decorative (requires alt="").'
    ];
    targetMarkup = `<img src="/assets/photo.jpg" alt="Conference attendees gathered at the opening keynote" />`;
    verificationSteps = [
      'Verify presence of alt attribute on <img> in DOM.',
      'Verify screen reader reads the alternative text or skips decorative image.',
      'Re-run automated image-alt check.'
    ];
  } else if (ruleId === 'region') {
    problem = 'Content is not contained within landmark regions.';
    whatNeedsToChange = 'Wrap major page areas in semantic HTML5 elements (<header>, <nav>, <main>, <footer>).';
    humanDecisionsRequired = [
      'Confirm primary page content boundaries for <main>.',
      'Ensure each <nav> landmark has a distinguishing aria-label if multiple navigation menus exist.'
    ];
    targetMarkup = `<header>...</header>\n<nav aria-label="Main Navigation">...</nav>\n<main>\n  <!-- Primary page content -->\n</main>\n<footer>...</footer>`;
    verificationSteps = [
      'Verify landmark navigation shortcuts in screen reader.',
      'Confirm exactly one <main> element per page.'
    ];
  }

  // Technology-specific guidance EXTENDS the framework-neutral objective above;
  // it never replaces `whatNeedsToChange` / `targetMarkup`, which remain the
  // generic HTML remediation in every case. It is only populated for a
  // defensibly-known technology (see technology-guidance.js).
  const technologyGuidance = getTechnologyGuidance(
    remediationFamily || familyFromRule(ruleId),
    technologyContext
  );

  // Curated, versioned rule guidance with provenance (spec §9.1).
  const ruleGuidance = getExactRuleGuidance(ruleId);
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
