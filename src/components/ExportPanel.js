import { workspaceStore } from '../state/workspace.js';
import { exportTasksToJson } from '../export/json.js';
import { exportTasksToJsonLd } from '../export/jsonld.js';
import { exportTasksToMarkdown } from '../export/markdown.js';
import { escapeHtml } from '../utils/escape-html.js';

/**
 * The three whole-document export formats. `title` is the card heading; the
 * preview shows the COMPLETE document (scrollable), and Download / Copy act on
 * the same full text — nothing is truncated.
 *
 * The JSON export embeds each task's constituent observations with their record
 * pointers back into the scan report (see src/export/json.js), so it carries
 * finding-level provenance.
 */
const FORMATS = [
  { key: 'md', title: 'Markdown Document', filename: 'remediation-plan.md', mime: 'text/markdown', build: (d) => exportTasksToMarkdown(d) },
  { key: 'json', title: 'JSON (with finding provenance)', filename: 'remediation-plan.json', mime: 'application/json', build: (d) => exportTasksToJson(d) },
  { key: 'jsonld', title: 'JSON-LD (W3C linked data)', filename: 'remediation-plan.jsonld', mime: 'application/ld+json', build: (d) => exportTasksToJsonLd(d) }
];

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
      this.innerHTML = `
        <section class="card">
          <h2 class="card-title" style="font-size: var(--font-size-2xl);">Export Remediation Plan</h2>
          <p style="color: var(--color-text-muted); margin: var(--space-4) 0;">Load an accessibility scan report to generate exportable remediation documents.</p>
          <a href="#/import" class="btn btn-primary">Go to Import</a>
        </section>`;
      return;
    }

    const data = { tasks, observations, sourceSummary };
    // Build each full document once; Download, Copy, and the preview all use it.
    this._docs = Object.fromEntries(FORMATS.map(f => [f.key, f.build(data)]));

    this.innerHTML = `
      <section>
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: var(--font-size-2xl);">Export Remediation Plan</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              ${tasks.length} remediation ${tasks.length === 1 ? 'task' : 'tasks'} with ARRM role mappings, guidance provenance, and verification criteria. Each preview below is the complete document.
            </p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          ${FORMATS.map(f => this.renderCard(f, this._docs[f.key])).join('')}
        </div>
      </section>`;

    this.setupListeners();
  }

  renderCard(format, fullText) {
    const bytes = new Blob([fullText]).size;
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(format.title)}</h3>
          <div style="display: flex; gap: var(--space-2);">
            <button type="button" class="btn btn-secondary" data-copy="${format.key}">Copy</button>
            <button type="button" class="btn btn-primary" data-download="${format.key}">Download</button>
          </div>
        </div>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-2);">
          Complete document · <code>${escapeHtml(format.filename)}</code> · ${formatBytes(bytes)}
        </p>
        <pre class="code-block" tabindex="0" aria-label="${escapeHtml(format.title)} full document" style="max-height: 24em; overflow: auto;"><code>${escapeHtml(fullText)}</code></pre>
        <span class="sr-only" role="status" data-status="${format.key}"></span>
      </div>`;
  }

  setupListeners() {
    this.querySelectorAll('[data-download]').forEach(btn =>
      btn.addEventListener('click', () => {
        const f = FORMATS.find(x => x.key === btn.dataset.download);
        if (f) downloadBlob(this._docs[f.key], f.filename, f.mime);
      }));

    this.querySelectorAll('[data-copy]').forEach(btn =>
      btn.addEventListener('click', async () => {
        const key = btn.dataset.copy;
        const status = this.querySelector(`[data-status="${key}"]`);
        try {
          await navigator.clipboard.writeText(this._docs[key]);
          if (status) status.textContent = 'Copied the full document to the clipboard.';
          const original = btn.textContent;
          btn.textContent = 'Copied';
          setTimeout(() => { btn.textContent = original; }, 1500);
        } catch {
          // Clipboard can be blocked (permissions, insecure context); the
          // Download button and the visible preview remain available.
          if (status) status.textContent = 'Copy was blocked by the browser. Use Download instead.';
        }
      }));
  }
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Some browsers require the anchor to be in the document for a synthetic click.
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

customElements.define('export-panel', ExportPanel);
