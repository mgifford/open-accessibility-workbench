import { aiConsentStore, AiConsentStore, MODEL_INFO, MODEL_SOURCES, consentText } from '../state/ai-consent.js';
import { FEATURES } from '../state/features.js';
import { escapeHtml } from '../utils/escape-html.js';
import { probeAndDecide } from '../ai/router.js';
import { connectionWarning } from '../ai/browser-capabilities.js';
import {
  deterministicProvider, createBrowserPromptProvider, createTransformersProvider
} from '../ai/providers.js';

/**
 * Optional local-AI advisor panel (spec §11 / ADR 0001). OFF until the user gives
 * explicit consent; no model downloads on load or report import.
 *
 * The panel is driven by a CAPABILITY ROUTE decided per session, never by browser
 * brand (ADR 0001):
 *   - browser-prompt / browser-prompt-downloadable → the browser's built-in
 *     on-device AI (no dependency, no download we host, not build-gated).
 *   - transformers → the build-gated (VITE_AI_RUNTIME) transformers.js model,
 *     only when WebGPU is usable.
 *   - deterministic → the honest floor; no separate model is downloaded.
 *
 * Whatever route runs, its output passes the same invention + validation gate and
 * is shown as a clearly-labelled DRAFT beside the deterministic guidance. On any
 * failure the panel falls back down the route order to deterministic guidance.
 */
export class AiAdvisor extends HTMLElement {
  set task(t) { this._task = t; this.render(); }

  connectedCallback() {
    this._unsub = aiConsentStore.subscribe(() => this.render());
    this.render();
    // Probe capabilities once per mount to decide the route. Never downloads.
    this._probe();
  }
  disconnectedCallback() {
    if (this._unsub) this._unsub();
    if (this._provider?.close) { try { this._provider.close(); } catch { /* ignore */ } }
  }

  async _probe() {
    if (this._probed) return;
    this._probed = true;
    try {
      const { decision } = await probeAndDecide(globalThis, { transformersBuilt: FEATURES.aiModelRuntime });
      this._route = decision.route;
      this._routeReason = decision.reason;

      // A browser that reports a READY built-in AI is cheap to verify without any
      // download, so confirm it actually generates (not a stub that echoes the
      // prompt) before offering it. A model that is merely DOWNLOADABLE is not
      // self-tested here — that would trigger a download; it is verified at
      // prepare() time instead. Either way a stub never reaches "Generate".
      if (this._route === 'browser-prompt') {
        const test = await this.provider().selfTest?.();
        if (test && !test.usable) {
          this._route = 'deterministic';
          this._routeReason = test.reason;
          this._provider = null; // drop the unusable browser provider
        }
      }
    } catch {
      this._route = 'deterministic';
      this._routeReason = 'Capability probe failed; using deterministic guidance.';
    }
    aiConsentStore.setRoute(this._route); // triggers a re-render via subscribe
  }

  /** The provider for the current route (lazily created, reused). */
  provider() {
    if (this._provider && this._providerRoute === this._route) return this._provider;
    if (this._provider?.close) { try { this._provider.close(); } catch { /* ignore */ } }
    this._providerRoute = this._route;
    if (this._route === 'browser-prompt' || this._route === 'browser-prompt-downloadable') {
      this._provider = createBrowserPromptProvider();
    } else if (this._route === 'transformers') {
      this._provider = createTransformersProvider({ modelId: MODEL_INFO.id, source: aiConsentStore.state.modelSource });
    } else {
      this._provider = deterministicProvider;
    }
    return this._provider;
  }

  render() {
    const s = aiConsentStore.state;
    const route = this._route || s.aiRoute || (FEATURES.aiModelRuntime ? 'transformers' : 'deterministic');

    // The route already folds in both real capability AND the build flag:
    // 'deterministic' means neither a built runtime nor a browser Prompt API is
    // usable here. In that case, follow main's honest gate — say drafting is not
    // available and offer nothing to enable (no inert "Enabled" state).
    if (route === 'deterministic') { this.renderUnavailableGate(); return; }

    if (!s.enabled) { this.renderConsentGate(route); return; }
    if (route === 'browser-prompt' || route === 'browser-prompt-downloadable') { this.renderBrowserPanel(s, route); return; }
    this.renderRuntimePanel(s);
  }

