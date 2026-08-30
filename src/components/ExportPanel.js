import { workspaceStore } from '../state/workspace.js';
import { exportTasksToJson } from '../export/json.js';
import { exportTasksToJsonLd } from '../export/jsonld.js';
import { exportTasksToMarkdown } from '../export/markdown.js';

export class ExportPanel extends HTMLElement {
  connectedCallback() {
    this.unsubscribe = workspaceStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    const { loaded, tasks, observations, sourceSummary } = workspaceStore.state;

    if (!loaded) {
      this.innerHTML = `<section class="card"><p>Please load a report first.</p></section>`;
      return;
    }

    const jsonExport = exportTasksToJson({ tasks, observations, sourceSummary });
    const jsonLdExport = exportTasksToJsonLd({ tasks, observations, sourceSummary });
    const mdExport = exportTasksToMarkdown({ tasks, observations, sourceSummary });

    this.innerHTML = `
      <section>
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: var(--font-size-2xl);">Export Remediation Plan</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              Export ${tasks.length} remediation tasks with full data provenance, ARRM role mappings, and verification criteria.
            </p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          <!-- Markdown Export Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Markdown Document</h3>
              <button type="button" class="btn btn-secondary" id="download-md-btn">Download Markdown</button>
            </div>
            <pre class="code-block" style="max-height: 200px;"><code>${escapeHtml(mdExport.slice(0, 1000))}...</code></pre>
          </div>

          <!-- JSON Export Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">JSON Export (Full Provenance)</h3>
              <button type="button" class="btn btn-secondary" id="download-json-btn">Download JSON</button>
            </div>
            <pre class="code-block" style="max-height: 200px;"><code>${escapeHtml(jsonExport.slice(0, 1000))}...</code></pre>
          </div>

          <!-- JSON-LD Export Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">JSON-LD (W3C Semantic Web)</h3>
              <button type="button" class="btn btn-secondary" id="download-jsonld-btn">Download JSON-LD</button>
            </div>
            <pre class="code-block" style="max-height: 200px;"><code>${escapeHtml(jsonLdExport.slice(0, 1000))}...</code></pre>
          </div>
        </div>
      </section>
    `;

    this.setupListeners(jsonExport, jsonLdExport, mdExport);
  }

  setupListeners(jsonText, jsonLdText, mdText) {
    const jsonBtn = this.querySelector('#download-json-btn');
    const jsonLdBtn = this.querySelector('#download-jsonld-btn');
    const mdBtn = this.querySelector('#download-md-btn');

    if (jsonBtn) {
      jsonBtn.addEventListener('click', () => {
        downloadBlob(jsonText, 'remediation-plan.json', 'application/json');
      });
    }

    if (jsonLdBtn) {
      jsonLdBtn.addEventListener('click', () => {
        downloadBlob(jsonLdText, 'remediation-plan.jsonld', 'application/ld+json');
      });
    }

    if (mdBtn) {
      mdBtn.addEventListener('click', () => {
        downloadBlob(mdText, 'remediation-plan.md', 'text/markdown');
      });
    }
  }
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

customElements.define('export-panel', ExportPanel);
