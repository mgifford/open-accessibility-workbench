/**
 * Exports remediation tasks as JSON-LD using the real schema.org vocabulary.
 *
 * Honesty notes:
 *  - `@context` is schema.org (a genuine, resolvable vocabulary) plus one
 *    inline term, `accessibilityProperty`, defined against schema.org's
 *    `PropertyValue`. The workbench's domain-specific facts (urgency, leverage,
 *    ARRM roles, remediation blueprint, ...) have no schema.org term, so they
 *    are represented honestly as `PropertyValue` objects under that term rather
 *    than asserted as invented schema.org types.
 *  - WCAG success criteria link to verified W3C "Understanding" URLs (see
 *    ./wcag-sc.js). Criteria not in the verified table are emitted as their
 *    plain dotted id with no URL — never a fabricated link.
 */

import { WCAG22_SC } from './wcag-sc.js';

/**
 * Builds a schema.org PropertyValue, or null when the value is empty/undefined
 * (so we never emit hollow properties).
 */
function propertyValue(name, value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return { '@type': 'PropertyValue', name, value };
}

/**
 * Represents a WCAG success criterion as a schema.org DefinedTerm.
 * Uses the verified Understanding URL when available; otherwise emits the SC id
 * with no `url` rather than a link that might 404.
 */
function wcagCriterion(sc) {
  const entry = WCAG22_SC[sc];
  const term = {
    '@type': 'DefinedTerm',
    termCode: sc,
    inDefinedTermSet: 'https://www.w3.org/TR/WCAG22/'
  };
  if (entry) {
    term.name = entry.title;
    term.url = `https://www.w3.org/WAI/WCAG22/Understanding/${entry.slug}.html`;
  }
  return term;
}

export function exportTasksToJsonLd(workspaceData) {
  const {
    tasks = [],
    sourceSummary = {},
    aiProvenance = { generatedByAI: false, model: null, runtime: null }
  } = workspaceData;

  const planProperties = [
    propertyValue('workbenchVersion', '0.1.0'),
    propertyValue('generatedByAI', Boolean(aiProvenance.generatedByAI)),
    propertyValue('aiModel', aiProvenance.model || null),
    propertyValue('aiRuntime', aiProvenance.runtime || null),
    propertyValue('scanSystem', sourceSummary.system || 'unknown'),
    propertyValue('scanId', sourceSummary.scanId || 'unknown'),
    propertyValue('scannedPages', sourceSummary.totalPages || 1)
  ].filter(Boolean);

  const jsonLd = {
    '@context': {
      '@vocab': 'https://schema.org/',
      // Domain-specific facts that schema.org does not define, carried honestly
      // as a list of schema.org PropertyValue objects.
      accessibilityProperty: {
        '@id': 'https://schema.org/PropertyValue',
        '@container': '@set'
      }
    },
    '@type': 'ItemList',
    name: 'Accessibility Remediation Plan',
    dateCreated: new Date().toISOString(),
    accessibilityProperty: planProperties,
    numberOfItems: tasks.length,
    itemListElement: tasks.map((t, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: buildTaskAction(t)
    }))
  };

  return JSON.stringify(jsonLd, null, 2);
}

/**
 * Represents a single remediation task as a schema.org Action, mapping fields
 * to real schema.org properties where they fit and carrying everything else as
 * PropertyValue objects.
 */
function buildTaskAction(t) {
  const wcag = Array.isArray(t.wcag) ? t.wcag : [];

  const roleProperties = t.roles ? [
    propertyValue('roleGuidanceSource', t.roles.source || 'unmapped'),
    propertyValue('primaryRole', t.roles.primary || null),
    propertyValue('coPrimaryRoles', t.roles.coPrimary || []),
    propertyValue('secondaryRoles', t.roles.secondary || []),
    propertyValue('contributorRoles', t.roles.contributors || []),
    propertyValue('needsAccessibilityTriage', Boolean(t.roles.needsAccessibilityTriage))
  ].filter(Boolean) : [];

  const blueprint = t.blueprint || {};
  const blueprintProperties = [
    propertyValue('problemStatement', blueprint.problem),
    propertyValue('rootCause', blueprint.likelyRootCause),
    propertyValue('remediationSummary', blueprint.whatNeedsToChange),
    propertyValue('humanDecisionsRequired', blueprint.humanDecisionsRequired),
    propertyValue('verificationSteps', blueprint.verificationSteps)
  ].filter(Boolean);

  const taskProperties = [
    propertyValue('urgency', t.urgency),
    propertyValue('leverage', t.leverage),
    ...roleProperties,
    ...blueprintProperties
  ].filter(Boolean);

  const action = {
    '@type': 'Action',
    identifier: t.id,
    name: t.title,
    object: wcag.map(wcagCriterion)
  };

  if (blueprint.problem) {
    action.description = blueprint.problem;
  }

  if (t.technologyContext) {
    action.instrument = {
      '@type': 'SoftwareApplication',
      name: t.technologyContext.name,
      applicationCategory: t.technologyContext.category || undefined,
      accessibilityProperty: [
        propertyValue('detectionConfidence', t.technologyContext.confidence),
        propertyValue('detectionSource', t.technologyContext.source),
        propertyValue('confirmed', Boolean(t.technologyContext.confirmed))
      ].filter(Boolean)
    };
  }

  if (taskProperties.length > 0) {
    action.accessibilityProperty = taskProperties;
  }

  return action;
}
