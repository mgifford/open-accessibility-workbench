/**
 * Capability-driven AI provider abstraction (ADR 0001).
 *
 * One interface, several implementations, chosen by probed capability — never by
 * browser brand. Whatever route generates a candidate, it flows through the SAME
 * anti-invention + bounded-validation gate; adding providers never widens what
 * output we trust.
 *
 * Provider interface:
 *   id            string
 *   label         string
 *   kind          'deterministic' | 'browser-prompt' | 'transformers'
 *   availability()            → { status, ready, downloadable }
 *   prepare(onProgress)       → resolves when a browser-managed download finishes
 *                               (browser-prompt only; discloses + user-initiated)
 *   generate(task, ctx, opts) → { finalCandidate, outcome, validationExport, provenance }
 *   close()                   → releases any session/worker
 *
 * `generate` runs this repo's bounded generate→validate→retry loop against the
 * deterministic validators; `finalCandidate` is null unless a candidate passed.
 */

import { resolvePath, normalizeAvailability } from './browser-capabilities.js';
import { buildRemediationPrompt } from './prompt.js';
import { runValidationLoop, buildValidationExport } from './validation-loop.js';
import {
  isAiRuntimeSupported, loadModel, cancelLoad, disposeModel,
  generateRemediation, cancelGeneration
} from './client.js';

/**
 * Consumes a Prompt API streaming response, reporting cumulative text to
 * `onDelta` as chunks arrive, and resolves with the FULL text. Browsers differ
 * on whether each chunk is the incremental delta or the running total; we
 * normalise to cumulative so callers always receive the whole answer-so-far and
 * the final return value is complete. Works with either an async-iterable
 * stream or a ReadableStream reader.
 */
export async function streamPrompt(session, prompt, opts, onDelta) {
  const stream = session.promptStreaming(prompt, opts);
  let full = '';
  const consume = (chunk) => {
    const text = typeof chunk === 'string' ? chunk : String(chunk ?? '');
    // Detect a running-total stream (each chunk starts with what we already
    // have) vs. an incremental one, and normalise to cumulative.
    if (text.length >= full.length && text.startsWith(full)) full = text;
    else full += text;
    onDelta(full);
  };

  if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
    for await (const chunk of stream) consume(chunk);
    return full;
  }
  if (stream && typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        consume(value);
      }
    } finally {
      reader.releaseLock?.();
    }
    return full;
  }
  // Not actually streamable — fall back to awaiting it as a whole.
  const whole = await stream;
  if (whole) { full = String(whole); onDelta(full); }
  return full;
}

// The remediation-JSON contract every model route is asked to emit. Kept here so
// a browser Prompt API that supports response constraints can be handed a schema;
// the deterministic response-processor remains the real gate regardless.
export const REMEDIATION_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['summary', 'rootCauseHypothesis', 'confidence', 'targetBehavior', 'recommendedStrategy', 'developerDecisionsRequired'],
  properties: {
    summary: { type: 'string' },
    rootCauseHypothesis: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    targetBehavior: { type: 'string' },
    recommendedStrategy: { type: 'string' },
    developerDecisionsRequired: { type: 'array', items: { type: 'string' } },
    targetMarkup: { type: ['string', 'null'] },
    sourceAwareCandidate: { type: ['string', 'null'] },
    verification: { type: 'array', items: { type: 'string' } },
    limitations: { type: 'array', items: { type: 'string' } }
  }
};

/**
 * Runs the shared bounded validation loop given a raw-text generator, and shapes
 * the result the advisor consumes. Used by the browser-prompt and (as a fallback
 * path) any main-thread provider. The transformers provider runs the same loop
 * inside its worker via client.generateRemediation.
 */
