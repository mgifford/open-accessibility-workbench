/**
 * Extracts multiple stable structural signatures from rendered HTML snippets.
 * Never removes values that are semantically relevant to the accessibility error.
 */

export function extractDomSignatures(htmlSnippet, locator = '') {
  if (!htmlSnippet || typeof htmlSnippet !== 'string') {
    return {
      exactHtmlSignature: '',
      structureSignature: '',
      semanticSignature: ''
    };
  }

  const trimmed = htmlSnippet.trim();

  // 1. Exact HTML Signature (normalized whitespace)
  const exactHtmlSignature = trimmed.replace(/\s+/g, ' ');

  // 2. Structure Signature: tag hierarchy and attributes with volatile values removed
  let struct = trimmed;
  // Replace dynamic IDs, hashes, timestamps
  struct = struct.replace(/\bid="[a-zA-Z0-9_-]*\d+[a-zA-Z0-9_-]*"/gi, 'id="*"');
  struct = struct.replace(/\bdata-history-node-id="\d+"/gi, 'data-history-node-id="*"');
  struct = struct.replace(/\bdata-drupal-selector="[^\"]*"/gi, 'data-drupal-selector="*"');
  struct = struct.replace(/\bhref="[^\"]*"/gi, 'href="*"');
  struct = struct.replace(/\bsrc="[^\"]*"/gi, 'src="*"');
  struct = struct.replace(/>\s*([^<]+)\s*</g, '>*<'); // replace arbitrary inner text with wildcard for structural match
  const structureSignature = struct.replace(/\s+/g, ' ');

  // 3. Semantic Signature: tag + accessibility role + aria semantics
  const tagMatch = trimmed.match(/^<([a-zA-Z0-9_-]+)/);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : 'unknown';

  const roleMatch = trimmed.match(/\brole="([^"]+)"/i);
  const role = roleMatch ? roleMatch[1].toLowerCase() : null;

  const hasAriaLabel = /\baria-label=/i.test(trimmed);
  const hasAriaHidden = /\baria-hidden=/i.test(trimmed);
  const hasAlt = /\balt=/i.test(trimmed);

  const semanticSignature = `${tag}${role ? `[role=${role}]` : ''}${hasAriaLabel ? '[aria-label]' : ''}${hasAlt ? '[alt]' : ''}${hasAriaHidden ? '[aria-hidden]' : ''}`;

  return {
    exactHtmlSignature,
    structureSignature,
    semanticSignature
  };
}
