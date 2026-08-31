/**
 * User technology confirmation state.
 *
 * Tracks the technology the user has confirmed (overrides detection) and the
 * technologies they have rejected (never re-applied). Persistence is opt-in and
 * stores only technology preferences — never report evidence.
 */

export const TECHNOLOGY_OPTIONS = [
  'HTML', 'Drupal/Twig', 'WordPress', 'React', 'Vue', 'Angular', 'Web Components', 'Other', 'Unknown'
];

const STORAGE_KEY = 'oaw.technology.v1';

class TechnologyStore {
  constructor() {
    this.state = { confirmed: null, rejected: [], persist: false };
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const raw = safeGet(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.state = { confirmed: parsed.confirmed ?? null, rejected: parsed.rejected || [], persist: Boolean(parsed.persist) };
        }
      }
    } catch { this.state = { confirmed: null, rejected: [], persist: false }; }
  }

  _save() {
    if (!this.state.persist) return;
    try { safeSet(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* ignore */ }
  }

  subscribe(l) { this.listeners.add(l); return () => this.listeners.delete(l); }
  _notify() { for (const l of this.listeners) l(this.state); }

  /** Confirm a technology (or 'Unknown' to suppress framework output). */
  confirm(name) {
    this.state.confirmed = name;
    // Confirming clears any prior rejection of the same technology.
    this.state.rejected = this.state.rejected.filter(r => r !== name);
    this._save();
    this._notify();
  }

  /** Reject a detected technology so it is not re-applied. */
  reject(name) {
    if (name && !this.state.rejected.includes(name)) this.state.rejected.push(name);
    if (this.state.confirmed === name) this.state.confirmed = null;
    this._save();
    this._notify();
  }

  /** Return to Unknown/auto: clears confirmation (keeps rejections). */
  reset() {
    this.state.confirmed = null;
    this._save();
    this._notify();
  }

  setPersistence(enabled) {
    this.state.persist = Boolean(enabled);
    if (this.state.persist) this._save();
    else { try { safeRemove(STORAGE_KEY); } catch { /* ignore */ } }
    this._notify();
  }
}

function safeGet(k) { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; } }
function safeSet(k, v) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch { /* ignore */ } }
function safeRemove(k) { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); } catch { /* ignore */ } }

export const technologyStore = new TechnologyStore();
export { TechnologyStore };
