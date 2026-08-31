import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOpenScansReportJson } from '../../src/adapters/open-scans/report-json.js';
import { enrichObservationsWithSignatures } from '../../src/analysis/canonicalize.js';
import { clusterPatternOccurrences } from '../../src/analysis/pattern-cluster.js';
import { buildComponentHypotheses } from '../../src/analysis/component-hypothesis.js';
import { buildRemediationTasks } from '../../src/analysis/remediation-tasks.js';
import { routeTaskForProfile, isTaskRelevantToProfile } from '../../src/roles/route-task.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demo = path.resolve(__dirname, '../fixtures/open-scans/report-pattern-demo.json');

function buildTasks() {
  const parsed = parseOpenScansReportJson(fs.readFileSync(demo, 'utf8'));
  const obs = enrichObservationsWithSignatures(parsed.observations);
  const clusters = clusterPatternOccurrences(obs, parsed.totalPages);
  const components = buildComponentHypotheses(clusters, parsed.totalPages);
  return buildRemediationTasks(clusters, components, parsed.totalPages);
}

// A stable "evidence fingerprint" of a task set: the underlying observation
// identities + pages + rules. Presentation fields (order, relevance) are excluded.
function evidenceFingerprint(tasks) {
  return tasks
    .flatMap(t => t.observations.map(o => `${o.rule.sourceRuleId}|${o.page.submittedUrl}|${o.evidence.locator}|${o.identity.sourcePatternId}`))
    .sort()
    .join('\n');
}

describe('Phase 7 gate: capability routing changes presentation, not evidence', () => {
  test('two profiles get different prioritization/handoff but IDENTICAL evidence', () => {
    const tasksForContent = buildTasks();
    const tasksForDev = buildTasks();

    // Same report -> identical underlying evidence regardless of profile.
    assert.equal(evidenceFingerprint(tasksForContent), evidenceFingerprint(tasksForDev));

    const contentCaps = ['Page content and media'];
    const cssCaps = ['CSS/design tokens'];

    const contentRouting = tasksForContent.map(t => routeTaskForProfile(t, contentCaps).relevance);
    const cssRouting = tasksForDev.map(t => routeTaskForProfile(t, cssCaps).relevance);

    // The two profiles produce different relevance verdicts across the task set.
    assert.notDeepEqual(contentRouting, cssRouting);

    // But no finding is removed for either profile — filtering never deletes.
    for (const t of tasksForContent) assert.ok(t.observations.length > 0);
  });

  test('the same task object is never mutated by routing', () => {
    const [task] = buildTasks();
    const before = JSON.stringify(task);
    routeTaskForProfile(task, ['Page content and media']);
    routeTaskForProfile(task, ['CSS/design tokens']);
    assert.equal(JSON.stringify(task), before, 'routing must not mutate the task/evidence');
  });
});

describe('Phase 7: required capability scenarios', () => {
  const contentPrimary = { roles: { primary: 'Content Authoring', coPrimary: [], secondary: ['Front-End Development'], contributors: ['Testing / QA'] }, blueprint: { humanDecisionsRequired: [] } };
  const visualPrimary = { roles: { primary: 'Visual Design', coPrimary: [], secondary: ['Front-End Development'], contributors: ['Testing / QA'] }, blueprint: {} };
  const devPrimary = { roles: { primary: 'Front-End Development', coPrimary: [], secondary: [], contributors: ['Testing / QA'] }, blueprint: {} };

  test('content capability without code capability -> direct on content task, handoff on dev task', () => {
    assert.equal(routeTaskForProfile(contentPrimary, ['Page content and media']).relevance, 'direct');
    assert.equal(routeTaskForProfile(devPrimary, ['Page content and media']).relevance, 'handoff');
  });

  test('code capability without content authority -> direct on dev task, handoff on content task', () => {
    assert.equal(routeTaskForProfile(devPrimary, ['HTML/templates/components']).relevance, 'direct');
    assert.equal(routeTaskForProfile(contentPrimary, ['HTML/templates/components']).relevance, 'supporting'); // FE is secondary
  });

  test('CSS capability without authority to choose colours -> supporting/direct, not owning the decision', () => {
    // Visual Design is primary; CSS maps to Visual Design + Front-End.
    const r = routeTaskForProfile(visualPrimary, ['CSS/design tokens']);
    assert.equal(r.relevance, 'direct'); // can implement
    assert.ok(r.matchedCapabilities.includes('CSS/design tokens'));
  });

  test('QA-only capability -> review-only (contributor), never owning the change', () => {
    const r = routeTaskForProfile(contentPrimary, ['Automated/manual testing']);
    assert.equal(r.relevance, 'review-only');
  });

  test('review-only capability -> review-only for any task', () => {
    assert.equal(routeTaskForProfile(devPrimary, ['I can review but not change the site']).relevance, 'review-only');
  });

  test('no profile -> unfiltered (all tasks visible)', () => {
    assert.equal(routeTaskForProfile(contentPrimary, []).relevance, 'unfiltered');
    assert.equal(isTaskRelevantToProfile(contentPrimary, []), true);
  });

  test('multiple capability selections aggregate matches', () => {
    const r = routeTaskForProfile(contentPrimary, ['Page content and media', 'Automated/manual testing']);
    assert.equal(r.relevance, 'direct');
    assert.ok(r.matchedCapabilities.includes('Page content and media'));
  });

  test('handoff verdict carries reasons and unmatched capabilities', () => {
    const r = routeTaskForProfile(devPrimary, ['Page content and media']);
    assert.equal(r.relevance, 'handoff');
    assert.ok(r.reason.length > 0);
    assert.ok(r.unmatchedCapabilities.includes('Page content and media'));
  });
});

describe('Phase 7: ARRM source distinction and profile persistence', () => {
  test('ARRM-covered SC is sourced w3c-arrm; uncovered SC is workbench-inference', async () => {
    const { getRolesForWcag } = await import('../../src/roles/arrm.js');
    assert.equal(getRolesForWcag(['1.1.1'], 'image-alt').source, 'w3c-arrm');
    assert.equal(getRolesForWcag(['9.9.9'], 'made-up').source, 'workbench-inference');
    // A WCAG 2.2 SC that IS in the ARRM draft is w3c-arrm, not an extension.
    assert.equal(getRolesForWcag(['2.5.8'], 'target-size').source, 'w3c-arrm');
  });

  test('capability profile persists and restores; clearing resets it', async () => {
    // Provide a minimal in-memory localStorage for the persistence module.
    const mem = new Map();
    globalThis.localStorage = {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: k => mem.delete(k)
    };
    const { saveProfile, getSavedProfile } = await import('../../src/roles/capability-profile.js');

    saveProfile({ selectedCapabilities: ['CSS/design tokens'], customNotes: '' });
    const restored = getSavedProfile();
    assert.deepEqual(restored.selectedCapabilities, ['CSS/design tokens']);

    // Clearing selections and saving persists the empty profile.
    saveProfile({ selectedCapabilities: [], customNotes: '' });
    assert.deepEqual(getSavedProfile().selectedCapabilities, []);

    delete globalThis.localStorage;
  });
});
