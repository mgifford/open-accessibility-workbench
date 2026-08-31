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

    // Parse WCAG conformance. Oobee emits comma-joined success-criterion tokens
    // of the form `wcag2a,wcag412` (see GovTechSG/oobee writeCsv.ts:
    // `conformance.join(',')`). Dotted forms (`2.4.4`) are also accepted so the
    // parser stays robust to variant inputs.
    const wcag = parseWcagConformance(row.wcagConformance);
    const wcagLevel = wcagLevelFromTokens(row.wcagConformance, wcag);

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

/**
 * Parses an Oobee `wcagConformance` value into an array of dotted WCAG
 * success-criterion identifiers (e.g. "2.4.4").
 *
 * Oobee serializes conformance as comma-joined tokens matched by the regex
 * `/wcag[0-9]{3,4}/` in its source, optionally suffixed with a level marker
 * (`a`/`aa`/`aaa`). Examples observed upstream:
 *   - `wcag2a`      -> level marker only (WCAG 2.x, Level A); no specific SC
 *   - `wcag412`     -> SC 4.1.2
 *   - `wcag143aa`   -> SC 1.4.3 (Level AA)
 *   - `wcag221aa`   -> SC 2.2.1 (Level AA)
 * Dotted forms (`2.4.4`) are also accepted for robustness.
 *
 * @param {string | undefined} raw
 * @returns {string[]} dotted success-criterion identifiers, de-duplicated
 */
export function parseWcagConformance(raw) {
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  const seen = new Set();
  const tokens = raw.split(',').map(s => s.trim()).filter(Boolean);
  for (const token of tokens) {
    // Already dotted (e.g. "2.4.4" or "2.4.4, 4.1.2" fragment).
    if (/^\d+\.\d+(?:\.\d+)?$/.test(token)) {
      seen.add(token);
      continue;
    }
    const match = /^wcag(\d{3,4})(a{1,3})?$/i.exec(token);
    if (!match) {
      continue;
    }
    const digits = match[1];
    // A bare level token like `wcag2a` (single digit + level) carries no SC.
    if (digits.length < 2) {
      continue;
    }
    // Digits encode principle.guideline.criterion. The criterion may be one or
    // two digits: 3-digit tokens are single-digit criteria (4.1.2 -> "412"),
    // 4-digit tokens are two-digit criteria (1.4.10 -> "1410").
    const principle = digits[0];
    const guideline = digits[1];
    const criterion = digits.slice(2);
    if (!criterion) {
      continue;
    }
    seen.add(`${principle}.${guideline}.${Number(criterion)}`);
  }
  return [...seen];
}

/**
 * Derives a coarse WCAG level (A / AA / AAA) from an Oobee conformance value.
 * Prefers explicit level suffixes in the raw tokens; falls back to A when only
 * bare success criteria are present.
 *
 * @param {string | undefined} raw
 * @param {string[]} _dottedCriteria
 * @returns {'A' | 'AA' | 'AAA'}
 */
export function wcagLevelFromTokens(raw, _dottedCriteria) {
  if (raw && typeof raw === 'string') {
    const lower = raw.toLowerCase();
    if (/wcag\d{1,4}aaa\b/.test(lower)) return 'AAA';
    if (/wcag\d{1,4}aa\b/.test(lower)) return 'AA';
    if (/wcag\d{1,4}a\b/.test(lower)) return 'A';
  }
  return 'A';
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