  /**
   * Shown when no AI route is usable here (no browser Prompt API and no built
   * transformers runtime). Be unambiguous that drafting cannot run — do NOT offer
   * an "Enable" that only flips to an inert "Enabled" state.
   */
  renderUnavailableGate() {
    // If we reached the deterministic floor because a browser Prompt API was
    // exposed but failed its self-test (a stub/echo model), say so specifically
    // rather than implying the build ships no model.
    const stubDetected = /echo|not actually available|did not produce|self-test|no output/i.test(this._routeReason || '');
    const lead = stubDetected
      ? `<strong>This browser’s built-in AI isn’t usable here.</strong> ${escapeHtml(this._routeReason)} There is nothing to enable — the deterministic guidance below works without it.`
      : `<strong>AI drafting is not available in this build.</strong> This deployment ships no on-device model, so there is nothing to enable or download here.`;
    this.innerHTML = `
      <div class="card">
        <h3 style="font-weight: 700; font-size: var(--font-size-base);">Local AI advisor</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: var(--space-2) 0;">
          ${lead}
        </p>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin: var(--space-2) 0;">
          On-device drafting is planned for a later release (it would run entirely in your browser — your report would never be uploaded). The deterministic guidance on this task works fully without it.
        </p>
      </div>`;
  }

  renderConsentGate(route) {
    const webgpu = AiConsentStore.webgpuAvailable();
    const browser = route === 'browser-prompt' || route === 'browser-prompt-downloadable';
    const transformers = route === 'transformers';
    this.innerHTML = `
      <div class="card">
        <h3 style="font-weight: 700; font-size: var(--font-size-base);">Optional: Local AI advisor</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); white-space: pre-line; margin: var(--space-2) 0;">${escapeHtml(consentText(route))}</p>
        <ul style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-left: var(--space-4);">
          ${browser
            ? `<li>This browser exposes a built-in on-device AI${route === 'browser-prompt-downloadable' ? ' (its model is downloaded by the browser, disclosed first)' : ''}. Inference stays on your device; your report is never sent anywhere.</li>`
            : ''}
          ${transformers
            ? `<li>Model: ${escapeHtml(MODEL_INFO.id)} (${escapeHtml(MODEL_INFO.quantization)}, ~${MODEL_INFO.approxDownloadMB} MB), from the host you choose.</li>
               <li>WebGPU on this device: ${webgpu ? 'available' : 'not available'}. Inference runs entirely on your device — your report is never sent anywhere.</li>`
            : ''}
          <li>The deterministic guidance on this task works with or without AI.</li>
        </ul>
        <button type="button" class="btn btn-secondary" id="ai-enable-btn" style="margin-top: var(--space-3);">Enable local AI</button>
      </div>`;
    const btn = this.querySelector('#ai-enable-btn');
    if (btn) btn.addEventListener('click', () => aiConsentStore.enable());
  }

