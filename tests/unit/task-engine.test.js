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

  test('status defaults to open and transitions through the lifecycle', () => {
    assert.equal(store.get('TASK-1'), 'open');
    for (const s of TASK_STATUSES) {
      store.set('TASK-1', s);
      assert.equal(store.get('TASK-1'), s);
    }
  });

  test('unknown status values are rejected', () => {
    store.set('TASK-1', 'bogus');
    assert.equal(store.get('TASK-1'), 'open');
  });

  test('summary counts statuses across task ids', () => {
    store.set('A', 'done');
    store.set('B', 'in-progress');
    store.set('C', 'done');
    const s = store.summary(['A', 'B', 'C', 'D']);
    assert.equal(s.done, 2);
    assert.equal(s['in-progress'], 1);
    assert.equal(s.open, 1); // D never set
  });

  test('setting a task back to open clears it', () => {
    store.set('A', 'done');
    store.set('A', 'open');
    assert.equal(store.get('A'), 'open');
    assert.equal(store.summary(['A']).done, 0);
  });
});
