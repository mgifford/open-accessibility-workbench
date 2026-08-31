import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { contentHash, makeSourceReport, SourceReportRegistry } from '../../src/analysis/source-registry.js';
import { parseOobeeReportCsv } from '../../src/adapters/oobee/report-csv.js';

describe('Source-report registry & durable identity', () => {
  test('content hash is stable and distinguishes different content', () => {
    assert.equal(contentHash('abc'), contentHash('abc'));
    assert.notEqual(contentHash('abc'), contentHash('abd'));
  });

  test('same filename + different content yields distinct source-report ids', () => {
    const a = makeSourceReport({ filename: 'report.csv', system: 'oobee', format: 'report.csv', rawContent: 'row-a' });
    const b = makeSourceReport({ filename: 'report.csv', system: 'oobee', format: 'report.csv', rawContent: 'row-b' });
    assert.notEqual(a.id, b.id);
    assert.equal(a.filename, b.filename); // same name, still distinguishable by id/hash
  });

  test('registry dedupes by id and lists reports', () => {
    const reg = new SourceReportRegistry();
    const r = makeSourceReport({ filename: 'x.json', system: 'open-scans', format: 'report.json', rawContent: 'same' });
    reg.register(r);
    reg.register({ ...r }); // same id
    assert.equal(reg.list().length, 1);
    assert.equal(reg.get(r.id).filename, 'x.json');
  });

  test('two identical Oobee rows receive distinct derived finding ids', () => {
    // Regression for the collision finding: identical rows must not share an id.
    const csv =
      'severity,issueId,issueDescription,wcagConformance,url,pageTitle,context,howToFix,axeImpact,xpath,learnMore\n' +
      'mustFix,link-name,Links must have discernible text,wcag2a,https://x/y,Y,<a></a>,Fix it,serious,//a,https://help\n' +
      'mustFix,link-name,Links must have discernible text,wcag2a,https://x/y,Y,<a></a>,Fix it,serious,//a,https://help';
    const parsed = parseOobeeReportCsv(csv);
    assert.equal(parsed.observations.length, 2);
    const [a, b] = parsed.observations;
    assert.notEqual(a.identity.sourceFindingId, b.identity.sourceFindingId);
    // Both still expose the human-meaningful descriptor.
    assert.ok(a.identity.sourceFindingId.includes('link-name|https://x/y|//a'));
  });
});
