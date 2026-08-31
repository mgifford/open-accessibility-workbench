/**
 * Shared parsing for WCAG conformance tags emitted by scanners.
 *
 * axe-derived tools (Oobee, Open Scans) encode success criteria as compact
 * tokens matching `/wcag[0-9]{3,4}/`, optionally suffixed with a level marker
 * (`a` / `aa` / `aaa`). Examples:
 *   - `wcag2a`      -> level marker only (no specific success criterion)
 *   - `wcag412`     -> SC 4.1.2
 *   - `wcag143`     -> SC 1.4.3
 *   - `wcag143aa`   -> SC 1.4.3 (Level AA)
 *   - `wcag1410aa`  -> SC 1.4.10 (Level AA)
 * Dotted forms (`2.4.4`) are also accepted for robustness.
 */

/**
 * Converts a single tag into a dotted success-criterion id, or null when the
 * tag carries no specific criterion (e.g. a bare level marker like `wcag2a`).
 * @param {string} tag
 * @returns {string | null}
 */
export function wcagTagToCriterion(tag) {
  if (typeof tag !== 'string') return null;
  const trimmed = tag.trim();
  if (!trimmed) return null;

  // Already dotted.
  if (/^\d+\.\d+(?:\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  const match = /^wcag(\d{3,4})(a{1,3})?$/i.exec(trimmed);
  if (!match) return null;

  const digits = match[1];
  const principle = digits[0];
  const guideline = digits[1];
  const criterion = digits.slice(2);
  if (!criterion) return null; // e.g. `wcag2a` -> level marker only

  return `${principle}.${guideline}.${Number(criterion)}`;
}

/**
 * Parses an array (or comma-joined string) of WCAG tags into de-duplicated
 * dotted success-criterion ids.
 * @param {string[] | string | undefined | null} tags
 * @returns {string[]}
 */
export function parseWcagTags(tags) {
  let list = [];
  if (Array.isArray(tags)) {
    list = tags;
  } else if (typeof tags === 'string') {
    list = tags.split(',');
  } else {
    return [];
  }

  const seen = new Set();
  for (const tag of list) {
    const sc = wcagTagToCriterion(tag);
    if (sc) seen.add(sc);
  }
  return [...seen];
}

/**
 * Derives a coarse WCAG level (A / AA / AAA) from tags, preferring explicit
 * level suffixes; defaults to 'A' when only bare criteria are present.
 * @param {string[] | string | undefined | null} tags
 * @returns {'A' | 'AA' | 'AAA'}
 */
export function wcagLevelFromTags(tags) {
  const joined = Array.isArray(tags) ? tags.join(',') : (typeof tags === 'string' ? tags : '');
  const lower = joined.toLowerCase();
  if (/wcag\d{1,4}aaa\b/.test(lower)) return 'AAA';
  if (/wcag\d{1,4}aa\b/.test(lower)) return 'AA';
  if (/wcag\d{1,4}a\b/.test(lower)) return 'A';
  return 'A';
}
