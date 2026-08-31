/**
 * Technology detection.
 *
 * Evidence priority (spec §8.2), strongest first:
 *   1. user-confirmed technology (overrides everything)
 *   2. explicit scanner / project metadata
 *   3. imported detector output
 *   4. strong evidence already in the report
 *   5. weak heuristic evidence
 *
 * Unknown is always a valid result — the engine never forces a framework
 * classification, and a weak clue never raises confidence above "low".
 */

/**
 * @typedef {object} TechnologyContext
 * @property {string} name         - technology name, or "Unknown"
 * @property {string|null} category
 * @property {'high'|'medium'|'low'|'none'} confidence
 * @property {'user'|'metadata'|'detector'|'report-evidence'|'heuristic'|'none'} source
 * @property {string[]} evidence
 * @property {boolean} confirmed    - true only when the user confirmed it
 */

const UNKNOWN = Object.freeze({
  name: 'Unknown',
  category: null,
  confidence: 'none',
  source: 'none',
  evidence: [],
  confirmed: false
});

/**
 * @param {Array<object>} observations
 * @param {string|null} userConfirmedTech  - a technology name the user confirmed,
 *   or the literal 'unknown' to explicitly suppress framework output.
 * @param {object|null} scanMetadata       - may carry a forward-compatible
 *   `technologies[]` array from upstream.
 * @param {string[]} [rejected]            - technology names the user rejected;
 *   detection must not re-apply these.
 * @returns {TechnologyContext}
 */
export function detectTechnologyFromObservations(observations = [], userConfirmedTech = null, scanMetadata = null, rejected = []) {
  const rejectedSet = new Set((rejected || []).map(r => String(r).toLowerCase()));

  // 1. User confirmation outranks all detectors, including an explicit Unknown.
  if (userConfirmedTech) {
    if (String(userConfirmedTech).toLowerCase() === 'unknown') {
      return { ...UNKNOWN, source: 'user', confirmed: true, evidence: ['User selected Unknown; framework-specific guidance suppressed.'] };
    }
    return {
      name: userConfirmedTech,
      category: getCategoryForTech(userConfirmedTech),
      confidence: 'high',
      source: 'user',
      evidence: ['User confirmed the technology stack.'],
      confirmed: true
    };
  }

  // 2. Explicit scanner / project metadata (forward-compatible technologies[]).
  const metaTech = pickMetadataTechnology(scanMetadata, rejectedSet);
  if (metaTech) return metaTech;

  // 3. Imported detector output (e.g. a Wappalyzer-style detectorResults[]).
  const importedTech = pickImportedDetector(scanMetadata, rejectedSet);
  if (importedTech) return importedTech;

  // 4/5. Evidence already present in the report. Strong markers -> medium
  // confidence; weak clues stay low and NEVER change output language on their own.
  const found = scanReportEvidence(observations, rejectedSet);
  if (found) return found;

  // Default: Unknown. We do NOT assert "Native HTML" — absence of framework
  // markers is not proof of anything, and unknown must remain unknown.
  return { ...UNKNOWN };
}

/**
 * Normalizes an upstream confidence (numeric 0-100 OR string) into our bands.
 * Unknown/absent confidence defaults to 'medium' (present-but-unqualified), never
 * 'high' — only user confirmation is high.
 */
export function normalizeConfidence(value) {
  if (typeof value === 'number') {
    if (value >= 80) return 'high';
    if (value >= 40) return 'medium';
    return 'low';
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'high') return 'high';
    if (v === 'medium' || v === 'med') return 'medium';
    if (v === 'low') return 'low';
    const n = Number(v);
    if (!Number.isNaN(n)) return normalizeConfidence(n);
  }
  return 'medium';
}

/** Maps a raw imported record to a context, preserving raw fields. */
function toContext(rec, source) {
  return {
    name: rec.name,
    category: rec.category || getCategoryForTech(rec.name),
    confidence: normalizeConfidence(rec.confidence),
    source,
    evidence: Array.isArray(rec.evidence) ? rec.evidence
      : [source === 'metadata' ? 'Technology reported in scan metadata.' : 'Imported technology detector output.'],
    confirmed: false,
    raw: rec // preserve unrecognized upstream fields
  };
}

