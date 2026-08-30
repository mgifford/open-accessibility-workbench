/**
 * WCAG 3.1.1 Language of Page validator.
 * Validates BCP 47 language tag format.
 */

export function validateLanguageTag(langString) {
  if (!langString || typeof langString !== 'string') {
    return {
      passed: false,
      status: 'Automated check failed: Missing lang attribute.'
    };
  }

  const clean = langString.trim();
  // Validates common BCP 47 formats e.g. en, en-US, fr-CA, zh-Hans
  const bcp47Regex = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

  const passed = bcp47Regex.test(clean);

  return {
    passed,
    status: passed
      ? `Language check passed: Valid BCP 47 language tag '${clean}'.`
      : `Automated check failed: '${clean}' is not a valid BCP 47 language tag.`
  };
}
