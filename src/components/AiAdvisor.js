import { aiConsentStore, AiConsentStore, MODEL_INFO, CONSENT_TEXT } from '../state/ai-consent.js';
import { escapeHtml } from '../utils/escape-html.js';

/**
 * Optional local-AI advisor panel (spec §11.3/§11.6/§11.7). It is OFF until the
 * user gives explicit consent; no model downloads on load or report import. When
 * AI is disabled or unavailable, deterministic guidance (rendered elsewhere on
 * the task) remains fully available — this panel never replaces it.
 */
export class AiAdvisor extends HTMLElement {
  set task(t) { this._task = t; this.render(); }

  connectedCallback() {
    this._unsub = aiConsentStore.subscribe(() => this.render());
    this.render();
  }
  disconnectedCallback() { if (this._unsub) this._unsub(); }

  render() {
    const s = aiConsentStore.state;
    const webgpu = AiConsentStore.webgpuAvailable();

    // Not yet enabled: show the consent gate.
    if (!s.enabled) {
      this.innerHTML = `
        <div class="card">
          <h3 style="font-weight: 700; font-size: var(--font-size-base);">Optional: Local AI advisor</h3>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); white-space: pre-line; margin: var(--space-2) 0;">${escapeHtml(CONSENT_TEXT)}</p>
          <ul style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-left: var(--space-4);">
            <li>Planned model: ${escapeHtml(MODEL_INFO.id)} (${escapeHtml(MODEL_INFO.quantization)}, rev ${escapeHtml(MODEL_INFO.revision)}, ~${MODEL_INFO.approxDownloadMB} MB).</li>
            <li>WebGPU on this device: ${webgpu ? 'available' : 'not available (a slower WASM fallback would be used where practical)'}.</li>
            <li><strong>This build does not download a separate model.</strong> The advisor composes structured, on-device guidance from the deterministic analysis; a downloadable local model is planned for a later release.</li>
            <li>The deterministic guidance on this task works with or without AI.</li>
          </ul>
          <button type="button" class="btn btn-secondary" id="ai-enable-btn" style="margin-top: var(--space-3);">Enable local AI</button>
        </div>`;
      const btn = this.querySelector('#ai-enable-btn');
      if (btn) btn.addEventListener('click', () => aiConsentStore.enable());
      return;
    }

    // Enabled: show status + Disable. There is no separate model download in this
    // build, so no download/cancel/remove controls are shown — showing controls
    // that do nothing real would be misleading. The status reflects the store's
    // lifecycle state, which the real runtime (a later phase) will drive.
    this.innerHTML = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);">
          <h3 style="font-weight: 700; font-size: var(--font-size-base);">Local AI advisor</h3>
          <span class="badge badge-medium">${escapeHtml(statusLabel(s.status))}</span>
        </div>
        <div id="ai-advisor-status" role="status" aria-live="polite" style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: var(--space-2) 0;">
          ${escapeHtml(s.message || 'Enabled. This build composes structured guidance on-device; no separate model is downloaded.')}
        </div>
        <div style="display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2);">
          <button type="button" class="btn btn-secondary" id="ai-disable-btn">Disable local AI</button>
        </div>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">
          AI contributions are optional and clearly labelled. If anything fails, the deterministic guidance on this task remains available.
        </p>
      </div>`;

    this.setup();
  }

  setup() {
    const on = (id, fn) => { const el = this.querySelector(id); if (el) el.addEventListener('click', fn); };
    on('#ai-disable-btn', () => aiConsentStore.disable());
  }
}

function statusLabel(status) {
  return ({ disabled: 'Disabled', consented: 'Enabled', downloading: 'Downloading', ready: 'Ready', error: 'Unavailable' })[status] || status;
}

customElements.define('ai-advisor', AiAdvisor);
