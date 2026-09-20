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

// NOTE: Per-rule remediation guidance (problem, objective, placeholder markup,
// human decisions, verification) lives in public/data/rules/rule-guidance.json,
// which is the single source of truth consumed at runtime by
// src/guidance/remediation.js. It is intentionally NOT duplicated here — a
// second copy in this build script previously drifted from the rendered text
// and was never read by the app.

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
fs.writeFileSync(path.join(techDir, 'guidance.json'), JSON.stringify(technologyGuidance, null, 2));

// Emit the curated rule-guidance JSON as an importable JS module so both the
// browser and Node tests consume it without a JSON import attribute.
const ruleGuidanceJson = fs.readFileSync(path.join(rulesDir, 'rule-guidance.json'), 'utf8');
const generated =
  '// GENERATED from public/data/rules/rule-guidance.json — run `npm run build:data`. Do not edit by hand.\n' +
  `export const RULE_GUIDANCE = ${ruleGuidanceJson.trim()};\n`;
fs.writeFileSync(path.resolve(__dirname, '../src/guidance/rule-guidance.generated.js'), generated);

console.log('Rules, technology guidance, and rule-guidance module generated successfully.');
