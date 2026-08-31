import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOpenScansReportJson } from '../../src/adapters/open-scans/report-json.js';
import { enrichObservationsWithSignatures } from '../../src/analysis/canonicalize.js';
import { clusterPatternOccurrences } from '../../src/analysis/pattern-cluster.js';
import { buildComponentHypotheses } from '../../src/analysis/component-hypothesis.js';
import { buildRemediationTasks } from '../../src/analysis/remediation-tasks.js';
import { TaskStatusStore, TASK_STATUSES } from '../../src/state/task-status.js';
import { verifyFindingProvenance } from '../../src/analysis/provenance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demo = path.resolve(__dirname, '../fixtures/open-scans/report-pattern-demo.json');

function buildTasks() {
  const parsed = parseOpenScansReportJson(fs.readFileSync(demo, 'utf8'));
  const observations = enrichObservationsWithSignatures(parsed.observations);
  // Stamp a source-report id so provenance resolves.
  observations.forEach(o => { o.source.sourceReportId = 'src-demo'; });
  const clusters = clusterPatternOccurrences(observations, parsed.totalPages);
  const components = buildComponentHypotheses(clusters, parsed.totalPages);
  const tasks = buildRemediationTasks(clusters, components, parsed.totalPages);
  return { observations, clusters, components, tasks };
}

describe('Phase 6 gate: tasks are the primary, consolidated experience', () => {
  test('a multi-pattern component yields ONE consolidated task, not one per pattern', () => {
    const { clusters, components, tasks } = buildTasks();
    // 6 patterns, 2 components -> 2 tasks (was 6 before consolidation).
    assert.equal(tasks.length, components.length);
    assert.ok(tasks.length < clusters.length, 'tasks must be fewer than patterns');

    const social = tasks.find(t => /social/i.test(t.title));
    assert.ok(social.consolidated);
    assert.equal(social.metrics.patternVariantCount, 5);
    assert.equal(social.metrics.observationCount, 10);
    // Its explanation states the consolidation.
    assert.ok(social.groupingRationale.some(r => /consolidated 5 pattern variants/i.test(r)));
  });

  test('consolidation preserves provenance: every underlying observation is retained and traceable', () => {
    const { observations, tasks } = buildTasks();
    const totalInTasks = tasks.reduce((n, t) => n + t.observations.length, 0);
    assert.equal(totalInTasks, observations.length, 'no observation dropped during consolidation');

    for (const t of tasks) {
      const { complete } = verifyFindingProvenance(t, { resolveSourceReport: () => ({ id: 'src-demo' }) });
      assert.equal(complete, true, `task ${t.id} must retain full provenance`);
    }
  });

  test('leverage reflects the whole component, not a single member pattern', () => {
    const { tasks } = buildTasks();
    const social = tasks.find(t => /social/i.test(t.title));
    // 10 occurrences across all 3 pages -> high/very-high leverage.
    assert.ok(['very-high', 'high'].includes(social.leverage));
    assert.equal(social.metrics.affectedPagesCount, 3);
  });

  test('tasks are sorted so the highest-leverage work is first', () => {
    const { tasks } = buildTasks();
    const rank = { 'very-high': 4, 'high': 3, 'medium': 2, 'low': 1 };
    for (let i = 1; i < tasks.length; i++) {
      assert.ok((rank[tasks[i - 1].leverage] || 0) >= (rank[tasks[i].leverage] || 0));
    }
  });
});

describe('Phase 6: task lifecycle state', () => {
  let store;
  beforeEach(() => { store = new TaskStatusStore(); store.clear(); });

  test('status defaults to new and transitions through the FULL lifecycle', () => {
    assert.equal(store.get('TASK-1'), 'new');
    // Every documented lifecycle state is settable.
    assert.deepEqual(TASK_STATUSES, ['new', 'ready', 'in-progress', 'blocked', 'needs-decision', 'needs-verification', 'done', 'deferred']);
    for (const s of TASK_STATUSES) {
      store.set('TASK-1', s);
      assert.equal(store.get('TASK-1'), s);
    }
  });

  test('unknown status values are rejected', () => {
    store.set('TASK-1', 'bogus');
    assert.equal(store.get('TASK-1'), 'new');
  });

  test('summary counts statuses across task ids', () => {
    store.set('A', 'done');
    store.set('B', 'in-progress');
    store.set('C', 'done');
    const s = store.summary(['A', 'B', 'C', 'D']);
    assert.equal(s.done, 2);
    assert.equal(s['in-progress'], 1);
    assert.equal(s.new, 1); // D never set -> default
  });

  test('setting a task back to new clears it', () => {
    store.set('A', 'done');
    store.set('A', 'new');
    assert.equal(store.get('A'), 'new');
    assert.equal(store.summary(['A']).done, 0);
  });

  test('migrates legacy "open" status to "new" and drops unknown values', () => {
    const migrated = new TaskStatusStore();
    // Directly exercise the migration on a legacy map.
    const out = migrated._migrate({ A: 'open', B: 'in-progress', C: 'legacy-unknown' });
    assert.equal(out.A, undefined);  // open -> new (default) -> not stored
    assert.equal(out.B, 'in-progress');
    assert.equal(out.C, undefined);  // unknown dropped
  });
});

