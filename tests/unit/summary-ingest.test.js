import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectReportSource } from '../../src/adapters/detect-source.js';
import { ingestSummaryFormat } from '../../src/adapters/summary-ingest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const oobeeDir = path.resolve(__dirname, '../fixtures/oobee');
const osDir = path.resolve(__dirname, '../fixtures/open-scans');

function ingest(dir, file) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const detection = detectReportSource(raw, file);
  return { detection, summary: ingestSummaryFormat(detection, raw) };
}

describe('Summary/aggregate format ingestion (Phase 3 application dispatch)', () => {
  test('every Oobee summary JSON is ingested, not rejected', () => {
    const items = ingest(oobeeDir, 'scanItemsSummary.json');
    assert.equal(items.detection.recognized, true);
    assert.equal(items.summary.kind, 'oobee-items');
    assert.equal(items.summary.severityCounts.mustFix, 2);
    assert.equal(items.summary.severityCounts.goodToFix, 1);
    assert.equal(items.summary.severityCounts.needsReview, 1);
    assert.equal(items.summary.totalItems, 4);

    const issues = ingest(oobeeDir, 'scanIssuesSummary.json');
    assert.equal(issues.summary.kind, 'oobee-issues');
    assert.equal(issues.summary.issues.length, 3);

    const pages = ingest(oobeeDir, 'scanPagesSummary.json');
    assert.equal(pages.summary.kind, 'oobee-pages');
    assert.equal(pages.summary.scannedPagesCount, 2);

    const detail = ingest(oobeeDir, 'scanPagesDetail.json');
    assert.equal(detail.summary.kind, 'oobee-pages-detail');
    assert.equal(detail.summary.pages.length, 2);
  });

  test('a standalone Open Scans overlap report is ingested', () => {
    const { summary } = ingest(osDir, 'report-overlap.json');
    assert.equal(summary.kind, 'open-scans-overlap');
    assert.deepEqual(summary.overlap.scannersInUse, ['axe', 'qualweb']);
    assert.equal(summary.overlap.scannerStats.axe.failed, 34);
  });

  test('finding-level formats are NOT treated as summaries (return null)', () => {
    // report.json and Oobee report.csv must fall through to the task pipeline.
    const osJson = ingest(osDir, 'report.json');
    assert.equal(osJson.summary, null);
    const oobeeCsv = ingest(oobeeDir, 'report.csv');
    assert.equal(oobeeCsv.summary, null);
  });
});
