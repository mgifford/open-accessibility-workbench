/**
 * Parsers for Oobee summary JSON reports.
 *
 * Shapes follow the artifacts produced by GovTechSG/oobee
 * (src/mergeAxeResults/jsonArtifacts.ts). The severity categories
 * (mustFix / goodToFix / needsReview / passed) are objects or arrays depending
 * on the artifact, never bare numbers, so counts are read from within each
 * category rather than from a single root field.
 */

/**
 * scanItemsSummary.json — object keyed by severity category, each category an
 * object of the form `{ totalItems, totalRuleIssues, rules }`, plus scan-level
 * aggregate fields (wcagPassPercentage, totalPagesScanned, ...).
 */
export function parseOobeeItemsSummary(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;

  const categoryTotal = (cat) => {
    if (cat == null) return 0;
    if (typeof cat === 'number') return cat; // tolerate simplified inputs
    if (typeof cat === 'object') return Number(cat.totalItems || 0);
    return 0;
  };

  const mustFix = categoryTotal(json.mustFix);
  const goodToFix = categoryTotal(json.goodToFix);
  const needsReview = categoryTotal(json.needsReview);

  return {
    system: 'oobee',
    format: 'scanItemsSummary.json',
    granularity: 'aggregate',
    mustFix,
    goodToFix,
    needsReview,
    totalItems: mustFix + goodToFix + needsReview,
    wcagPassPercentage:
      json.wcagPassPercentage !== undefined ? Number(json.wcagPassPercentage) : null,
    totalPagesScanned:
      json.totalPagesScanned !== undefined ? Number(json.totalPagesScanned) : null
  };
}

/**
 * scanIssuesSummary.json — object with severity categories as arrays of rule
 * objects `{ rule, description, axeImpact, helpUrl, conformance, totalItems }`.
 * The flattened `issues` array preserves each rule's originating category.
 */
export function parseOobeeIssuesSummary(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;

  const categories = ['mustFix', 'goodToFix', 'needsReview', 'passed'];
  const issues = [];

  if (Array.isArray(json)) {
    // Tolerate a bare array of rule objects (older/variant inputs).
    for (const rule of json) {
      issues.push({ ...rule, category: rule.category || null });
    }
  } else if (json && typeof json === 'object') {
    for (const category of categories) {
      const arr = json[category];
      if (Array.isArray(arr)) {
        for (const rule of arr) {
          issues.push({ ...rule, category });
        }
      }
    }
  }

  return {
    system: 'oobee',
    format: 'scanIssuesSummary.json',
    granularity: 'aggregate',
    issues
  };
}

/**
 * scanPagesSummary.json — object separating pages into `pagesAffected` and
 * `pagesNotAffected`, with `scannedPagesCount` and lists of pages not scanned.
 */
export function parseOobeePagesSummary(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;

  const pagesAffected = Array.isArray(json.pagesAffected) ? json.pagesAffected : [];
  const pagesNotAffected = Array.isArray(json.pagesNotAffected) ? json.pagesNotAffected : [];
  const pagesNotScanned = Array.isArray(json.pagesNotScanned) ? json.pagesNotScanned : [];

  // scannedPagesCount is authoritative when present; otherwise derive it.
  const scannedPagesCount =
    json.scannedPagesCount !== undefined
      ? Number(json.scannedPagesCount)
      : pagesAffected.length + pagesNotAffected.length;

  return {
    system: 'oobee',
    format: 'scanPagesSummary.json',
    granularity: 'page',
    scannedPagesCount,
    pagesAffected,
    pagesNotAffected,
    pagesNotScanned
  };
}

/**
 * scanPagesDetail.json — object extending the pages summary with a per-page,
 * per-rule breakdown. Pages live under `pagesAffected` (and `pagesNotAffected`).
 */
export function parseOobeePagesDetail(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;

  let pages = [];
  if (Array.isArray(json)) {
    pages = json; // tolerate a bare array of page objects
  } else if (json && typeof json === 'object') {
    const affected = Array.isArray(json.pagesAffected) ? json.pagesAffected : [];
    const notAffected = Array.isArray(json.pagesNotAffected) ? json.pagesNotAffected : [];
    pages = [...affected, ...notAffected];
  }

  return {
    system: 'oobee',
    format: 'scanPagesDetail.json',
    granularity: 'page',
    pages
  };
}
