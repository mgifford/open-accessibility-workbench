import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { groupByRule, isIsolated } from '../../src/analysis/pattern-grouping.js';

const cluster = (ruleId, pages, occ, extra = {}) => ({
  ruleId, sourceRuleId: ruleId, pagesCount: pages, occurrencesCount: occ,
  observations: [], wcag: [], ...extra
});

describe('Pattern grouping (presentation only)', () => {
  test('isIsolated flags one-page, one-occurrence patterns', () => {
    assert.equal(isIsolated(cluster('r', 1, 1)), true);
    assert.equal(isIsolated(cluster('r', 2, 2)), false);
    assert.equal(isIsolated(cluster('r', 1, 5)), false);
  });

  test('groups clusters by rule and keeps every cluster', () => {
    const clusters = [
      cluster('style_focus_visible', 20, 20),
      cluster('style_focus_visible', 1, 1),
      cluster('region', 20, 200)
    ];
    const groups = groupByRule(clusters);
    assert.equal(groups.length, 2);
    const total = groups.reduce((n, g) => n + g.count, 0);
    assert.equal(total, 3, 'no cluster dropped');
  });

  test('separates recurring patterns from isolated one-offs within a group', () => {
    const clusters = [
      cluster('style_focus_visible', 20, 20),
      cluster('style_focus_visible', 1, 1),
      cluster('style_focus_visible', 1, 1)
    ];
    const g = groupByRule(clusters)[0];
    assert.equal(g.recurring.length, 1);
    assert.equal(g.isolated.length, 2);
  });

  test('groups with recurring patterns are ordered before all-isolated groups', () => {
    const clusters = [
      cluster('all_isolated', 1, 1),
      cluster('has_recurring', 20, 20)
    ];
    const groups = groupByRule(clusters);
    assert.equal(groups[0].key, 'has_recurring');
    assert.equal(groups[1].key, 'all_isolated');
  });

  test('the group display carries the resolved rule info (title/wcag when verified)', () => {
    const clusters = [cluster('https://alfa.siteimprove.com/rules/sia-r66', 20, 20)];
    const g = groupByRule(clusters)[0];
    assert.match(g.display.title, /enhanced contrast/i);
    assert.deepEqual(g.display.wcag, ['1.4.6']);
  });
});
