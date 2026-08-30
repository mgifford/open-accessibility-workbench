import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractSelectorSignature } from '../../src/analysis/selector-signature.js';
import { extractDomSignatures } from '../../src/analysis/dom-signature.js';
import { clusterPatternOccurrences } from '../../src/analysis/pattern-cluster.js';
import { buildComponentHypotheses } from '../../src/analysis/component-hypothesis.js';
import { buildRemediationTasks } from '../../src/analysis/remediation-tasks.js';

describe('Pattern & Component Engine', () => {
  test('sanitizes volatile dynamic IDs and preserves structural class names', () => {
    const rawLocator = 'article[data-history-node-id="551"] > header > .node__meta > .node__byline > .node__author > span > a[title="View user profile."][href$="amyjune-hineline"]';
    const sig = extractSelectorSignature(rawLocator);

    assert.ok(!sig.includes('551'));
    assert.ok(sig.includes('data-history-node-id'));
    assert.ok(sig.includes('.node__meta'));
    assert.ok(sig.includes('.node__author'));
  });

  test('extracts multiple structural signatures from HTML snippet', () => {
    const html = '<a class="social-media-link-icon--linkedin" href="https://linkedin.com"><span class="fab fa-linkedin"></span></a>';
    const sigs = extractDomSignatures(html);

    assert.ok(sigs.exactHtmlSignature);
    assert.ok(sigs.structureSignature.includes('social-media-link-icon--linkedin'));
    assert.equal(sigs.semanticSignature, 'a');
  });

  test('clusters cross-page occurrences without over-merging distinct rules', () => {
    const obsList = [
      {
        id: 'obs-1',
        rule: { normalizedRuleId: 'link-name', sourceRuleId: 'link-name', wcag: ['2.4.4'] },
        page: { submittedUrl: 'https://example.com/page1' },
        evidence: { locator: '.social-link', renderedHtml: '<a class="social-link" href="#">Icon</a>' },
        signatures: { structureSignature: '<a class="social-link">*</a>' },
        classification: { impact: 'serious' },
        provenance: { scanner: 'axe' }
      },
      {
        id: 'obs-2',
        rule: { normalizedRuleId: 'link-name', sourceRuleId: 'link-name', wcag: ['2.4.4'] },
        page: { submittedUrl: 'https://example.com/page2' },
        evidence: { locator: '.social-link', renderedHtml: '<a class="social-link" href="#">Icon</a>' },
        signatures: { structureSignature: '<a class="social-link">*</a>' },
        classification: { impact: 'serious' },
        provenance: { scanner: 'axe' }
      },
      {
        id: 'obs-3',
        rule: { normalizedRuleId: 'color-contrast', sourceRuleId: 'color-contrast', wcag: ['1.4.3'] },
        page: { submittedUrl: 'https://example.com/page1' },
        evidence: { locator: '.footer-text', renderedHtml: '<p class="footer-text">Copyright</p>' },
        signatures: { structureSignature: '<p class="footer-text">*</p>' },
        classification: { impact: 'serious' },
        provenance: { scanner: 'axe' }
      }
    ];

    const clusters = clusterPatternOccurrences(obsList, 2);
    assert.equal(clusters.length, 2); // 1 link-name cluster, 1 color-contrast cluster

    const linkCluster = clusters.find(c => c.ruleId === 'link-name');
    assert.equal(linkCluster.pagesCount, 2);
    assert.equal(linkCluster.occurrencesCount, 2);

    const hypotheses = buildComponentHypotheses(clusters, 2);
    assert.equal(hypotheses.length, 2);

    const tasks = buildRemediationTasks(clusters, hypotheses, 2);
    assert.equal(tasks.length, 2);
  });
});
