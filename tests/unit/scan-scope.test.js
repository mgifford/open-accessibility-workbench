import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hostnameOf, collectPageUrls, rankDomains, scaleSummary, commonPatterns, buildScanScope,
  patternStrength, rankPatternsByStrength
} from '../../src/analysis/scan-scope.js';

describe('scan-scope: domain + scale derivation', () => {
  test('hostnameOf strips protocol and www, and rejects junk', () => {
    assert.equal(hostnameOf('https://www.example.com/a/b'), 'example.com');
    assert.equal(hostnameOf('http://sub.example.org/'), 'sub.example.org');
    assert.equal(hostnameOf('not a url'), null);
    assert.equal(hostnameOf(''), null);
    assert.equal(hostnameOf(undefined), null);
  });

  test('collectPageUrls gathers from tasks, CSV page summaries, and observations, de-duped', () => {
    const urls = collectPageUrls({
      tasks: [{ affectedPages: ['https://a.com/1', 'https://a.com/2'] }],
      sourceSummary: { pageSummaries: [{ finalUrl: 'https://a.com/2' }, { submittedUrl: 'https://b.com/x' }] },
      observations: [{ page: { finalUrl: 'https://c.com/y' } }]
    });
    assert.deepEqual([...urls].sort(), ['https://a.com/1', 'https://a.com/2', 'https://b.com/x', 'https://c.com/y']);
  });

  test('rankDomains orders by page count then name', () => {
    const ranked = rankDomains([
      'https://a.com/1', 'https://a.com/2', 'https://a.com/3',
      'https://b.com/1', 'https://b.com/2',
      'https://c.com/1'
    ]);
    assert.deepEqual(ranked, [
      { domain: 'a.com', pageCount: 3 },
      { domain: 'b.com', pageCount: 2 },
      { domain: 'c.com', pageCount: 1 }
    ]);
  });

  test('scaleSummary reports pages-with-findings against totalPages', () => {
    const scale = scaleSummary({
      tasks: [
        { affectedPages: ['https://a.com/1', 'https://a.com/2'] },
        { affectedPages: ['https://a.com/2', 'https://a.com/3'] }
      ],
      sourceSummary: { totalPages: 10 }
    });
    assert.equal(scale.totalPages, 10);
    assert.equal(scale.pagesWithFindings, 3); // /1 /2 /3, de-duped
    assert.equal(scale.percentage, 30);
  });

  test('scaleSummary percentage is null when totalPages is unknown', () => {
    const scale = scaleSummary({ tasks: [{ affectedPages: ['https://a.com/1'] }], sourceSummary: {} });
    assert.equal(scale.percentage, null);
  });

  test('commonPatterns ranks by pages affected then occurrences and respects the limit', () => {
    const tasks = [
      { id: 't1', title: 'Contrast', ruleId: 'color-contrast', remediationFamily: 'contrast', metrics: { affectedPagesCount: 5, observationCount: 20 } },
      { id: 't2', title: 'Links', ruleId: 'link-name', remediationFamily: 'accessible-name', metrics: { affectedPagesCount: 5, observationCount: 40 } },
      { id: 't3', title: 'Region', ruleId: 'region', remediationFamily: 'structure', metrics: { affectedPagesCount: 1, observationCount: 1 } }
    ];
    const patterns = commonPatterns({ tasks }, 2);
    assert.equal(patterns.length, 2);
    // Same page count (5), so higher occurrences (t2) wins the tie.
    assert.equal(patterns[0].taskId, 't2');
    assert.equal(patterns[1].taskId, 't1');
  });

  test('patternStrength bands by reach', () => {
    assert.equal(patternStrength({ pagesCount: 3 }), 'strong');
    assert.equal(patternStrength({ pagesCount: 1, pagesPercentage: 60 }), 'strong'); // majority of pages
    assert.equal(patternStrength({ pagesCount: 2 }), 'moderate');
    assert.equal(patternStrength({ pagesCount: 1, pagesPercentage: 10 }), 'isolated');
    assert.equal(patternStrength({}), 'isolated');
  });

  test('rankPatternsByStrength leads with strong, then pages, then occurrences; no mutation', () => {
    const clusters = [
      { id: 'iso', pagesCount: 1, pagesPercentage: 10, occurrencesCount: 9 },
      { id: 'strongA', pagesCount: 4, pagesPercentage: 80, occurrencesCount: 4 },
      { id: 'mod', pagesCount: 2, pagesPercentage: 40, occurrencesCount: 2 },
      { id: 'strongB', pagesCount: 4, pagesPercentage: 80, occurrencesCount: 10 }
    ];
    const before = clusters.map(c => c.id);
    const ranked = rankPatternsByStrength(clusters).map(c => c.id);
    assert.deepEqual(ranked, ['strongB', 'strongA', 'mod', 'iso']); // strongB has more occurrences than strongA
    assert.deepEqual(clusters.map(c => c.id), before); // input untouched
  });

  test('buildScanScope returns null when nothing is loaded', () => {
    assert.equal(buildScanScope({ loaded: false }), null);
  });

  test('buildScanScope assembles domains, totals, scale, and patterns from a loaded state', () => {
    const scope = buildScanScope({
      loaded: true,
      sourceSummary: { system: 'open-scans', scanId: '353', totalPages: 3 },
      tasks: [
        { id: 't1', title: 'Region', ruleId: 'region', remediationFamily: 'structure', affectedPages: ['https://x.gov/a', 'https://x.gov/b'], metrics: { affectedPagesCount: 2, observationCount: 5 } },
        { id: 't2', title: 'Links', ruleId: 'link-name', remediationFamily: 'accessible-name', affectedPages: ['https://y.com/c'], metrics: { affectedPagesCount: 1, observationCount: 3 } }
      ]
    });
    assert.equal(scope.system, 'open-scans');
    assert.equal(scope.totalDomains, 2);
    assert.equal(scope.domains[0].domain, 'x.gov'); // 2 pages beats y.com's 1
    assert.equal(scope.scale.totalPages, 3);
    assert.equal(scope.scale.pagesWithFindings, 3);
    assert.equal(scope.patterns[0].taskId, 't1'); // most pages affected
  });
});
