/**
 * Build ARRM dataset snapshot and WCAG 2.2 mapping.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../public/data/arrm');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const metadata = {
  source: 'W3C ARRM (Accessibility Roles and Responsibilities Mapping)',
  sourceUrl: 'https://www.w3.org/WAI/planning/arrm/',
  snapshotDate: '2026-08-29',
  arrmStatus: 'W3C Community Group Guidance / Resource',
  license: 'W3C Document License / CC-BY-4.0',
  attribution: 'W3C Web Accessibility Initiative (WAI) ARRM Community Group & Open Accessibility Workbench contributors',
  extensionNote: 'WCAG 2.2 extensions added by Open Accessibility Workbench are tagged with source: open-accessibility-workbench-extension'
};

const roles = [
  {
    id: 'content',
    name: 'Content Authoring',
    description: 'Creates text, alt text, headings, captions, link meaning, page language, and media alternatives.',
    canChange: ['Page content and media', 'Content structure']
  },
  {
    id: 'visual-design',
    name: 'Visual Design',
    description: 'Defines color contrast, typography scale, visual layout, focus indicator styling, and iconography.',
    canChange: ['CSS/design tokens', 'Visual design']
  },
  {
    id: 'ux-design',
    name: 'UX / Interaction Design',
    description: 'Designs keyboard workflows, landmark layout, form error flows, focus order, and interactive patterns.',
    canChange: ['UX/interaction design', 'Product/business requirements']
  },
  {
    id: 'frontend-dev',
    name: 'Front-End Development',
    description: 'Implements semantic HTML, ARIA, CSS layout, DOM hierarchy, keyboard event handling, and focus management.',
    canChange: ['HTML/templates/components', 'CSS/design tokens', 'JavaScript/interactions', 'Design systems/components']
  },
  {
    id: 'backend-dev',
    name: 'Back-End Development',
    description: 'Implements server-side templates, CMS field formatters, database-driven markup, and API responses.',
    canChange: ['HTML/templates/components', 'CMS configuration']
  },
  {
    id: 'qa-testing',
    name: 'Automated & Manual Testing',
    description: 'Conducts assistive technology audits, regression testing, automated test suite maintenance, and verification.',
    canChange: ['Automated/manual testing']
  },
  {
    id: 'product-governance',
    name: 'Product & Governance',
    description: 'Prioritizes remediation tasks, allocates engineering capacity, ensures compliance, and manages vendor standards.',
    canChange: ['Product/business requirements', 'Governance/process']
  }
];

const tasks = [
  {
    id: 'TASK-ALT-TEXT',
    wcagSc: '1.1.1',
    name: 'Provide meaningful text alternatives for non-text content',
    primaryRole: 'content',
    secondaryRoles: ['frontend-dev', 'visual-design'],
    contributors: ['qa-testing']
  },
  {
    id: 'TASK-COLOR-CONTRAST',
    wcagSc: '1.4.3',
    name: 'Ensure sufficient contrast between text and background',
    primaryRole: 'visual-design',
    secondaryRoles: ['frontend-dev'],
    contributors: ['qa-testing']
  },
  {
    id: 'TASK-REFLOW',
    wcagSc: '1.4.10',
    name: 'Ensure content reflows without loss of information or 2D scrolling',
    primaryRole: 'frontend-dev',
    secondaryRoles: ['visual-design', 'ux-design'],
    contributors: ['qa-testing']
  },
  {
    id: 'TASK-NON-TEXT-CONTRAST',
    wcagSc: '1.4.11',
    name: 'Ensure UI components and graphical objects meet 3:1 contrast ratio',
    primaryRole: 'visual-design',
    secondaryRoles: ['frontend-dev'],
    contributors: ['qa-testing']
  },
  {
    id: 'TASK-FOCUS-VISIBLE',
    wcagSc: '2.4.7',
    name: 'Ensure interactive elements have a visible focus indicator',
    primaryRole: 'visual-design',
    secondaryRoles: ['frontend-dev'],
    contributors: ['qa-testing']
  },
  {
    id: 'TASK-LINK-NAME',
    wcagSc: '2.4.4',
    name: 'Ensure every link has discernible, meaningful accessible text',
    primaryRole: 'content',
    secondaryRoles: ['frontend-dev'],
    contributors: ['ux-design', 'qa-testing']
  },
  {
    id: 'TASK-HEADINGS-LABELS',
    wcagSc: '2.4.6',
    name: 'Ensure headings and labels describe topic or purpose',
    primaryRole: 'content',
    secondaryRoles: ['ux-design', 'frontend-dev'],
    contributors: ['qa-testing']
  },
  {
    id: 'TASK-TARGET-SIZE-MINIMUM',
    wcagSc: '2.5.8',
    name: 'Ensure interactive pointer targets meet minimum size or spacing (WCAG 2.2)',
    primaryRole: 'visual-design',
    secondaryRoles: ['frontend-dev', 'ux-design'],
    contributors: ['qa-testing'],
    source: 'open-accessibility-workbench-extension'
  },
  {
    id: 'TASK-FOCUS-NOT-OBSCURED',
    wcagSc: '2.4.11',
    name: 'Ensure focused item is not completely obscured by author-created content (WCAG 2.2)',
    primaryRole: 'frontend-dev',
    secondaryRoles: ['visual-design', 'ux-design'],
    contributors: ['qa-testing'],
    source: 'open-accessibility-workbench-extension'
  },
  {
    id: 'TASK-NAME-ROLE-VALUE',
    wcagSc: '4.1.2',
    name: 'Ensure UI controls have accessible names, valid roles, and state tracking',
    primaryRole: 'frontend-dev',
    secondaryRoles: ['ux-design'],
    contributors: ['qa-testing']
  },
  {
    id: 'TASK-LANDMARKS',
    wcagSc: '1.3.1',
    name: 'Provide appropriate semantic landmarks and heading hierarchy',
    primaryRole: 'frontend-dev',
    secondaryRoles: ['ux-design', 'content'],
    contributors: ['qa-testing']
  }
];

const wcagRoleMap = {
  '1.1.1': { primary: 'content', secondary: ['frontend-dev', 'visual-design'], contributors: ['qa-testing'] },
  '1.3.1': { primary: 'frontend-dev', secondary: ['ux-design', 'content'], contributors: ['qa-testing'] },
  '1.4.3': { primary: 'visual-design', secondary: ['frontend-dev'], contributors: ['qa-testing'] },
  '1.4.10': { primary: 'frontend-dev', secondary: ['visual-design', 'ux-design'], contributors: ['qa-testing'] },
  '1.4.11': { primary: 'visual-design', secondary: ['frontend-dev'], contributors: ['qa-testing'] },
  '2.4.4': { primary: 'content', secondary: ['frontend-dev'], contributors: ['ux-design', 'qa-testing'] },
  '2.4.6': { primary: 'content', secondary: ['ux-design', 'frontend-dev'], contributors: ['qa-testing'] },
  '2.4.7': { primary: 'visual-design', secondary: ['frontend-dev'], contributors: ['qa-testing'] },
  '2.4.11': { primary: 'frontend-dev', secondary: ['visual-design', 'ux-design'], contributors: ['qa-testing'], source: 'open-accessibility-workbench-extension' },
  '2.5.8': { primary: 'visual-design', secondary: ['frontend-dev', 'ux-design'], contributors: ['qa-testing'], source: 'open-accessibility-workbench-extension' },
  '3.1.1': { primary: 'content', secondary: ['frontend-dev'], contributors: ['qa-testing'] },
  '3.3.2': { primary: 'content', secondary: ['ux-design', 'frontend-dev'], contributors: ['qa-testing'] },
  '4.1.2': { primary: 'frontend-dev', secondary: ['ux-design'], contributors: ['qa-testing'] }
};

fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
fs.writeFileSync(path.join(outDir, 'roles.json'), JSON.stringify(roles, null, 2));
fs.writeFileSync(path.join(outDir, 'tasks.json'), JSON.stringify(tasks, null, 2));
fs.writeFileSync(path.join(outDir, 'wcag-role-map.json'), JSON.stringify(wcagRoleMap, null, 2));

console.log('ARRM dataset generated successfully in public/data/arrm');
