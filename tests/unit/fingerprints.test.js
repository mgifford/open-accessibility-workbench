import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  patternFingerprintOf, occurrenceFingerprintOf, displayAliasFrom,
  jcsCanonicalize, computePatternFingerprint, PATTERN_PROFILE
} from '../../src/analysis/fingerprints.js';

const DIGEST = '7eb7c1914a8fade9544b105baf207a0fb9ee680ed76926daaec6a4ad835554e5';

describe('fingerprints: surfacing scan-supplied identifiers', () => {
  test('patternFingerprintOf reads a cluster/task observation identity', () => {
    const fp = patternFingerprintOf({
      observations: [{ identity: { sourcePatternId: DIGEST, a11yPatternDisplayId: 'A11Y-PAT-7EB7C1914A8F' } }]
    });
    assert.deepEqual(fp, { digest: DIGEST, displayId: 'A11Y-PAT-7EB7C1914A8F', source: 'scan' });
  });

  test('patternFingerprintOf derives the display alias when the report omitted it', () => {
    const fp = patternFingerprintOf({ observations: [{ identity: { sourcePatternId: DIGEST } }] });
    assert.equal(fp.displayId, 'A11Y-PAT-7EB7C1914A8F');
  });

  test('patternFingerprintOf returns null when no identity is present (e.g. rule-only CSV)', () => {
    assert.equal(patternFingerprintOf({ observations: [{ identity: { sourcePatternId: null } }] }), null);
    assert.equal(patternFingerprintOf({ observations: [] }), null);
    assert.equal(patternFingerprintOf({}), null);
  });

  test('occurrenceFingerprintOf reads an observation identity', () => {
    const fp = occurrenceFingerprintOf({ identity: { sourceOccurrenceId: DIGEST, a11yOccurrenceDisplayId: 'A11Y-OCC-7EB7C1914A8F' } });
    assert.equal(fp.displayId, 'A11Y-OCC-7EB7C1914A8F');
    assert.equal(fp.source, 'scan');
  });

  test('displayAliasFrom takes 12 uppercase hex, rejects short input', () => {
    assert.equal(displayAliasFrom(DIGEST, 'PAT'), 'A11Y-PAT-7EB7C1914A8F');
    assert.equal(displayAliasFrom(DIGEST, 'OCC'), 'A11Y-OCC-7EB7C1914A8F');
    assert.equal(displayAliasFrom('short'), null);
    assert.equal(displayAliasFrom(null), null);
  });
});

describe('fingerprints: JCS canonicalization', () => {
  test('sorts object keys and emits no whitespace, recursively', () => {
    assert.equal(jcsCanonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
    assert.equal(jcsCanonicalize({ z: { y: 1, x: 2 }, a: [3, 2] }), '{"a":[3,2],"z":{"x":2,"y":1}}');
  });
  test('is order-independent for the same object', () => {
    assert.equal(
      jcsCanonicalize({ rule: 'r', target: 't', profile: 'p' }),
      jcsCanonicalize({ profile: 'p', target: 't', rule: 'r' })
    );
  });
});

describe('fingerprints: spec-compliant compute (SHA-256 over JCS)', () => {
  test('produces a 64-hex digest and matching 12-hex display alias, marked workbench-derived', async () => {
    const input = { target: { url: 'https://example.com' }, rule: { ns: 'axe-core', id: 'color-contrast' }, locator: 'main > p' };
    const fp = await computePatternFingerprint(input);
    assert.match(fp.digest, /^[0-9a-f]{64}$/);
    assert.equal(fp.displayId, `A11Y-PAT-${fp.digest.slice(0, 12).toUpperCase()}`);
    assert.equal(fp.source, 'workbench-derived');
  });

  test('is deterministic and matches a hand-computed SHA-256 of the canonical input', async () => {
    const input = { target: { url: 'https://example.com' }, rule: { ns: 'axe-core', id: 'color-contrast' }, locator: 'main > p', stateKey: null };
    const a = await computePatternFingerprint(input);
    const b = await computePatternFingerprint({ ...input });
    assert.equal(a.digest, b.digest); // deterministic

    // Independently compute the expected digest via Node crypto over the same
    // canonical string the module builds, proving the algorithm (not just its
    // own output) is correct.
    const { createHash } = await import('node:crypto');
    const canonical = jcsCanonicalize({
      profile: PATTERN_PROFILE,
      target: input.target, rule: input.rule, locator: input.locator, state_key: null
    });
    const expected = createHash('sha256').update(canonical, 'utf8').digest('hex');
    assert.equal(a.digest, expected);
  });
});
