import { parseCSV } from '../../utils/csv-parser.js';
import { normalizeOpenScansCsvObservations } from './normalize.js';

// Engines whose rule IDs are axe-core rule IDs (or map cleanly to them). axe is
// the authoritative engine: it is the industry standard, tuned to avoid false
// positives, and present in every open-scans scan. The others are supplementary
// — real signal, but their tasks rank below axe-backed ones. (Oobee's default
// engine is also axe, so axe rule IDs are the shared vocabulary across sources.)
export const AUTHORITATIVE_ENGINE = 'axe';

/**
 * Discovers the scan engines present in an open-scans summary CSV by column
 * prefix, so a new engine works with no code change. An engine is present when
 * the header has a `<engine>_failed` column; `<engine>_failed_rules` (a
 * semicolon-joined list of rule ids/urls) carries the per-page finding signal.
 * @param {string[]} headers
 * @returns {string[]} engine prefixes, e.g. ['alfa','axe','equal_access',...]
 */
export function discoverEngines(headers) {
  const engines = new Set();
  for (const h of headers) {
    const m = /^([a-z0-9]+(?:_[a-z0-9]+)*)_failed$/.exec(h);
    // Exclude aggregate/derived columns that merely end in `_failed` but are not
    // an engine total (none today, but keep the guard explicit).
    if (m && m[1] !== 'duplicate') engines.add(m[1]);
  }
  // Stable, deterministic order with axe first so downstream tie-breaks are
  // reproducible; unknown engines follow alphabetically.
  return Array.from(engines).sort((a, b) => {
    if (a === AUTHORITATIVE_ENGINE) return -1;
    if (b === AUTHORITATIVE_ENGINE) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Parses an open-scans page-summary CSV. Returns both the per-page summary rows
 * (for the overview) and low-fidelity, rule-only observations derived from each
 * engine's `*_failed_rules` list (for the task pipeline). Observations have no
 * element evidence — the CSV does not carry HTML/selectors — which the UI states
 * honestly; the sibling report.json remains the source of element-level evidence.
 */
export function parseOpenScansReportCsv(content) {
  const records = typeof content === 'string' ? parseCSV(content) : content;
  const headers = records.length ? Object.keys(records[0]) : [];
  const engines = discoverEngines(headers);

  const pages = records.map(row => {
    const page = {
      issueNumber: row.issue_number ? Number(row.issue_number) : null,
      scanTitle: row.scan_title || '',
      submittedUrl: row.submitted_url || '',
      finalUrl: row.final_url || '',
      pageTitle: row.page_title || '',
      httpStatus: row.http_status ? Number(row.http_status) : 200,
      browser: row.scan_browser || 'unknown',
      duplicateFindings: Number(row.duplicate_findings || 0),
      // Per-engine failure counts + rule lists, keyed by engine prefix.
      engines: {}
    };
    for (const eng of engines) {
      const rules = row[`${eng}_failed_rules`]
        ? row[`${eng}_failed_rules`].split(';').map(s => s.trim()).filter(Boolean)
        : [];
      page.engines[eng] = {
        failed: Number(row[`${eng}_failed`] || 0),
        failedRules: rules
      };
    }
    return page;
  });

  const observations = normalizeOpenScansCsvObservations(pages, engines);

  return {
    system: 'open-scans',
    format: 'report.csv',
    granularity: 'page',
    engines,
    totalPages: pages.length,
    pages,
    observations
  };
}
