/**
 * Main-thread client for the parse/reduce worker (spec §13.1/§13.7). Runs one
 * report at a time; starting a new run or calling cancel() terminates the current
 * worker (cooperative cancellation) so its CPU work stops and its memory frees.
 */

let current = null; // { worker, id, reject }
let counter = 0;

export function isWorkerSupported() {
  return typeof Worker !== 'undefined';
}

/** Cancels any in-flight parse run. */
export function cancelParse() {
  if (current) {
    try { current.worker.terminate(); } catch { /* ignore */ }
    const rej = current.reject;
    current = null;
    if (rej) rej(new DOMException('Parse cancelled.', 'AbortError'));
  }
}

/**
 * Parses+reduces a report in the worker.
 * @param {string} rawContent
 * @param {string} filename
 * @param {(p: {phase: string, detail: string}) => void} [onProgress]
 * @returns {Promise<object>} resolves with the worker's result payload
 */
export function parseInWorker(rawContent, filename, onProgress) {
  cancelParse(); // only one run at a time
  const worker = new Worker(new URL('./parse-worker.js', import.meta.url), { type: 'module' });
  const id = ++counter;

  return new Promise((resolve, reject) => {
    current = { worker, id, reject };
    worker.onmessage = (e) => {
      const msg = e.data || {};
      if (msg.id !== id) return;
      if (msg.progress) { if (onProgress) onProgress(msg.progress); return; }
      // Terminal message.
      const finish = () => { try { worker.terminate(); } catch { /* ignore */ } if (current && current.id === id) current = null; };
      if (msg.success) { finish(); resolve(msg); }
      else { finish(); reject(new Error(msg.error || 'Parsing failed')); }
    };
    worker.onerror = (err) => {
      try { worker.terminate(); } catch { /* ignore */ }
      if (current && current.id === id) current = null;
      reject(new Error(err.message || 'Worker error'));
    };
    worker.postMessage({ id, rawContent, filename });
  });
}
