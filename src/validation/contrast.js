/**
 * Static WCAG 2.2 Color Contrast Validator.
 * Calculates relative luminance and contrast ratio according to WCAG formula:
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * Ratio = (L1 + 0.05) / (L2 + 0.05)
 */

export function parseHexColor(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function calculateRelativeLuminance(rgb) {
  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(val => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function calculateContrastRatio(hex1, hex2) {
  const rgb1 = parseHexColor(hex1);
  const rgb2 = parseHexColor(hex2);
  if (!rgb1 || !rgb2) return null;

  const l1 = calculateRelativeLuminance(rgb1);
  const l2 = calculateRelativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export function validateColorContrast(fgHex, bgHex, isLargeText = false) {
  const ratio = calculateContrastRatio(fgHex, bgHex);
  if (ratio === null) {
    return {
      passed: false,
      ratio: null,
      status: 'Insufficient evidence to validate: Missing explicit color hex values.',
      requiresPageVerification: true
    };
  }

  const requiredThreshold = isLargeText ? 3.0 : 4.5;
  const roundedRatio = Math.round(ratio * 100) / 100;
  const passed = roundedRatio >= requiredThreshold;

  return {
    passed,
    ratio: roundedRatio,
    requiredThreshold,
    status: passed
      ? `Contrast check passed (${roundedRatio}:1 >= ${requiredThreshold}:1)`
      : `Automated check failed: Contrast ratio ${roundedRatio}:1 is below required ${requiredThreshold}:1.`,
    requiresPageVerification: false
  };
}
