import { formatGitHubIssue } from '../export/github-issue.js';

export class HandoffBuilder extends HTMLElement {
  set task(t) {
    this._task = t;
    this.render();
  }

  render() {
    if (!this._task) return;
    const ghText = formatGitHubIssue(this._task);
    this.innerHTML = `
      <div class="card">
        <h4 style="font-weight: 700; font-size: var(--font-size-base); margin-bottom: var(--space-2);">Prepare Handoff</h4>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--space-3);">
          Route this remediation task to ${this._task.roles?.primary || 'the assigned role'} with full evidence and verification criteria.
        </p>
        <pre class="code-block" style="max-height: 180px; margin-bottom: var(--space-3);"><code>${escapeHtml(ghText)}</code></pre>
        <button type="button" class="btn btn-secondary" id="copy-handoff-btn">Copy Issue Markdown</button>
      </div>
    `;

    const btn = this.querySelector('#copy-handoff-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(ghText);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy Issue Markdown', 2000);
      });
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

customElements.define('handoff-builder', HandoffBuilder);
