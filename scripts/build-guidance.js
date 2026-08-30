/**
 * Build normalized rules and deterministic remediation guidance datasets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesDir = path.resolve(__dirname, '../public/data/rules');
const techDir = path.resolve(__dirname, '../public/data/technology');

for (const dir of [rulesDir, techDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const normalizedRules = {
  'color-contrast': {
    normalizedRuleId: 'color-contrast',
    aliases: ['color-contrast', 'QW-ACT-R37', 'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail'],
    title: 'Text elements must meet minimum color contrast ratio thresholds',
    wcag: ['1.4.3'],
    wcagLevel: 'AA',
    defaultImpact: 'serious',
    summary: 'Ensure text has sufficient contrast against its background (at least 4.5:1 for normal text, 3:1 for large text).',
    nativeSemanticsFirst: true
  },
  'link-name': {
    normalizedRuleId: 'link-name',
    aliases: ['link-name', 'QW-ACT-R11', 'WCAG2AA.Principle2.Guideline2_4.2_4_4.H30.2'],
    title: 'Links must have discernible, accessible text',
    wcag: ['2.4.4', '4.1.2'],
    wcagLevel: 'A',
    defaultImpact: 'serious',
    summary: 'Every link must have an accessible name that clearly communicates the destination or purpose of the link.',
    nativeSemanticsFirst: true
  },
  'image-alt': {
    normalizedRuleId: 'image-alt',
    aliases: ['image-alt', 'QW-ACT-R38', 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37'],
    title: 'Images must have text alternatives',
    wcag: ['1.1.1'],
    wcagLevel: 'A',
    defaultImpact: 'critical',
    summary: 'Informative images need descriptive alt attributes. Decorative images should have empty alt="" attributes.',
    nativeSemanticsFirst: true
  },
  'button-name': {
    normalizedRuleId: 'button-name',
    aliases: ['button-name', 'QW-ACT-R12'],
    title: 'Buttons must have discernible text',
    wcag: ['4.1.2'],
    wcagLevel: 'A',
    defaultImpact: 'critical',
    summary: 'Buttons must have clear accessible names describing the triggered action.',
    nativeSemanticsFirst: true
  },
  'region': {
    normalizedRuleId: 'region',
    aliases: ['region', 'landmark-one-main', 'QW-ACT-R76'],
    title: 'All page content must be contained by landmarks',
    wcag: ['1.3.1', '2.4.1'],
    wcagLevel: 'A',
    defaultImpact: 'moderate',
    summary: 'Wrap top-level page sections in HTML5 landmark elements (<header>, <nav>, <main>, <footer>, <aside>).',
    nativeSemanticsFirst: true
  },
  'heading-order': {
    normalizedRuleId: 'heading-order',
    aliases: ['heading-order', 'empty-heading'],
    title: 'Heading levels should only increase by one',
    wcag: ['1.3.1'],
    wcagLevel: 'A',
    defaultImpact: 'moderate',
    summary: 'Heading tags (<h1> to <h6>) must reflect the true structural hierarchy of the document without skipping levels.',
    nativeSemanticsFirst: true
  },
  'html-has-lang': {
    normalizedRuleId: 'html-has-lang',
    aliases: ['html-has-lang', 'html-lang-valid'],
    title: '<html> element must have a valid lang attribute',
    wcag: ['3.1.1'],
    wcagLevel: 'A',
    defaultImpact: 'serious',
    summary: 'Add a valid BCP 47 language code to the root <html> tag (e.g. <html lang="en">).',
    nativeSemanticsFirst: true
  },
  'target-size': {
    normalizedRuleId: 'target-size',
    aliases: ['target-size', 'target-size-minimum'],
    title: 'Pointer targets must meet minimum size requirements',
    wcag: ['2.5.8'],
    wcagLevel: 'AA',
    defaultImpact: 'serious',
    summary: 'Ensure touch and click targets are at least 24x24 CSS pixels or have sufficient spacing offset.',
    nativeSemanticsFirst: true
  }
};

const remediationPatterns = {
  'link-name': {
    problem: 'Links lacking discernible text prevent screen reader users from understanding where the link navigates.',
    whySystemic: 'Often occurs in shared navigation bars, footer social icon links, or card link components across multiple pages.',
    likelyRootCause: 'Icon font or SVG icon rendered inside an <a> tag without accompanying text or accessible label.',
    humanDecisionsRequired: [
      'Confirm the intended destination or label for each icon link (e.g., "Visit our LinkedIn page").',
      'Decide whether the link text should be visually hidden (.sr-only) or provided via aria-label.'
    ],
    implementation: [
      'Prefer visible link text or visually hidden text (<span class="sr-only">LinkedIn</span>) over ARIA attributes.',
      'If an icon-only link is strictly required by design, add aria-label="Descriptive destination" directly on the <a> element.',
      'Do not add ARIA roles to native <a> elements with valid href.'
    ],
    verificationSteps: [
      'Inspect the computed accessible name in the browser Accessibility Tree inspector.',
      'Navigate to the link using keyboard Tab and verify focus visibility and screen reader readout.',
      'Re-run automated axe / Open Scans rule to confirm the violation is resolved.'
    ]
  },
  'color-contrast': {
    problem: 'Low contrast between foreground text and background colors makes text difficult or impossible to read for users with low vision or in high ambient light.',
    whySystemic: 'Usually caused by shared brand color tokens (e.g. orange on white, light grey footer text) defined in global CSS or design system variables.',
    likelyRootCause: 'Theme design token value has insufficient luminance contrast ratio (< 4.5:1).',
    humanDecisionsRequired: [
      'Consult with Visual Design to adjust the foreground or background color palette token to achieve at least 4.5:1 ratio.',
      'Confirm if font weight can be increased to bold 14pt+ or regular 18pt+ if 3:1 ratio is targeted.'
    ],
    implementation: [
      'Adjust CSS custom property / design token value in the global theme stylesheet rather than adding inline styles.',
      'Ensure hover, focus, and active interactive states also maintain sufficient contrast.'
    ],
    verificationSteps: [
      'Use the browser DevTools color picker to verify contrast ratio >= 4.5:1.',
      'Test in forced-colors / high-contrast operating system mode.',
      'Re-run automated contrast check.'
    ]
  },
  'image-alt': {
    problem: 'Images missing text alternatives fail to convey their information or purpose to non-sighted users.',
    whySystemic: 'CMS template or authoring field does not require an alt attribute when rendering media.',
    likelyRootCause: 'Template renders <img> without alt attribute, or CMS editor omitted alt text during content entry.',
    humanDecisionsRequired: [
      'Determine if the image is informative or decorative.',
      'If informative, write concise alternative text conveying the essential visual information.',
      'If decorative, confirm it should receive alt="" and aria-hidden="true".'
    ],
    implementation: [
      'For informative images, add descriptive alt attribute: <img src="..." alt="Description">.',
      'For decorative images, provide an explicit empty alt attribute: <img src="..." alt="">.',
      'Never omit the alt attribute entirely on HTML <img> tags.'
    ],
    verificationSteps: [
      'Check HTML markup for presence of alt attribute.',
      'Inspect screen reader announcement.',
      'Re-run automated scanner check.'
    ]
  },
  'region': {
    problem: 'Content outside landmark regions is difficult for screen reader users to navigate efficiently.',
    whySystemic: 'Base page layout template lacks HTML5 semantic container tags (<header>, <main>, <footer>, <nav>).',
    likelyRootCause: 'Generic <div> tags used for major layout wrappers instead of semantic elements.',
    humanDecisionsRequired: [
      'Confirm the primary content boundary to be designated as <main>.',
      'Identify global vs. section navigation menus.'
    ],
    implementation: [
      'Wrap main content in a single <main> element.',
      'Wrap header in <header> and footer in <footer>.',
      'Ensure each <nav> landmark has a unique accessible name (e.g. aria-label="Primary").'
    ],
    verificationSteps: [
      'Verify landmark navigation using screen reader landmark shortcuts (e.g. "D" key in NVDA/JAWS).',
      'Confirm exactly one <main> landmark exists per document.'
    ]
  }
};

const technologyGuidance = {
  'drupal': {
    name: 'Drupal',
    category: 'CMS',
    templateLanguage: 'Twig',
    remediationContext: 'In Drupal, markup is typically rendered via Twig template files (*.html.twig) in custom themes or modules, or through CMS View display modes and Block configurations.',
    examples: {
      'link-name': '{# In links.html.twig #}\n<a href="{{ item.url }}" class="social-link" aria-label="{{ item.title }}">\n  <span class="icon-{{ item.icon }}" aria-hidden="true"></span>\n</a>',
      'image-alt': '{# In media--image.html.twig #}\n<img src="{{ media_url }}" alt="{{ content.field_media_image.0[\'#item\'].alt }}" />'
    }
  },
  'wordpress': {
    name: 'WordPress',
    category: 'CMS',
    templateLanguage: 'PHP',
    remediationContext: 'In WordPress, components are defined in theme PHP templates, block patterns, or theme.json design tokens.',
    examples: {
      'link-name': '<?php // In template-parts/social-nav.php ?>\n<a href="<?php echo esc_url($link); ?>" class="social-icon" aria-label="<?php echo esc_attr($label); ?>">\n  <span class="dashicons dashicons-twitter" aria-hidden="true"></span>\n</a>'
    }
  },
  'react': {
    name: 'React',
    category: 'Frontend Framework',
    templateLanguage: 'JSX',
    remediationContext: 'In React, components are implemented as JSX functions with props and design system component libraries.',
    examples: {
      'link-name': 'export function SocialLink({ href, label, icon: Icon }) {\n  return (\n    <a href={href} aria-label={label} className="social-link">\n      <Icon aria-hidden="true" />\n    </a>\n  );\n}'
    }
  },
  'html': {
    name: 'Native HTML / CSS',
    category: 'Standards',
    templateLanguage: 'HTML',
    remediationContext: 'Standard semantic HTML5 markup and modern CSS custom properties.',
    examples: {
      'link-name': '<a href="https://example.com" class="social-link" aria-label="Organization Profile on LinkedIn">\n  <span class="fab fa-linkedin" aria-hidden="true"></span>\n</a>'
    }
  }
};

fs.writeFileSync(path.join(rulesDir, 'normalized-rules.json'), JSON.stringify(normalizedRules, null, 2));
fs.writeFileSync(path.join(rulesDir, 'remediation-patterns.json'), JSON.stringify(remediationPatterns, null, 2));
fs.writeFileSync(path.join(techDir, 'guidance.json'), JSON.stringify(technologyGuidance, null, 2));

console.log('Rules, remediation patterns, and technology guidance generated successfully.');
