/**
 * Client interface for interacting with the background AI Worker.
 */

let aiWorkerInstance = null;
let requestCounter = 0;
const pendingRequests = new Map();

export function getAiWorker() {
  if (!aiWorkerInstance && typeof Worker !== 'undefined') {
    aiWorkerInstance = new Worker(new URL('../workers/ai-worker.js', import.meta.url), { type: 'module' });
    aiWorkerInstance.onmessage = (e) => {
      const { id, success, data, error, progress } = e.data;
      if (pendingRequests.has(id)) {
        const handler = pendingRequests.get(id);
        if (progress && handler.onProgress) {
          handler.onProgress(progress);
        } else {
          pendingRequests.delete(id);
          if (success) handler.resolve(data);
          else handler.reject(new Error(error));
        }
      }
    };
  }
  return aiWorkerInstance;
}

export function requestAiRemediation(task, modelId, sourceContext = null, onProgress = null) {
  const worker = getAiWorker();
  if (!worker) {
    return Promise.reject(new Error('Web Workers not supported in this runtime.'));
  }

  const id = ++requestCounter;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onProgress });
    worker.postMessage({
      type: 'GENERATE_REMEDIATION',
      id,
      task,
      modelId,
      sourceContext
    });
  });
}
