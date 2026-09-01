/**
 * Local-AI consent & status (spec §11.3/§11.6/§11.7).
 *
 * No model downloads on page load or report import. The model is fetched only
 * after the user gives explicit consent by enabling AI. Consent persists locally
 * (a preference only — never report evidence). When AI is unavailable at any
 * step, callers fall back to deterministic guidance without losing the task.
 */

export const MODEL_INFO = {
  // Selected via the Phase 11 evaluation (see docs/AI_ARCHITECTURE.md). Small,
  // instruction-tuned, WebGPU/WASM-capable, quantized for browser download.
  id: 'HuggingFaceTB/SmolLM2-135M-Instruct',
  revision: 'main',
  quantization: 'q4',
  approxDownloadMB: 110,
  approxStorageMB: 140,
  runtime: 'transformers.js'
};

/**
 * Where the model weights are downloaded FROM. Inference always runs locally in
 * the browser either way — report data never leaves the device. The only
 * difference is what the weights host sees when the model is fetched: the user's
 * IP address and which model id, never any report content.
 *
 * - 'huggingface': transformers.js default (huggingface.co / its CDN).
 * - 'github-release': a same-org GitHub Release asset base URL (set at build/deploy
 *   time via VITE_MODEL_RELEASE_BASE); avoids the Hugging Face host.
 */
export const MODEL_SOURCES = {
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face (default)',
    note: 'Weights download from huggingface.co. That host sees your IP address and which model you load — never your report.'
  },
  'github-release': {
    id: 'github-release',
    label: 'GitHub Release (this project)',
    note: 'Weights download from this project’s GitHub release instead of Hugging Face. GitHub sees your IP and the file requested — never your report.'
  }
};

export const DEFAULT_MODEL_SOURCE = 'huggingface';

export const CONSENT_TEXT = [
  'Local AI runs on this device.',
  'This build does not download a separate model; a downloadable local model is planned for a later release.',
  'Your accessibility report is not sent to a cloud AI service.'
].join('\n');

const STORAGE_KEY = 'oaw.aiConsent.v1';

class AiConsentStore {
  constructor() {
    // status: 'disabled' | 'consented' | 'downloading' | 'ready' | 'error'
    this.state = {
      enabled: false, status: 'disabled', progress: 0, message: '',
      device: null, error: null, modelSource: DEFAULT_MODEL_SOURCE
    };
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const raw = safeGet(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Only the CONSENT preference and the model-source CHOICE persist — never a
        // "ready" state (the model cache may have been evicted; readiness is
        // re-established at runtime).
        if (parsed && parsed.enabled) this.state.enabled = true;
        if (parsed && MODEL_SOURCES[parsed.modelSource]) this.state.modelSource = parsed.modelSource;
      }
    } catch { /* ignore */ }
  }

  _persist() {
    try { safeSet(STORAGE_KEY, JSON.stringify({ enabled: this.state.enabled, modelSource: this.state.modelSource })); } catch { /* ignore */ }
  }

  /** User selects where weights download from (persisted). */
  setModelSource(source) {
    if (!MODEL_SOURCES[source]) return;
    this.state.modelSource = source;
    this._persist();
    this._notify();
  }

  subscribe(l) { this.listeners.add(l); return () => this.listeners.delete(l); }
  _notify() { for (const l of this.listeners) l(this.state); }
  setState(p) { this.state = { ...this.state, ...p }; this._notify(); }

  /** Detects WebGPU availability (best-effort, no download). */
  static webgpuAvailable() {
    try { return typeof navigator !== 'undefined' && 'gpu' in navigator; } catch { return false; }
  }

  /** User gives explicit consent. Does NOT start a download by itself. */
  enable() {
    this.state.enabled = true;
    this.state.status = 'consented';
    this._persist();
    this._notify();
  }

  /** Disable AI and forget the consent preference. */
  disable() {
    this.setState({ enabled: false, status: 'disabled', progress: 0, message: '', error: null });
    try { safeRemove(STORAGE_KEY); } catch { /* ignore */ }
  }

  markDownloading(progress = 0, message = 'Downloading model…') {
    this.setState({ status: 'downloading', progress, message });
  }
  markReady(device = null) { this.setState({ status: 'ready', progress: 100, message: 'Model ready.', device }); }
  markError(error) { this.setState({ status: 'error', error: String(error), message: 'AI unavailable — using deterministic guidance.' }); }

  /** Returns whether the model is ready to generate. */
  isReady() { return this.state.enabled && this.state.status === 'ready'; }
}

function safeGet(k) { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; } }
function safeSet(k, v) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch { /* ignore */ } }
function safeRemove(k) { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); } catch { /* ignore */ } }

export const aiConsentStore = new AiConsentStore();
export { AiConsentStore };
