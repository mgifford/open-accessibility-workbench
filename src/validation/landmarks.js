/**
 * Validates top-level HTML5 landmark structural presence.
 */

export function validateLandmarkStructure(htmlSnippet) {
  if (!htmlSnippet || typeof htmlSnippet !== 'string') {
    return {
      passed: false,
      status: 'Insufficient evidence to validate'
    };
  }

  const hasMain = /<main\b/i.test(htmlSnippet) || /role="main"/i.test(htmlSnippet);
  const hasHeader = /<header\b/i.test(htmlSnippet) || /role="banner"/i.test(htmlSnippet);
  const hasNav = /<nav\b/i.test(htmlSnippet) || /role="navigation"/i.test(htmlSnippet);
  const hasFooter = /<footer\b/i.test(htmlSnippet) || /role="contentinfo"/i.test(htmlSnippet);

  return {
    passed: hasMain || hasHeader || hasNav || hasFooter,
    hasMain,
    hasHeader,
    hasNav,
    hasFooter,
    status: (hasMain || hasHeader || hasNav || hasFooter)
      ? 'Landmark structure detected (Requires page-level verification of landmark exclusivity and hierarchy).'
      : 'Automated check failed: No standard semantic landmark elements detected.'
  };
}
