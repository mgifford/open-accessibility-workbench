/**
 * Static Accessible Name mechanism detector.
 */

export function validateAccessibleNamePresence(htmlSnippet) {
  if (!htmlSnippet || typeof htmlSnippet !== 'string') {
    return {
      passed: false,
      mechanism: null,
      status: 'Insufficient evidence to validate'
    };
  }

  const trimmed = htmlSnippet.trim();

  // Check aria-label
  const ariaLabelMatch = trimmed.match(/\baria-label="([^"]*)"/i);
  if (ariaLabelMatch && ariaLabelMatch[1].trim().length > 0) {
    return {
      passed: true,
      mechanism: 'aria-label',
      name: ariaLabelMatch[1].trim(),
      status: 'Accessible-name mechanism detected (aria-label)'
    };
  }

  // Check aria-labelledby
  const ariaLabelledbyMatch = trimmed.match(/\baria-labelledby="([^"]+)"/i);
  if (ariaLabelledbyMatch) {
    return {
      passed: true,
      mechanism: 'aria-labelledby',
      status: 'Accessible-name mechanism detected (aria-labelledby) - Requires page verification of target ID'
    };
  }

  // Check title
  const titleMatch = trimmed.match(/\btitle="([^"]*)"/i);
  if (titleMatch && titleMatch[1].trim().length > 0) {
    return {
      passed: true,
      mechanism: 'title',
      name: titleMatch[1].trim(),
      status: 'Accessible-name mechanism detected (title attribute)'
    };
  }

  // Check text content inside tags
  const innerTextMatch = trimmed.match(/>([^<]+)</);
  if (innerTextMatch && innerTextMatch[1].trim().length > 0) {
    return {
      passed: true,
      mechanism: 'text-content',
      name: innerTextMatch[1].trim(),
      status: 'Accessible-name mechanism detected (visible text content)'
    };
  }

  return {
    passed: false,
    mechanism: null,
    status: 'Automated check failed: No accessible name mechanism detected (missing visible text, aria-label, or title).'
  };
}
