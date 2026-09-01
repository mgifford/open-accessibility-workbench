/**
 * Input size limits (spec §13.3/§13.6). Scanner evidence is untrusted; a
 * gigantic file or a single gigantic field can exhaust memory or the main
 * thread. These guards keep the app usable and give an understandable message
 * rather than hanging.
 */

// A report larger than this warns the user before processing (does not block).
export const LARGE_FILE_WARN_BYTES = 8 * 1024 * 1024; // 8 MB
// A report larger than this is refused (understandable error, not a crash).
export const MAX_FILE_BYTES = 64 * 1024 * 1024; // 64 MB
// A large free-text field (e.g. an HTML snippet or scanner message) longer than
// this is truncated with a marker so downstream rendering/normalization stays
// bounded.
export const MAX_FIELD_CHARS = 100 * 1000; // 100k chars
// A short field (locator, scanner guidance, page title, rule id) — these are
// never legitimately huge, so bound them tightly.
export const MAX_SHORT_FIELD_CHARS = 8 * 1000; // 8k chars
// A URL beyond this length is pathological; browsers themselves cap around 2k.
export const MAX_URL_CHARS = 2 * 1000; // 2k chars

/**
 * Approximate UTF-8 byte length of a string without allocating a full encoded
 * copy. ASCII counts as 1, most scripts 2–3, astral 4. Good enough to guard
 * memory/throughput; exactness is not required for a limit check.
 */
export function approxByteLength(str) {
  if (typeof str !== 'string') return 0;
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; } // surrogate pair
    else bytes += 3;
  }
  return bytes;
}

/** @returns {{ ok: boolean, warn?: boolean, error?: string, bytes: number }} */
export function checkFileSize(content) {
  // Count UTF-8 bytes (not UTF-16 code units) so non-ASCII reports are not
  // undercounted against the byte limit.
  const bytes = typeof content === 'number'
    ? content // caller passed a known byte size (e.g. File.size) directly
    : approxByteLength(content);
  if (bytes > MAX_FILE_BYTES) {
    return { ok: false, bytes, error: `This report is ${(bytes / (1024 * 1024)).toFixed(0)} MB, above the ${(MAX_FILE_BYTES / (1024 * 1024))} MB limit. Split or filter it and try again.` };
  }
  return { ok: true, warn: bytes > LARGE_FILE_WARN_BYTES, bytes };
}

/** Truncates to a given char limit with a clear marker. */
function truncate(value, limit) {
  if (typeof value !== 'string' || value.length <= limit) return value;
  return value.slice(0, limit) + `\n… [truncated: ${value.length - limit} more characters]`;
}

/**
 * Truncates an over-long large field (HTML, scanner message). Returns the value
 * unchanged when within the limit.
 */
export function capField(value) { return truncate(value, MAX_FIELD_CHARS); }

/** Truncates a short field (locator, guidance, title, rule id). */
export function capShort(value) { return truncate(value, MAX_SHORT_FIELD_CHARS); }

/** Truncates a URL-shaped field. */
export function capUrl(value) { return truncate(value, MAX_URL_CHARS); }
