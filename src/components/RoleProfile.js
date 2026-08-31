import { profileStore } from '../state/profile.js';
import { CAPABILITY_OPTIONS } from '../roles/capability-profile.js';

export class RoleProfile extends HTMLElement {
  connectedCallback() {
    this.unsubscribe = profileStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    const { selectedCapabilities } = profileStore.state;

    this.innerHTML = `
      <section class="card">
        <h2 class="card-title" style="font-size: var(--font-size-2xl);">Capability & Role Profile</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--space-6);">
          Select the areas you have the ability to modify or review. The Workbench will tailor task views and handoff recommendations to your capabilities.
        </p>

        <form id="profile-form">
          <fieldset style="border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-6); margin-bottom: var(--space-6);">
            <legend style="font-weight: 700; padding: 0 var(--space-2);">What can you change?</legend>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3); margin-top: var(--space-4);">
              ${CAPABILITY_OPTIONS.map((opt, idx) => {
                const checked = selectedCapabilities.includes(opt);
                return `
                  <div style="display: flex; align-items: center; gap: var(--space-2); min-height: var(--min-target-size);">
                    <input type="checkbox" id="cap-${idx}" value="${opt}" ${checked ? 'checked' : ''} style="width: 18px; height: 18px;" />
                    <label for="cap-${idx}" style="font-size: var(--font-size-sm); cursor: pointer;">${opt}</label>
                  </div>
                `;
              }).join('')}
            </div>
          </fieldset>

          <div style="display: flex; gap: var(--space-4);">
            <button type="button" class="btn btn-secondary" id="clear-profile-btn">Clear Selections</button>
            <a href="#/tasks" class="btn btn-primary">View Matched Tasks</a>
          </div>
        </form>
      </section>
    `;

    this.setupListeners();
  }

  setupListeners() {
    const checkboxes = this.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        // Re-rendering replaces the checkbox; remember it so we can restore focus
        // after the store notifies and re-renders (spec §7.4: keep focus).
        this._restoreFocusId = cb.id;
        profileStore.toggleCapability(cb.value);
      });
    });

    const clearBtn = this.querySelector('#clear-profile-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._restoreFocusId = 'clear-profile-btn';
        profileStore.setCapabilities([]);
      });
    }

    // Restore focus to the control the user just operated.
    if (this._restoreFocusId) {
      const el = this.querySelector(`#${CSS.escape(this._restoreFocusId)}`);
      if (el) el.focus();
      this._restoreFocusId = null;
    }
  }
}

customElements.define('role-profile', RoleProfile);
