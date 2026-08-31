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

    // Real upstream link-name finding (LinkedIn social icon) — preserves the
    // actual upstream pattern identity, not a Workbench-invented one.
    const socialLinkObs = result.observations.find(
      o => o.rule.normalizedRuleId === 'link-name' && /linkedin/.test(o.evidence.locator)
    );
    assert.ok(socialLinkObs);
    assert.equal(socialLinkObs.identity.sourcePatternId, 'A11Y-0fa23e4b');
    assert.equal(socialLinkObs.identity.a11yPatternDisplayId, 'A11Y-PAT-7947E7825C01');
    assert.equal(socialLinkObs.classification.impact, 'serious');
    assert.ok(socialLinkObs.rule.wcag.includes('2.4.4'));
    assert.ok(socialLinkObs.rule.wcag.includes('4.1.2'));
    // The old malformed WCAG parser produced tokens like "2aa"/"2a"; ensure
    // only well-formed dotted success criteria are present.
    for (const sc of socialLinkObs.rule.wcag) {
      assert.match(sc, /^\d+\.\d+(\.\d+)?$/, `malformed WCAG SC: ${sc}`);
    }
  });

  test('preserves QualWeb evidence and distinct upstream pattern identities', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report.json'), 'utf8');
    const result = parseOpenScansReportJson(raw);

    // Phase 0 fixture contract (docs §58): axe AND qualweb both active.
    assert.deepEqual(result.engines, ['axe', 'qualweb']);
    const scanners = new Set(result.observations.map(o => o.provenance.scanner));
    assert.ok(scanners.has('axe'), 'axe findings present');
    assert.ok(scanners.has('qualweb'), 'qualweb findings present');

    // QualWeb ACT rule finding is normalized (QW-ACT-R37 -> color-contrast).
    const qualwebObs = result.observations.find(o => o.provenance.scanner === 'qualweb');
    assert.ok(qualwebObs);
    assert.equal(qualwebObs.rule.sourceRuleId, 'QW-ACT-R37');

    // Distinct upstream pattern IDs are preserved, not collapsed into one.
    const patternIds = new Set(
      result.observations.map(o => o.identity.sourcePatternId).filter(Boolean)
    );
    assert.ok(patternIds.size >= 3, `expected multiple distinct pattern ids, got ${patternIds.size}`);

    // Region finding legitimately has no WCAG SC upstream (empty wcagSc).
    const regionObs = result.observations.find(o => o.rule.normalizedRuleId === 'region');
    assert.ok(regionObs);
    assert.deepEqual(regionObs.rule.wcag, []);
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