function pickMetadataTechnology(scanMetadata, rejectedSet) {
  const list = scanMetadata?.technologies;
  if (!Array.isArray(list) || list.length === 0) return null;
  const usable = list.filter(t => t && t.name && !rejectedSet.has(String(t.name).toLowerCase()));
  if (usable.length === 0) return null;
  const ctx = toContext(usable[0], 'metadata');
  // Preserve EVERY imported record separately from the selected context (#5).
  ctx.allTechnologies = usable.map(t => toContext(t, 'metadata'));
  return ctx;
}

function pickImportedDetector(scanMetadata, rejectedSet) {
  const list = scanMetadata?.detectorResults;
  if (!Array.isArray(list) || list.length === 0) return null;
  const usable = list.filter(t => t && t.name && !rejectedSet.has(String(t.name).toLowerCase()));
  if (usable.length === 0) return null;
  const ctx = toContext(usable[0], 'detector');
  ctx.allTechnologies = usable.map(t => toContext(t, 'detector'));
  return ctx;
}

// Report-evidence markers. `strong` markers are CMS/framework-specific enough to
// warrant medium confidence; everything else is a weak clue kept at low.
const STRONG_MARKERS = [
  { name: 'Drupal', test: (h) => /data-history-node-id|drupal-selector|\/sites\/default\/files|node--type-/.test(h), why: 'Drupal-specific markup (data-history-node-id / drupal-selector / sites/default/files).' },
  { name: 'WordPress', test: (h) => /wp-content|wp-block-|wp-json/.test(h), why: 'WordPress-specific markup (wp-content / wp-block).' },
  { name: 'React', test: (h) => /data-reactroot|data-reactid/.test(h), why: 'React root markers (data-reactroot / data-reactid).' },
  { name: 'Angular', test: (h) => /ng-version|_nghost|_ngcontent/.test(h), why: 'Angular markers (ng-version / _nghost).' }
];

const WEAK_CLUES = [
  { name: 'Drupal', test: (h) => /node__meta|region--/.test(h), why: 'Possible Drupal theme class (weak).' },
  { name: 'React', test: (h) => /(^|[^a-z])react-/.test(h), why: 'A "react-" class name (weak).' },
  { name: 'Vue', test: (h) => /data-v-[0-9a-f]{6,}/.test(h), why: 'Scoped-style attribute resembling Vue (weak).' }
];

function scanReportEvidence(observations, rejectedSet) {
  const evidence = [];
  // Strong markers first.
  for (const obs of observations) {
    const hay = `${obs.evidence?.renderedHtml || ''} ${obs.evidence?.locator || ''} ${obs.page?.title || ''} ${obs.page?.submittedUrl || ''}`;
    for (const m of STRONG_MARKERS) {
      if (rejectedSet.has(m.name.toLowerCase())) continue;
      if (m.test(hay)) {
        return { name: m.name, category: getCategoryForTech(m.name), confidence: 'medium', source: 'report-evidence', evidence: [m.why], confirmed: false };
      }
    }
  }
  // Weak clues: recorded but kept at LOW confidence. A weak clue must not change
  // output language, so callers treat low-confidence context as advisory only.
  for (const obs of observations) {
    const hay = `${obs.evidence?.renderedHtml || ''} ${obs.evidence?.locator || ''}`;
    for (const w of WEAK_CLUES) {
      if (rejectedSet.has(w.name.toLowerCase())) continue;
      if (w.test(hay)) {
        return { name: w.name, category: getCategoryForTech(w.name), confidence: 'low', source: 'heuristic', evidence: [w.why], confirmed: false };
      }
    }
  }
  return null;
}

function getCategoryForTech(name) {
  const lower = String(name).toLowerCase();
  if (/drupal|wordpress|joomla|typo3/.test(lower)) return 'CMS';
  if (/react|vue|angular|svelte|preact/.test(lower)) return 'Frontend Framework';
  if (/twig|liquid|handlebars/.test(lower)) return 'Template Language';
  if (/web components|lit|stencil/.test(lower)) return 'Web Components';
  if (/html/.test(lower)) return 'Standards';
  return 'Other';
}