  renderBrowserPanel(s, route) {
    const downloadable = route === 'browser-prompt-downloadable';
    const draft = this._draft;
    const connWarn = downloadable ? connectionWarning() : '';
    this.innerHTML = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);">
          <h3 style="font-weight: 700; font-size: var(--font-size-base);">Local AI advisor</h3>
          <span class="badge badge-medium">${escapeHtml(statusLabel(s.status))}</span>
        </div>
        <div id="ai-advisor-status" role="status" aria-live="polite" style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: var(--space-2) 0;">
          ${escapeHtml(s.message || (downloadable
            ? 'Enabled. This browser can provide a built-in on-device AI; its model is downloaded by the browser when you prepare it.'
            : 'Enabled. Using this browser’s built-in on-device AI. Your report is never uploaded.'))}
        </div>
        ${s.status === 'downloading' && Number(s.progress) ? `<progress max="100" value="${Number(s.progress) || 0}" style="width: 100%;"></progress>` : ''}
        ${connWarn ? `<p style="font-size: var(--font-size-xs); color: var(--color-urgency-medium); margin: var(--space-1) 0;">${escapeHtml(connWarn)}</p>` : ''}
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin: var(--space-1) 0;">
          Uses the browser’s built-in on-device AI. No separate model is downloaded from this project; inference is on-device and your report is never uploaded.
        </p>
        <div style="display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2);">
          ${downloadable && s.status !== 'ready' && s.status !== 'downloading' ? '<button type="button" class="btn btn-secondary" id="ai-prepare-btn">Prepare browser AI</button>' : ''}
          ${!downloadable || s.status === 'ready' ? '<button type="button" class="btn btn-primary" id="ai-generate-btn">Generate draft suggestion</button>' : ''}
          <button type="button" class="btn btn-secondary" id="ai-disable-btn">Disable local AI</button>
        </div>
        ${this._generating ? `<p role="status" aria-live="polite" style="font-size: var(--font-size-sm); margin-top: var(--space-2);">Generating a draft…</p>${this.renderStreamPreview()}` : ''}
        ${draft ? this.renderDraft(draft) : ''}
        ${this.draftDisclaimer()}
      </div>`;
    this.wireBrowser();
  }

  renderRuntimePanel(s) {
    const source = MODEL_SOURCES[s.modelSource] || MODEL_SOURCES.huggingface;
    const webgpu = AiConsentStore.webgpuAvailable();
    const draft = this._draft;

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
        ${connectionWarning() ? `<p style="font-size: var(--font-size-xs); color: var(--color-urgency-medium); margin: var(--space-1) 0;">${escapeHtml(connectionWarning())}</p>` : ''}

        <div style="display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2);">
          ${s.status !== 'ready' && s.status !== 'downloading' ? '<button type="button" class="btn btn-secondary" id="ai-download-btn">Download &amp; load model</button>' : ''}
          ${s.status === 'downloading' ? '<button type="button" class="btn btn-secondary" id="ai-cancel-download">Cancel download</button>' : ''}
          ${s.status === 'ready' ? '<button type="button" class="btn btn-primary" id="ai-generate-btn">Generate draft suggestion</button>' : ''}
          ${s.status === 'ready' ? '<button type="button" class="btn btn-secondary" id="ai-remove-btn">Remove model from memory</button>' : ''}
          <button type="button" class="btn btn-secondary" id="ai-disable-btn">Disable local AI</button>
        </div>

        ${this._generating ? `<p role="status" aria-live="polite" style="font-size: var(--font-size-sm); margin-top: var(--space-2);">Generating a draft… <button type="button" class="btn btn-secondary" id="ai-cancel-gen">Cancel</button></p>${this.renderStreamPreview()}` : ''}

        ${draft ? this.renderDraft(draft) : ''}
        ${this.draftDisclaimer()}
      </div>`;

