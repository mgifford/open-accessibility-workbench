/**
 * Decompresses base64-encoded gzip strings (.json.gz.b64)
 * Uses browser DecompressionStream when available or zlib in Node.
 */

import { MAX_FILE_BYTES } from '../../utils/input-limits.js';

export async function decompressGzipB64(b64String, maxBytes = MAX_FILE_BYTES) {
  if (!b64String || typeof b64String !== 'string') {
    throw new Error('Invalid base64 input for decompression');
  }

  // Decode Base64 to Uint8Array
  let binaryString;
  if (typeof atob === 'function') {
    binaryString = atob(b64String.trim());
  } else if (typeof Buffer !== 'undefined') {
    const out = (await import('node:zlib')).gunzipSync(Buffer.from(b64String.trim(), 'base64'));
    if (out.length > maxBytes) throw new Error(`Decompressed report exceeds the ${(maxBytes / (1024 * 1024)).toFixed(0)} MB limit.`);
    return out.toString('utf8');
  } else {
    throw new Error('No base64 decoding mechanism available');
  }

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Decompress using Web Streams DecompressionStream, bounding the expanded size
  // so a compression bomb cannot exhaust memory: read chunks and stop once the
  // decompressed output would exceed maxBytes (spec §13.3).
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    // Cancelling the reader below aborts the writable side; swallow those
    // abort rejections so they don't surface as unhandled rejections.
    writer.write(bytes).catch(() => {});
    writer.close().catch(() => {});

    const reader = ds.readable.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`Decompressed report exceeds the ${(maxBytes / (1024 * 1024)).toFixed(0)} MB limit.`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  }

  throw new Error('DecompressionStream is not supported in this runtime');
}
