/**
 * Session-only browser AI capability probing (ADR 0001).
 *
 * Browser brand is NEVER used to select a route. We probe page-accessible
 * capabilities for the current session and record only that session's result:
 * whether the built-in Prompt API is exposed and ready/downloadable, and whether
 * WebGPU can actually run a local model here. Callers turn this into a route with
 * `capabilityDecision`. Everything degrades to the deterministic floor.
 */

// The built-in Prompt API is exposed under one of these paths depending on the
// browser/channel. We probe both and use whichever resolves.
const PROMPT_API_PATHS = ['LanguageModel', 'ai.languageModel'];

export function resolvePath(root, path) {
  return path.split('.').reduce((value, key) => value?.[key], root);
}

/**
 * Maps the several strings browsers report from `availability()` into one
 * normalized shape. Different channels have used "readily"/"available",
 * "after-download"/"downloadable", "downloading", "no"/"unavailable".
 */
export function normalizeAvailability(value) {
  const raw = String(value?.status ?? value?.available ?? value ?? 'unknown').toLowerCase();
  if (['available', 'readily', 'ready'].includes(raw)) {
    return { status: 'available', ready: true, downloadable: false };
  }
  if (['downloadable', 'after-download'].includes(raw)) {
    return { status: 'downloadable', ready: false, downloadable: true };
  }
  if (raw === 'downloading') {
    return { status: 'downloading', ready: false, downloadable: true };
  }
  if (['unavailable', 'no'].includes(raw)) {
    return { status: 'unavailable', ready: false, downloadable: false };
  }
  return { status: raw, ready: false, downloadable: false };
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('availability check timed out')), timeoutMs))
  ]);
}

/** Probes the built-in Prompt API without ever triggering a download. */
async function probePromptApi(root, timeoutMs) {
  const detectedPath = PROMPT_API_PATHS.find((path) => resolvePath(root, path) !== undefined);
  if (!detectedPath) {
    return { detected: false, detectedPath: '', status: 'not-exposed', ready: false, downloadable: false };
  }
  const api = resolvePath(root, detectedPath);
  if (typeof api?.availability !== 'function') {
    // Older shapes exposed only `create`; treat presence as "exposed" but not
    // confirmed ready (we never call create() during a probe).
    const exposed = typeof api?.create === 'function' || typeof api === 'function';
    return { detected: true, detectedPath, status: exposed ? 'exposed' : 'unknown', ready: false, downloadable: false };
  }
  try {
    const result = await withTimeout(Promise.resolve(api.availability()), timeoutMs);
    return { detected: true, detectedPath, ...normalizeAvailability(result) };
  } catch (error) {
    return { detected: true, detectedPath, status: 'error', ready: false, downloadable: false, error: error.message };
  }
}

// A short, unusual probe whose correct answer is a single known word. A real
// model answers with (or containing) the word; a stub Prompt API that echoes
// the input — some Chromium builds expose one that replies "On-device model is
// not available in Chromium, this API is just echoing back the input: …" — does
// not. The probe is deliberately tiny so a functional model answers instantly
// and it costs almost nothing.
const SELF_TEST_PROMPT = 'Reply with only the word READY and nothing else.';
const SELF_TEST_EXPECTED = 'ready';

/**
 * Runs ONE tiny generation against an already-usable Prompt API session to
 * confirm it actually produces model output rather than echoing the prompt or
 * returning a "not available" stub. Never triggers a download (callers only run
 * this once the model is ready/prepared). Returns a structured verdict; on any
 * error it reports `usable: false` with the reason so the caller can fall back.
 *
 * @param {object} languageModel - the resolved Prompt API (window.LanguageModel)
 * @param {number} [timeoutMs]
 * @returns {Promise<{ usable: boolean, reason: string, sample?: string }>}
 */
export async function verifyPromptApiUsable(languageModel, timeoutMs = 8000) {
  if (!languageModel || typeof languageModel.create !== 'function') {
    return { usable: false, reason: 'Prompt API cannot create a session.' };
  }
  let session = null;
  try {
    session = await withTimeout(Promise.resolve(languageModel.create()), timeoutMs);
    const raw = await withTimeout(Promise.resolve(session.prompt(SELF_TEST_PROMPT)), timeoutMs);
    const text = String(raw ?? '').trim();
    const lower = text.toLowerCase();

    // A stub that echoes the prompt back, or announces it is not a real model.
    if (lower.includes(SELF_TEST_PROMPT.toLowerCase())) {
      return { usable: false, reason: 'The browser AI echoed the prompt instead of answering — no real on-device model is available.', sample: text.slice(0, 120) };
    }
    if (/not available|just echoing|echo(ing)? back the input|placeholder|stub/i.test(text)) {
      return { usable: false, reason: 'The browser reports its on-device AI is not actually available here.', sample: text.slice(0, 120) };
    }
    // Empty output is not a working model either.
    if (text === '') {
      return { usable: false, reason: 'The browser AI returned no output.' };
    }
    // A working model answers with the expected token (models may add
    // punctuation/casing); accept any non-echo, non-empty answer that contains it,
    // but also accept a short plausible answer even if the exact token drifted.
    const answered = lower.includes(SELF_TEST_EXPECTED) || text.length <= 40;
    return answered
      ? { usable: true, reason: 'Self-test produced a real answer.', sample: text.slice(0, 120) }
      : { usable: false, reason: 'The browser AI did not produce a usable answer to a basic prompt.', sample: text.slice(0, 120) };
  } catch (error) {
    return { usable: false, reason: `Browser AI self-test failed: ${error.message}` };
  } finally {
    try { session?.destroy?.(); } catch { /* ignore */ }
  }
}

