import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { describeRule, resolveRuleDisplay, RULE_DESCRIPTIONS } from '../../src/rules/rule-descriptions.js';

describe('Rule descriptions map', () => {
  test('verified Alfa and ACT rules resolve to a title and WCAG SC', () => {
    assert.deepEqual(describeRule('https://alfa.siteimprove.com/rules/sia-r66').wcag, ['1.4.6']);
    assert.match(describeRule('https://alfa.siteimprove.com/rules/sia-r66').title, /enhanced contrast/i);
    assert.deepEqual(describeRule('qw-act-r30').wcag, ['2.5.3']);
    assert.deepEqual(describeRule('qw-act-r65').wcag, ['4.1.2']);
  });

  test('best-practice rules honestly carry no WCAG SC', () => {
    assert.deepEqual(describeRule('https://alfa.siteimprove.com/rules/sia-r61').wcag, []);
  });

  test('unknown rule ids return null (no fabrication)', () => {
    assert.equal(describeRule('some-made-up-rule'), null);
    assert.equal(describeRule(''), null);
  });

  test('every mapped entry cites a source and a title', () => {
    for (const [id, entry] of Object.entries(RULE_DESCRIPTIONS)) {
      assert.ok(entry.title, `${id} needs a title`);
      assert.ok(/^https?:\/\//.test(entry.source), `${id} needs a real source URL`);
      assert.ok(Array.isArray(entry.wcag), `${id} wcag must be an array`);
      for (const sc of entry.wcag) assert.match(sc, /^\d+\.\d+\.\d+$/, `${id} SC ${sc} must be dotted`);
    }
  });
});

describe('resolveRuleDisplay', () => {
  const taskLike = (ruleId, sourceRuleId, wcag, description, helpUrl) => ({
    ruleId, sourceRuleId, wcag,
    observations: [{ evidence: { description, helpUrl } }]
  });

  test('mapped rule: verified title + SC, plus the finding description', () => {
    const d = resolveRuleDisplay(taskLike(
      'https://alfa.siteimprove.com/rules/sia-r66',
      'https://alfa.siteimprove.com/rules/sia-r66',
      [], 'The highest possible contrast is 4.92:1', null));
    assert.equal(d.mapped, true);
    assert.match(d.title, /enhanced contrast/i);
    assert.deepEqual(d.wcag, ['1.4.6']);
    assert.match(d.description, /4.92:1/);
    assert.equal(d.sourceUrl, 'https://alfa.siteimprove.com/rules/sia-r66');
  });

  test('unmapped rule: no title, but the scanner description and help carry it', () => {
    const d = resolveRuleDisplay(taskLike(
      'region', 'region', [],
      'All page content should be contained by landmarks',
      'https://dequeuniversity.com/rules/axe/4.12/region'));
    assert.equal(d.mapped, false);
    assert.equal(d.title, null);
    assert.match(d.description, /landmarks/);
    assert.equal(d.sourceUrl, 'https://dequeuniversity.com/rules/axe/4.12/region');
  });

  test("the finding's own WCAG tags take precedence over the map", () => {
    const d = resolveRuleDisplay(taskLike('link-name', 'link-name', ['2.4.4'], 'no name', null));
    assert.deepEqual(d.wcag, ['2.4.4']);
  });

  test('a bare-URL rule id with no map entry still links to itself', () => {
    const d = resolveRuleDisplay(taskLike(
      'https://alfa.siteimprove.com/rules/sia-r999',
      'https://alfa.siteimprove.com/rules/sia-r999', [], 'x', null));
    assert.equal(d.mapped, false);
    assert.equal(d.sourceUrl, 'https://alfa.siteimprove.com/rules/sia-r999');
  });
});
