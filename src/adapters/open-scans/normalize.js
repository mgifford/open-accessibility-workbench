/**
 * Normalizes Open Scans detailed findings into CanonicalObservation objects.
 * Preserves upstream IDs, locators, HTML, and scanner messages.
 */

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

  for (const pageResult of openScansReport.results) {
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
        for (const failure of engineData.failures) {
          recordIndex++;

          // Extract WCAG SC tags
          const wcag = [];
          if (Array.isArray(failure.wcagSc)) {
            for (const tag of failure.wcagSc) {
              const match = tag.match(/wcag(\d)(\d)(\d)/i);
              if (match) {
                wcag.push(`${match[1]}.${match[2]}.${match[3]}`);
              } else if (tag.startsWith('wcag')) {
                wcag.push(tag.replace('wcag', ''));
              }
            }
          }

          const observation = {
            id: failure.a11yOccurrenceFingerprint || `obs-os-${scanId}-${recordIndex}`,
            schemaVersion: '1.0',
            source: {
              system: 'open-scans',
              version: null,
              format: 'report.json',
              scanId,
              importedAt,
              originalRef: importedRef
            },
            page: { ...page },
            classification: {
              sourceCategory: null,
              impact: failure.impact || 'serious',
              wcagLevel: failure.wcagSc?.some(t => /aaa/i.test(t)) ? 'AAA' : (failure.wcagSc?.some(t => /aa/i.test(t)) ? 'AA' : 'A')
            },
            rule: {
              sourceRuleId: failure.rule || 'unknown-rule',
              normalizedRuleId: normalizeRuleName(failure.rule || ''),
              wcag: Array.from(new Set(wcag)),
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
