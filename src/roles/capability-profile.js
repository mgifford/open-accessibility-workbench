/**
 * User capability profile options and preference storage.
 */

export const CAPABILITY_OPTIONS = [
  'Page content and media',
  'HTML/templates/components',
  'CSS/design tokens',
  'JavaScript/interactions',
  'CMS configuration',
  'Design systems/components',
  'Visual design',
  'UX/interaction design',
  'Automated/manual testing',
  'Product/business requirements',
  'Governance/process',
  'I can review but not change the site'
];

const STORAGE_KEY = 'oaw_capability_profile';

const EMPTY_PROFILE = { selectedCapabilities: [], customNotes: '' };

/**
 * Validates and normalizes a stored profile object. Any malformed shape resets
 * to an empty profile rather than propagating bad data (which could crash the UI
 * on `.includes`). Only known capabilities are kept.
 */
export function normalizeProfile(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...EMPTY_PROFILE };
  const caps = Array.isArray(parsed.selectedCapabilities) ? parsed.selectedCapabilities : [];
  const selectedCapabilities = caps.filter(c => CAPABILITY_OPTIONS.includes(c));
  const customNotes = typeof parsed.customNotes === 'string' ? parsed.customNotes : '';
  return { selectedCapabilities, customNotes };
}

export function getSavedProfile() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeProfile(JSON.parse(raw));
    }
  } catch (e) {
    // localStorage unavailable or corrupt: fall through to empty profile.
  }
  return { ...EMPTY_PROFILE };
}

export function saveProfile(profile) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }
  } catch (e) {
    // localStorage unavailable
  }
}
