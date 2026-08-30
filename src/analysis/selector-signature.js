/**
 * Generates normalized, stable selector signatures from CSS selectors or XPaths.
 * Strips dynamic node IDs and hash sequences while preserving semantic class hierarchies.
 */

export function extractSelectorSignature(rawLocator) {
  if (!rawLocator || typeof rawLocator !== 'string') {
    return 'root';
  }

  let cleaned = rawLocator.trim();

  // Strip dynamic attributes e.g. [data-history-node-id="551"] -> [data-history-node-id]
  cleaned = cleaned.replace(/\[data-history-node-id="\d+"\]/g, '[data-history-node-id]');
  cleaned = cleaned.replace(/\[id="[a-zA-Z0-9_-]*\d+[a-zA-Z0-9_-]*"\]/g, '[id]');
  cleaned = cleaned.replace(/#ember\d+/g, '#ember');
  cleaned = cleaned.replace(/#ui-id-\d+/g, '#ui-id');
  cleaned = cleaned.replace(/#[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '#uuid');

  // Normalize xpath numeric indexes if structural e.g. /html/body/div[1]/a[2] -> /html/body/div/a
  cleaned = cleaned.replace(/\[\d+\]/g, '');

  // Normalize whitespace and child combinators
  cleaned = cleaned.replace(/\s*>\s*/g, ' > ');
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.toLowerCase();
}
