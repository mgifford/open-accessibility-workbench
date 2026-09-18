import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { exportTasksToJson } from '../../src/export/json.js';
import { exportTasksToJsonLd } from '../../src/export/jsonld.js';
import { exportTasksToMarkdown } from '../../src/export/markdown.js';
import { formatGitHubIssue } from '../../src/export/github-issue.js';

describe('Export Schemas & Provenance Transparency', () => {
  const sampleWorkspace = {
    sourceSummary: { system: 'open-scans', scanId: '347', totalPages: 2 },
    observations: [{ id: 'obs-1' }, { id: 'obs-2' }],
    tasks: [
      {
        id: 'TASK-link-name-1',
        title: 'Provide accessible names for icon links',
        ruleId: 'link-name',
        wcag: ['2.4.4', '4.1.2'],
        urgency: 'serious',
        leverage: 'high',
        metrics: { observationCount: 2, affectedPagesCount: 2 },
        roles: { primary: 'Front-End Development', secondary: ['Content Authoring'], source: 'W3C ARRM' },
        componentHypothesis: { name: 'Shared Social Links', confidence: 'high', rationale: 'Repeats across pages' },
        blueprint: {
          problem: 'Links lack text.',
          systemicRationale: 'Repeats on all pages.',
          likelyRootCause: 'Template issue.',
          whatNeedsToChange: 'Add aria-label.',
          humanDecisionsRequired: ['Confirm label.'],
          targetMarkup: '<a href="#" aria-label="LinkedIn"></a>',
          verificationSteps: ['Check name.']
        },
        affectedPages: ['https://example.com/1', 'https://example.com/2'],
        representativeLocator: '.social-link',
        representativeHtml: '<a href="#"></a>',
        observations: [
          {
            id: 'obs-1',
            source: { recordPointer: '/results/0/axe/failures/1', originalRef: 'report.json', scanId: '347' },
            provenance: { scanner: 'axe' },
            page: { submittedUrl: 'https://example.com/1' },
            evidence: { locator: '.social-link' },
            duplicate: { isDuplicate: false }
          }
        ]
      }
    ],
    aiProvenance: { generatedByAI: false, model: null, runtime: null }
  };

  test('JSON export includes complete provenance and task lineage', () => {
    const jsonStr = exportTasksToJson(sampleWorkspace);
    const parsed = JSON.parse(jsonStr);

    assert.equal(parsed.workbenchVersion, '0.1.0');
    assert.equal(parsed.aiProvenance.generatedByAI, false);
    assert.equal(parsed.tasks.length, 1);
    assert.equal(parsed.tasks[0].id, 'TASK-link-name-1');
  });

  test('JSON export embeds finding-level provenance (record pointers) per task', () => {
    const parsed = JSON.parse(exportTasksToJson(sampleWorkspace));
    const obs = parsed.tasks[0].observations;
    assert.equal(obs.length, 1, 'the task carries its constituent observations');
    assert.equal(obs[0].recordPointer, '/results/0/axe/failures/1', 'traceable back to the source record');
    assert.equal(obs[0].scanner, 'axe');
    assert.equal(obs[0].sourceReport, 'report.json');
    assert.equal(obs[0].page, 'https://example.com/1');
    assert.equal(obs[0].locator, '.social-link');
  });

  test('JSON-LD export uses real schema.org vocabulary and verified WCAG URLs', () => {
    const jsonLdStr = exportTasksToJsonLd(sampleWorkspace);
    const parsed = JSON.parse(jsonLdStr);

    // @context points at the real, resolvable schema.org vocabulary — not an
    // invented namespace.
    assert.equal(parsed['@context']['@vocab'], 'https://schema.org/');
    assert.equal(parsed['@type'], 'ItemList');

    const task = parsed.itemListElement[0].item;
    assert.equal(task['@type'], 'Action');
    assert.equal(task.identifier, 'TASK-link-name-1');

    // WCAG criteria are DefinedTerms with verified Understanding URLs.
    const sc244 = task.object.find(o => o.termCode === '2.4.4');
    assert.equal(sc244.url, 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html');
    assert.equal(sc244.name, 'Link Purpose (In Context)');
  });

  test('JSON-LD never emits a fabricated URL for an unknown criterion', () => {
    const ws = {
      tasks: [{ id: 'T', title: 'x', wcag: ['9.9.9'], blueprint: {} }],
      observations: [], sourceSummary: {}
    };
    const parsed = JSON.parse(exportTasksToJsonLd(ws));
    const term = parsed.itemListElement[0].item.object[0];
    assert.equal(term.termCode, '9.9.9');
    // No verified slug -> no url at all, rather than a link that would 404.
    assert.equal(term.url, undefined);
  });

  test('Markdown and GitHub issue exports format clean handoffs', () => {
    const md = exportTasksToMarkdown(sampleWorkspace);
    assert.ok(md.includes('# Accessibility Remediation Plan'));
    assert.ok(md.includes('### [TASK-link-name-1]'));

    const gh = formatGitHubIssue(sampleWorkspace.tasks[0]);
    assert.ok(gh.includes('## Accessibility Remediation Task: Provide accessible names for icon links'));
    assert.ok(gh.includes('### Decisions Required Before Implementation'));
  });
});
