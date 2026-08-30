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
        representativeHtml: '<a href="#"></a>'
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

  test('JSON-LD export adheres to semantic schema with WCAG URLs', () => {
    const jsonLdStr = exportTasksToJsonLd(sampleWorkspace);
    const parsed = JSON.parse(jsonLdStr);

    assert.equal(parsed['@context'], 'https://open-accessibility-workbench.org/ns/v1.jsonld');
    assert.equal(parsed['@type'], 'AccessibilityRemediationPlan');
    assert.ok(parsed.remediationTasks[0].wcagCriteria[0].includes('https://www.w3.org/WAI/WCAG22/Understanding/'));
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
