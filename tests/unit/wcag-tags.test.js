import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseWcagTags, wcagLevelFromTags, wcagTagToCriterion } from '../../src/utils/wcag-tags.js';

describe('WCAG tag parsing', () => {
  test('converts compact axe tokens to dotted success criteria', () => {
    assert.equal(wcagTagToCriterion('wcag412'), '4.1.2');
    assert.equal(wcagTagToCriterion('wcag143'), '1.4.3');
    assert.equal(wcagTagToCriterion('wcag143aa'), '1.4.3');
    assert.equal(wcagTagToCriterion('wcag1410aa'), '1.4.10'); // two-digit criterion
    assert.equal(wcagTagToCriterion('wcag111a'), '1.1.1');
  });

  test('treats bare level markers as carrying no success criterion', () => {
    assert.equal(wcagTagToCriterion('wcag2a'), null);
    assert.equal(wcagTagToCriterion('wcag2aa'), null);
    assert.equal(wcagTagToCriterion('wcag2aaa'), null);
  });

  test('accepts already-dotted criteria and ignores junk', () => {
    assert.equal(wcagTagToCriterion('2.4.4'), '2.4.4');
    assert.equal(wcagTagToCriterion('best-practice'), null);
    assert.equal(wcagTagToCriterion(''), null);
    assert.equal(wcagTagToCriterion(undefined), null);
  });

  test('parses arrays and comma-joined strings, de-duplicating', () => {
    // Open Scans array form
    assert.deepEqual(parseWcagTags(['wcag2aa', 'wcag143']), ['1.4.3']);
    // Oobee comma-joined form
    assert.deepEqual(parseWcagTags('wcag2a,wcag244,wcag412'), ['2.4.4', '4.1.2']);
    // dotted, with duplicates
    assert.deepEqual(parseWcagTags('2.4.4, 4.1.2, 2.4.4'), ['2.4.4', '4.1.2']);
    // empty / non-string inputs
    assert.deepEqual(parseWcagTags([]), []);
    assert.deepEqual(parseWcagTags(null), []);
  });

  test('never emits malformed criteria such as "2aa"', () => {
    // Regression guard for the previous Open Scans parser bug.
    for (const sc of parseWcagTags(['wcag2aa', 'wcag143', 'wcag2a'])) {
      assert.match(sc, /^\d+\.\d+(\.\d+)?$/);
    }
  });

  test('derives coarse WCAG level from explicit suffixes', () => {
    assert.equal(wcagLevelFromTags(['wcag2aaa', 'wcag146']), 'AAA');
    assert.equal(wcagLevelFromTags(['wcag2aa', 'wcag143']), 'AA');
    assert.equal(wcagLevelFromTags(['wcag2a', 'wcag244']), 'A');
    assert.equal(wcagLevelFromTags([]), 'A');
  });
});
