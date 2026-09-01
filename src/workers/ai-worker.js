/**
 * AI worker (Phase 11/12/15): loads a small language model, runs the bounded
 * generate→validate loop, and disposes the model — all off the main thread.
 *
 * Inference is local; only the model WEIGHTS are fetched (from the user's chosen
 * host). The deterministic guidance path never depends on this worker: if the
 * model is not loaded, generation returns an error and the caller falls back.
 */

import { buildRemediationPrompt } from '../ai/prompt.js';
import { runValidationLoop, buildValidationExport } from '../ai/validation-loop.js';
import { loadModel, generate as runGenerate, disposeModel } from '../ai/model-runtime.js';

let pipeline = null;
let loadedModelId = null;
let loadedDevice = null;
let loadAbort = null;
let cancelGeneration = false;

function post(msg) { self.postMessage(msg); }

self.onmessage = async (e) => {
  const { type, id } = e.data || {};

  if (type === 'LOAD_MODEL') {
    const { modelId, source } = e.data;
    // If the requested model is already loaded, report ready immediately.
    if (pipeline && loadedModelId === modelId) {
      post({ id, type: 'LOADED', device: loadedDevice });
      return;
    }
    // Replace any previously loaded model.
    await disposeCurrent();
    loadAbort = new AbortController();
    try {
      const res = await loadModel({
        modelId, source,
        signal: loadAbort.signal,
        onProgress: (p) => post({ id, progress: { phase: 'download', progress: p.progress, file: p.file, status: p.status } })
      });
      pipeline = res.pipeline;
      loadedModelId = modelId;
      loadedDevice = res.device;
      post({ id, type: 'LOADED', device: res.device });
    } catch (err) {
      pipeline = null; loadedModelId = null; loadedDevice = null;
      if (err && err.name === 'AbortError') post({ id, type: 'LOAD_CANCELLED' });
      else post({ id, type: 'LOAD_ERROR', error: (err && err.message) || 'Model load failed' });
    } finally {
      loadAbort = null;
    }
    return;
  }

  if (type === 'CANCEL_LOAD') {
    if (loadAbort) loadAbort.abort();
    return;
  }

  if (type === 'CANCEL_GENERATION') {
    cancelGeneration = true;
    return;
  }

  if (type === 'DISPOSE') {
    await disposeCurrent();
    post({ id, type: 'DISPOSED' });
    return;
  }

  if (type === 'GENERATE_REMEDIATION') {
    const { task, sourceContext, validationContext } = e.data;
    if (!pipeline) { post({ id, success: false, error: 'No model is loaded.' }); return; }
    cancelGeneration = false;
    try {
      const loop = await runValidationLoop({
        ruleId: task.ruleId,
        sourceContext,
        validationContext: validationContext || { originalSnippet: task.representativeHtml },
        isCancelled: () => cancelGeneration,
        generate: async (feedback, attempt) => {
          post({ id, progress: { phase: 'inference', status: `Generating (attempt ${attempt})…` } });
          const prompt = buildRemediationPrompt(task, sourceContext, feedback);
          return runGenerate(pipeline, prompt, { maxNewTokens: 256, temperature: 0.2 });
        }
      });
      post({
        id, success: true,
        data: {
          finalCandidate: loop.finalCandidate,     // null unless it passed validation
          outcome: loop.outcome,
          validationExport: buildValidationExport(loop, { ruleId: task.ruleId, validationContext }),
          provenance: loop.finalCandidate ? { generatedByAI: true, model: loadedModelId, device: loadedDevice } : { generatedByAI: false }
        }
      });
    } catch (err) {
      post({ id, success: false, error: (err && err.message) || 'AI generation error' });
    }
    return;
  }
};

async function disposeCurrent() {
  if (pipeline) { await disposeModel(pipeline); }
  pipeline = null; loadedModelId = null; loadedDevice = null;
}