async function runLoopWith({ task, sourceContext, validationContext, generateText, provenanceBase, isCancelled = () => false, onProgress = null }) {
  const ctx = validationContext || { originalSnippet: task.representativeHtml };
  const loop = await runValidationLoop({
    ruleId: task.ruleId,
    sourceContext,
    validationContext: ctx,
    isCancelled,
    generate: async (feedback, attempt) => {
      onProgress?.({ phase: 'inference', status: `Generating (attempt ${attempt})…`, attempt });
      // `generateText` may accept an onDelta second arg (streaming providers).
      // The partial text is for a live in-progress preview only — it is raw and
      // unverified; the returned full text still goes through the validation gate.
      const onDelta = onProgress
        ? (partial) => onProgress({ phase: 'inference', status: `Generating (attempt ${attempt})…`, attempt, partial })
        : null;
      return generateText(buildRemediationPrompt(task, sourceContext, feedback), onDelta);
    }
  });
  return {
    finalCandidate: loop.finalCandidate,
    outcome: loop.outcome,
    validationExport: buildValidationExport(loop, { ruleId: task.ruleId, validationContext: ctx }),
    provenance: loop.finalCandidate ? { generatedByAI: true, ...provenanceBase } : { generatedByAI: false }
  };
}

/* ------------------------------------------------------------------ */
/* Deterministic provider — always available, always the floor.        */
/* ------------------------------------------------------------------ */

/**
 * The deterministic provider never runs a model. It is the route the advisor
 * lands on when no model route is available or a model route fails. It reports
 * `no-usable-candidate` so the panel shows the deterministic guidance rendered
 * elsewhere on the task (this provider does not invent remediation text).
 */
export const deterministicProvider = {
  id: 'deterministic',
  label: 'Deterministic guidance',
  kind: 'deterministic',
  async availability() { return { status: 'available', ready: true, downloadable: false }; },
  async generate({ task }) {
    return {
      finalCandidate: null,
      outcome: 'no-usable-candidate',
      validationExport: null,
      provenance: { generatedByAI: false, deterministic: true, ruleId: task?.ruleId }
    };
  },
  async close() {}
};

/* ------------------------------------------------------------------ */
/* Browser Prompt API provider — window.LanguageModel / Gemini Nano.   */
/* No dependency, no download we host, no COOP/COEP headers needed.     */
/* ------------------------------------------------------------------ */

/**
 * Uses the browser's built-in Prompt API. It is offered live (consent-gated) —
 * NOT behind VITE_AI_RUNTIME — because it adds nothing to our bundle or deploy.
 * The browser manages any model download; we disclose it and never start it
 * silently. Output still passes the shared validation loop.
 */
