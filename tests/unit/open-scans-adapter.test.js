import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOpenScansReportJson } from '../../src/adapters/open-scans/report-json.js';
import { parseOpenScansOverlapJson } from '../../src/adapters/open-scans/overlap-json.js';
import { parseOpenScansReportCsv, discoverEngines } from '../../src/adapters/open-scans/report-csv.js';

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
    // scannersInUse lists only the engines that actually ran findings...
    assert.deepEqual(result.scannersInUse, ['axe', 'qualweb']);
    assert.equal(result.scannerStats.axe.failed, 34);
    assert.equal(result.scannerStats.qualweb.failed, 19);
    // ...but scannerStats faithfully includes all five configured scanners,
    // including the ones with zero failures (real upstream shape).
    assert.deepEqual(
      Object.keys(result.scannerStats).sort(),
      ['accesslint', 'alfa', 'axe', 'equalAccess', 'qualweb']
    );
    assert.equal(result.scannerStats.alfa.failed, 0);
    // duplicateFindingTotals is distinct from cross-scanner overlap (0 here).
    assert.equal(result.duplicateFindingTotals, 15);
    assert.deepEqual(result.overlapEntries, []);
  });

  test('correctly parses multi-engine summary report.csv', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report.csv'), 'utf8');
    const result = parseOpenScansReportCsv(raw);

    assert.equal(result.system, 'open-scans');
    assert.equal(result.granularity, 'page');
    assert.equal(result.totalPages, 2);
    // Engines discovered by column prefix, axe first (authoritative).
    assert.equal(result.engines[0], 'axe');
    assert.deepEqual([...result.engines].sort(), ['accesslint', 'alfa', 'axe', 'equal_access', 'qualweb']);
    // Per-engine counts + rule lists live under page.engines[<engine>].
    assert.equal(result.pages[0].engines.axe.failed, 24);
    assert.deepEqual(result.pages[0].engines.axe.failedRules, ['color-contrast', 'link-name', 'region']);
  });

  test('discoverEngines finds engines by column prefix and puts axe first', () => {
    const headers = ['submitted_url', 'alfa_failed', 'alfa_failed_rules', 'axe_failed', 'axe_failed_rules', 'qualweb_failed', 'duplicate_findings'];
    assert.deepEqual(discoverEngines(headers), ['axe', 'alfa', 'qualweb']);
  });

  test('derives rule-only observations from failed_rules, tagging axe as authoritative', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report.csv'), 'utf8');
    const result = parseOpenScansReportCsv(raw);

    // One observation per (page, engine, ruleId) across all engines.
    assert.ok(result.observations.length >= 5, 'observations derived from failed_rules');

    const axeObs = result.observations.filter(o => o.provenance.scanner === 'axe');
    assert.ok(axeObs.length > 0);
    for (const o of axeObs) {
      assert.equal(o.provenance.authoritative, true, 'axe observations are authoritative');
      // Rule-only: the CSV carries no element evidence, and none is invented.
      assert.equal(o.evidence.renderedHtml, '');
      assert.equal(o.evidence.locator, '');
      assert.equal(o.evidence.evidenceLevel, 'rule-only');
      assert.equal(o.classification.impact, null);
      assert.equal(o.classification.impactSource, 'none');
    }

    const qualwebObs = result.observations.filter(o => o.provenance.scanner === 'qualweb');
    assert.ok(qualwebObs.length > 0);
    assert.equal(qualwebObs[0].provenance.authoritative, false, 'supplementary engines are not authoritative');
  });
});
