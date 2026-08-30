/**
 * Image Alternative Text structural presence validator.
 */

export function validateImageAltPresence(htmlSnippet) {
  if (!htmlSnippet || typeof htmlSnippet !== 'string') {
    return {
      passed: false,
      status: 'Insufficient evidence to validate'
    };
  }

  const isImg = /<img\b/i.test(htmlSnippet);
  if (!isImg) {
    return {
      passed: true,
      status: 'Not an <img> element'
    };
  }

  const altMatch = htmlSnippet.match(/\balt="([^"]*)"/i);
  if (altMatch) {
    const altValue = altMatch[1];
    if (altValue === '') {
      return {
        passed: true,
        type: 'decorative',
        status: 'Alternative mechanism present: Empty alt="" indicates decorative image (Requires confirmation of decorative intent).'
      };
    } else {
      return {
        passed: true,
        type: 'informative',
        alt: altValue,
        status: 'Alternative mechanism present: Informative alt text detected.'
      };
    }
  }

  // Check aria-hidden
  if (/aria-hidden="true"/i.test(htmlSnippet)) {
    return {
      passed: true,
      type: 'hidden',
      status: 'Alternative mechanism present: aria-hidden="true" applied.'
    };
  }

  return {
    passed: false,
    status: 'Automated check failed: <img> tag is missing required alt attribute.'
  };
}
