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

describe('Phase 7: decision authority vs implementation ability', () => {
  const contrastTask = { remediationFamily: 'contrast', roles: { primary: 'Visual Design', coPrimary: [], secondary: ['Front-End Development'], contributors: ['Testing / QA'] }, blueprint: { humanDecisionsRequired: ['Choose an approved accessible colour token.'] } };
  const nameTask = { remediationFamily: 'accessible-name', roles: { primary: 'Content Authoring', coPrimary: ['Front-End Development'], secondary: [], contributors: ['Testing / QA'] }, blueprint: { humanDecisionsRequired: ['Confirm the link destination name.'] } };

  test('CSS capability WITHOUT colour authority is implementation-blocked, NOT direct', () => {
    // The reviewer's key scenario: a CSS-only user can implement a token but does
    // not choose the accessible colour.
    const r = routeTaskForProfile(contrastTask, ['CSS/design tokens']);
    assert.equal(r.relevance, 'implementation-blocked');
    assert.ok(r.reason.some(x => /decision/i.test(x)));
    assert.ok(r.reason.some(x => /Visual Design/i.test(x)));
  });

  test('visual-design capability CAN make the colour decision', () => {
    const r = routeTaskForProfile(contrastTask, ['Visual design']);
    assert.equal(r.relevance, 'decision');
  });

  test('content capability makes the name decision; code-only is implementation-blocked', () => {
    assert.equal(routeTaskForProfile(nameTask, ['Page content and media']).relevance, 'decision');
    assert.equal(routeTaskForProfile(nameTask, ['HTML/templates/components']).relevance, 'implementation-blocked');
  });

  test('QA-only capability -> review-only, never deciding or owning', () => {
    assert.equal(routeTaskForProfile(contrastTask, ['Automated/manual testing']).relevance, 'review-only');
  });

  test('review-only capability -> review-only for any task', () => {
    assert.equal(routeTaskForProfile(contrastTask, ['I can review but not change the site']).relevance, 'review-only');
  });

  test('no profile -> unfiltered (all tasks visible)', () => {
    assert.equal(routeTaskForProfile(contrastTask, []).relevance, 'unfiltered');
    assert.equal(isTaskRelevantToProfile(contrastTask, []), true);
  });

  test('unrelated capability -> handoff with reasons, using non-ownership language', () => {
    const r = routeTaskForProfile(contrastTask, ['JavaScript/interactions']);
    assert.equal(r.relevance, 'handoff');
    assert.ok(r.reason.length > 0);
    // Non-ownership language: "requires input from", never "owns".
    assert.ok(r.reason.some(x => /requires input from/i.test(x)));
    assert.ok(!r.reason.some(x => /\bowns?\b/i.test(x)), 'must not use ownership language');
  });
});

describe('Phase 7: ARRM source distinction and profile persistence', () => {
  test('ARRM-covered SC is sourced w3c-arrm; uncovered SC is unmapped', async () => {
    const { getRolesForWcag } = await import('../../src/roles/arrm.js');
    assert.equal(getRolesForWcag(['1.1.1'], 'image-alt').source, 'w3c-arrm');
    // Uncovered SC is not owned and not labelled ARRM.
    assert.equal(getRolesForWcag(['9.9.9'], 'made-up').source, 'unmapped');
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
