/**
 * Central state store for active workspace reports, findings, clusters, and tasks.
 */

class WorkspaceStore {
  constructor() {
    this.state = {
      loaded: false,
      loading: false,
      statusMessage: 'Ready to import report.',
      sourceSummary: null,
      observations: [],
      clusters: [],
      hypotheses: [],
      tasks: [],
      overlapData: null,
      summaryData: null,
      sourceReports: [],
      activeTaskId: null,
      userConfirmedTech: null
    };
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  reset() {
    this.state = {
      loaded: false,
      loading: false,
      statusMessage: 'Workspace reset.',
      sourceSummary: null,
      observations: [],
      clusters: [],
      hypotheses: [],
      tasks: [],
      overlapData: null,
      summaryData: null,
      sourceReports: [],
      activeTaskId: null,
      userConfirmedTech: null
    };
    this.notify();
  }
}

export const workspaceStore = new WorkspaceStore();
