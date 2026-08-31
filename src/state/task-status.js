/**
 * Task lifecycle state, kept separate from the derived task objects so status
 * survives re-analysis. Status is a lightweight per-workspace convenience the
 * user drives; it is opt-in persisted to localStorage (report evidence is never
 * persisted — see PRIVACY.md).
 */

export const TASK_STATUSES = ['open', 'in-progress', 'needs-decision', 'done'];

export const TASK_STATUS_LABELS = {
  'open': 'Open',
  'in-progress': 'In progress',
  'needs-decision': 'Needs decision',
  'done': 'Done'
};

const STORAGE_KEY = 'oaw.taskStatus.v1';

class TaskStatusStore {
  constructor() {
    /** @type {Record<string,string>} taskId -> status */
    this.byId = {};
    this.persist = false;
    this.listeners = new Set();
    this._loadIfEnabled();
  }

  _loadIfEnabled() {
    try {
      const raw = safeGet(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.byId = parsed.byId || {};
          this.persist = Boolean(parsed.persist);
        }
      }
    } catch {
      // Corrupt/unavailable storage: start clean, never throw.
      this.byId = {};
      this.persist = false;
    }
  }

  _save() {
    if (!this.persist) return;
    try {
      safeSet(STORAGE_KEY, JSON.stringify({ persist: true, byId: this.byId }));
    } catch {
      /* storage full/blocked: keep working in-memory */
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const l of this.listeners) l(this.byId);
  }

  /** Returns the status for a task, defaulting to 'open'. */
  get(taskId) {
    return this.byId[taskId] || 'open';
  }

  /** Sets a task's status; no-op for unknown status values. */
  set(taskId, status) {
    if (!TASK_STATUSES.includes(status)) return;
    if (status === 'open') {
      delete this.byId[taskId];
    } else {
      this.byId[taskId] = status;
    }
    this._save();
    this._notify();
  }

  /** Enables or disables persistence of task status to localStorage. */
  setPersistence(enabled) {
    this.persist = Boolean(enabled);
    if (this.persist) {
      this._save();
    } else {
      try { safeRemove(STORAGE_KEY); } catch { /* ignore */ }
    }
    this._notify();
  }

  /** Counts of each status across the given task ids (for summaries). */
  summary(taskIds = []) {
    const counts = { open: 0, 'in-progress': 0, 'needs-decision': 0, done: 0 };
    for (const id of taskIds) counts[this.get(id)]++;
    return counts;
  }

  clear() {
    this.byId = {};
    try { safeRemove(STORAGE_KEY); } catch { /* ignore */ }
    this._notify();
  }
}

// localStorage wrappers that never throw (private mode, disabled storage, SSR).
function safeGet(k) {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; }
}
function safeSet(k, v) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch { /* ignore */ }
}
function safeRemove(k) {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); } catch { /* ignore */ }
}

export const taskStatusStore = new TaskStatusStore();
export { TaskStatusStore };
