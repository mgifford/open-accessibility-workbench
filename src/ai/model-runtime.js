/**
 * Real on-device model runtime (Phase 15). Loads and runs a small language model
 * in the browser via transformers.js. Runs INSIDE the AI worker so inference
 * never blocks the main thread.
 *
 * Privacy: inference is entirely local — report/prompt data never leaves the
 * device. Only the model WEIGHTS are fetched over the network, from the host the
 * user chose (Hugging Face or a GitHub release); that host sees the user's IP and
 * the requested file, never report content.
 *
 * transformers.js is imported lazily (only when a model is actually loaded) so the
 * core app never pays its cost. The module is injectable for tests.
 */

// Base URL for the GitHub-release-hosted weights, injected at build time. When
// empty, the 'github-release' source cannot be used and the caller is told so.
const RELEASE_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MODEL_RELEASE_BASE) || '';

// Same-origin path where the transformers.js WASM runtime is self-hosted (copied
// into the build). Keeps the ONNX/WASM backend off third-party CDNs.
const WASM_PATH = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL || '/') + 'wasm/';

// The real runtime is only bundled when the build enables it (VITE_AI_RUNTIME=1).
// A normal (flag-off) build must NOT pull in transformers.js + its ~100 MB of
// WASM. When disabled, the specifier is built from a runtime-computed string so
// the bundler cannot statically include the dependency.
const AI_RUNTIME_BUILT = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_RUNTIME === '1');

let _transformersPromise = null;

/** Lazily imports transformers.js once. Injectable for tests. */
async function loadTransformers(inject) {
  if (inject) return inject;
  if (!AI_RUNTIME_BUILT) {
    throw new Error('The AI model runtime was not included in this build. Rebuild with VITE_AI_RUNTIME=1 to enable it.');
  }
  if (!_transformersPromise) {
    // Dynamic import so the dependency is only fetched when AI is actually used.
    // Guarded by the build-time literal so a flag-off build tree-shakes the whole
    // dependency (transformers.js + its WASM) out of the bundle entirely.
    if (import.meta.env.VITE_AI_RUNTIME === '1') {
      _transformersPromise = import('@huggingface/transformers');
    } else {
      throw new Error('The AI model runtime was not included in this build.');
    }
  }
  return _transformersPromise;
}

/**
 * Configures the transformers.js environment for our privacy/hosting choices.
 * @param {any} env - the library's `env` object
 * @param {'huggingface'|'github-release'} source
 */
export function configureEnv(env, source) {
  if (!env) return;
  // Self-host the WASM backend (no third-party CDN for the runtime itself).
  if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = WASM_PATH;
  // We run in a browser: fetch models remotely, don't look for a local FS path.
  env.allowLocalModels = false;
  env.allowRemoteModels = true;

  if (source === 'github-release') {
    if (!RELEASE_BASE) throw new Error('This build has no GitHub-release model host configured. Choose Hugging Face, or set VITE_MODEL_RELEASE_BASE at build time.');
    // Point the model host at the release base instead of huggingface.co.
    env.remoteHost = RELEASE_BASE.replace(/\/+$/, '');
    env.remotePathTemplate = '{model}';
  } else {
    // Hugging Face default host/template (reset in case it was changed before).
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/{revision}';
  }
}

/**
 * Loads a text-generation pipeline for `modelId`.
 * @param {object} opts
 * @param {string} opts.modelId
 * @param {'huggingface'|'github-release'} opts.source
 * @param {'webgpu'|'wasm'} [opts.device]
 * @param {(p:{progress:number, file?:string, status?:string})=>void} [opts.onProgress]
 * @param {AbortSignal} [opts.signal]
 * @param {any} [opts.transformersModule] - injected library (tests)
 * @returns {Promise<{ pipeline: any, device: string }>}
 */
export async function loadModel(opts) {
  const { modelId, source, device, onProgress, signal, transformersModule } = opts;
  if (signal?.aborted) throw new DOMException('Load cancelled.', 'AbortError');

  const tf = await loadTransformers(transformersModule);
  configureEnv(tf.env, source);

  // Pick a device: prefer WebGPU when present, else WASM. Callers may force one.
  const chosenDevice = device || (hasWebGPU() ? 'webgpu' : 'wasm');

  const pipeline = await tf.pipeline('text-generation', modelId, {
    dtype: 'q4',
    device: chosenDevice,
    progress_callback: (p) => {
      if (!onProgress) return;
      // transformers.js reports { status, file, progress (0-100), loaded, total }.
      const pct = typeof p?.progress === 'number' ? p.progress : (p?.status === 'ready' ? 100 : 0);
      onProgress({ progress: pct, file: p?.file, status: p?.status });
    }
  });

  if (signal?.aborted) { try { await pipeline.dispose?.(); } catch { /* ignore */ } throw new DOMException('Load cancelled.', 'AbortError'); }
  return { pipeline, device: chosenDevice };
}

/**
 * Runs generation and returns the raw generated text (the caller parses/validates
 * it — this module never trusts or shapes the output).
 * @param {any} pipeline
 * @param {string} prompt
 * @param {object} [opts]
 * @returns {Promise<string>}
 */
export async function generate(pipeline, prompt, opts = {}) {
  const { maxNewTokens = 256, temperature = 0.2, signal } = opts;
  if (signal?.aborted) throw new DOMException('Generation cancelled.', 'AbortError');
  const out = await pipeline(prompt, {
    max_new_tokens: maxNewTokens,
    temperature,
    do_sample: temperature > 0,
    return_full_text: false
  });
  // transformers.js returns [{ generated_text }] (string) for text-generation.
  const text = Array.isArray(out) ? (out[0]?.generated_text ?? '') : (out?.generated_text ?? '');
  return typeof text === 'string' ? text : '';
}

/** Releases the model from memory. Safe to call more than once. */
export async function disposeModel(pipeline) {
  try { await pipeline?.dispose?.(); } catch { /* ignore */ }
}

/** WebGPU availability (best-effort, no download). */
export function hasWebGPU() {
  try { return typeof navigator !== 'undefined' && 'gpu' in navigator; } catch { return false; }
}