    this.wireRuntime(s);
  }

  draftDisclaimer() {
    return `
      <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">
        AI output is an <strong>unverified draft</strong> for a human to review — never applied automatically, and always shown beside the deterministic guidance. It passes the same invention and validation checks, but modest local models can still be wrong.
      </p>`;
  }

  renderDraft(draft) {
    if (draft.error) {
      return `<div style="margin-top: var(--space-3); padding: var(--space-3); border-left: 4px solid var(--color-urgency-high); background: var(--color-urgency-high-bg); border-radius: var(--radius-md);">
        <strong style="font-size: var(--font-size-sm);">No usable draft.</strong>
        <p style="font-size: var(--font-size-sm); margin: var(--space-1) 0 0;">${escapeHtml(draft.error)} The deterministic guidance above remains available.</p>
        ${this.renderRegenerate()}
      </div>`;
    }
    const c = draft.finalCandidate;
    if (!c) {
      // A withheld draft: instead of a terse "did not pass", tell the user
      // exactly what the deterministic checks flagged, what would help, and offer
      // a regenerate. The validation story below carries the specifics.
      return `<div style="margin-top: var(--space-3); padding: var(--space-3); border-left: 4px solid var(--color-urgency-medium); background: var(--color-urgency-medium-bg); border-radius: var(--radius-md);">
        <strong style="font-size: var(--font-size-sm);">The draft was withheld — it didn't pass the deterministic checks.</strong>
        <p style="font-size: var(--font-size-sm); margin: var(--space-1) 0 0;">The model's suggestion is not shown because it failed validation (outcome: ${escapeHtml(draft.outcome || 'unresolved')}). Use the deterministic guidance above.</p>
        ${this.renderNextSteps(draft)}
        ${this.renderValidationStory(draft)}
        ${this.renderRegenerate()}
      </div>`;
    }
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
        ${this.renderDeterministicDiff(c)}
        ${this.renderValidationStory(draft)}
        ${this.renderRegenerate()}
      </div>`;
  }

  /**
   * B3 — Validation transparency. Turns the hidden validationExport into a
   * visible, trustworthy story: what each attempt was checked against, whether a
   * retry ran, the measured value vs. its threshold, and the manual checks that
   * remain. Renders nothing when there is no attempt data.
   */
  renderValidationStory(draft) {
    const ve = draft.validationExport;
    const attempts = ve?.attempts || [];
    if (!attempts.length) return '';

    const retried = attempts.length > 1;
    const rows = attempts.map(a => {
      const passed = a.status === 'passed';
      const label = a.status === 'passed' ? 'passed'
        : a.status === 'insufficient-evidence' ? 'needs page-level check'
        : 'failed';
      const colour = passed ? 'var(--color-urgency-low, #2e7d32)'
        : a.status === 'insufficient-evidence' ? 'var(--color-urgency-medium)'
        : 'var(--color-urgency-high)';
      const measured = this.measuredVsThreshold(a.results);
      const errs = Array.isArray(a.results?.errors) && a.results.errors.length
        ? `<div style="color: var(--color-text-secondary);">Flagged: ${escapeHtml(a.results.errors.join('; '))}</div>` : '';
      return `<li style="margin-bottom: var(--space-1);">
        <strong>Attempt ${a.attempt}:</strong> <span style="color:${colour};">${escapeHtml(label)}</span>
        ${a.humanReadableStatus ? `<span style="color: var(--color-text-secondary);"> — ${escapeHtml(a.humanReadableStatus)}</span>` : ''}
        ${measured ? `<div style="color: var(--color-text-secondary);">${measured}</div>` : ''}
        ${errs}
      </li>`;
    }).join('');

    const manual = ve.manualVerificationRequired || [];
    return `
      <details style="margin-top: var(--space-2); font-size: var(--font-size-sm);">
        <summary style="cursor: pointer; font-weight: 700;">How this draft was checked${retried ? ' (a retry ran)' : ''}</summary>
        <ol style="margin: var(--space-2) 0 0 var(--space-4);">${rows}</ol>
        ${manual.length ? `<div style="margin-top: var(--space-2);"><strong>Still needs a human to verify:</strong>
          <ul style="margin-left: var(--space-4);">${manual.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul></div>` : ''}
      </details>`;
  }

  /** Renders "measured X vs required Y" when the validator reported a ratio. */
  measuredVsThreshold(results) {
    if (!results || results.ratio === undefined || results.ratio === null) return '';
    const measured = Number(results.ratio);
    const required = results.requiredThreshold;
    if (!Number.isFinite(measured)) return '';
    const reqText = (required !== undefined && required !== null) ? ` vs. required ${escapeHtml(String(required))}:1` : '';
    return `Measured contrast ${escapeHtml(measured.toFixed(2))}:1${reqText}`;
  }

  /**
   * B4 — Actionable failures. Derives specific next steps from what the last
   * attempt flagged, rather than a generic "did not pass".
   */
  renderNextSteps(draft) {
    const attempts = draft.validationExport?.attempts || [];
    const last = attempts[attempts.length - 1];
    const steps = [];
    const errorText = (last?.results?.errors || []).join(' ').toLowerCase();
    const statusText = (last?.humanReadableStatus || '').toLowerCase();

    if (last?.status === 'insufficient-evidence' || /page-level|computed styles|geometry/.test(statusText)) {
      steps.push('This rule needs page-level verification — check it against the live page (computed styles/geometry are not available from the snippet alone).');
    }
    if (/invented|fabricat/.test(errorText) || /invented content/.test(statusText)) {
      steps.push('The model introduced specific values (e.g. a colour or wording) that were not in the source. Add source context below so the draft can be grounded in your real markup.');
    }
    if (/contrast/.test(errorText) || /contrast/.test(statusText)) {
      steps.push('The suggested colours did not meet the contrast threshold. Provide the real foreground/background colours so a compliant pair can be checked.');
    }
    if (!this._task?.sourceContext) {
      steps.push('Adding source context (the surrounding template or component) usually improves the draft.');
    }
    if (!steps.length) steps.push('Try regenerating; if it keeps failing, the deterministic guidance above is the reliable path for this task.');

    return `<div style="margin-top: var(--space-2); font-size: var(--font-size-sm);">
      <strong>What would help:</strong>
      <ul style="margin-left: var(--space-4);">${steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
    </div>`;
  }

  /**
   * B5 — Draft-vs-deterministic diff. Shows the model's suggested markup beside
   * the deterministic blueprint's targetMarkup so the user sees exactly what the
   * model contributed. Renders nothing unless both are present and differ.
   */
  renderDeterministicDiff(candidate) {
    const aiMarkup = candidate?.targetMarkup;
    const detMarkup = this._task?.blueprint?.targetMarkup;
    if (!aiMarkup || !detMarkup) return '';
    if (norm(aiMarkup) === norm(detMarkup)) {
      return `<p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">
        The AI's suggested markup matches the deterministic blueprint — the model added nothing new here.
      </p>`;
    }
    return `
      <details style="margin-top: var(--space-2); font-size: var(--font-size-sm);">
        <summary style="cursor: pointer; font-weight: 700;">Compare with the deterministic blueprint</summary>
        <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-2); margin-top: var(--space-2);">
          <div>
            <div style="font-weight: 700; font-size: var(--font-size-xs); color: var(--color-text-secondary);">Deterministic blueprint</div>
            <pre style="white-space:pre-wrap; overflow-x:auto; background:var(--color-bg-subtle); padding:var(--space-2); border-radius:var(--radius-sm);">${escapeHtml(detMarkup)}</pre>
          </div>
          <div>
            <div style="font-weight: 700; font-size: var(--font-size-xs); color: var(--color-brand-primary);">AI draft (what the model contributed)</div>
            <pre style="white-space:pre-wrap; overflow-x:auto; background:var(--color-bg-subtle); padding:var(--space-2); border-radius:var(--radius-sm); border-left: 3px solid var(--color-brand-primary);">${escapeHtml(aiMarkup)}</pre>
          </div>
        </div>
      </details>`;
  }

  /** B4 — a Regenerate button that re-runs the same generation. */
  renderRegenerate() {
    if (this._generating) return '';
    return `<div style="margin-top: var(--space-2);">
      <button type="button" class="btn btn-secondary" id="ai-regenerate-btn">Regenerate draft</button>
    </div>`;
  }

  /** Shared: run the current provider's generate and store the draft. */
  async _generate() {
    if (!this._task) { aiConsentStore.setState({ message: 'Open a task to generate a suggestion.' }); return; }
    this._draft = null; this._generating = true; this._streamPartial = ''; this.render();
    try {
      const data = await this.provider().generate({
        task: this._task,
        sourceContext: this._task.sourceContext || null,
        validationContext: { originalSnippet: this._task.representativeHtml },
        onProgress: (p) => {
          if (p?.status) aiConsentStore.setState({ message: p.status });
          // Live token stream (browser Prompt API): update only the in-progress
          // preview, cheaply, without a full re-render of the whole panel.
          if (typeof p?.partial === 'string') {
            this._streamPartial = p.partial;
            this._updateStreamPreview();
          }
        }
      });
      this._draft = data;
    } catch (err) {
      this._draft = { error: err.message || 'Generation failed' };
    } finally {
      this._generating = false;
      this._streamPartial = '';
      // Clear the transient "Generating (attempt N)…" progress line — generation
      // is done, and the draft card below now carries the outcome and details.
      const done = this._draft?.finalCandidate
        ? 'Draft ready for review below.'
        : (this._draft?.error ? '' : 'No draft was produced — see the details below.');
      aiConsentStore.setState({ message: done });
      this.render();
    }
  }

  /**
   * Renders the live streaming preview. The partial text is the model's RAW,
   * UNVERIFIED output as it arrives — shown so the wait feels alive, but clearly
   * labelled and never mistaken for the validated draft, which only appears
   * after the invention + validation gate passes.
   */
  renderStreamPreview() {
    if (!this._generating) return '';
    const partial = this._streamPartial || '';
    return `
      <div id="ai-stream-preview" style="margin-top: var(--space-2); padding: var(--space-3); border: 1px dashed var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-subtle);">
        <div style="display:flex; align-items:center; gap:var(--space-2);">
          <span class="badge badge-medium">Drafting…</span>
          <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">raw model output — not yet checked</span>
        </div>
        <pre id="ai-stream-text" aria-live="polite" style="white-space: pre-wrap; word-break: break-word; max-height: 12em; overflow-y: auto; font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-2); font-family: var(--font-mono);">${escapeHtml(partial)}</pre>
      </div>`;
  }

  /** Cheap in-place update of the streaming preview text (no full re-render). */
  _updateStreamPreview() {
    const el = this.querySelector('#ai-stream-text');
    if (el) {
      el.textContent = this._streamPartial || '';
      el.scrollTop = el.scrollHeight;
    }
  }

  wireBrowser() {
    const on = (id, fn) => { const el = this.querySelector(id); if (el) el.addEventListener('click', fn); };
    on('#ai-disable-btn', async () => { try { await this.provider().close?.(); } catch { /* ignore */ } aiConsentStore.disable(); });
    on('#ai-prepare-btn', async () => {
      aiConsentStore.markDownloading(0, 'Preparing the browser’s built-in AI…');
      try {
        await this.provider().prepare?.((p) => {
          const pct = Math.round(Number(p.progress) || 0);
          aiConsentStore.markDownloading(pct, `Downloading the browser’s AI… ${pct}%`);
        });
        aiConsentStore.markReady('browser');
      } catch (err) {
        // A stub/echo Prompt API surfaces here: don't offer a broken Generate —
        // switch to the honest "AI drafting is not available" gate so the user
        // isn't led into a generate that can only fail.
        if (err && err.name === 'BrowserAiUnusableError') {
          this._route = 'deterministic';
          this._routeReason = err.message;
          this._provider = null;
          aiConsentStore.disable();
          aiConsentStore.setRoute('deterministic');
          return;
        }
        aiConsentStore.markError(err.message || 'The browser could not prepare its AI');
      }
    });
    on('#ai-generate-btn', () => this._generate());
    on('#ai-regenerate-btn', () => this._generate());
  }

  wireRuntime(s) {
    const on = (id, fn) => { const el = this.querySelector(id); if (el) el.addEventListener('click', fn); };

    this.querySelectorAll('input[name="ai-model-source"]').forEach(r =>
      r.addEventListener('change', (e) => { aiConsentStore.setModelSource(e.target.value); this._provider = null; }));

    on('#ai-disable-btn', async () => { try { await this.provider().close?.(); } catch { /* ignore */ } aiConsentStore.disable(); });

    on('#ai-download-btn', async () => {
      aiConsentStore.markDownloading(0, 'Starting download…');
      try {
        const { device } = await this.provider().prepare((p) => {
          const pct = Math.round(Number(p.progress) || 0);
          aiConsentStore.markDownloading(pct, p.file ? `Downloading ${p.file}… ${pct}%` : `Downloading… ${pct}%`);
        });
        aiConsentStore.markReady(device);
      } catch (err) {
        if (err && err.name === 'AbortError') aiConsentStore.setState({ status: 'consented', progress: 0, message: 'Download cancelled. Deterministic guidance remains available.' });
        else aiConsentStore.markError(err.message || 'Model download failed');
      }
    });

    on('#ai-cancel-download', () => { this.provider().cancelPrepare?.(); });

    on('#ai-remove-btn', async () => {
      try { await this.provider().close?.(); } catch { /* ignore */ }
      this._provider = null;
      aiConsentStore.setState({ status: 'consented', progress: 0, message: 'Model removed from memory. Re-download to use AI again.' });
    });

    on('#ai-generate-btn', () => this._generate());
    on('#ai-regenerate-btn', () => this._generate());
    on('#ai-cancel-gen', () => { this.provider().cancelGeneration?.(); });
  }
}

function statusLabel(status) {
  return ({ disabled: 'Disabled', consented: 'Enabled', downloading: 'Downloading', ready: 'Ready', error: 'Unavailable' })[status] || status;
}

/** Whitespace-insensitive comparison for the draft-vs-deterministic markup diff. */
function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

customElements.define('ai-advisor', AiAdvisor);
