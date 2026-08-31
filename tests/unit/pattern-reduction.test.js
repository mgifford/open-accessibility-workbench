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
});
