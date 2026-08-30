/**
 * Decompresses base64-encoded gzip strings (.json.gz.b64)
 * Uses browser DecompressionStream when available or zlib in Node.
 */

export async function decompressGzipB64(b64String) {
  if (!b64String || typeof b64String !== 'string') {
    throw new Error('Invalid base64 input for decompression');
  }

  // Decode Base64 to Uint8Array
  let binaryString;
  if (typeof atob === 'function') {
    binaryString = atob(b64String.trim());
  } else if (typeof Buffer !== 'undefined') {
    return (await import('node:zlib')).gunzipSync(Buffer.from(b64String.trim(), 'base64')).toString('utf8');
  } else {
    throw new Error('No base64 decoding mechanism available');
  }

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Decompress using Web Streams DecompressionStream
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const response = new Response(ds.readable);
    const text = await response.text();
    return text;
  }

  throw new Error('DecompressionStream is not supported in this runtime');
}
