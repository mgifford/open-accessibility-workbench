import { buildHandoff, handoffToMarkdown } from '../export/handoff.js';
import { formatGitHubIssue } from '../export/github-issue.js';
import { escapeHtml } from '../utils/escape-html.js';

/**
 * Prepare-handoff panel for a task. Explains why the task likely needs another
 * role (routing guidance, not ownership) and packages the evidence, unresolved
 * decisions, suggested roles, objective, and verification criteria (spec §7.7 /
 * §9.7). Offers Markdown, plain text, and GitHub-issue copies with keyboard
 * support. No GitHub authentication is required.
 */
export class HandoffBuilder extends HTMLElement {
  set task(t) { this._task = t; this.render(); }
  set capabilities(c) { this._caps = c; }

  render() {
    if (!this._task) return;
    const handoff = buildHandoff(this._task, this._caps || []);
    const markdown = handoffToMarkdown(handoff);
    const ghText = formatGitHubIssue(this._task);
    this._markdown = markdown;
    this._ghText = ghText;

    this.innerHTML = `
      <div class="card">
        <h3 style="font-weight: 700; font-size: var(--font-size-base); margin-bottom: var(--space-2);">Prepare handoff</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-3);">
          ${escapeHtml(handoff.whyHandoff)}
        </p>
        <label for="handoff-format" style="font-size: var(--font-size-xs); font-weight: 700;">Format:</label>
        <select id="handoff-format" style="padding: var(--space-1); border-radius: var(--radius-sm); border: 1px solid var(--color-border); margin: 0 var(--space-2) var(--space-2) var(--space-1);">
          <option value="markdown">Markdown</option>
          <option value="plain">Plain text</option>
          <option value="github">GitHub issue</option>
        </select>
        <pre class="code-block" style="max-height: 220px; overflow: auto; margin-bottom: var(--space-3);"><code id="handoff-preview">${escapeHtml(markdown)}</code></pre>
        <button type="button" class="btn btn-secondary" id="copy-handoff-btn">Copy handoff</button>
        <span id="handoff-copy-status" role="status" aria-live="polite" style="margin-left: var(--space-2); font-size: var(--font-size-xs);"></span>
      </div>
    `;

    this.setup();
  }

  _current() {
    const fmt = this.querySelector('#handoff-format')?.value || 'markdown';
    if (fmt === 'github') return this._ghText;
    return this._markdown; // markdown doubles as plain text
  }

  setup() {
    const formatSel = this.querySelector('#handoff-format');
    const preview = this.querySelector('#handoff-preview');
    if (formatSel && preview) {
      formatSel.addEventListener('change', () => {
        preview.textContent = this._current();
      });
    }

    const btn = this.querySelector('#copy-handoff-btn');
    const status = this.querySelector('#handoff-copy-status');
    if (btn) {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(this._current());
          if (status) status.textContent = 'Handoff copied to clipboard.';
        } catch {
          if (status) status.textContent = 'Copy failed — select the text above and copy manually.';
        }
      });
    }
  }
}

customElements.define('handoff-builder', HandoffBuilder);
