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
import { decompressGzipB64 } from '../../src/adapters/oobee/decompress.js';
import zlib from 'node:zlib';

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
    assert.equal(goodToFix[0].rule.normalizedRuleId, 'color-contrast-enhanced');
    assert.equal(needsReview[0].rule.normalizedRuleId, 'image-alt');
  });

  test('Phase 3 gate: a finding retains all required Oobee fields', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report.csv'), 'utf8');
    const result = parseOobeeReportCsv(raw);

    // The needsReview image-alt finding on the home page exercises every field
    // the Phase 3 gate requires a finding to retain.
    const obs = result.observations.find(
      o => o.rule.sourceRuleId === 'image-alt' && /\/home$/.test(o.page.submittedUrl)
    );
    assert.ok(obs, 'image-alt home finding present');

    // severity category
    assert.equal(obs.classification.sourceCategory, 'needsReview');
    // issue ID (Oobee's issueId)
    assert.equal(obs.rule.sourceRuleId, 'image-alt');
    // context (the rendered HTML snippet)
    assert.equal(obs.evidence.renderedHtml, '<img class="hero-banner" src="/assets/banner.jpg">');
    // XPath
    assert.equal(obs.evidence.locator, '/html/body/main/div[1]/img');
    assert.equal(obs.evidence.locatorType, 'xpath');
    // howToFix (scanner guidance)
    assert.match(obs.evidence.scannerGuidance, /empty alt attribute/);
    // axe impact (retained as reported, not fabricated)
    assert.equal(obs.classification.impact, 'moderate');
    assert.equal(obs.classification.impactSource, 'scanner');
    // WCAG
    assert.ok(obs.rule.wcag.includes('1.1.1'));
    // page
    assert.equal(obs.page.submittedUrl, 'https://example.gov.sg/home');
    assert.equal(obs.page.title, 'Home | GovTech');
    // learnMore preserved as help URL
    assert.match(obs.evidence.helpUrl, /image-alt$/);
  });

  test('does not fabricate an axe impact when Oobee omits one', () => {
    // A row with an empty axeImpact must not be assigned a severity-derived
    // impact; it stays null with impactSource "none".
    const csv =
      'severity,issueId,issueDescription,wcagConformance,url,pageTitle,context,howToFix,axeImpact,xpath,learnMore\n' +
      'mustFix,link-name,Links must have discernible text,wcag2a,https://x/y,Y,<a></a>,Fix it,,//a,https://help';
    const parsed = parseOobeeReportCsv(csv);
    const obs = parsed.observations[0];
    assert.equal(obs.classification.impact, null);
    assert.equal(obs.classification.impactSource, 'none');
  });

  test('parses Oobee wcagConformance tokens into dotted success criteria', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'report.csv'), 'utf8');
    const result = parseOobeeReportCsv(raw);

    // wcag2a,wcag244,wcag412 -> ["2.4.4", "4.1.2"] (bare level token dropped)
    const linkName = result.observations.find(o => o.rule.normalizedRuleId === 'link-name');
    assert.ok(linkName.rule.wcag.includes('2.4.4'));
    assert.ok(linkName.rule.wcag.includes('4.1.2'));
    assert.equal(linkName.classification.wcagLevel, 'A');

    // wcag2aaa,wcag146 -> AAA level, SC 1.4.6
    const enhanced = result.observations.find(o => o.rule.normalizedRuleId === 'color-contrast-enhanced');
    assert.ok(enhanced.rule.wcag.includes('1.4.6'));
    assert.equal(enhanced.classification.wcagLevel, 'AAA');
  });

  test('correctly parses Oobee scanItemsSummary.json category objects', () => {
    const itemsRaw = fs.readFileSync(path.join(fixturesDir, 'scanItemsSummary.json'), 'utf8');
    const items = parseOobeeItemsSummary(itemsRaw);
    // Categories are objects upstream; totals are read from within them.
    assert.equal(items.mustFix, 2);
    assert.equal(items.goodToFix, 1);
    assert.equal(items.needsReview, 1);
    assert.equal(items.totalItems, 4);
    assert.equal(items.totalPagesScanned, 2);
  });

  test('correctly parses Oobee scanIssuesSummary.json categorized arrays', () => {
    const issuesRaw = fs.readFileSync(path.join(fixturesDir, 'scanIssuesSummary.json'), 'utf8');
    const issues = parseOobeeIssuesSummary(issuesRaw);
    // 3 distinct rules across mustFix/goodToFix/needsReview; passed is empty.
    assert.equal(issues.issues.length, 3);
    const byCategory = issues.issues.map(i => i.category);
    assert.ok(byCategory.includes('mustFix'));
    assert.ok(byCategory.includes('goodToFix'));
    assert.ok(byCategory.includes('needsReview'));
  });

  test('handles a valid Oobee issues summary with all categories empty', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'scanIssuesSummary.empty.json'), 'utf8');
    const issues = parseOobeeIssuesSummary(raw);
    assert.equal(issues.system, 'oobee');
    assert.equal(issues.issues.length, 0);
  });

  test('correctly parses Oobee scanPagesSummary.json affected/not-affected pages', () => {
    const pagesSummaryRaw = fs.readFileSync(path.join(fixturesDir, 'scanPagesSummary.json'), 'utf8');
    const pagesSummary = parseOobeePagesSummary(pagesSummaryRaw);
    assert.equal(pagesSummary.scannedPagesCount, 2);
    assert.equal(pagesSummary.pagesAffected.length, 2);
    assert.equal(pagesSummary.pagesNotAffected.length, 0);
  });

  test('decompresses a base64-gzip (.json.gz.b64) Oobee payload', async () => {
    // Round-trip a real Oobee summary through gzip+base64, then decompress and
    // parse it — the compressed-format path must recover the exact JSON.
    const original = fs.readFileSync(path.join(fixturesDir, 'scanItemsSummary.json'), 'utf8');
    const b64 = zlib.gzipSync(Buffer.from(original)).toString('base64');

    const restored = await decompressGzipB64(b64);
    assert.equal(restored, original);

    // And the decompressed text still parses through the normal adapter.
    const items = parseOobeeItemsSummary(restored);
    assert.equal(items.totalItems, 4);
  });

  test('correctly parses Oobee scanPagesDetail.json per-page breakdown', () => {
    const pagesDetailRaw = fs.readFileSync(path.join(fixturesDir, 'scanPagesDetail.json'), 'utf8');
    const pagesDetail = parseOobeePagesDetail(pagesDetailRaw);
    assert.equal(pagesDetail.pages.length, 2);
    // Detail pages carry a per-rule breakdown under typesOfIssues.
    const home = pagesDetail.pages.find(p => /\/home$/.test(p.url));
    assert.ok(Array.isArray(home.typesOfIssues));
    assert.equal(home.typesOfIssues[0].ruleId, 'link-name');
  });
});
