/**
 * ARRM (Accessibility Roles and Responsibilities Mapping) module.
 */

export const ARRM_ROLES = {
  CONTENT: { id: 'content', name: 'Content Authoring', key: 'content' },
  VISUAL_DESIGN: { id: 'visual-design', name: 'Visual Design', key: 'visual-design' },
  UX_DESIGN: { id: 'ux-design', name: 'UX / Interaction Design', key: 'ux-design' },
  FRONTEND_DEV: { id: 'frontend-dev', name: 'Front-End Development', key: 'frontend-dev' },
  BACKEND_DEV: { id: 'backend-dev', name: 'Back-End Development', key: 'backend-dev' },
  QA_TESTING: { id: 'qa-testing', name: 'Automated & Manual Testing', key: 'qa-testing' },
  PRODUCT: { id: 'product-governance', name: 'Product & Governance', key: 'product-governance' }
};

const WCAG_ROLE_TABLE = {
  '1.1.1': { primary: 'Content Authoring', secondary: ['Front-End Development', 'Visual Design'], contributors: ['Automated & Manual Testing'] },
  '1.3.1': { primary: 'Front-End Development', secondary: ['UX / Interaction Design', 'Content Authoring'], contributors: ['Automated & Manual Testing'] },
  '1.4.3': { primary: 'Visual Design', secondary: ['Front-End Development'], contributors: ['Automated & Manual Testing'] },
  '1.4.10': { primary: 'Front-End Development', secondary: ['Visual Design', 'UX / Interaction Design'], contributors: ['Automated & Manual Testing'] },
  '1.4.11': { primary: 'Visual Design', secondary: ['Front-End Development'], contributors: ['Automated & Manual Testing'] },
  '2.4.4': { primary: 'Content Authoring', secondary: ['Front-End Development'], contributors: ['UX / Interaction Design', 'Automated & Manual Testing'] },
  '2.4.6': { primary: 'Content Authoring', secondary: ['UX / Interaction Design', 'Front-End Development'], contributors: ['Automated & Manual Testing'] },
  '2.4.7': { primary: 'Visual Design', secondary: ['Front-End Development'], contributors: ['Automated & Manual Testing'] },
  '2.4.11': { primary: 'Front-End Development', secondary: ['Visual Design'], contributors: ['Automated & Manual Testing'], source: 'Workbench WCAG 2.2 Extension' },
  '2.5.8': { primary: 'Visual Design', secondary: ['Front-End Development', 'UX / Interaction Design'], contributors: ['Automated & Manual Testing'], source: 'Workbench WCAG 2.2 Extension' },
  '3.1.1': { primary: 'Content Authoring', secondary: ['Front-End Development'], contributors: ['Automated & Manual Testing'] },
  '3.3.2': { primary: 'Content Authoring', secondary: ['UX / Interaction Design', 'Front-End Development'], contributors: ['Automated & Manual Testing'] },
  '4.1.2': { primary: 'Front-End Development', secondary: ['UX / Interaction Design'], contributors: ['Automated & Manual Testing'] }
};

export function getRolesForWcag(wcagCriteriaList = [], ruleId = '') {
  let matched = null;

  for (const sc of wcagCriteriaList) {
    if (WCAG_ROLE_TABLE[sc]) {
      matched = WCAG_ROLE_TABLE[sc];
      break;
    }
  }

  if (!matched) {
    if (ruleId.includes('contrast')) {
      matched = WCAG_ROLE_TABLE['1.4.3'];
    } else if (ruleId.includes('alt') || ruleId.includes('link-name')) {
      matched = WCAG_ROLE_TABLE['2.4.4'];
    } else {
      matched = {
        primary: 'Front-End Development',
        secondary: ['UX / Interaction Design'],
        contributors: ['Automated & Manual Testing']
      };
    }
  }

  return {
    primary: matched.primary,
    secondary: matched.secondary || [],
    contributors: matched.contributors || ['Automated & Manual Testing'],
    source: matched.source || 'W3C ARRM'
  };
}
