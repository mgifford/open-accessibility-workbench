import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOpenScansReportJson } from '../../src/adapters/open-scans/report-json.js';
import { enrichObservationsWithSignatures } from '../../src/analysis/canonicalize.js';
import { clusterPatternOccurrences } from '../../src/analysis/pattern-cluster.js';
import { buildComponentHypotheses } from '../../src/analysis/component-hypothesis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(__dirname, '../fixtures/open-scans/report-pattern-demo.json');

function reduce() {
  const parsed = parseOpenScansReportJson(fs.readFileSync(fixture, 'utf8'));
  const observations = enrichObservationsWithSignatures(parsed.observations);
  const clusters = clusterPatternOccurrences(observations, parsed.totalPages);
  const components = buildComponentHypotheses(clusters, parsed.totalPages);
  return { observations, clusters, components };
}

describe('Phase 5 gate: observations -> patterns -> shared components (no AI)', () => {
  test('a realistic report is reduced to a small set of shared components', () => {
    const { observations, clusters, components } = reduce();

    // Many observations, fewer patterns, fewest components — real reduction.
    assert.ok(observations.length >= 12, `expected many observations, got ${observations.length}`);
    assert.ok(components.length < clusters.length, 'components must be fewer than patterns');
    assert.ok(clusters.length < observations.length, 'patterns must be fewer than observations');
    assert.equal(components.length, 2); // social-links component + footer component
  });

  test('the five social icons collapse into one shared component (across distinct upstream ids)', () => {
    const { components } = reduce();
    const social = components.find(c => /social/i.test(c.name));
    assert.ok(social, 'a social-links component was hypothesized');
    // Five distinct per-network pattern clusters, one component.
    assert.ok(social.clusterIds.length >= 5, `expected >=5 member clusters, got ${social.clusterIds.length}`);
    assert.equal(social.confidence, 'high');
    assert.equal(social.pagesCount, 3);
  });

  test('does not over-merge: the footer contrast pattern stays a separate component', () => {
    const { components } = reduce();
    const footer = components.find(c => /footer/i.test(c.name));
    assert.ok(footer, 'footer kept as its own component');
    const social = components.find(c => /social/i.test(c.name));
    assert.notEqual(footer.id, social.id);
    // The footer component does not absorb any social clusters.
    assert.ok(!footer.clusterIds.some(id => social.clusterIds.includes(id)));
  });

  test('every grouping explains itself', () => {
    const { clusters, components } = reduce();

    // Each pattern cluster states why its occurrences are grouped.
    for (const c of clusters) {
      assert.ok(Array.isArray(c.groupingRationale) && c.groupingRationale.length > 0);
      assert.ok(c.groupingRationale.some(r => /rule|pattern|signature|page/i.test(r)));
    }

    // Each component hypothesis carries explainable, non-numeric confidence with
    // the concrete signals behind it.
    for (const comp of components) {
      assert.ok(['high', 'medium', 'low'].includes(comp.confidence));
      assert.ok(Array.isArray(comp.confidenceSignals));
      assert.ok(typeof comp.rationale === 'string' && comp.rationale.length > 0);
    }
    const social = components.find(c => /social/i.test(c.name));
    assert.ok(social.confidenceSignals.some(s => /structural family/i.test(s)));
    assert.ok(social.confidenceSignals.some(s => /pages/i.test(s)));
  });

  test('explanations are TRUE, not just present: reported basis matches the algorithm', () => {
    const { clusters, components } = reduce();

    // The social demo groups by upstream pattern id — the cluster rationale must
    // say so and must NOT claim structural DOM equality was compared.
    for (const c of clusters) {
      assert.ok(c.groupingBasis, 'cluster records its actual grouping basis');
      const rationale = c.groupingRationale.join(' ');
      if (c.groupingBasis === 'upstream-pattern-id') {
        assert.match(rationale, /upstream pattern id/i);
        assert.doesNotMatch(rationale, /matching canonical structural dom signature/i);
      }
      if (c.groupingBasis === 'structure-signature') {
        assert.match(rationale, /structural dom signature/i);
      }
    }

    // The social component combines FIVE DISTINCT upstream ids over TEN
    // occurrences — the signals must state that accurately.
    const social = components.find(c => /social/i.test(c.name));
    assert.equal(social.upstreamPatternIds.length, 5);
    assert.equal(social.patternVariants, 5);
    assert.equal(social.occurrencesCount, 10);
    assert.ok(
      social.confidenceSignals.some(s => /distinct upstream patterns/i.test(s)),
      'must not claim a single shared upstream identity across distinct ids'
    );
    assert.ok(!social.confidenceSignals.some(s => /^5 instances/i.test(s)),
      'must not conflate 5 variants with occurrence count');
    assert.ok(social.confidenceSignals.some(s => /10 occurrences/i.test(s)));
  });

  test('class-order / attribute-order / quote-style differences do NOT fragment', () => {
    const obs = [
      mkObs('o1', 'link-name', 'p1', '<a class="social-link icon" href="#">x</a>'),
      mkObs('o2', 'link-name', 'p2', "<a class='icon social-link' href='#'>x</a>"),
      mkObs('o3', 'link-name', 'p3', '<a href="#" class="icon social-link">x</a>')
    ];
    const enriched = enrichObservationsWithSignatures(obs);
    const clusters = clusterPatternOccurrences(enriched, 3);
    // All three are the same element modulo class/attr order + quotes -> 1 pattern.
    assert.equal(clusters.length, 1, `expected 1 pattern, got ${clusters.length}`);
    assert.equal(clusters[0].occurrencesCount, 3);
  });

  test('conflicting upstream identity vs structure: same upstream id groups, and says so honestly', () => {
    // Two STRUCTURALLY DIFFERENT elements share one upstream pattern id + rule.
    // They group by upstream id (the scanner's assignment), and the rationale
    // must NOT claim their structures matched.
    const obs = [
      mkObs('a', 'link-name', 'p1', '<a class="x" href="#">x</a>', 'A11Y-SAME'),
      mkObs('b', 'link-name', 'p1', '<button class="y">y</button>', 'A11Y-SAME')
    ];
    const enriched = enrichObservationsWithSignatures(obs);
    const clusters = clusterPatternOccurrences(enriched, 1);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].groupingBasis, 'upstream-pattern-id');
    const rationale = clusters[0].groupingRationale.join(' ');
    assert.doesNotMatch(rationale, /matching canonical structural dom signature/i);
  });
});

function mkObs(id, ruleId, page, html, patternId = null) {
  return {
    id,
    rule: { normalizedRuleId: ruleId, sourceRuleId: ruleId, wcag: ['2.4.4'] },
    page: { submittedUrl: `https://example.com/${page}` },
    evidence: { locator: `.${page}`, renderedHtml: html },
    identity: { sourcePatternId: patternId },
    classification: { impact: 'serious' },
    provenance: { scanner: 'axe' }
  };
}
