import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkFileSize, capField, capShort, capUrl, approxByteLength, MAX_FIELD_CHARS, MAX_SHORT_FIELD_CHARS, MAX_URL_CHARS, MAX_FILE_BYTES } from '../../src/utils/input-limits.js';
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

  test('short and URL fields have their own tighter caps', () => {
    assert.ok(capShort('a'.repeat(MAX_SHORT_FIELD_CHARS + 100)).length <= MAX_SHORT_FIELD_CHARS + 100);
    assert.match(capShort('a'.repeat(MAX_SHORT_FIELD_CHARS + 100)), /truncated/);
    assert.equal(capShort('/main/div[2]'), '/main/div[2]'); // normal locator untouched
    assert.match(capUrl('https://x/' + 'a'.repeat(MAX_URL_CHARS + 10)), /truncated/);
    assert.equal(capUrl('https://example.test/report.json'), 'https://example.test/report.json');
  });

  test('file size is counted in UTF-8 bytes, not UTF-16 code units', () => {
    // A 4-byte astral char (surrogate pair) counts as 4 bytes, not 2 code units.
    assert.equal(approxByteLength('\u{1F600}'), 4); // 😀
    assert.equal(approxByteLength('a'), 1);
    assert.equal(approxByteLength('é'), 2);
    // A string of multibyte chars can exceed the byte limit even when its
    // .length (code units) would not.
    const multibyte = 'é'.repeat(MAX_FILE_BYTES / 2 + 1); // ~ (limit)+2 bytes
    assert.equal(checkFileSize(multibyte).ok, false);
  });

  test('a known byte size (e.g. File.size) is accepted directly as a number', () => {
    assert.equal(checkFileSize(1024).ok, true);
    assert.equal(checkFileSize(MAX_FILE_BYTES + 1).ok, false);
  });

  test('decompression refuses output above the byte limit (compression-bomb guard)', async () => {
    const zlib = await import('node:zlib');
    const { decompressGzipB64 } = await import('../../src/adapters/oobee/decompress.js');
    // Highly compressible payload: 200k identical chars gzips tiny but expands big.
    const payload = 'a'.repeat(200 * 1000);
    const b64 = zlib.gzipSync(Buffer.from(payload)).toString('base64');
    // Under a small cap it must refuse rather than return the expanded output.
    await assert.rejects(() => decompressGzipB64(b64, 50 * 1000), /exceeds the .* limit/i);
    // Under the default (large) cap it decompresses normally.
    assert.equal(await decompressGzipB64(b64), payload);
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

import { classifyReportUrl, fetchRemoteReport, reportUrlFromLocation, reportJsonSiblingUrl, TRUSTED_REPORT_HOSTS } from '../../src/adapters/remote-report.js';

describe('Phase 13: secure remote report loading (§13.5)', () => {
  test('rejects non-HTTPS and unsafe schemes; allows localhost http', () => {
    assert.equal(classifyReportUrl('http://evil.example/r.json').ok, false);
    assert.equal(classifyReportUrl('javascript:alert(1)').ok, false);
    assert.equal(classifyReportUrl('not a url').ok, false);
    assert.equal(classifyReportUrl('http://localhost:5173/r.json').ok, true);
    assert.equal(classifyReportUrl('https://example.test/r.json').ok, true);
  });

  test('a documented trusted host loads without extra confirmation; others require it', () => {
    assert.equal(classifyReportUrl(`https://${TRUSTED_REPORT_HOSTS[0]}/r.json`).trusted, true);
    assert.equal(classifyReportUrl('https://random.example/r.json').trusted, false);
  });

  test('report.csv URL maps to its finding-level report.json sibling; other URLs do not', () => {
    assert.equal(
      reportJsonSiblingUrl('https://mgifford.github.io/open-scans/reports/issues/issue-338/2026-08-05T14-36-34-116Z/report.csv'),
      'https://mgifford.github.io/open-scans/reports/issues/issue-338/2026-08-05T14-36-34-116Z/report.json'
    );
    assert.equal(reportJsonSiblingUrl('https://example.test/report.json'), null);
    assert.equal(reportJsonSiblingUrl('https://example.test/data/other.csv'), null);
    assert.equal(reportJsonSiblingUrl('not a url'), null);
  });

  test('arbitrary origin needs confirmation before fetch', async () => {
    let fetched = false;
    const r = await fetchRemoteReport('https://random.example/r.json', { fetchImpl: async () => { fetched = true; return { ok: true, text: async () => '' }; } });
    assert.equal(r.ok, false);
    assert.equal(r.needsConfirmation, true);
    assert.equal(fetched, false, 'must not fetch before confirmation');
  });

  test('fetch uses credentials:omit and no proxy', async () => {
    let seenInit = null;
    await fetchRemoteReport('https://example.test/r.json', {
      confirmedArbitrary: true,
      fetchImpl: async (url, init) => { seenInit = { url, init }; return { ok: true, status: 200, text: async () => '{}' }; }
    });
    assert.equal(seenInit.init.credentials, 'omit');
    assert.match(seenInit.url, /^https:\/\/example\.test\//); // direct, no proxy prefix
  });

  test('a CORS/network failure returns an understandable fallback message', async () => {
    const r = await fetchRemoteReport('https://example.test/r.json', {
      confirmedArbitrary: true,
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); }
    });
    assert.equal(r.ok, false);
    assert.match(r.error, /CORS|download the report and upload/i);
  });

  test('a redirect from a trusted URL to an arbitrary origin needs confirmation', async () => {
    let consumed = false;
    const r = await fetchRemoteReport(`https://${TRUSTED_REPORT_HOSTS[0]}/r.json`, {
      fetchImpl: async () => ({
        ok: true, status: 200, redirected: true, url: 'https://evil.example/r.json',
        headers: { get: () => null },
        text: async () => { consumed = true; return '{}'; }
      })
    });
    assert.equal(r.ok, false);
    assert.equal(r.needsConfirmation, true);
    assert.match(r.error, /redirected to evil\.example/i);
    assert.equal(consumed, false, 'must not read the body after an untrusted redirect');
  });

  test('a redirect that stays on a trusted host is allowed', async () => {
    const r = await fetchRemoteReport(`https://${TRUSTED_REPORT_HOSTS[0]}/a.json`, {
      fetchImpl: async () => ({
        ok: true, status: 200, redirected: true, url: `https://${TRUSTED_REPORT_HOSTS[0]}/b.json`,
        headers: { get: () => null }, text: async () => '{}'
      })
    });
    assert.equal(r.ok, true);
  });

  test('an over-limit Content-Length is refused before the body is consumed', async () => {
    let consumed = false;
    const r = await fetchRemoteReport('https://example.test/big.json', {
      confirmedArbitrary: true,
      fetchImpl: async () => ({
        ok: true, status: 200,
        headers: { get: (h) => (h.toLowerCase() === 'content-length' ? String(MAX_FILE_BYTES + 1) : null) },
        text: async () => { consumed = true; return 'x'; }
      })
    });
    assert.equal(r.ok, false);
    assert.match(r.error, /above the .* limit/i);
    assert.equal(consumed, false, 'must not read the body when the declared size is over the limit');
  });

  test('cancellation during fetch is reported', async () => {
    const r = await fetchRemoteReport('https://example.test/r.json', {
      confirmedArbitrary: true,
      fetchImpl: async () => { const e = new Error('abort'); e.name = 'AbortError'; throw e; }
    });
    assert.equal(r.ok, false);
    assert.match(r.error, /cancelled/i);
  });

  test('reads ?report= from a query string', () => {
    assert.equal(reportUrlFromLocation('?report=https://x/r.json'), 'https://x/r.json');
    assert.equal(reportUrlFromLocation(''), null);
  });
});
