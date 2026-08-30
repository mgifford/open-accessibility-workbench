/**
 * WCAG 2.5.3 Label in Name validator.
 * Compares visible text against accessible name (e.g. aria-label).
 */

export function validateLabelInName(visibleText, accessibleName) {
  if (!visibleText || !accessibleName) {
    return {
      passed: false,
      status: 'Insufficient evidence to validate: Missing visible text or accessible name.'
    };
  }

  const cleanVisible = visibleText.trim().toLowerCase();
  const cleanName = accessibleName.trim().toLowerCase();

  const passed = cleanName.includes(cleanVisible);

  return {
    passed,
    status: passed
      ? 'Label in Name check passed (Accessible name contains visible text)'
      : `Automated check failed: Accessible name ("${accessibleName}") does not contain visible label ("${visibleText}").`
  };
}
