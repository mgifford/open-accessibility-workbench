/**
 * Normalizes Open Scans detailed findings into CanonicalObservation objects.
 * Preserves upstream IDs, locators, HTML, and scanner messages.
 */

import { parseWcagTags, wcagLevelFromTags } from '../../utils/wcag-tags.js';

/**
 * @param {object} openScansReport
 * @param {string} [importedRef="report.json"]
 * @returns {Array<import('../../analysis/canonicalize.js').CanonicalObservation>}
 */
export function normalizeOpenScansReportJson(openScansReport, importedRef = 'report.json') {
  if (!openScansReport || !Array.isArray(openScansReport.results)) {
    return [];
  }

  const scanId = String(openScansReport.issueNumber || openScansReport.scanTitle || 'open-scans');
  const importedAt = new Date().toISOString();
  const observations = [];
  let recordIndex = 0;

  for (let pageIndex = 0; pageIndex < openScansReport.results.length; pageIndex++) {
    const pageResult = openScansReport.results[pageIndex];
    const page = {
      submittedUrl: pageResult.submittedUrl || '',
      finalUrl: pageResult.finalUrl || pageResult.submittedUrl || '',
      title: pageResult.pageTitle || '',
      browser: pageResult.scanContext?.browser || openScansReport.scanContext?.browser || 'unknown',
      viewport: pageResult.scanContext?.viewport || openScansReport.scanContext?.viewport || null,
      colorScheme: pageResult.scanContext?.colorScheme || openScansReport.scanContext?.colorScheme || 'light'
    };

    // Iterate over scanner engines (axe, qualweb, alfa, equalAccess, accesslint)
    const engines = ['axe', 'qualweb', 'alfa', 'equalAccess', 'accesslint'];

    for (const engine of engines) {
      const engineData = pageResult[engine];
      if (engineData && engineData.executed && Array.isArray(engineData.failures)) {
        for (let failureIndex = 0; failureIndex < engineData.failures.length; failureIndex++) {
          const failure = engineData.failures[failureIndex];
          recordIndex++;

          // Extract WCAG SC tags (tokens like `wcag2aa`, `wcag143`).
          const wcag = parseWcagTags(failure.wcagSc);

          // Stable JSON-pointer-style path to the exact source record, so a
          // normalized observation can be located in the original artifact.
          const recordPointer = `/results/${pageIndex}/${engine}/failures/${failureIndex}`;

          const observation = {
            id: failure.a11yOccurrenceFingerprint || `obs-os-${scanId}-${recordIndex}`,
            schemaVersion: '1.0',
            source: {
              system: 'open-scans',
              version: null,
              format: 'report.json',
              scanId,
              sourceReportId: null, // stamped by the loader from the source registry
              importedAt,
              originalRef: importedRef,
              recordPointer
            },
            page: { ...page },
            classification: {
              sourceCategory: null,
              // Retain the scanner's impact exactly; never fabricate one when
              // the scanner reported none (matches the Oobee model and
              // DATA_MODEL.md's "normalizers do not invent missing values").
              impact: hasImpact(failure.impact) ? failure.impact : null,
              impactSource: hasImpact(failure.impact) ? 'scanner' : 'none',
              wcagLevel: wcagLevelFromTags(failure.wcagSc)
            },
            rule: {
              sourceRuleId: failure.rule || 'unknown-rule',
              normalizedRuleId: normalizeRuleName(failure.rule || ''),
              wcag,
              actRules: []
            },
            evidence: {
              description: failure.message || '',
              renderedHtml: failure.html || '',
              locator: failure.xpath || '',
              locatorType: failure.xpath?.startsWith('/') ? 'xpath' : 'selector',
              scannerGuidance: failure.fixSummary || '',
              helpUrl: failure.ruleUrl || null
            },
            identity: {
              sourceFindingId: failure.fingerprint || null,
              sourcePatternId: failure.patternId || failure.a11yPatternFingerprint || null,
              sourceOccurrenceId: failure.a11yOccurrenceFingerprint || null,
              sourceFingerprint: failure.fingerprint || null,
              a11yPatternDisplayId: failure.a11yPatternDisplayId || null,
              a11yOccurrenceDisplayId: failure.a11yOccurrenceDisplayId || null
            },
            duplicate: {
              sourceMarkedDuplicate: Boolean(failure.isDuplicate),
              duplicateOf: failure.duplicateOf || null
            },
            provenance: {
              scanner: engine,
              sourceRecordIndex: recordIndex
            }
          };

          observations.push(observation);
        }
      }
    }
  }

  return observations;
}

function hasImpact(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function normalizeRuleName(rawRule) {
  const lower = rawRule.toLowerCase().trim();
  if (lower.includes('color-contrast') || lower === 'qw-act-r37') return 'color-contrast';
  if (lower.includes('link-name') || lower === 'qw-act-r11') return 'link-name';
  if (lower.includes('image-alt') || lower === 'qw-act-r38') return 'image-alt';
  if (lower.includes('button-name') || lower === 'qw-act-r12') return 'button-name';
  if (lower.includes('region') || lower === 'qw-act-r76' || lower === 'landmark-one-main') return 'region';
  if (lower.includes('heading-order')) return 'heading-order';
  if (lower.includes('html-has-lang') || lower.includes('html-lang-valid')) return 'html-has-lang';
  return lower;
}
