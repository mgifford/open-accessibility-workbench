/**
 * Central state store for active workspace reports, findings, clusters, and tasks.
 */

import { buildRemediationTasks } from '../analysis/remediation-tasks.js';

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

  /**
   * Rebuilds tasks (and their technology contexts, blueprints, and guidance)
   * from the already-computed clusters/hypotheses when the technology profile
   * changes — WITHOUT re-parsing the report. `techState` is
   * { confirmed, rejected }. Clusters and observations are unchanged, so evidence
   * is preserved; only technology-dependent task fields are recomputed.
   */
  recomputeTasks(techState = {}) {
    const s = this.state;
    if (!s.loaded || !Array.isArray(s.clusters) || s.clusters.length === 0) return;
    const totalPages = s.sourceSummary?.totalPages || 1;
    const tasks = buildRemediationTasks(
      s.clusters,
      s.hypotheses || [],
      totalPages,
      techState.confirmed || null,
      s.scanMetadata || null,
      s.sourceSummary?.sourceReportId || null,
      techState.rejected || []
    );
    this.setState({ tasks });
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
