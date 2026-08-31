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
// A single field (e.g. an HTML snippet) longer than this is truncated with a
// marker so downstream rendering/normalization stays bounded.
export const MAX_FIELD_CHARS = 100 * 1000; // 100k chars

/** @returns {{ ok: boolean, warn?: boolean, error?: string, bytes: number }} */
export function checkFileSize(content) {
  const bytes = typeof content === 'string'
    ? content.length // approximate (UTF-16 code units); good enough for a guard
    : 0;
  if (bytes > MAX_FILE_BYTES) {
    return { ok: false, bytes, error: `This report is ${(bytes / (1024 * 1024)).toFixed(0)} MB, above the ${(MAX_FILE_BYTES / (1024 * 1024))} MB limit. Split or filter it and try again.` };
  }
  return { ok: true, warn: bytes > LARGE_FILE_WARN_BYTES, bytes };
}

/**
 * Truncates an over-long field value, appending a clear marker. Returns the
 * value unchanged when within the limit.
 */
export function capField(value) {
  if (typeof value !== 'string' || value.length <= MAX_FIELD_CHARS) return value;
  return value.slice(0, MAX_FIELD_CHARS) + `\n… [truncated: ${value.length - MAX_FIELD_CHARS} more characters]`;
}