// Below this many gigabytes of reported device memory, loading a browser local
// model (~110–350 MB weights, plus WebGPU working buffers) is likely to exhaust
// memory. On unified-memory machines that pressure can stall the compositor and
// take the whole desktop down. navigator.deviceMemory is coarse and capped at 8
// for privacy, so this only catches the clearly-too-small devices; everything at
// or above still gets an explicit warning before any download.
export const LOCAL_MODEL_MIN_DEVICE_MEMORY_GB = 8;

/**
 * Actually resolve a WebGPU adapter rather than trusting that `navigator.gpu`
 * merely exists. A browser can expose the API but fail to return an adapter
 * (blocklisted GPU, software fallback disabled, headless), in which case the
 * local model cannot run and offering it would only produce a confusing failure
 * or a hang. Returns a structured result the UI uses to decide whether to offer
 * the transformers.js route and how strongly to warn.
 */
export async function probeWebGpu(root = globalThis, timeoutMs = 3000) {
  const gpu = root.navigator?.gpu;
  const deviceMemory = typeof root.navigator?.deviceMemory === 'number' ? root.navigator.deviceMemory : null;
  if (!gpu) {
    return { present: false, usable: false, adapter: false, deviceMemory, reason: 'This browser does not expose WebGPU. A local model would fall back to CPU (WASM), which can be slow enough to look like a frozen page.' };
  }
  if (deviceMemory !== null && deviceMemory < LOCAL_MODEL_MIN_DEVICE_MEMORY_GB) {
    return { present: true, usable: false, adapter: false, deviceMemory, reason: `This device reports about ${deviceMemory} GB of memory. Loading a local model into WebGPU memory on a machine this small can make the whole computer unresponsive, so it is not offered here.` };
  }
  if (typeof gpu.requestAdapter !== 'function') {
    return { present: true, usable: true, adapter: false, deviceMemory, reason: '' };
  }
  try {
    const adapter = await withTimeout(Promise.resolve(gpu.requestAdapter()), timeoutMs);
    if (!adapter) {
      return { present: true, usable: false, adapter: false, deviceMemory, reason: 'WebGPU is exposed but no graphics adapter is available to this browser, so a local model cannot run here.' };
    }
    return { present: true, usable: true, adapter: true, deviceMemory, reason: '' };
  } catch (error) {
    return { present: true, usable: false, adapter: false, deviceMemory, reason: `WebGPU could not initialise a graphics adapter (${error.message}), so a local model cannot run here.` };
  }
}

/**
 * Plain-language caution when a large model download would run over a metered,
 * cellular, or slow connection, or with Data Saver on. Returns '' when the
 * connection looks unmetered or the Network Information API is unavailable
 * (Safari, Firefox), so no false warning is shown.
 */
export function connectionWarning(root = globalThis) {
  const connection = root.navigator?.connection;
  if (!connection) return '';
  if (connection.saveData) return 'Data Saver is on in your browser, which usually means you are limiting data use. This model download is large.';
  if (connection.type === 'cellular') return 'You appear to be on a cellular connection. Downloading the model may use mobile data and could incur charges.';
  if (/^(slow-2g|2g|3g)$/.test(connection.effectiveType || '')) return 'Your connection looks slow, so downloading the model may take a long time.';
  return '';
}

/**
 * One session capability report. Sequential probing (no concurrency) because
 * experimental browser AI implementations can contend for the same model
 * service. Never inspects user-agent or brand.
 */
export async function probeBrowserCapabilities(root = globalThis, timeoutMs = 3000) {
  const prompt = await probePromptApi(root, timeoutMs);
  const webgpu = await probeWebGpu(root, timeoutMs);
  return {
    secureContext: root.isSecureContext === true,
    prompt,
    compute: {
      webgpu: webgpu.usable,
      webgpuPresent: webgpu.present,
      webgpuAdapter: webgpu.adapter,
      webgpuReason: webgpu.reason,
      deviceMemory: webgpu.deviceMemory,
      webnn: Boolean(root.navigator?.ml)
    }
  };
}

/**
 * Turns a capability report into the browser-Prompt-API routing state. WebGPU /
 * transformers routing is decided by the caller (it also depends on the build
 * flag), so this only classifies the built-in API.
 *
 * @returns {'browser-ready'|'browser-downloadable'|'no-browser-prompt-api'}
 */
export function capabilityDecision(report) {
  const prompt = report?.prompt;
  if (prompt?.ready) return 'browser-ready';
  if (prompt?.downloadable) return 'browser-downloadable';
  return 'no-browser-prompt-api';
}
