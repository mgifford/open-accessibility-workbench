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

function pickMetadataTechnology(scanMetadata, rejectedSet) {
  const list = scanMetadata?.technologies;
  if (!Array.isArray(list) || list.length === 0) return null;
  const top = list.find(t => t && t.name && !rejectedSet.has(String(t.name).toLowerCase()));
  if (!top) return null;
  return {
    name: top.name,
    category: top.category || getCategoryForTech(top.name),
    // Numeric upstream confidence (0-100) mapped to our bands; metadata is
    // authoritative-ish but still not user-confirmed.
    confidence: typeof top.confidence === 'number' ? (top.confidence >= 80 ? 'high' : top.confidence >= 40 ? 'medium' : 'low') : 'high',
    source: 'metadata',
    evidence: Array.isArray(top.evidence) ? top.evidence : ['Technology reported in scan metadata.'],
    confirmed: false,
    // Preserve unrecognized upstream fields rather than discarding them.
    raw: top
  };
}

function pickImportedDetector(scanMetadata, rejectedSet) {
  const list = scanMetadata?.detectorResults;
  if (!Array.isArray(list) || list.length === 0) return null;
  const top = list.find(t => t && t.name && !rejectedSet.has(String(t.name).toLowerCase()));
  if (!top) return null;
  return {
    name: top.name,
    category: top.category || getCategoryForTech(top.name),
    confidence: 'medium',
    source: 'detector',
    evidence: Array.isArray(top.evidence) ? top.evidence : ['Imported technology detector output.'],
    confirmed: false,
    raw: top
  };
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
