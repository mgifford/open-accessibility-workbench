import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOpenScansReportJson } from '../../src/adapters/open-scans/report-json.js';
import { parseOpenScansOverlapJson } from '../../src/adapters/open-scans/overlap-json.js';
import { parseOpenScansReportCsv } from '../../src/adapters/open-scans/report-csv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures/open-scans');

describe('Open Scans Adapter Contract', () => {
  test('correctly parses detailed report.json and preserves upstream IDs', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report.json'), 'utf8');
    const result = parseOpenScansReportJson(raw);

    assert.equal(result.system, 'open-scans');
    assert.equal(result.scanId, '347');
    assert.equal(result.totalPages, 2);
    assert.ok(result.observations.length > 0);

    const socialLinkObs = result.observations.find(o => o.rule.normalizedRuleId === 'link-name');
    assert.ok(socialLinkObs);
    assert.equal(socialLinkObs.identity.sourcePatternId, 'A11Y-social-links');
    assert.equal(socialLinkObs.identity.a11yPatternDisplayId, 'A11Y-PAT-944A9E5FA4E6');
    assert.equal(socialLinkObs.classification.impact, 'serious');
    assert.ok(socialLinkObs.rule.wcag.includes('2.4.4'));
  });

  test('correctly parses report-overlap.json', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report-overlap.json'), 'utf8');
    const result = parseOpenScansOverlapJson(raw);

    assert.equal(result.system, 'open-scans');
    assert.deepEqual(result.scannersInUse, ['axe', 'qualweb']);
    assert.equal(result.scannerStats.axe.failed, 34);
  });

  test('correctly parses summary report.csv', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report.csv'), 'utf8');
    const result = parseOpenScansReportCsv(raw);

    assert.equal(result.system, 'open-scans');
    assert.equal(result.granularity, 'page');
    assert.equal(result.totalPages, 2);
    assert.equal(result.pages[0].axeFailed, 24);
    assert.deepEqual(result.pages[0].axeFailedRules, ['color-contrast', 'link-name', 'region']);
  });
});
