import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectTechnologyFromObservations } from '../../src/technology/detect.js';
import { getTechnologyGuidance } from '../../src/guidance/technology-guidance.js';
import { generateRemediationBlueprint } from '../../src/guidance/remediation.js';
import { exportTasksToJson } from '../../src/export/json.js';

const drupalObs = [{ evidence: { renderedHtml: '<a data-history-node-id="5">x</a>', locator: '.a' }, page: { title: '', submittedUrl: '' } }];
const reactWeakObs = [{ evidence: { renderedHtml: '<div class="react-thing">x</div>', locator: '.a' }, page: { title: '', submittedUrl: '' } }];
const reactStrongObs = [{ evidence: { renderedHtml: '<div data-reactroot>x</div>', locator: '.a' }, page: { title: '', submittedUrl: '' } }];

describe('Phase 8: technology evidence priority', () => {
  test('user-confirmed technology overrides heuristic detection', () => {
    // Report evidence points to React, but the user confirmed Drupal.
    const t = detectTechnologyFromObservations(reactStrongObs, 'Drupal');
    assert.equal(t.name, 'Drupal');
    assert.equal(t.source, 'user');
    assert.equal(t.confirmed, true);
  });

  test('confirmed Unknown suppresses framework output', () => {
    const t = detectTechnologyFromObservations(drupalObs, 'unknown');
    assert.equal(t.name, 'Unknown');
    assert.equal(t.confirmed, true);
    assert.equal(getTechnologyGuidance('accessible-name', t), null);
  });

  test('scan metadata beats detector and report evidence', () => {
    const t = detectTechnologyFromObservations(drupalObs, null, {
      technologies: [{ name: 'WordPress', category: 'CMS', confidence: 100, evidence: ['meta-generator'] }]
    });
    assert.equal(t.name, 'WordPress');
    assert.equal(t.source, 'metadata');
    assert.ok(t.evidence.includes('meta-generator'));
  });

  test('imported detector output is used when no metadata', () => {
    const t = detectTechnologyFromObservations([], null, { detectorResults: [{ name: 'Vue', evidence: ['bundle'] }] });
    assert.equal(t.name, 'Vue');
    assert.equal(t.source, 'detector');
  });

  test('no evidence stays Unknown — never forced to a framework', () => {
    const t = detectTechnologyFromObservations([]);
    assert.equal(t.name, 'Unknown');
    assert.equal(t.confidence, 'none');
  });
});

describe('Phase 8: weak evidence and confidence', () => {
  test('a weak clue stays low confidence and yields NO framework guidance', () => {
    const t = detectTechnologyFromObservations(reactWeakObs);
    assert.equal(t.name, 'React');
    assert.equal(t.confidence, 'low');
    assert.equal(t.source, 'heuristic');
    assert.equal(getTechnologyGuidance('accessible-name', t), null);
  });

  test('a strong report marker reaches medium and yields guidance', () => {
    const t = detectTechnologyFromObservations(drupalObs);
    assert.equal(t.name, 'Drupal');
    assert.equal(t.confidence, 'medium');
    assert.equal(t.source, 'report-evidence');
    const g = getTechnologyGuidance('accessible-name', t);
    assert.ok(g && /Drupal/.test(g.note));
  });

  test('low-confidence detection never produces framework-specific source code', () => {
    const t = detectTechnologyFromObservations(reactWeakObs);
    const bp = generateRemediationBlueprint({ ruleId: 'link-name', cluster: {}, technologyContext: t, remediationFamily: 'accessible-name' });
    assert.equal(bp.technologyGuidance, null);
    // Generic targetMarkup is still present (HTML, not JSX).
    assert.ok(bp.targetMarkup && /<a /.test(bp.targetMarkup));
  });
});

describe('Phase 8: rejection and metadata compatibility', () => {
  test('a rejected detection is not re-applied', () => {
    // Reject Drupal; the same report evidence must not re-detect it.
    const t = detectTechnologyFromObservations(drupalObs, null, null, ['Drupal']);
    assert.notEqual(t.name, 'Drupal');
    assert.equal(t.name, 'Unknown');
  });

  test('older reports without technologies[] still resolve (no failure)', () => {
    assert.doesNotThrow(() => detectTechnologyFromObservations([], null, { someOtherField: true }));
    const t = detectTechnologyFromObservations([], null, { someOtherField: true });
    assert.equal(t.name, 'Unknown');
  });

  test('unknown upstream metadata fields are preserved, not discarded', () => {
    const t = detectTechnologyFromObservations([], null, {
      technologies: [{ name: 'Drupal', confidence: 100, evidence: ['x'], upstreamOnlyField: 'keep-me' }]
    });
    assert.equal(t.raw.upstreamOnlyField, 'keep-me');
  });
});

describe('Phase 8 gate: framework guidance EXTENDS, never replaces generic', () => {
  test('generic HTML guidance is present regardless of technology', () => {
    for (const tech of [null, 'Drupal', 'unknown']) {
      const t = detectTechnologyFromObservations(drupalObs, tech);
      const bp = generateRemediationBlueprint({ ruleId: 'link-name', cluster: {}, technologyContext: t, remediationFamily: 'accessible-name' });
      assert.ok(bp.whatNeedsToChange && bp.whatNeedsToChange.length > 0, `generic objective present for ${tech}`);
      assert.ok(bp.targetMarkup && /<a /.test(bp.targetMarkup), `generic HTML markup present for ${tech}`);
    }
  });

  test('confirmed technology adds guidance without changing the generic objective', () => {
    const t = detectTechnologyFromObservations([], 'Drupal');
    const generic = generateRemediationBlueprint({ ruleId: 'link-name', cluster: {}, technologyContext: detectTechnologyFromObservations([]), remediationFamily: 'accessible-name' });
    const withTech = generateRemediationBlueprint({ ruleId: 'link-name', cluster: {}, technologyContext: t, remediationFamily: 'accessible-name' });
    // Same generic objective + markup...
    assert.equal(withTech.whatNeedsToChange, generic.whatNeedsToChange);
    assert.equal(withTech.targetMarkup, generic.targetMarkup);
    // ...plus an additive Drupal note.
    assert.ok(withTech.technologyGuidance && /Drupal/.test(withTech.technologyGuidance.note));
    assert.equal(generic.technologyGuidance, null);
  });

  test('technology context appears in JSON export with provenance', () => {
    const t = detectTechnologyFromObservations([], null, {
      technologies: [{ name: 'Drupal', category: 'CMS', confidence: 90, evidence: ['meta-generator'] }]
    });
    const task = {
      id: 'T1', title: 'x', ruleId: 'link-name', ruleIds: ['link-name'], remediationFamily: 'accessible-name',
      patternClusterIds: ['c1'], wcag: ['2.4.4'], urgency: 'high', leverage: 'high', metrics: {},
      componentHypothesis: null, roles: {}, technologyContext: t, blueprint: {}, affectedPages: []
    };
    const out = JSON.parse(exportTasksToJson({ tasks: [task], observations: [], sourceSummary: {} }));
    const exported = out.tasks[0];
    assert.equal(exported.technologyContext.name, 'Drupal');
    assert.equal(exported.technologyContext.source, 'metadata');       // provenance
    assert.ok(exported.technologyContext.evidence.includes('meta-generator'));
    // Pattern and rule identities are retained in exports.
    assert.deepEqual(exported.ruleIds, ['link-name']);
    assert.deepEqual(exported.patternClusterIds, ['c1']);
  });
});
