/**
 * Normalizes Oobee finding records into CanonicalObservation objects.
 * Preserves mustFix / goodToFix / needsReview classifications alongside impact levels.
 */

import { parseWcagTags, wcagLevelFromTags } from '../../utils/wcag-tags.js';

/**
 * @param {Array<Record<string, string>>} oobeeRecords
 * @param {string} [importedRef="report.csv"]
 * @returns {Array<import('../../analysis/canonicalize.js').CanonicalObservation>}
 */
export function normalizeOobeeCsvRecords(oobeeRecords, importedRef = 'report.csv') {
  if (!Array.isArray(oobeeRecords)) {
    return [];
  }

  const importedAt = new Date().toISOString();
  const observations = [];

  for (let i = 0; i < oobeeRecords.length; i++) {
    const row = oobeeRecords[i];
    const ruleId = row.issueId || row.rule || 'unknown-rule';
    const severity = row.severity || 'mustFix';
    // Retain the scanner's axe impact exactly; do NOT fabricate one from the
    // severity category when the scanner did not report an impact (the two are
    // distinct concepts). `impactSource` records provenance.
    const hasAxeImpact = typeof row.axeImpact === 'string' && row.axeImpact.trim() !== '';
    const impact = hasAxeImpact ? row.axeImpact : null;

    // Parse WCAG conformance. Oobee emits comma-joined success-criterion tokens
    // of the form `wcag2a,wcag412` (see GovTechSG/oobee writeCsv.ts:
    // `conformance.join(',')`).
    const wcag = parseWcagTags(row.wcagConformance);
    const wcagLevel = wcagLevelFromTags(row.wcagConformance);

    const observation = {
      id: `obs-oobee-${i + 1}`,
      schemaVersion: '1.0',
      source: {
        system: 'oobee',
        version: null,
        format: 'report.csv',
        scanId: row.customFlowLabel || 'oobee-scan',
        importedAt,
        originalRef: importedRef
      },
      page: {
        submittedUrl: row.url || '',
        finalUrl: row.url || '',
        title: row.pageTitle || '',
        browser: row.deviceChosen || 'desktop',
        viewport: null,
        colorScheme: null
      },
      classification: {
        sourceCategory: severity, // 'mustFix' | 'goodToFix' | 'needsReview'
        impact, // axe impact as reported by Oobee, or null if not provided
        impactSource: hasAxeImpact ? 'scanner' : 'none',
        wcagLevel
      },
      rule: {
        sourceRuleId: ruleId,
        normalizedRuleId: normalizeOobeeRule(ruleId),
        wcag,
        actRules: []
      },
      evidence: {
        description: row.issueDescription || '',
        renderedHtml: row.context || '',
        locator: row.xpath || '',
        locatorType: 'xpath',
        scannerGuidance: row.howToFix || '',
        helpUrl: row.learnMore || null
      },
      identity: {
        sourceFindingId: null,
        sourcePatternId: null,
        sourceOccurrenceId: null,
        sourceFingerprint: null
      },
      duplicate: {
        sourceMarkedDuplicate: false,
        duplicateOf: null
      },
      provenance: {
        scanner: 'oobee/axe',
        sourceRecordIndex: i + 1
      }
    };

    observations.push(observation);
  }

  return observations;
}

function normalizeOobeeRule(ruleId) {
  const lower = ruleId.toLowerCase().trim();
  if (lower.includes('link-name')) return 'link-name';
  if (lower.includes('color-contrast-enhanced')) return 'color-contrast-enhanced';
  if (lower.includes('color-contrast')) return 'color-contrast';
  if (lower.includes('image-alt')) return 'image-alt';
  if (lower.includes('button-name')) return 'button-name';
  if (lower.includes('region')) return 'region';
  if (lower.includes('heading-order')) return 'heading-order';
  if (lower.includes('html-has-lang')) return 'html-has-lang';
  return lower;
}
