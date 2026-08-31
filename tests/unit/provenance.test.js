import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOpenScansReportJson } from '../../src/adapters/open-scans/report-json.js';
import { parseOobeeReportCsv } from '../../src/adapters/oobee/report-csv.js';
import { enrichObservationsWithSignatures } from '../../src/analysis/canonicalize.js';
import { clusterPatternOccurrences } from '../../src/analysis/pattern-cluster.js';
import { buildComponentHypotheses } from '../../src/analysis/component-hypothesis.js';
import { buildRemediationTasks } from '../../src/analysis/remediation-tasks.js';
import { traceFinding, verifyFindingProvenance } from '../../src/analysis/provenance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const osDir = path.resolve(__dirname, '../fixtures/open-scans');
const oobeeDir = path.resolve(__dirname, '../fixtures/oobee');

function buildTasksFromObservations(observations, totalPages) {
  const enriched = enrichObservationsWithSignatures(observations);
  const clusters = clusterPatternOccurrences(enriched, totalPages);
  const hypotheses = buildComponentHypotheses(clusters, totalPages);
  return buildRemediationTasks(clusters, hypotheses, totalPages);
}

describe('Phase 4 gate: provenance tracing', () => {
  test('every Open Scans finding traces to source report, record, scanner, and page', () => {
    const parsed = parseOpenScansReportJson(fs.readFileSync(path.join(osDir, 'report.json'), 'utf8'));
    const tasks = buildTasksFromObservations(parsed.observations, parsed.totalPages);
    assert.ok(tasks.length > 0);

    for (const task of tasks) {
      const { complete, gaps } = verifyFindingProvenance(task);
      assert.equal(complete, true, `provenance gaps: ${JSON.stringify(gaps)}`);

      // Each of the four axes is concretely identifiable.
      for (const trace of traceFinding(task)) {
        assert.equal(trace.sourceReport.system, 'open-scans');       // which source report
        assert.equal(trace.sourceReport.format, 'report.json');
        assert.match(trace.originalRecord.pointer, /^\/results\/\d+\/\w+\/failures\/\d+$/); // which original record
        assert.ok(['axe', 'qualweb', 'alfa', 'equalAccess', 'accesslint'].includes(trace.scanner)); // which scanner
        assert.match(trace.page.submittedUrl, /^https?:\/\//);       // which page
      }
    }
  });

  test('an Open Scans finding resolves to the exact record via its pointer', () => {
    const raw = fs.readFileSync(path.join(osDir, 'report.json'), 'utf8');
    const report = JSON.parse(raw);
    const parsed = parseOpenScansReportJson(raw);
    const tasks = buildTasksFromObservations(parsed.observations, parsed.totalPages);

    // Take the first observation of the first task and walk its pointer into the
    // original artifact; the located record must match the observation's rule.
    const obs = tasks[0].observations[0];
    const pointer = obs.source.recordPointer; // e.g. /results/0/axe/failures/1
    const [, , pageIdx, engine, , failIdx] = pointer.split('/');
    const record = report.results[Number(pageIdx)][engine].failures[Number(failIdx)];
    assert.equal(record.rule, obs.rule.sourceRuleId);
    assert.equal(record.patternId, obs.identity.sourcePatternId);
  });

  test('every Oobee finding traces to source report, record, scanner, and page', () => {
    const parsed = parseOobeeReportCsv(fs.readFileSync(path.join(oobeeDir, 'report.csv'), 'utf8'));
    const tasks = buildTasksFromObservations(parsed.observations, parsed.totalPages);
    assert.ok(tasks.length > 0);

    for (const task of tasks) {
      const { complete, gaps } = verifyFindingProvenance(task);
      assert.equal(complete, true, `provenance gaps: ${JSON.stringify(gaps)}`);

      for (const trace of traceFinding(task)) {
        assert.equal(trace.sourceReport.system, 'oobee');
        assert.equal(trace.sourceReport.format, 'report.csv');
        assert.match(trace.originalRecord.pointer, /^row:\d+$/);
        // Oobee has no upstream finding id; the derived composite pins the row.
        assert.ok(trace.originalRecord.findingId.includes('|'));
        assert.ok(trace.scanner.startsWith('oobee'));
        assert.match(trace.page.submittedUrl, /^https?:\/\//);
      }
    }
  });

  test('verifyFindingProvenance flags a finding whose observation lost its source', () => {
    const brokenTask = {
      observations: [{
        source: { system: null, format: null },
        provenance: { scanner: null, sourceRecordIndex: null },
        identity: { sourceFindingId: null },
        page: { submittedUrl: '', finalUrl: '' }
      }]
    };
    const { complete, gaps } = verifyFindingProvenance(brokenTask);
    assert.equal(complete, false);
    const axes = gaps.map(g => g.axis);
    assert.ok(axes.includes('source-report'));
    assert.ok(axes.includes('original-record'));
    assert.ok(axes.includes('scanner'));
    assert.ok(axes.includes('page'));
  });

  test('adversarial: null source identity + bogus pointer must NOT verify', () => {
    // The exact reviewer reproducer: no scanId/originalRef, and a syntactically
    // valid but fabricated pointer. Existence alone must not satisfy the gate.
    const bogus = {
      observations: [{
        source: { system: 'oobee', format: 'report.csv', scanId: null, originalRef: null, recordPointer: 'row:999999' },
        provenance: { scanner: 'oobee/axe', sourceRecordIndex: null },
        identity: { sourceFindingId: null },
        page: { submittedUrl: 'https://x/y' }
      }]
    };
    const { complete, gaps } = verifyFindingProvenance(bogus);
    assert.equal(complete, false);
    assert.ok(gaps.some(g => g.axis === 'source-report'));
  });

  test('malformed record pointer is rejected', () => {
    const bad = {
      observations: [{
        source: { system: 'open-scans', format: 'report.json', originalRef: 'report.json', recordPointer: 'not-a-pointer' },
        provenance: { scanner: 'axe' },
        identity: { sourceFindingId: null },
        page: { submittedUrl: 'https://x/y' }
      }]
    };
    const { complete, gaps } = verifyFindingProvenance(bad);
    assert.equal(complete, false);
    assert.ok(gaps.some(g => g.axis === 'original-record'));
  });

  test('resolver-based verification requires a registered, resolvable report', () => {
    const parsed = parseOpenScansReportJson(fs.readFileSync(path.join(osDir, 'report.json'), 'utf8'));
    // Stamp a source-report id the way the loader does.
    for (const o of parsed.observations) o.source.sourceReportId = 'src-open-scans-abcd1234';
    const tasks = buildTasksFromObservations(parsed.observations, parsed.totalPages);

    const registry = { 'src-open-scans-abcd1234': { id: 'src-open-scans-abcd1234' } };
    const resolve = id => registry[id] || null;

    // Resolves -> complete.
    assert.equal(verifyFindingProvenance(tasks[0], { resolveSourceReport: resolve }).complete, true);
    // Unknown registry -> fails on source-report.
    const bad = verifyFindingProvenance(tasks[0], { resolveSourceReport: () => null });
    assert.equal(bad.complete, false);
    assert.ok(bad.gaps.some(g => g.axis === 'source-report'));
  });
});
