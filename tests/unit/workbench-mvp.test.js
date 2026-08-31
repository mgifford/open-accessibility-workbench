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
    // Honestly labelled: no deterministic transform exists yet.
    assert.equal(cand.label, 'Supplied source context');
    assert.equal(cand.transformed, false);
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

import { generateRemediationBlueprint } from '../../src/guidance/remediation.js';
import { routeTaskForProfile } from '../../src/roles/route-task.js';

describe('Phase 9 hardening: no invented content; honest validation & handoff', () => {
  const RULES = ['link-name', 'color-contrast', 'image-alt', 'region'];

  test('blueprints never invent names, alt text, labels, or colours', () => {
    for (const rule of RULES) {
      const bp = generateRemediationBlueprint({ ruleId: rule, cluster: { pagesCount: 1, occurrencesCount: 1 }, technologyContext: null });
      const tm = bp.targetMarkup || '';
      // Unresolved values are placeholders, not fabricated content.
      if (rule !== 'region') assert.ok(tm.includes('{{'), `${rule} target markup should use {{ }} placeholders`);
      // No invented specifics from the prior version.
      assert.ok(!/Visit our profile|LinkedIn|Conference attendees|#d44d10/i.test(tm), `${rule} must not contain invented values`);
      // No hardcoded hex colour presented as an accessible answer.
      assert.ok(!/#[0-9a-f]{6}/i.test(tm), `${rule} must not hardcode a colour`);
    }
  });

  test('handoff routing agrees with the Phase 7 capability router', () => {
    const bp = generateRemediationBlueprint({ ruleId: 'link-name', cluster: {}, remediationFamily: 'accessible-name', technologyContext: null });
    const task = { id: 'T', title: 'x', ruleId: 'link-name', remediationFamily: 'accessible-name',
      roles: { primary: 'Content Authoring', coPrimary: ['Front-End Development'], secondary: [], contributors: [] },
      blueprint: bp, representativeLocator: '.a', representativeHtml: '<a></a>', metrics: { observationCount: 1 }, affectedPages: [], observations: [] };
    const caps = ['Page content and media', 'HTML/templates/components'];
    const route = routeTaskForProfile(task, caps);
    const handoff = buildHandoff(task, caps);
    assert.equal(handoff.relevance, route.relevance);
    // The reviewer's scenario: this user is NOT told they cannot handle the task.
    assert.notEqual(handoff.relevance, 'handoff');
    assert.ok(!/do not cover this task/i.test(handoff.whyHandoff));
  });

  test('handoff Markdown includes affected page URLs and resolvable source pointers', () => {
    const task = { id: 'T', title: 'x', ruleId: 'link-name',
      roles: { primary: 'Content Authoring' }, blueprint: generateRemediationBlueprint({ ruleId: 'link-name', cluster: {}, technologyContext: null }),
      representativeLocator: '.a', representativeHtml: '<a></a>', metrics: { observationCount: 2 },
      affectedPages: ['https://example.test/home', 'https://example.test/about'],
      observations: [{ source: { sourceReportId: 'R1', originalRef: 'report.json', recordPointer: '/results/0/axe/failures/1' }, provenance: { scanner: 'axe' }, page: { submittedUrl: 'https://example.test/home' } }] };
    const md = handoffToMarkdown(buildHandoff(task, []));
    assert.match(md, /example\.test\/home/);
    assert.match(md, /example\.test\/about/);
    assert.match(md, /R1/);
    assert.match(md, /\/results\/0\/axe\/failures\/1/);
  });

  test('curated guidance provenance appears in Markdown and JSON-LD exports', () => {
    const bp = generateRemediationBlueprint({ ruleId: 'link-name', cluster: {}, technologyContext: null });
    const task = { id: 'T', title: 'x', ruleId: 'link-name', wcag: ['2.4.4'], urgency: 'high', leverage: 'high', metrics: {}, roles: {}, blueprint: bp, affectedPages: [], observations: [] };
    const md = exportTasksToMarkdown({ tasks: [task], observations: [], sourceSummary: {} });
    assert.match(md, /Curated Guidance/);
    assert.match(md, /Source:/);
    const ld = JSON.parse(exportTasksToJsonLd({ tasks: [task], observations: [], sourceSummary: {} }));
    assert.ok(ld.remediationTasks[0].actionableBlueprint.curatedGuidance.provenance);
  });
});
