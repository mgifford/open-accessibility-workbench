import { aiConsentStore, AiConsentStore, MODEL_INFO, MODEL_SOURCES, CONSENT_TEXT } from '../state/ai-consent.js';
import { FEATURES } from '../state/features.js';
import { escapeHtml } from '../utils/escape-html.js';
import {
  isAiRuntimeSupported, loadModel, cancelLoad, disposeModel,
  generateRemediation, cancelGeneration
} from '../ai/client.js';

/**
 * Optional local-AI advisor panel (spec §11 / Phase 15). OFF until the user gives
 * explicit consent; no model downloads on load or report import. When AI is
 * disabled or a model is not loaded, the deterministic guidance rendered elsewhere
 * on the task remains fully available — this panel never replaces it.
 *
 * The REAL model runtime (download + inference) is gated behind
 * FEATURES.aiModelRuntime. When that flag is off, the panel is honest that this
 * build downloads no separate model.
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

    if (!s.enabled) { this.renderConsentGate(webgpu); return; }
    if (FEATURES.aiModelRuntime) { this.renderRuntimePanel(s, webgpu); return; }
    this.renderScaffoldedPanel(s);
  }

  renderConsentGate(webgpu) {
    const runtime = FEATURES.aiModelRuntime;
    this.innerHTML = `
      <div class="card">
        <h3 style="font-weight: 700; font-size: var(--font-size-base);">Optional: Local AI advisor</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); white-space: pre-line; margin: var(--space-2) 0;">${escapeHtml(CONSENT_TEXT)}</p>
        <ul style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-left: var(--space-4);">
          <li>${runtime ? 'Model' : 'Planned model'}: ${escapeHtml(MODEL_INFO.id)} (${escapeHtml(MODEL_INFO.quantization)}, ~${MODEL_INFO.approxDownloadMB} MB).</li>
          <li>WebGPU on this device: ${webgpu ? 'available' : 'not available (a slower WASM fallback would be used where practical)'}.</li>
          ${runtime
            ? '<li>Inference runs entirely on your device — your report is never sent anywhere. Only the model weights are downloaded, from the host you choose.</li>'
            : '<li><strong>This build does not download a separate model.</strong> The advisor composes structured, on-device guidance from the deterministic analysis; a downloadable local model is planned for a later release.</li>'}
          <li>The deterministic guidance on this task works with or without AI.</li>
        </ul>
        <button type="button" class="btn btn-secondary" id="ai-enable-btn" style="margin-top: var(--space-3);">Enable local AI</button>
      </div>`;
    const btn = this.querySelector('#ai-enable-btn');
    if (btn) btn.addEventListener('click', () => aiConsentStore.enable());
  }

  renderScaffoldedPanel(s) {
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
    const btn = this.querySelector('#ai-disable-btn');
    if (btn) btn.addEventListener('click', () => aiConsentStore.disable());
  }

  renderRuntimePanel(s, webgpu) {
    const source = MODEL_SOURCES[s.modelSource] || MODEL_SOURCES.huggingface;
    const supported = isAiRuntimeSupported();
    const draft = this._draft; // last generated draft (or error), if any

    this.innerHTML = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);">
          <h3 style="font-weight: 700; font-size: var(--font-size-base);">Local AI advisor</h3>
          <span class="badge badge-medium">${escapeHtml(statusLabel(s.status))}</span>
        </div>

        <div id="ai-advisor-status" role="status" aria-live="polite" style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: var(--space-2) 0;">
          ${escapeHtml(s.message || 'Enabled. No model is loaded yet.')}
        </div>
        ${s.status === 'downloading' ? `<progress max="100" value="${Number(s.progress) || 0}" style="width: 100%;"></progress>` : ''}

        <fieldset style="border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); margin: var(--space-2) 0;">
          <legend style="font-size: var(--font-size-xs); font-weight: 700; padding: 0 var(--space-1);">Download weights from</legend>
          ${Object.values(MODEL_SOURCES).map(src => `
            <label style="display: flex; align-items: flex-start; gap: var(--space-2); font-size: var(--font-size-sm); margin: var(--space-1) 0;">
              <input type="radio" name="ai-model-source" value="${escapeHtml(src.id)}" ${src.id === source.id ? 'checked' : ''} ${s.status === 'downloading' || s.status === 'ready' ? 'disabled' : ''} />
              <span><strong>${escapeHtml(src.label)}</strong><br><span style="color: var(--color-text-muted); font-size: var(--font-size-xs);">${escapeHtml(src.note)}</span></span>
            </label>`).join('')}
        </fieldset>

        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin: var(--space-1) 0;">
          Model: ${escapeHtml(MODEL_INFO.id)} (~${MODEL_INFO.approxDownloadMB} MB). Device: ${webgpu ? 'WebGPU' : 'WASM (CPU)'}. Inference is on-device; your report is never uploaded.
        </p>

        <div style="display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2);">
          ${!supported ? '<span style="font-size: var(--font-size-sm); color: var(--color-urgency-high);">Web Workers are unavailable in this browser; AI cannot run.</span>' : ''}
          ${supported && s.status !== 'ready' && s.status !== 'downloading' ? '<button type="button" class="btn btn-secondary" id="ai-download-btn">Download &amp; load model</button>' : ''}
          ${supported && s.status === 'downloading' ? '<button type="button" class="btn btn-secondary" id="ai-cancel-download">Cancel download</button>' : ''}
          ${supported && s.status === 'ready' ? '<button type="button" class="btn btn-primary" id="ai-generate-btn">Generate draft suggestion</button>' : ''}
          ${supported && s.status === 'ready' ? '<button type="button" class="btn btn-secondary" id="ai-remove-btn">Remove model from memory</button>' : ''}
          <button type="button" class="btn btn-secondary" id="ai-disable-btn">Disable local AI</button>
        </div>

        ${this._generating ? '<p role="status" aria-live="polite" style="font-size: var(--font-size-sm); margin-top: var(--space-2);">Generating a draft… <button type="button" class="btn btn-secondary" id="ai-cancel-gen">Cancel</button></p>' : ''}

        ${draft ? this.renderDraft(draft) : ''}

        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">
          AI output is an <strong>unverified draft</strong> for a human to review — never applied automatically, and always shown beside the deterministic guidance. It passes the same invention and validation checks, but modest local models can still be wrong.
        </p>
      </div>`;

    this.wireRuntime(s);
  }

  renderDraft(draft) {
    if (draft.error) {
      return `<div style="margin-top: var(--space-3); padding: var(--space-3); border-left: 4px solid var(--color-urgency-high); background: var(--color-urgency-high-bg); border-radius: var(--radius-md);">
        <strong style="font-size: var(--font-size-sm);">No usable draft.</strong>
        <p style="font-size: var(--font-size-sm); margin: var(--space-1) 0 0;">${escapeHtml(draft.error)} The deterministic guidance above remains available.</p>
      </div>`;
    }
    const c = draft.finalCandidate;
    if (!c) {
      return `<div style="margin-top: var(--space-3); padding: var(--space-3); border-left: 4px solid var(--color-urgency-medium); background: var(--color-urgency-medium-bg); border-radius: var(--radius-md);">
        <strong style="font-size: var(--font-size-sm);">Draft did not pass validation.</strong>
        <p style="font-size: var(--font-size-sm); margin: var(--space-1) 0 0;">The model's suggestion failed the deterministic checks and was withheld (outcome: ${escapeHtml(draft.outcome || 'unresolved')}). Use the deterministic guidance above.</p>
      </div>`;
    }
    // Present a clearly-labelled DRAFT. All fields are escaped; markup is shown as
    // text, never rendered.
    return `
      <div style="margin-top: var(--space-3); padding: var(--space-3); border: 2px dashed var(--color-brand-primary); border-radius: var(--radius-md);">
        <div style="display:flex; align-items:center; gap:var(--space-2);">
          <span class="badge badge-medium">AI DRAFT — review required</span>
        </div>
        <dl style="font-size: var(--font-size-sm); margin-top: var(--space-2);">
          <dt style="font-weight:700;">Summary</dt><dd>${escapeHtml(c.summary || '')}</dd>
          <dt style="font-weight:700; margin-top:var(--space-2);">Suggested strategy</dt><dd>${escapeHtml(c.recommendedStrategy || '')}</dd>
          ${c.targetMarkup ? `<dt style="font-weight:700; margin-top:var(--space-2);">Suggested markup (draft)</dt><dd><pre style="white-space:pre-wrap; overflow-x:auto; background:var(--color-bg-subtle); padding:var(--space-2); border-radius:var(--radius-sm);">${escapeHtml(c.targetMarkup)}</pre></dd>` : ''}
          ${Array.isArray(c.developerDecisionsRequired) && c.developerDecisionsRequired.length ? `<dt style="font-weight:700; margin-top:var(--space-2);">You must decide</dt><dd><ul style="margin-left:var(--space-4);">${c.developerDecisionsRequired.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul></dd>` : ''}
        </dl>
      </div>`;
  }

  wireRuntime(s) {
    const on = (id, fn) => { const el = this.querySelector(id); if (el) el.addEventListener('click', fn); };

    this.querySelectorAll('input[name="ai-model-source"]').forEach(r =>
      r.addEventListener('change', (e) => aiConsentStore.setModelSource(e.target.value)));

    on('#ai-disable-btn', async () => { try { await disposeModel(); } catch { /* ignore */ } aiConsentStore.disable(); });

    on('#ai-download-btn', async () => {
      aiConsentStore.markDownloading(0, 'Starting download…');
      try {
        const { device } = await loadModel(MODEL_INFO.id, s.modelSource, (p) => {
          const pct = Math.round(Number(p.progress) || 0);
          aiConsentStore.markDownloading(pct, p.file ? `Downloading ${p.file}… ${pct}%` : `Downloading… ${pct}%`);
        });
        aiConsentStore.markReady(device);
      } catch (err) {
        if (err && err.name === 'AbortError') aiConsentStore.setState({ status: 'consented', progress: 0, message: 'Download cancelled. Deterministic guidance remains available.' });
        else aiConsentStore.markError(err.message || 'Model download failed');
      }
    });

    on('#ai-cancel-download', () => { cancelLoad(); });

    on('#ai-remove-btn', async () => {
      try { await disposeModel(); } catch { /* ignore */ }
      aiConsentStore.setState({ status: 'consented', progress: 0, message: 'Model removed from memory. Re-download to use AI again.' });
    });

    on('#ai-generate-btn', async () => {
      if (!this._task) { aiConsentStore.setState({ message: 'Open a task to generate a suggestion.' }); return; }
      this._draft = null; this._generating = true; this.render();
      try {
        const data = await generateRemediation(this._task, {
          sourceContext: this._task.sourceContext || null,
          validationContext: { originalSnippet: this._task.representativeHtml }
        });
        this._draft = data;
      } catch (err) {
        this._draft = { error: err.message || 'Generation failed' };
      } finally {
        this._generating = false;
        this.render();
      }
    });

    on('#ai-cancel-gen', () => { cancelGeneration(); });
  }
}

function statusLabel(status) {
  return ({ disabled: 'Disabled', consented: 'Enabled', downloading: 'Downloading', ready: 'Ready', error: 'Unavailable' })[status] || status;
}

customElements.define('ai-advisor', AiAdvisor);
