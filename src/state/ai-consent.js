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

export const CONSENT_TEXT = [
  'Local AI runs on this device.',
  'This build does not download a separate model; a downloadable local model is planned for a later release.',
  'Your accessibility report is not sent to a cloud AI service.'
].join('\n');

const STORAGE_KEY = 'oaw.aiConsent.v1';

class AiConsentStore {
  constructor() {
    // status: 'disabled' | 'consented' | 'downloading' | 'ready' | 'error'
    this.state = { enabled: false, status: 'disabled', progress: 0, message: '', device: null, error: null };
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const raw = safeGet(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Only the CONSENT preference persists — never a "ready" state (the model
        // cache may have been evicted; readiness is re-established at runtime).
        if (parsed && parsed.enabled) this.state.enabled = true;
      }
    } catch { /* ignore */ }
  }

  _persist() {
    try { safeSet(STORAGE_KEY, JSON.stringify({ enabled: this.state.enabled })); } catch { /* ignore */ }
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
