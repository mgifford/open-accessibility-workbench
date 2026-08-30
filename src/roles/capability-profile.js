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

export function getSavedProfile() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    // localStorage unavailable
  }
  return {
    selectedCapabilities: [],
    customNotes: ''
  };
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
