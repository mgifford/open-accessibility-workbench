import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOobeeReportCsv } from '../../src/adapters/oobee/report-csv.js';
import {
  parseOobeeItemsSummary,
  parseOobeeIssuesSummary,
  parseOobeePagesSummary,
  parseOobeePagesDetail
} from '../../src/adapters/oobee/items-summary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures/oobee');

describe('Oobee Adapter Contract', () => {
  test('correctly parses finding-level report.csv and preserves severity categories', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report.csv'), 'utf8');
    const result = parseOobeeReportCsv(raw);

    assert.equal(result.system, 'oobee');
    assert.equal(result.granularity, 'finding');
    assert.equal(result.observations.length, 4);

    const mustFix = result.observations.filter(o => o.classification.sourceCategory === 'mustFix');
    const goodToFix = result.observations.filter(o => o.classification.sourceCategory === 'goodToFix');
    const needsReview = result.observations.filter(o => o.classification.sourceCategory === 'needsReview');

    assert.equal(mustFix.length, 2);
    assert.equal(goodToFix.length, 1);
    assert.equal(needsReview.length, 1);

    assert.equal(mustFix[0].rule.normalizedRuleId, 'link-name');
    assert.equal(goodToFix[0].rule.normalizedRuleId, 'color-contrast');
    assert.equal(needsReview[0].rule.normalizedRuleId, 'image-alt');
  });

  test('correctly parses Oobee summary JSON reports', () => {
    const itemsRaw = fs.readFileSync(path.join(fixturesDir, 'scanItemsSummary.json'), 'utf8');
    const items = parseOobeeItemsSummary(itemsRaw);
    assert.equal(items.totalItems, 4);
    assert.equal(items.mustFix, 2);

    const issuesRaw = fs.readFileSync(path.join(fixturesDir, 'scanIssuesSummary.json'), 'utf8');
    const issues = parseOobeeIssuesSummary(issuesRaw);
    assert.equal(issues.issues.length, 3);

    const pagesSummaryRaw = fs.readFileSync(path.join(fixturesDir, 'scanPagesSummary.json'), 'utf8');
    const pagesSummary = parseOobeePagesSummary(pagesSummaryRaw);
    assert.equal(pagesSummary.totalPagesScanned, 2);

    const pagesDetailRaw = fs.readFileSync(path.join(fixturesDir, 'scanPagesDetail.json'), 'utf8');
    const pagesDetail = parseOobeePagesDetail(pagesDetailRaw);
    assert.equal(pagesDetail.pages.length, 2);
  });
});