export function createBrowserPromptProvider(root = globalThis, options = {}) {
  const languageModel = resolvePath(root, 'LanguageModel') || resolvePath(root, 'ai.languageModel');
  let session = null;

  async function ensureSession() {
    if (session) return session;
    if (!languageModel || typeof languageModel.create !== 'function') {
      throw new Error('Browser-provided AI is not available.');
    }
    session = await languageModel.create({ signal: options.signal });
    return session;
  }

  /**
   * Generates the model's raw text. When `onDelta` is supplied AND the session
   * exposes `promptStreaming()`, the answer is streamed and each incremental
   * chunk is reported so the UI can show progress live; the FULL text is still
   * returned and is what the validation loop consumes (streaming changes only
   * how the wait is shown, never what is validated or committed). Falls back to
   * the non-streaming `prompt()` otherwise.
   */
  async function generateText(prompt, onDelta = null) {
    const s = await ensureSession();
    const canStream = typeof onDelta === 'function' && typeof s.promptStreaming === 'function';

    if (canStream) {
      try {
        return await streamPrompt(s, prompt, { responseConstraint: REMEDIATION_SCHEMA, signal: options.signal }, onDelta);
      } catch (error) {
        if (!/constraint|schema|option|unsupported/i.test(error.message || '')) throw error;
        return await streamPrompt(s, prompt, { signal: options.signal }, onDelta);
      }
    }

    try {
      return await s.prompt(prompt, { responseConstraint: REMEDIATION_SCHEMA, signal: options.signal });
    } catch (error) {
      // Older builds reject unknown options; retry unconstrained (the
      // response-processor still enforces the shape and rejects invention).
      if (!/constraint|schema|option|unsupported/i.test(error.message || '')) throw error;
      return await s.prompt(prompt, { signal: options.signal });
    }
  }

  return {
    id: 'browser-prompt',
    label: 'Browser-provided AI',
    kind: 'browser-prompt',
    async availability() {
      if (typeof languageModel?.availability !== 'function') {
        // Exposed but no availability(): treat as unavailable until a real probe
        // confirms readiness; we never call create() to find out.
        return { status: languageModel ? 'unknown' : 'unavailable', ready: false, downloadable: false };
      }
      return normalizeAvailability(await languageModel.availability());
    },
    /** Disclosed, user-initiated download of the browser-managed model. */
    async prepare(onProgress) {
      if (!languageModel || typeof languageModel.create !== 'function') throw new Error('Browser-provided AI is not available.');
      const availability = await this.availability();
      if (availability.ready) return availability;
      if (availability.status !== 'downloadable' && availability.status !== 'downloading') {
        throw new Error('Browser-provided AI cannot be downloaded in this browser.');
      }
      session = await languageModel.create({
        signal: options.signal,
        monitor: (monitor) => monitor?.addEventListener?.('downloadprogress', (event) =>
          onProgress?.({ phase: 'download', progress: Math.round((event.loaded ?? event.progress ?? 0) * 100) }))
      });
      return { status: 'available', ready: true, downloadable: false };
    },
    async generate({ task, sourceContext = null, validationContext = null, isCancelled, onProgress } = {}) {
      const availability = await this.availability();
      if (!availability.ready) throw new Error('Browser-provided AI is not ready. Approve its browser-managed download first.');
      return runLoopWith({
        task, sourceContext, validationContext, generateText, isCancelled, onProgress,
        provenanceBase: { model: 'browser-managed', modelRevision: 'browser', runtime: 'browser-prompt-api', device: 'browser' }
      });
    },
    async close() {
      if (typeof session?.destroy === 'function') session.destroy();
      session = null;
    }
  };
}

/* ------------------------------------------------------------------ */
/* transformers.js worker provider — build-gated (VITE_AI_RUNTIME).    */
/* Wraps the existing worker/client; the loop runs INSIDE the worker.  */
/* ------------------------------------------------------------------ */

/**
 * Runs a small model in a Web Worker via transformers.js. Only usable in a
 * VITE_AI_RUNTIME build (the dependency is tree-shaken out otherwise) and on a
 * usable WebGPU device (WASM fallback where practical). `availability()` reports
 * `downloadable` — the model is fetched by an explicit user action through
 * `prepare()`; the bounded validation loop runs in the worker.
 */
export function createTransformersProvider(options = {}) {
  const modelId = options.modelId;
  const source = options.source || 'huggingface';
  let loadedDevice = null;

  return {
    id: 'transformers',
    label: 'Local Hugging Face model',
    kind: 'transformers',
    modelIdentifier: modelId,
    async availability() {
      if (!isAiRuntimeSupported()) return { status: 'unavailable', ready: false, downloadable: false };
      return { status: 'downloadable', ready: false, downloadable: true };
    },
    /** Download + load the model into the worker. */
    async prepare(onProgress) {
      const { device } = await loadModel(modelId, source, (p) => onProgress?.({
        phase: 'download', progress: Math.round(Number(p.progress) || 0), file: p.file, status: p.status
      }));
      loadedDevice = device;
      return { status: 'available', ready: true, downloadable: false, device };
    },
    cancelPrepare() { cancelLoad(); },
    async generate({ task, sourceContext = null, validationContext = null, onProgress } = {}) {
      // The worker owns the bounded validation loop and returns the shaped result
      // (finalCandidate/outcome/validationExport/provenance) already.
      return generateRemediation(task, {
        sourceContext,
        validationContext: validationContext || { originalSnippet: task.representativeHtml },
        onProgress
      });
    },
    cancelGeneration() { cancelGeneration(); },
    device() { return loadedDevice; },
    async close() { try { await disposeModel(); } catch { /* ignore */ } loadedDevice = null; }
  };
}
