/**
 * Task lifecycle state, kept separate from the derived task objects so status
 * survives re-analysis. Status is a lightweight per-workspace convenience the
 * user drives; it is opt-in persisted to localStorage (report evidence is never
 * persisted — see PRIVACY.md).
 */

// Full lifecycle. `new` is the default (untriaged); `ready` marks triaged,
// actionable work; `blocked` is an external dependency (distinct from
// `needs-decision`, an unresolved human decision); `needs-verification` keeps
// implementation-complete distinct from accessibility-verified; `deferred` is an
// intentional not-now decision (distinct from unfinished `new`).
export const TASK_STATUSES = [
  'new', 'ready', 'in-progress', 'blocked', 'needs-decision', 'needs-verification', 'done', 'deferred'
];

export const TASK_STATUS_LABELS = {
  'new': 'New',
  'ready': 'Ready',
  'in-progress': 'In progress',
  'blocked': 'Blocked',
  'needs-decision': 'Needs decision',
  'needs-verification': 'Needs verification',
  'done': 'Done',
  'deferred': 'Deferred'
};

const DEFAULT_STATUS = 'new';

// Migration from the previous reduced lifecycle (v1) to the full model (v2).
const STATUS_MIGRATIONS = { 'open': 'new' };

const STORAGE_KEY = 'oaw.taskStatus.v2';
const LEGACY_STORAGE_KEY = 'oaw.taskStatus.v1';

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
      let raw = safeGet(STORAGE_KEY);
      let fromLegacy = false;
      if (!raw) { raw = safeGet(LEGACY_STORAGE_KEY); fromLegacy = Boolean(raw); }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.byId = this._migrate(parsed.byId || {});
          this.persist = Boolean(parsed.persist);
          if (fromLegacy && this.persist) this._save(); // rewrite under v2 key
        }
      }
    } catch {
      // Corrupt/unavailable storage: start clean, never throw.
      this.byId = {};
      this.persist = false;
    }
  }

  /** Migrates stored statuses to the current schema, dropping unknown values. */
  _migrate(byId) {
    const out = {};
    for (const [id, status] of Object.entries(byId || {})) {
      const migrated = STATUS_MIGRATIONS[status] || status;
      if (TASK_STATUSES.includes(migrated) && migrated !== DEFAULT_STATUS) {
        out[id] = migrated;
      }
    }
    return out;
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

  /** Returns the status for a task, defaulting to 'new'. */
  get(taskId) {
    return this.byId[taskId] || DEFAULT_STATUS;
  }

  /** Sets a task's status; no-op for unknown status values. */
  set(taskId, status) {
    if (!TASK_STATUSES.includes(status)) return;
    if (status === DEFAULT_STATUS) {
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
    const counts = Object.fromEntries(TASK_STATUSES.map(s => [s, 0]));
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
