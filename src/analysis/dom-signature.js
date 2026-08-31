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

  // 2. Structure Signature: tag hierarchy and attributes with volatile values
  // removed, then CANONICALIZED so equivalent markup that differs only in quote
  // style, attribute order, or class-token order yields one signature.
  let struct = trimmed.replace(/'/g, '"'); // normalize quote style
  // Replace dynamic IDs, hashes, timestamps
  struct = struct.replace(/\bid="[a-zA-Z0-9_-]*\d+[a-zA-Z0-9_-]*"/gi, 'id="*"');
  struct = struct.replace(/\bdata-history-node-id="\d+"/gi, 'data-history-node-id="*"');
  struct = struct.replace(/\bdata-drupal-selector="[^\"]*"/gi, 'data-drupal-selector="*"');
  struct = struct.replace(/\bhref="[^\"]*"/gi, 'href="*"');
  struct = struct.replace(/\bsrc="[^\"]*"/gi, 'src="*"');
  struct = struct.replace(/>\s*([^<]+)\s*</g, '>*<'); // inner text -> wildcard
  struct = canonicalizeTags(struct);
  const structureSignature = struct.replace(/\s+/g, ' ').trim();

  // 3. Semantic Signature: tag + accessibility role + aria semantics
  const tagMatch = trimmed.match(/^<([a-zA-Z0-9_-]+)/);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : 'unknown';

  const roleMatch = trimmed.match(/\brole="([^"]+)"/i);
  const role = roleMatch ? roleMatch[1].toLowerCase() : null;

  const hasAriaLabel = /\baria-label=/i.test(trimmed);
  const hasAriaHidden = /\baria-hidden=/i.test(trimmed);
  const hasAlt = /\balt=/i.test(trimmed);

  const semanticSignature = `${tag}${role ? `[role=${role}]` : ''}${hasAriaLabel ? '[aria-label]' : ''}${hasAlt ? '[alt]' : ''}${hasAriaHidden ? '[aria-hidden]' : ''}`;

  // 4. Family Signature: the structure signature with volatile *per-instance*
  // suffixes of BEM-style / icon-font class names abstracted away, so members of
  // one reusable component (e.g. every `social-media-link-icon--<network>` and
  // its `fa-<network>` icon) collapse to a single family key. This is what turns
  // "5 social icons across N pages" into one shared-component candidate. The
  // abstraction is conservative — it only collapses the trailing modifier of a
  // `base--modifier` class and the trailing token of an icon-font `fa-<x>`
  // class, both of which vary per instance without changing the a11y defect.
  const familySignature = structureSignature
    .replace(/([a-z0-9]+(?:-[a-z0-9]+)*)--[a-z0-9_]+/gi, '$1--*')
    .replace(/\bfa-[a-z0-9_]+/gi, 'fa-*');

  return {
    exactHtmlSignature,
    structureSignature,
    familySignature,
    semanticSignature
  };
}

/**
 * Canonicalizes each opening tag in a structure string so equivalent markup
 * that differs only in attribute order or class-token order produces one
 * signature: within every `<tag ...>`, class tokens are sorted and attributes
 * are sorted by name. Values (already wildcarded above) are preserved. Text and
 * closing tags are untouched.
 */
function canonicalizeTags(html) {
  return html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g, (match, tag, attrs, selfClose) => {
    if (!attrs || !attrs.trim()) return `<${tag.toLowerCase()}${selfClose ? '/' : ''}>`;

    // Split attributes: name="value" | name='value' | name=value | name
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'>]+)?/g;
    const parsed = [];
    let m;
    while ((m = attrRe.exec(attrs)) !== null) {
      const name = m[1].toLowerCase();
      let val = m[2] || '';
      if (name === 'class') {
        // Sort class tokens.
        const cm = val.match(/"([^"]*)"|'([^']*)'/);
        if (cm) {
          const tokens = (cm[1] ?? cm[2]).split(/\s+/).filter(Boolean).sort();
          val = `="${tokens.join(' ')}"`;
        }
      } else {
        val = val.replace(/\s*=\s*/, '=');
      }
      parsed.push({ name, text: `${name}${val}` });
    }
    parsed.sort((a, b) => a.name.localeCompare(b.name));
    const rebuilt = parsed.map(p => p.text).join(' ');
    return `<${tag.toLowerCase()} ${rebuilt}${selfClose ? '/' : ''}>`;
  });
}
