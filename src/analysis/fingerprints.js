/**
 * Accessibility fingerprints (see
 * https://mgifford.github.io/ACCESSIBILITY.md/examples/fingerprints/README.html).
 *
 * A fingerprint is a stable, immutable identifier for an accessibility finding
 * so the same issue can be tracked across scans and tools. open-scans reports
 * already carry them per pattern and per occurrence — we surface those
 * authoritative values rather than inventing our own. When a report omits them
 * (e.g. a rule-only summary CSV), we can OPTIONALLY compute a pattern
 * fingerprint per the spec and label it clearly as workbench-derived.
 *
 * Spec digest: lowercase-hex(SHA-256(UTF-8(JCS-canonicalize(input)))), with a
 * profile id inside the hashed input. Display aliases are 12 uppercase hex.
 */

/**
 * Extracts the pattern-level fingerprint a report supplied for a cluster/task,
 * from its observations' identity. Returns null when the source carried none.
 * @param {{ observations?: Array<object> }} clusterOrTask
 * @returns {{ digest: string|null, displayId: string|null, source: 'scan' }|null}
 */
export function patternFingerprintOf(clusterOrTask) {
  const obs = (clusterOrTask?.observations || []).find(o => o.identity?.a11yPatternDisplayId || o.identity?.sourcePatternId);
  if (!obs) return null;
  const digest = obs.identity.sourcePatternId || null; // 64-hex when the scan is fingerprint-native
  const displayId = obs.identity.a11yPatternDisplayId || displayAliasFrom(digest, 'PAT');
  if (!digest && !displayId) return null;
  return { digest, displayId, source: 'scan' };
}

/**
 * Extracts the occurrence-level fingerprint a report supplied for a single
 * observation. Returns null when the source carried none.
 * @param {object} observation
 * @returns {{ digest: string|null, displayId: string|null, source: 'scan' }|null}
 */
export function occurrenceFingerprintOf(observation) {
  const id = observation?.identity;
  if (!id) return null;
  const digest = id.sourceOccurrenceId || null;
  const displayId = id.a11yOccurrenceDisplayId || displayAliasFrom(digest, 'OCC');
  if (!digest && !displayId) return null;
  return { digest, displayId, source: 'scan' };
}

/**
 * Builds a human-readable display alias (A11Y-PAT-XXXXXXXXXXXX / A11Y-OCC-…) from
 * a full 64-hex digest: first 12 hex chars, uppercased, per the spec. Returns
 * null for a missing/short digest.
 */
export function displayAliasFrom(digest, kind = 'PAT') {
  if (typeof digest !== 'string' || digest.length < 12) return null;
  return `A11Y-${kind}-${digest.slice(0, 12).toUpperCase()}`;
}

/**
 * RFC 8785 (JSON Canonicalization Scheme) — the subset needed for fingerprint
 * inputs: object keys sorted lexicographically by UTF-16 code unit, no
 * whitespace, arrays in order, and only the value types the spec uses (string,
 * number, boolean, null, object, array). This is deterministic across runs so
 * the same input always hashes to the same digest.
 */
export function jcsCanonicalize(value) {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(jcsCanonicalize).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${jcsCanonicalize(value[k])}`).join(',')}}`;
  }
  throw new TypeError(`Unsupported value type for JCS: ${typeof value}`);
}

/** The pattern fingerprint profile identifier hashed into the input. */
export const PATTERN_PROFILE = 'a11y/pattern/v1';

/**
 * Computes a spec-compliant pattern fingerprint from its five input fields,
 * for a source that did not supply one. Async because it uses Web Crypto
 * SHA-256. Returns { digest, displayId, source: 'workbench-derived' }.
 *
 * @param {{ target: object, rule: object, locator: string|null, stateKey?: string|null }} input
 * @param {SubtleCrypto} [subtle] injectable for tests; defaults to Web Crypto.
 */
export async function computePatternFingerprint(input, subtle = globalThis.crypto?.subtle) {
  if (!subtle || typeof subtle.digest !== 'function') {
    throw new Error('Web Crypto SubtleCrypto is not available to compute a fingerprint.');
  }
  // Field order does not matter — JCS sorts keys — but the shape must match the
  // spec: target, rule, locator, state_key, profile.
  const canonical = jcsCanonicalize({
    profile: PATTERN_PROFILE,
    target: input.target,
    rule: input.rule,
    locator: input.locator ?? null,
    state_key: input.stateKey ?? null
  });
  const bytes = new TextEncoder().encode(canonical);
  const hashBuffer = await subtle.digest('SHA-256', bytes);
  const digest = [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { digest, displayId: displayAliasFrom(digest, 'PAT'), source: 'workbench-derived' };
}
