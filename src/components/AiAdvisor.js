import { requestAiRemediation } from '../ai/client.js';

export class AiAdvisor extends HTMLElement {
  set task(t) {
    this._task = t;
    this.render();
  }

  render() {
    if (!this._task) return;
    this.innerHTML = `
      <div class="card" style="background-color: var(--color-brand-bg); border-color: var(--color-brand-primary);">
        <h4 style="font-weight: 700; color: var(--color-brand-primary); margin-bottom: var(--space-2);">Local In-Browser AI Advisor</h4>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--space-3);">
          Runs locally via WebGPU/WASM. Never uploads report content or website snippets.
        </p>
        <button type="button" class="btn btn-primary" id="run-ai-btn">Generate AI Candidate</button>
        <div id="ai-output" style="margin-top: var(--space-3); display: none;"></div>
      </div>
    `;

    const btn = this.querySelector('#run-ai-btn');
    const out = this.querySelector('#ai-output');

    if (btn) {
      btn.addEventListener('click', async () => {
        out.style.display = 'block';
        out.textContent = 'Generating candidate with validation feedback loop...';
        try {
          const res = await requestAiRemediation(this._task, 'HuggingFaceTB/SmolLM2-135M-Instruct');
          out.innerHTML = `
            <pre class="code-block" style="margin-top: var(--space-2);"><code>${escapeHtml(res.targetMarkup || res.sourceAwareCandidate || '')}</code></pre>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-1);">
              Status: ${res.validationResult?.status || 'Passed'} (Validated in ${res.attempts} attempt(s))
            </div>
          `;
        } catch (err) {
          out.textContent = 'Error: ' + err.message;
        }
      });
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

customElements.define('ai-advisor', AiAdvisor);
