/**
 * Normalizes imported technology-detector output into the workbench's record
 * shape, so a scan pipeline that runs a real detector (e.g. Wappalyzer) can feed
 * its results straight in without reshaping them here.
 *
 * Accepted input shapes (all real Wappalyzer / detector variants):
 *
 *  1. Workbench array   — [ { name, category?, confidence?, evidence?, versions? }, ... ]
 *  2. Wappalyzer object — { "Drupal": { versions: [...], categories: [...] }, ... }
 *     (wappalyzer-python3 `analyze_with_versions_and_categories`)
 *  3. Wappalyzer object — { "Drupal": { version, confidence, categories, groups }, ... }
 *     (the PyPI `wappalyzer` package's `analyze()` per-technology value)
 *
 * Output: an array of records { name, category, confidence?, versions, evidence, raw }.
 * `confidence` is passed through only when the detector supplied one; the caller
 * (detect.js) normalizes it and never promotes an unqualified detection above
 * medium — only user confirmation is high.
 */

/**
 * @param {object|Array|string} content - parsed object, array, or JSON string.
 * @returns {Array<object>} normalized detector records (may be empty).
 */
export function normalizeDetectorTechnologies(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  if (!json || typeof json !== 'object') return [];

  // Shape 1: already an array of records.
  if (Array.isArray(json)) return json.filter(t => t && t.name).map(coerceRecord);

  // Shape 2/3: an object keyed by technology name. Reject array-like objects
  // (handled above) and empty objects.
  return Object.entries(json)
    .filter(([name, value]) => name && value && typeof value === 'object')
    .map(([name, value]) => coerceRecord({ name, ...value }));
}

/** Coerces one record (workbench or Wappalyzer field names) to the common shape. */
function coerceRecord(rec) {
  const versions = Array.isArray(rec.versions)
    ? rec.versions
    : (rec.version ? [rec.version] : []);
  const categories = Array.isArray(rec.categories) ? rec.categories : [];
  const out = {
    name: rec.name,
    category: rec.category || categories[0] || null,
    versions,
    evidence: Array.isArray(rec.evidence) && rec.evidence.length
      ? rec.evidence
      : buildEvidence(rec.name, versions, categories),
    raw: rec
  };
  // Only carry confidence forward when the detector actually reported one, so an
  // absent confidence is normalized to "present-but-unqualified" downstream
  // rather than being invented here.
  if (rec.confidence !== undefined && rec.confidence !== null) out.confidence = rec.confidence;
  return out;
}

function buildEvidence(name, versions, categories) {
  const parts = [`Reported by an imported technology detector`];
  if (versions.length) parts.push(`version ${versions.join(', ')}`);
  if (categories.length) parts.push(`categories: ${categories.join(', ')}`);
  return [`${parts.join('; ')}.`];
}

/**
 * Back-compat: the original importer returned the raw `technologies` array (or
 * []). Kept for callers that only need the list; new code should prefer
 * normalizeDetectorTechnologies, which also accepts the Wappalyzer object shapes.
 * @deprecated use normalizeDetectorTechnologies
 */
export function parseImportedDetectorJson(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  return Array.isArray(json?.technologies) ? json.technologies : [];
}
