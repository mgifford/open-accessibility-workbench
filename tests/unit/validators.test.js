import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateStructuralGuardrails } from '../../src/validation/structural.js';
import { validateColorContrast, calculateContrastRatio } from '../../src/validation/contrast.js';
import { validateAccessibleNamePresence } from '../../src/validation/accessible-name.js';
import { validateImageAltPresence } from '../../src/validation/image-alt.js';
import { validateLanguageTag } from '../../src/validation/language.js';
import { validateLandmarkStructure } from '../../src/validation/landmarks.js';
import { validateTargetSize } from '../../src/validation/target-size.js';
import { runValidationSuite } from '../../src/validation/registry.js';

describe('Deterministic Validators & Guardrails', () => {
  test('structural guardrail rejects script injection and unclosed fences', () => {
    const malicious = '<a href="#">Link <script>alert(1)</script></a>';
    const res = validateStructuralGuardrails(malicious);
    assert.equal(res.passed, false);
    assert.ok(res.errors[0].includes('<script>'));

    const fences = '```html\n<a href="#">Link</a>\n```';
    const fenceRes = validateStructuralGuardrails(fences);
    assert.equal(fenceRes.passed, false);
    assert.ok(fenceRes.errors[0].includes('fences'));
  });

  test('color contrast validator accurately calculates contrast ratios', () => {
    // Black (#000000) on White (#ffffff) = 21:1
    const ratio = calculateContrastRatio('#000000', '#ffffff');
    assert.equal(Math.round(ratio), 21);

    // Drupal orange (#f26321) on White (#ffffff) = ~3.19:1
    const orangeRes = validateColorContrast('#f26321', '#ffffff', false);
    assert.equal(orangeRes.passed, false);
    assert.ok(orangeRes.ratio < 4.5);

    // Dark orange (#b91c1c) on White = > 4.5:1
    const darkOrangeRes = validateColorContrast('#b91c1c', '#ffffff', false);
    assert.equal(darkOrangeRes.passed, true);
  });

  test('accessible name validator detects aria-label, title, and text content', () => {
    const withAria = '<a href="#" aria-label="Visit LinkedIn"><span class="icon"></span></a>';
    const res1 = validateAccessibleNamePresence(withAria);
    assert.equal(res1.passed, true);
    assert.equal(res1.mechanism, 'aria-label');

    const emptyIcon = '<a href="#"><span class="icon"></span></a>';
    const res2 = validateAccessibleNamePresence(emptyIcon);
    assert.equal(res2.passed, false);
  });

  test('image alt validator distinguishes decorative vs informative', () => {
    const decorative = '<img src="divider.png" alt="" />';
    const res1 = validateImageAltPresence(decorative);
    assert.equal(res1.passed, true);
    assert.equal(res1.type, 'decorative');

    const informative = '<img src="speaker.jpg" alt="Keynote speaker presenting" />';
    const res2 = validateImageAltPresence(informative);
    assert.equal(res2.passed, true);
    assert.equal(res2.type, 'informative');

    const missing = '<img src="speaker.jpg" />';
    const res3 = validateImageAltPresence(missing);
    assert.equal(res3.passed, false);
  });

  test('language tag validator checks valid BCP 47 formats', () => {
    assert.equal(validateLanguageTag('en').passed, true);
    assert.equal(validateLanguageTag('fr-CA').passed, true);
    assert.equal(validateLanguageTag('zh-Hans').passed, true);
    assert.equal(validateLanguageTag('12345').passed, false);
  });

  test('target size validator checks WCAG 2.2 criteria', () => {
    assert.equal(validateTargetSize(44, 44, true).passed, true);
    assert.equal(validateTargetSize(24, 24, false).passed, true);
    assert.equal(validateTargetSize(16, 16, false).passed, false);
  });
});
