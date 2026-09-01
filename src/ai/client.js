/**
 * Main-thread client for the AI worker (Phase 15). Manages a single worker,
 * exposes load / generate / cancel / dispose, and forwards progress. The
 * deterministic workflow never depends on this — every call can reject and the
 * caller falls back to deterministic guidance.
 */

let worker = null;
let counter = 0;
const pending = new Map(); // id -> { resolve, reject, onProgress, expectType }

function getWorker() {
  if (!worker && typeof Worker !== 'undefined') {
    worker = new Worker(new URL('../workers/ai-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const msg = e.data || {};
      const h = pending.get(msg.id);
      if (!h) return;
      if (msg.progress) { if (h.onProgress) h.onProgress(msg.progress); return; }
      // Terminal messages resolve/reject by shape.
      if (msg.type === 'LOADED') { pending.delete(msg.id); h.resolve({ device: msg.device }); return; }
      if (msg.type === 'LOAD_CANCELLED') { pending.delete(msg.id); h.reject(new DOMException('Load cancelled.', 'AbortError')); return; }
      if (msg.type === 'LOAD_ERROR') { pending.delete(msg.id); h.reject(new Error(msg.error)); return; }
      if (msg.type === 'DISPOSED') { pending.delete(msg.id); h.resolve(true); return; }
      if (msg.success === true) { pending.delete(msg.id); h.resolve(msg.data); return; }
      if (msg.success === false) { pending.delete(msg.id); h.reject(new Error(msg.error)); return; }
    };
    worker.onerror = (err) => {
      for (const [, h] of pending) h.reject(new Error(err.message || 'AI worker error'));
      pending.clear();
    };
  }
  return worker;
}

export function isAiRuntimeSupported() {
  return typeof Worker !== 'undefined';
}

function request(message, onProgress) {
  const w = getWorker();
  if (!w) return Promise.reject(new Error('Web Workers not supported.'));
  const id = ++counter;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ ...message, id });
  });
}

/** Downloads/loads the model. Resolves { device } when ready. */
export function loadModel(modelId, source, onProgress) {
  return request({ type: 'LOAD_MODEL', modelId, source }, onProgress);
}

/** Cancels an in-flight model download (best-effort; fire-and-forget). */
export function cancelLoad() {
  if (worker) worker.postMessage({ type: 'CANCEL_LOAD' });
}

/** Generates a remediation candidate via the bounded validation loop. */
export function generateRemediation(task, { sourceContext = null, validationContext = null, onProgress = null } = {}) {
  return request({ type: 'GENERATE_REMEDIATION', task, sourceContext, validationContext }, onProgress);
}

/** Cancels an in-flight generation (best-effort). */
export function cancelGeneration() {
  if (worker) worker.postMessage({ type: 'CANCEL_GENERATION' });
}

/** Disposes the loaded model, freeing memory. */
export function disposeModel() {
  if (!worker) return Promise.resolve(true);
  return request({ type: 'DISPOSE' });
}