describe('Phase 6 blockers: stable identity & order-independent consolidation', () => {
  // Minimal deterministic cluster/observation builders.
  const obs = (ruleId, loc, pat, page = 'p1') => ({
    rule: { sourceRuleId: ruleId }, page: { submittedUrl: page },
    evidence: { locator: loc }, identity: { sourcePatternId: pat },
    classification: { impact: 'serious', sourceCategory: null }, provenance: { scanner: 'axe' },
    source: { sourceReportId: 'REPORT-A' }
  });
  const cluster = (id, ruleId, loc, pat) => ({
    id, ruleId, sourceRuleId: ruleId, upstreamPatternId: pat, wcag: ['2.4.4'],
    occurrencesCount: 1, pagesCount: 1, pagesPercentage: 100, affectedPages: ['p1'],
    representativeLocator: loc, representativeHtml: '<x>', groupingRationale: ['r'],
    observations: [obs(ruleId, loc, pat)]
  });

  test('task IDs are stable across cluster reordering (status cannot transfer)', () => {
    const a = cluster('c1', 'link-name', '.a', 'PAT-A');
    const b = cluster('c2', 'link-name', '.b', 'PAT-B');
    const forward = buildRemediationTasks([a, b], [], 1, null, null, 'REPORT-A');
    const reversed = buildRemediationTasks([b, a], [], 1, null, null, 'REPORT-A');

    // The task that owns pattern PAT-A has the SAME id in both orders.
    const idFor = (tasks, pat) => tasks.find(t => t.observations.some(o => o.identity.sourcePatternId === pat)).id;
    assert.equal(idFor(forward, 'PAT-A'), idFor(reversed, 'PAT-A'));
    assert.equal(idFor(forward, 'PAT-B'), idFor(reversed, 'PAT-B'));
  });

  test('task IDs are report-scoped: two reports do not share task IDs', () => {
    const a = cluster('c1', 'link-name', '.a', 'PAT-A');
    const t1 = buildRemediationTasks([a], [], 1, null, null, 'REPORT-A');
    const t2 = buildRemediationTasks([a], [], 1, null, null, 'REPORT-B');
    assert.notEqual(t1[0].id, t2[0].id);
  });

  test('a multi-rule component splits by remediation family, order-independently', () => {
    const link = cluster('c1', 'link-name', '.header a', 'PAT-L');
    const contrast = cluster('c2', 'color-contrast', '.header span', 'PAT-C');
    const hyp = { id: 'COMP-1', clusterId: 'c1', clusterIds: ['c1', 'c2'], name: 'Shared Header', confidence: 'high' };

    const A = buildRemediationTasks([link, contrast], [hyp], 1, null, null, 'REPORT-A');
    const B = buildRemediationTasks([contrast, link], [{ ...hyp, clusterIds: ['c2', 'c1'] }], 1, null, null, 'REPORT-A');

    // Two remediation families -> two tasks, regardless of input order.
    assert.equal(A.length, 2);
    assert.equal(B.length, 2);
    const families = t => t.map(x => x.remediationFamily).sort();
    assert.deepEqual(families(A), ['accessible-name', 'contrast']);
    assert.deepEqual(families(A), families(B));
    // Same ids and titles regardless of order (no first-cluster dependency).
    assert.deepEqual(A.map(t => t.id).sort(), B.map(t => t.id).sort());
    // Each task's blueprint matches its own family (no hidden change).
    const nameTask = A.find(t => t.remediationFamily === 'accessible-name');
    const contrastTask = A.find(t => t.remediationFamily === 'contrast');
    assert.match(nameTask.title, /accessible|discernible/i);
    assert.match(contrastTask.title, /contrast/i);
  });

  test('same-family clusters in a component still consolidate into one task', () => {
    const link1 = cluster('c1', 'link-name', '.social--a', 'PAT-1');
    const link2 = cluster('c2', 'link-name', '.social--b', 'PAT-2');
    const hyp = { id: 'COMP-1', clusterId: 'c1', clusterIds: ['c1', 'c2'], name: 'Shared Social', confidence: 'high' };
    const tasks = buildRemediationTasks([link1, link2], [hyp], 1, null, null, 'REPORT-A');
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].remediationFamily, 'accessible-name');
    assert.equal(tasks[0].observations.length, 2);
  });
});
