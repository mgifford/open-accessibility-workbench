import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, escapeAttr, safeUrl } from '../../src/utils/escape-html.js';

describe('HTML escaping for untrusted report data', () => {
  test('escapeHtml neutralizes tags in report-derived values', () => {
    // Reproduces the reviewer's harness: an <img> in a rule id must not survive
    // as live markup.
    const malicious = '<img src=x onerror=alert(1)>';
    const out = escapeHtml(malicious);
    assert.ok(!out.includes('<img'), 'no live <img>');
    assert.equal(out, '&lt;img src=x onerror=alert(1)&gt;');
  });

  test('escapeHtml handles null/undefined/non-strings', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(42), '42');
  });

  test('escapeAttr also escapes quotes so attributes cannot be broken out of', () => {
    const out = escapeAttr('" onmouseover="alert(1)');
    assert.ok(!out.includes('"'), 'no raw double-quote');
    assert.equal(out, '&quot; onmouseover=&quot;alert(1)');
  });

  test('safeUrl blocks active schemes but allows http/https/relative', () => {
    assert.equal(safeUrl('javascript:alert(1)'), '#');
    assert.equal(safeUrl('data:text/html,<script>'), '#');
    assert.equal(safeUrl('vbscript:msgbox'), '#');
    assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
    assert.equal(safeUrl('http://example.com'), 'http://example.com');
    assert.equal(safeUrl('/relative/path'), '/relative/path');
    assert.equal(safeUrl('#anchor'), '#anchor');
    assert.equal(safeUrl('mailto:a@b.com'), 'mailto:a@b.com');
    assert.equal(safeUrl(''), '#');
    assert.equal(safeUrl(null), '#');
    // Case/whitespace evasion is handled.
    assert.equal(safeUrl('  JavaScript:alert(1)'), '#');
  });
});
