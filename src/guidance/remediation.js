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

  // Target markup is a STRUCTURAL PATTERN with explicit placeholders for every
  // value a human must decide. It never invents accessible names, alt text,
  // labels, colours, or design-token architecture (spec §3.5). Placeholders are
  // written in {{ }} so they are obviously unresolved, not a finished fix.
  if (ruleId === 'link-name') {
    problem = 'Links do not have discernible, accessible text communicating their destination.';
    whatNeedsToChange = 'Provide an accessible name for the link. Prefer visible text; for an icon-only link, add visually-hidden text or an accessible name.';
    humanDecisionsRequired = [
      'Determine the human-readable purpose/destination of each link (a content decision).',
      'Decide whether to use visible text, visually-hidden text, or an accessible name.'
    ];
    targetMarkup = `<!-- Pattern (fill in the human-decided values):\n     Option A — visible text:  <a href="{{ href }}">{{ link purpose }}</a>\n     Option B — icon-only:     <a href="{{ href }}"><span aria-hidden="true">{{ icon }}</span><span class="visually-hidden">{{ link purpose }}</span></a> -->`;
    verificationSteps = [
      'Inspect the computed accessible name in the browser accessibility tree.',
      'Tab to the link and verify a screen reader announces its purpose.',
      'Re-run the automated link-name rule.'
    ];
  } else if (ruleId === 'color-contrast') {
    problem = 'Elements have insufficient color contrast between text and background.';
    whatNeedsToChange = 'Change the text or background colour (ideally a design token) to meet the required ratio (4.5:1 normal text, 3:1 large text). The specific accessible colour is a design decision.';
    humanDecisionsRequired = [
      'Choose an approved accessible colour/token that meets the ratio (a Visual Design decision — the Workbench does not choose the colour).',
      'Decide whether the affected text qualifies as large text (3:1) or normal text (4.5:1).'
    ];
    targetMarkup = `/* Pattern — set the token to a colour Visual Design confirms meets the ratio: */\n:root {\n  --color-foreground: {{ accessible colour, ratio >= 4.5:1 against its background }};\n}`;
    verificationSteps = [
      'Measure the chosen colours with a contrast tool or DevTools.',
      'Verify readability in forced-colors / high-contrast mode.',
      'Re-run the automated color-contrast rule.'
    ];
  } else if (ruleId === 'image-alt') {
    problem = 'Images lack a text alternative, so non-sighted users cannot understand their content.';
    whatNeedsToChange = 'Provide a text alternative appropriate to each image: descriptive alt for informative images, empty alt for decorative images.';
    humanDecisionsRequired = [
      'Determine whether each image is informative or decorative.',
      'For informative images, decide what the alternative should convey (a content decision — the Workbench does not write alt text).'
    ];
    targetMarkup = `<!-- Informative: --> <img src="{{ src }}" alt="{{ what the image conveys }}" />\n<!-- Decorative: --> <img src="{{ src }}" alt="" />`;
    verificationSteps = [
      'Confirm the alt attribute is present and appropriate to the image’s purpose.',
      'Verify a screen reader announces informative images and skips decorative ones.',
      'Re-run the automated image-alt rule.'
    ];
  } else if (ruleId === 'region') {
    problem = 'Content is not contained within landmark regions.';
    whatNeedsToChange = 'Wrap major page areas in semantic HTML5 landmarks (<header>, <nav>, <main>, <footer>).';
    humanDecisionsRequired = [
      'Confirm the primary content boundary for <main>.',
      'If more than one navigation region exists, decide a distinguishing label for each (a structure decision).'
    ];
    targetMarkup = `<header>{{ site header }}</header>\n<nav aria-label="{{ label if multiple navs }}">{{ navigation }}</nav>\n<main>{{ primary page content }}</main>\n<footer>{{ site footer }}</footer>`;
    verificationSteps = [
      'Confirm exactly one <main> element per page.',
      'Navigate by landmark with a screen reader.',
      'Re-run the automated region rule.'
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
