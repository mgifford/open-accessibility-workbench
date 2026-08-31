import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkFileSize, capField, MAX_FIELD_CHARS, MAX_FILE_BYTES } from '../../src/utils/input-limits.js';
import { parseOobeeReportCsv } from '../../src/adapters/oobee/report-csv.js';
import { parseOpenScansReportJson } from '../../src/adapters/open-scans/report-json.js';
import { detectReportSource } from '../../src/adapters/detect-source.js';

describe('Phase 13: input-size hardening (§13.3/§13.6)', () => {
  test('a report over the hard limit is refused with an understandable error', () => {
    const big = 'x'.repeat(MAX_FILE_BYTES + 1);
    const r = checkFileSize(big);
    assert.equal(r.ok, false);
    assert.match(r.error, /above the .* limit/i);
  });

  test('a large-but-allowed report warns without blocking', () => {
    const r = checkFileSize('y'.repeat(9 * 1024 * 1024));
    assert.equal(r.ok, true);
    assert.equal(r.warn, true);
  });

  test('a gigantic individual field is truncated with a marker', () => {
    const huge = 'a'.repeat(MAX_FIELD_CHARS + 5000);
    const capped = capField(huge);
    assert.ok(capped.length < huge.length);
    assert.match(capped, /truncated: \d+ more characters/);
    // A normal field is untouched.
    assert.equal(capField('<a></a>'), '<a></a>');
  });

  test('a gigantic HTML field in an Oobee row is capped during normalization', () => {
    const huge = 'z'.repeat(MAX_FIELD_CHARS + 1000);
    const csv =
      'severity,issueId,issueDescription,wcagConformance,url,pageTitle,context,howToFix,axeImpact,xpath,learnMore\n' +
      `mustFix,link-name,d,wcag2a,https://x/y,Y,"${huge}",Fix,serious,//a,https://h`;
    const parsed = parseOobeeReportCsv(csv);
    assert.ok(parsed.observations[0].evidence.renderedHtml.length <= MAX_FIELD_CHARS + 100);
    assert.match(parsed.observations[0].evidence.renderedHtml, /truncated/);
  });
});

describe('Phase 13: large report processing (generated fixture)', () => {
  test('a synthetic large Open Scans report (1000 findings) parses and reduces', () => {
    // Generate a large report in-memory rather than committing a big binary.
    const failures = [];
    for (let i = 0; i < 1000; i++) {
      failures.push({
        rule: 'link-name', impact: 'serious', wcagSc: ['wcag2a', 'wcag244'],
        xpath: `.social-link-${i % 5}`, // 5 recurring shapes -> should consolidate
        html: `<a class="social-link-${i % 5}"><span class="fa fa-x"></span></a>`,
        message: 'Links must have discernible text', patternId: `A11Y-${i % 5}`
      });
    }
    const report = {
      issueNumber: 1, engines: ['axe'],
      results: [{ submittedUrl: 'https://x/', finalUrl: 'https://x/', pageTitle: 'X',
        axe: { executed: true, counts: { failed: 1000 }, failedRules: ['link-name'], failures } }]
    };
    const parsed = parseOpenScansReportJson(JSON.stringify(report));
    assert.equal(parsed.observations.length, 1000);
    // Detection recognizes it as Open Scans JSON.
    assert.equal(detectReportSource(JSON.stringify(report), 'report.json').type, 'open-scans-json');
  });
});

import { clearLocalData, listStoredData } from '../../src/state/local-data.js';

describe('Phase 13: local data clearing (§13.2)', () => {
  test('clears only preference keys; never throws without localStorage', () => {
    const mem = new Map();
    globalThis.localStorage = {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: k => mem.delete(k)
    };
    mem.set('oaw_capability_profile', '{}');
    mem.set('oaw.technology.v1', '{}');
    mem.set('unrelated_key', 'keep me');

    assert.equal(listStoredData().length, 2);
    const { removed } = clearLocalData();
    assert.equal(removed, 2);
    assert.equal(mem.get('unrelated_key'), 'keep me'); // untouched
    assert.equal(listStoredData().length, 0);

    delete globalThis.localStorage;
    assert.doesNotThrow(() => clearLocalData()); // no storage -> no throw
  });
});
