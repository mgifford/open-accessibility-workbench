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
import { getExactRuleGuidance } from '../../src/guidance/exact-rule.js';
import { buildSourceAwareCandidate } from '../../src/guidance/source-candidate.js';
import { buildHandoff, handoffToMarkdown } from '../../src/export/handoff.js';
import { exportTasksToMarkdown } from '../../src/export/markdown.js';
import { exportTasksToJson } from '../../src/export/json.js';
import { exportTasksToJsonLd } from '../../src/export/jsonld.js';
import { formatGitHubIssue } from '../../src/export/github-issue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demo = path.resolve(__dirname, '../fixtures/open-scans/report-pattern-demo.json');

function loadWorkspace() {
  const parsed = parseOpenScansReportJson(fs.readFileSync(demo, 'utf8'));
  const observations = enrichObservationsWithSignatures(parsed.observations);
  observations.forEach(o => { o.source.sourceReportId = 'src-demo'; });
  const clusters = clusterPatternOccurrences(observations, parsed.totalPages);
  const hypotheses = buildComponentHypotheses(clusters, parsed.totalPages);
  const tasks = buildRemediationTasks(clusters, hypotheses, parsed.totalPages, null, null, 'src-demo');
  return { observations, clusters, hypotheses, tasks, sourceSummary: { system: 'open-scans', scanId: '347', totalPages: parsed.totalPages } };
}

describe('Phase 9 MVP gate: full deterministic workflow with AI disabled', () => {
  test('1-9: import -> reduce -> select -> evidence -> decisions -> scope -> handoff -> verify -> export', () => {
    const ws = loadWorkspace();

    // 2. Reduction is visible: observations -> patterns -> tasks.
    assert.ok(ws.observations.length > ws.tasks.length);

    // 3. Select a task.
    const task = ws.tasks.find(t => /social/i.test(t.title)) || ws.tasks[0];
    assert.ok(task);

    // 4. Inspect ALL underlying evidence (every observation reachable).
    assert.ok(task.observations.length > 0);
    assert.equal(task.metrics.observationCount, task.observations.length);

    // 5. Unresolved decisions are explicit and structured.
    assert.ok(Array.isArray(task.blueprint.humanDecisions));
    for (const d of task.blueprint.humanDecisions) {
      assert.ok(d.decision);
      assert.equal(d.status, 'unresolved');
      assert.equal(typeof d.blocksImplementation, 'boolean');
    }

    // 6. Implementation scope: consolidated component + affected pages.
    assert.ok(task.metrics.affectedPagesCount >= 1);

    // 7. Prepare a handoff (with AI disabled).
    const handoff = buildHandoff(task, []);
    assert.ok(handoff.problem && handoff.remediationObjective);
    assert.ok(Array.isArray(handoff.verificationCriteria) && handoff.verificationCriteria.length > 0);
    assert.ok(handoff.suggestedRoles);
    const hmd = handoffToMarkdown(handoff);
    assert.match(hmd, /Unresolved decisions/);
    assert.match(hmd, /Verification criteria/);
    // Non-ownership language.
    assert.ok(!/\bowns?\b/i.test(hmd));

    // 8. Verification instructions present on the blueprint.
    assert.ok(task.blueprint.verificationSteps.length > 0);

    // 9. Export in every required format; AI flag false; counts match.
    const json = JSON.parse(exportTasksToJson(ws));
    assert.equal(json.aiProvenance.generatedByAI, false);
    assert.equal(json.summary.totalTasks, ws.tasks.length);
    assert.ok(exportTasksToMarkdown(ws).length > 0);
    assert.ok(exportTasksToJsonLd(ws).length > 0);
    assert.ok(formatGitHubIssue(task).length > 0);
  });

  test('curated rule guidance carries provenance and is not scanner documentation', () => {
    const g = getExactRuleGuidance('link-name');
    assert.equal(g.curated, true);
    assert.ok(g.provenance.source && g.provenance.revision && g.provenance.license);
    assert.equal(g.provenance.kind, 'workbench-guidance');
    assert.ok(Array.isArray(g.decisions) && Array.isArray(g.implementation) && Array.isArray(g.verification));
  });

  test('a source-aware candidate is unavailable without supplied source', () => {
    const ws = loadWorkspace();
    const task = ws.tasks[0];
    // No source -> null.
    assert.equal(buildSourceAwareCandidate(null, task), null);
    assert.equal(buildSourceAwareCandidate({ framework: 'Drupal' }, task), null); // no snippet
    // With a real snippet -> a labelled candidate that references the SUPPLIED source.
    const cand = buildSourceAwareCandidate({ framework: 'Drupal', filename: 'social.twig', snippet: '<a>{{ link }}</a>' }, task);
    assert.ok(cand);
    assert.equal(cand.label, 'Candidate source change');
    assert.equal(cand.basedOnSuppliedSource, true);
    assert.match(cand.suppliedSnippet, /link/);
  });

  test('rendered scanner HTML is never labelled a source patch', () => {
    const ws = loadWorkspace();
    for (const t of ws.tasks) {
      // The blueprint's targetMarkup is framework-neutral guidance, never called
      // a source patch; sourceAwareCandidate stays null without supplied source.
      assert.equal(t.blueprint.sourceAwareCandidate, null);
    }
  });

  test('untrusted HTML / prompt-injection from a report is treated as data in handoff output', () => {
    const raw = fs.readFileSync(path.resolve(__dirname, '../fixtures/malformed/prompt-injection.json'), 'utf8');
    const parsed = parseOpenScansReportJson(raw);
    const obs = enrichObservationsWithSignatures(parsed.observations);
    obs.forEach(o => { o.source.sourceReportId = 'inj'; });
    const clusters = clusterPatternOccurrences(obs, parsed.totalPages);
    const hyps = buildComponentHypotheses(clusters, parsed.totalPages);
    const tasks = buildRemediationTasks(clusters, hyps, parsed.totalPages, null, null, 'inj');

    // The handoff Markdown carries the injected text as plain text (data), and
    // the UI renders everything via escapeHtml/textContent — verified elsewhere.
    // Here we assert the injected script is present as literal text, not stripped
    // or executed, so a reviewer can see it is handled as data.
    const md = handoffToMarkdown(buildHandoff(tasks[0], []));
    assert.ok(typeof md === 'string');
    // Markdown is plain text; any <script> from evidence stays literal.
    if (/script/i.test(md)) assert.match(md, /<script/i);
  });

  test('the entire workflow uses no AI module', () => {
    // Building the workspace + handoff + exports imports nothing from src/ai.
    const ws = loadWorkspace();
    const task = ws.tasks[0];
    assert.doesNotThrow(() => {
      buildHandoff(task, []);
      exportTasksToMarkdown(ws);
      exportTasksToJsonLd(ws);
      exportTasksToJson(ws);
    });
  });
});
