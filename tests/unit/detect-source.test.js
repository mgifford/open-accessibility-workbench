import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectReportSource, REPORT_TYPES } from '../../src/adapters/detect-source.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('Phase 0 Gate: Source Detection Contract', () => {
  test('accurately identifies Open Scans detailed report.json', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'open-scans/report.json'), 'utf8');
    const result = detectReportSource(content, 'report.json');

    assert.equal(result.recognized, true);
    assert.equal(result.type, REPORT_TYPES.OPEN_SCANS_JSON);
    assert.equal(result.system, 'open-scans');
    assert.equal(result.granularity, 'finding');
    assert.ok(result.parsedData);
    assert.equal(result.parsedData.issueNumber, 347);
  });

  test('accurately identifies Open Scans report-overlap.json', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'open-scans/report-overlap.json'), 'utf8');
    const result = detectReportSource(content, 'report-overlap.json');

    assert.equal(result.recognized, true);
    assert.equal(result.type, REPORT_TYPES.OPEN_SCANS_OVERLAP_JSON);
    assert.equal(result.system, 'open-scans');
    assert.equal(result.granularity, 'overlap');
    assert.deepEqual(result.parsedData.scannersInUse, ['axe', 'qualweb']);
  });

  test('accurately identifies Open Scans summary report.csv', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'open-scans/report.csv'), 'utf8');
    const result = detectReportSource(content, 'report.csv');

    assert.equal(result.recognized, true);
    assert.equal(result.type, REPORT_TYPES.OPEN_SCANS_CSV);
    assert.equal(result.system, 'open-scans');
    assert.equal(result.granularity, 'page');
    assert.ok(Array.isArray(result.parsedData));
    assert.equal(result.parsedData.length, 2);
  });

  test('accurately identifies Oobee finding-level report.csv', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'oobee/report.csv'), 'utf8');
    const result = detectReportSource(content, 'report.csv');

    assert.equal(result.recognized, true);
    assert.equal(result.type, REPORT_TYPES.OOBEE_CSV);
    assert.equal(result.system, 'oobee');
    assert.equal(result.granularity, 'finding');
    assert.ok(Array.isArray(result.parsedData));
    assert.equal(result.parsedData.length, 4);
    assert.equal(result.parsedData[0].severity, 'mustFix');
  });

  test('accurately identifies Oobee scanItemsSummary.json', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'oobee/scanItemsSummary.json'), 'utf8');
    const result = detectReportSource(content, 'scanItemsSummary.json');

    assert.equal(result.recognized, true);
    assert.equal(result.type, REPORT_TYPES.OOBEE_ITEMS_SUMMARY_JSON);
    assert.equal(result.system, 'oobee');
    assert.equal(result.granularity, 'aggregate');
  });

  test('accurately identifies Oobee scanIssuesSummary.json', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'oobee/scanIssuesSummary.json'), 'utf8');
    const result = detectReportSource(content, 'scanIssuesSummary.json');

    assert.equal(result.recognized, true);
    assert.equal(result.type, REPORT_TYPES.OOBEE_ISSUES_SUMMARY_JSON);
    assert.equal(result.system, 'oobee');
  });

  test('accurately identifies Oobee scanPagesSummary.json', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'oobee/scanPagesSummary.json'), 'utf8');
    const result = detectReportSource(content, 'scanPagesSummary.json');

    assert.equal(result.recognized, true);
    assert.equal(result.type, REPORT_TYPES.OOBEE_PAGES_SUMMARY_JSON);
    assert.equal(result.system, 'oobee');
  });

  test('accurately identifies Oobee scanPagesDetail.json', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'oobee/scanPagesDetail.json'), 'utf8');
    const result = detectReportSource(content, 'scanPagesDetail.json');

    assert.equal(result.recognized, true);
    assert.equal(result.type, REPORT_TYPES.OOBEE_PAGES_DETAIL_JSON);
    assert.equal(result.system, 'oobee');
  });

  test('rejects empty input with clear error message', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'malformed/empty.json'), 'utf8');
    const result = detectReportSource(content, 'empty.json');

    assert.equal(result.recognized, false);
    assert.equal(result.type, REPORT_TYPES.UNKNOWN);
    assert.match(result.error, /does not match a supported Open Scans or Oobee report format/);
  });

  test('rejects invalid JSON/CSV without crashing', () => {
    const invalidJson = fs.readFileSync(path.join(fixturesDir, 'malformed/invalid.json'), 'utf8');
    const result1 = detectReportSource(invalidJson, 'invalid.json');
    assert.equal(result1.recognized, false);

    const invalidCsv = fs.readFileSync(path.join(fixturesDir, 'malformed/invalid.csv'), 'utf8');
    const result2 = detectReportSource(invalidCsv, 'invalid.csv');
    assert.equal(result2.recognized, false);
  });

  test('rejects unsupported JSON structure with actionable explanation', () => {
    const unsupported = fs.readFileSync(path.join(fixturesDir, 'malformed/unsupported-structure.json'), 'utf8');
    const result = detectReportSource(unsupported, 'unsupported.json');

    assert.equal(result.recognized, false);
    assert.ok(result.explanation.includes('Supported formats:'));
  });
});
