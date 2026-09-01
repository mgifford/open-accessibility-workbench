import { clearLocalData, listStoredData } from '../state/local-data.js';
import { escapeHtml } from '../utils/escape-html.js';
import { workspaceStore } from '../state/workspace.js';
import { profileStore } from '../state/profile.js';
import { technologyStore } from '../state/technology.js';
import { taskStatusStore } from '../state/task-status.js';
import { aiConsentStore } from '../state/ai-consent.js';

/**
 * "Clear local data" control (spec §13.2). Lists exactly what preferences are
 * stored locally and lets the user remove them. Report contents are never
 * stored, so there is nothing report-related to clear here.
 */
export class LocalDataControls extends HTMLElement {
  connectedCallback() { this.render(); }

  render() {
    const stored = listStoredData();
    this.innerHTML = `
      <div style="margin-top: var(--space-4);">
        <h3 style="font-weight: 700; margin-bottom: var(--space-2);">Local data on this device</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-2);">
          The Workbench stores only preferences locally — never your report contents. Currently stored:
        </p>
        <ul style="font-size: var(--font-size-sm); margin-left: var(--space-4);">
          ${(stored.length ? stored : []).map(i => `<li>${escapeHtml(i.label)}</li>`).join('') || '<li>Nothing is stored right now.</li>'}
        </ul>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin: var(--space-2) 0;">
          "Clear local data" removes all of the above (capability profile, task statuses, technology preferences, and the AI consent preference) and also resets the active workspace in memory (the loaded report and its derived tasks). This build downloads no separate AI model.
        </p>
        <button type="button" class="btn btn-secondary" id="clear-local-data">Clear local data</button>
        <span id="clear-local-status" role="status" aria-live="polite" style="margin-left: var(--space-2); font-size: var(--font-size-xs);"></span>
      </div>
    `;
    const btn = this.querySelector('#clear-local-data');
    if (btn) {
      btn.addEventListener('click', () => {
        // Reset the live in-memory stores to defaults FIRST (some persist on
        // change), THEN clear storage so no key is re-persisted afterwards.
        workspaceStore.reset();
        profileStore.setCapabilities([]);
        technologyStore.reset();          // clears confirmed
        technologyStore.state.rejected = []; // and clear rejections in memory
        taskStatusStore.clear();
        aiConsentStore.disable();
        const { removed } = clearLocalData();

        // Re-render the list first, THEN set the status message, so the message
        // is not wiped by the re-render.
        this.render();
        const status = this.querySelector('#clear-local-status');
        if (status) status.textContent = removed > 0
          ? `Cleared ${removed} stored item(s) and reset the workspace.`
          : 'Reset the workspace. Nothing was stored.';
      });
    }
  }
}

customElements.define('local-data-controls', LocalDataControls);
