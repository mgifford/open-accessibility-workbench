/**
 * Normalizes Open Scans detailed findings into CanonicalObservation objects.
 * Preserves upstream IDs, locators, HTML, and scanner messages.
 */

import { parseWcagTags, wcagLevelFromTags } from '../../utils/wcag-tags.js';
import { capField, capShort, capUrl } from '../../utils/input-limits.js';

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
      submittedUrl: capUrl(pageResult.submittedUrl || ''),
      finalUrl: capUrl(pageResult.finalUrl || pageResult.submittedUrl || ''),
      title: capShort(pageResult.pageTitle || ''),
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
              description: capField(failure.message || ''),
              renderedHtml: capField(failure.html || ''),
              locator: capShort(failure.xpath || ''),
              locatorType: failure.xpath?.startsWith('/') ? 'xpath' : 'selector',
              scannerGuidance: capField(failure.fixSummary || ''),
              helpUrl: failure.ruleUrl ? capUrl(failure.ruleUrl) : null
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

/**
 * Builds low-fidelity, rule-only CanonicalObservations from a multi-engine
 * open-scans page-summary CSV. Each observation is one (page, engine, ruleId)
 * from an engine's `*_failed_rules` list. The CSV carries no element evidence,
 * so `renderedHtml`/`locator` are empty and `evidenceLevel` is 'rule-only' — the
 * UI states this honestly and the sibling report.json remains the element-level
 * source.
 *
 * axe is authoritative (see report-csv.js): an axe-backed finding is marked
 * `authoritative: true` so ranking can float it above findings only a
 * supplementary engine reported.
 *
 * @param {Array<object>} pages - parser page rows (with `.engines`)
 * @param {string[]} engines - discovered engine prefixes
 * @param {string} [importedRef="report.csv"]
 * @returns {Array<import('../../analysis/canonicalize.js').CanonicalObservation>}
 */
export function normalizeOpenScansCsvObservations(pages, engines, importedRef = 'report.csv') {
  if (!Array.isArray(pages)) return [];
  const importedAt = new Date().toISOString();
  const observations = [];
  let recordIndex = 0;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const p = pages[pageIndex];
    const scanId = String(p.issueNumber || p.scanTitle || 'open-scans-csv');
    const page = {
      submittedUrl: capUrl(p.submittedUrl || ''),
      finalUrl: capUrl(p.finalUrl || p.submittedUrl || ''),
      title: capShort(p.pageTitle || ''),
      browser: p.browser || 'unknown',
      viewport: null,
      colorScheme: null
    };

    for (const engine of engines) {
      const engData = p.engines?.[engine];
      if (!engData || !Array.isArray(engData.failedRules)) continue;
      const isAxe = engine === 'axe';

      for (const rawRule of engData.failedRules) {
        recordIndex++;
        // A failed-rules entry may be a bare rule id or a rule-doc URL; keep the
        // last path segment as the id when it is a URL (e.g. an alfa sia-r14 URL).
        const sourceRuleId = capShort(ruleIdFromEntry(rawRule));
        const recordPointer = `/pages/${pageIndex}/${engine}/failed_rules/${rawRule}`;

        observations.push({
          id: `obs-oscsv-${scanId}-${recordIndex}`,
          schemaVersion: '1.0',
          source: {
            system: 'open-scans',
            version: null,
            format: 'report.csv',
            scanId,
            sourceReportId: null,
            importedAt,
            originalRef: importedRef,
            recordPointer
          },
          page: { ...page },
          classification: {
            // The CSV has no per-rule impact or category; do not fabricate one.
            sourceCategory: null,
            impact: null,
            impactSource: 'none',
            wcagLevel: null
          },
          rule: {
            sourceRuleId,
            normalizedRuleId: normalizeRuleName(sourceRuleId),
            wcag: [],
            actRules: []
          },
          evidence: {
            // Rule-only: the CSV names the failing rule per page but not the
            // element. Empty evidence is honest; do not invent a snippet.
            description: '',
            renderedHtml: '',
            locator: '',
            locatorType: 'none',
            scannerGuidance: '',
            helpUrl: isUrlEntry(rawRule) ? capUrl(rawRule) : null,
            evidenceLevel: 'rule-only'
          },
          identity: {
            sourceFindingId: null,
            sourceFindingIdSource: 'workbench-derived',
            sourcePatternId: null,
            sourceOccurrenceId: null,
            sourceFingerprint: null
          },
          duplicate: { sourceMarkedDuplicate: false, duplicateOf: null },
          provenance: {
            scanner: engine,
            authoritative: isAxe,
            sourceRecordIndex: recordIndex
          }
        });
      }
    }
  }

  return observations;
}

function isUrlEntry(entry) {
  return typeof entry === 'string' && /^https?:\/\//i.test(entry.trim());
}

/** Extracts a rule id from a failed-rules entry that may be a bare id or a URL. */
function ruleIdFromEntry(entry) {
  const s = String(entry || '').trim();
  if (!s) return 'unknown-rule';
  if (isUrlEntry(s)) {
    try {
      const path = new URL(s).pathname.replace(/\/+$/, '');
      return path.split('/').pop() || s;
    } catch { return s; }
  }
  return s;
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
