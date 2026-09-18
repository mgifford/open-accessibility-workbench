import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WCAG22_SC, understandingUrl, criterionTitle } from '../../src/export/wcag-sc.js';

describe('WCAG 2.2 success-criterion table', () => {
  test('known criteria resolve to verified Understanding URLs', () => {
    assert.equal(
      understandingUrl('1.4.3'),
      'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html'
    );
    assert.equal(understandingUrl('4.1.2'), 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html');
    assert.equal(criterionTitle('2.4.4'), 'Link Purpose (In Context)');
  });

  test('unknown criteria return null rather than a fabricated URL', () => {
    assert.equal(understandingUrl('9.9.9'), null);
    assert.equal(criterionTitle('9.9.9'), null);
    // 4.1.1 Parsing was removed in WCAG 2.2 and must not resolve.
    assert.equal(understandingUrl('4.1.1'), null);
  });

  test('every slug is lower-case with no spaces or punctuation', () => {
    for (const [sc, { slug }] of Object.entries(WCAG22_SC)) {
      assert.match(slug, /^[a-z0-9-]+$/, `${sc} slug "${slug}" has unexpected characters`);
    }
  });
});
