/**
 * Human-readable descriptions for scanner rule ids that would otherwise render
 * as opaque codes or bare URLs (Alfa `sia-r*`, ACT `qw-act-r*`, and a few IBM
 * equal-access rules whose WCAG mapping is unambiguous).
 *
 * Every entry here was VERIFIED against the authoritative rule page, cited in
 * `source`. `wcag` is a list of dotted WCAG Success Criteria the rule maps to,
 * or `[]` when the rule is a best practice not required for conformance to any
 * specific SC (stated honestly rather than invented). This map only supplies a
 * friendly title and the verified SC list; the plain-English "what's wrong" text
 * always comes from the scanner's own per-finding description, never from here.
 *
 * Unknown rule ids are not a problem: the UI falls back to the raw id plus the
 * finding's own description, so nothing is fabricated for rules not listed.
 *
 * Snapshot verified 2026-09-18. When a rule is absent, that is deliberate — it
 * means its SC mapping was not verified, not that it has none.
 */

/** @type {Record<string, { title: string, wcag: string[], source: string }>} */
export const RULE_DESCRIPTIONS = {
  // --- Siteimprove Alfa (ACT-based). Verified against alfa.siteimprove.com/rules. ---
  'https://alfa.siteimprove.com/rules/sia-r14': {
    title: 'Visible labels are included in accessible names',
    wcag: ['2.5.3'],
    source: 'https://alfa.siteimprove.com/rules/sia-r14'
  },
  'https://alfa.siteimprove.com/rules/sia-r53': {
    title: 'Headings are structured (best practice)',
    wcag: [],
    source: 'https://alfa.siteimprove.com/rules/sia-r53'
  },
  'https://alfa.siteimprove.com/rules/sia-r56': {
    title: 'Landmarks of the same type have a unique accessible name (best practice)',
    wcag: [],
    source: 'https://alfa.siteimprove.com/rules/sia-r56'
  },
  'https://alfa.siteimprove.com/rules/sia-r57': {
    title: 'Perceivable text content is included in a landmark (best practice)',
    wcag: [],
    source: 'https://alfa.siteimprove.com/rules/sia-r57'
  },
  'https://alfa.siteimprove.com/rules/sia-r61': {
    title: 'Documents start with a level-1 heading (best practice)',
    wcag: [],
    source: 'https://alfa.siteimprove.com/rules/sia-r61'
  },
  'https://alfa.siteimprove.com/rules/sia-r66': {
    title: 'Text has enhanced contrast',
    wcag: ['1.4.6'],
    source: 'https://alfa.siteimprove.com/rules/sia-r66'
  },
  'https://alfa.siteimprove.com/rules/sia-r87': {
    title: 'First focusable element is a link to the main content (best practice)',
    wcag: [],
    source: 'https://alfa.siteimprove.com/rules/sia-r87'
  },
  'https://alfa.siteimprove.com/rules/sia-r111': {
    title: 'Target size (enhanced)',
    wcag: ['2.5.5'],
    source: 'https://alfa.siteimprove.com/rules/sia-r111'
  },

  // --- W3C ACT rules as emitted raw by QualWeb (qw-act-r*). Verified against
  // the ACT rule permalinks the scan itself links to. ---
  'qw-act-r30': {
    title: 'Visible label is part of the accessible name',
    wcag: ['2.5.3'],
    source: 'https://www.w3.org/WAI/standards-guidelines/act/rules/2ee8b8/'
  },
  'qw-act-r65': {
    title: 'Element with presentational children has no focusable content',
    wcag: ['4.1.2'],
    source: 'https://www.w3.org/WAI/standards-guidelines/act/rules/307n5z/'
  },

  // --- IBM equal-access rules whose WCAG mapping is unambiguous and corroborated
  // by the rule id + IBM's own naming. Others are intentionally omitted (their
  // scanner description is shown instead, rather than guess an SC). ---
  'style_focus_visible': {
    title: 'Keyboard focus indicator is visible',
    wcag: ['2.4.7'],
    source: 'https://www.ibm.com/able/requirements/checker-rule-sets/'
  },
  'element_tabbable_unobscured': {
    title: 'Tabbable element is not obscured on focus',
    wcag: ['2.4.11'],
    source: 'https://www.ibm.com/able/requirements/checker-rule-sets/'
  }
};

/**
 * Returns a friendly description for a rule id, or null when the id is not in the
 * verified map. Never fabricates: callers fall back to the raw id and the
 * finding's own scanner description.
 * @param {string} ruleId - the source or normalized rule id
 * @returns {{ title: string, wcag: string[], source: string } | null}
 */
export function describeRule(ruleId) {
  if (!ruleId) return null;
  return RULE_DESCRIPTIONS[ruleId] || RULE_DESCRIPTIONS[ruleId.toLowerCase()] || null;
}

/**
 * Resolves the best display info for a task/cluster, combining the verified map
 * with the finding's OWN scanner-provided description, help URL, and WCAG tags.
 * Nothing here is invented: a friendly title/SC comes only from the verified map,
 * and the "what's wrong" explanation always comes from the scanner.
 *
 * @param {object} item - a task or cluster, carrying `ruleId`, `sourceRuleId`,
 *   `wcag`, and `observations[]` (each with `evidence.description`/`.helpUrl`).
 * @returns {{
 *   ruleId: string, title: string|null, description: string,
 *   wcag: string[], sourceUrl: string|null, mapped: boolean
 * }}
 */
export function resolveRuleDisplay(item = {}) {
  const ruleId = item.ruleId || item.sourceRuleId || '';
  const mapped = describeRule(item.sourceRuleId) || describeRule(ruleId);

  // Scanner-provided explanation and link from the finding itself.
  const obs = Array.isArray(item.observations) ? item.observations : [];
  const withDesc = obs.find(o => (o.evidence?.description || '').trim());
  const description = (withDesc?.evidence?.description || '').trim();
  const withHelp = obs.find(o => o.evidence?.helpUrl);
  const findingHelp = withHelp?.evidence?.helpUrl || null;

  // WCAG: prefer the finding's own tags; fall back to the verified map. Both are
  // honest sources — the finding's tags come from the scanner, the map from a
  // verified rule page.
  const findingWcag = Array.isArray(item.wcag) && item.wcag.length ? item.wcag : [];
  const wcag = findingWcag.length ? findingWcag : (mapped?.wcag || []);

  return {
    ruleId,
    title: mapped?.title || null,
    description,
    wcag,
    sourceUrl: mapped?.source || findingHelp || (isRuleUrl(ruleId) ? ruleId : null),
    mapped: Boolean(mapped)
  };
}

/** A rule id that is itself an http(s) URL (e.g. an Alfa sia-r* rule). */
function isRuleUrl(ruleId = '') {
  return /^https?:\/\//i.test(ruleId);
}
