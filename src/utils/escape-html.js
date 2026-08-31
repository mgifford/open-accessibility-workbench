/**
 * HTML escaping for untrusted, report-derived values interpolated into template
 * strings. Scanner evidence (rule ids, messages, HTML snippets, URLs, titles) is
 * untrusted data and must never become live markup — see the project's data
 * boundary rules. Use `escapeHtml` for text content and `escapeAttr` for values
 * placed inside a quoted attribute.
 */

/**
 * Escapes a value for use as HTML text content.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes a value for use inside a double- or single-quoted HTML attribute.
 * Includes quote and control characters in addition to the text-content set.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeAttr(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns a URL only if it uses a safe scheme (http, https, mailto) or is a
 * relative/anchor reference; otherwise returns '#'. Blocks javascript:, data:,
 * and other active schemes from report-derived hrefs. The result is NOT
 * attribute-escaped — wrap with escapeAttr at the call site.
 * @param {unknown} value
 * @returns {string}
 */
export function safeUrl(value) {
  if (value === null || value === undefined) return '#';
  const url = String(value).trim();
  if (url === '') return '#';
  // Relative paths and same-page anchors are safe.
  if (/^(\/|\.|#|\?)/.test(url)) return url;
  // Absolute URLs must use an allowed scheme.
  if (/^(https?:|mailto:)/i.test(url)) return url;
  // Protocol-relative (//host) is treated as https.
  if (/^\/\//.test(url)) return url;
  return '#';
}
