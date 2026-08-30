/**
 * WCAG 2.2 Target Size validator (2.5.8 Minimum: 24x24 CSS pixels, Enhanced: 44x44 CSS pixels).
 * Only validates when geometry / explicit pixel dimensions are provided.
 */

export function validateTargetSize(widthPx, heightPx, enhancedTarget = false) {
  if (widthPx === undefined || heightPx === undefined || widthPx === null || heightPx === null) {
    return {
      passed: false,
      status: 'Insufficient evidence to validate: Target geometry information not present in static report snippet.',
      requiresPageVerification: true
    };
  }

  const threshold = enhancedTarget ? 44 : 24;
  const passed = widthPx >= threshold && heightPx >= threshold;

  return {
    passed,
    width: widthPx,
    height: heightPx,
    threshold,
    status: passed
      ? `Target size check passed (${widthPx}x${heightPx}px >= ${threshold}x${threshold}px)`
      : `Automated check failed: Pointer target (${widthPx}x${heightPx}px) is smaller than ${threshold}x${threshold}px threshold.`,
    requiresPageVerification: false
  };
}
