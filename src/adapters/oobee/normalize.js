/**
 * Normalizes Oobee finding records into CanonicalObservation objects.
 * Preserves mustFix / goodToFix / needsReview classifications alongside impact levels.
 */

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
    const impact = row.axeImpact || (severity === 'mustFix' ? 'serious' : 'moderate');

    // Parse WCAG tags
    const wcag = [];
    if (row.wcagConformance) {
      const parts = row.wcagConformance.split(',').map(s => s.trim());
      for (const p of parts) {
        if (/^\d+\.\d+(\.\d+)?$/.test(p)) {
          wcag.push(p);
        }
      }
    }

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
        impact: impact,
        wcagLevel: wcag.some(w => w.startsWith('1.') || w.startsWith('2.')) ? 'AA' : 'A'
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
  if (lower.includes('color-contrast')) return 'color-contrast';
  if (lower.includes('image-alt')) return 'image-alt';
  if (lower.includes('button-name')) return 'button-name';
  if (lower.includes('region')) return 'region';
  if (lower.includes('heading-order')) return 'heading-order';
  if (lower.includes('html-has-lang')) return 'html-has-lang';
  return lower;
}
