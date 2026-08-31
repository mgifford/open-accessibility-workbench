import './components/ReportLoader.js';
import './components/ReportOverview.js';
import './components/PatternExplorer.js';
import './components/PatternCard.js';
import './components/TaskList.js';
import './components/TaskDetail.js';
import './components/RoleProfile.js';
import './components/TechnologyContext.js';
import './components/EvidencePanel.js';
import './components/RemediationBlueprint.js';
import './components/HandoffBuilder.js';
import './components/AiAdvisor.js';
import './components/ModelStatus.js';
import './components/ValidationResults.js';
import './components/ExportPanel.js';
import { Router } from './router.js';
import { workspaceStore } from './state/workspace.js';
import { technologyStore } from './state/technology.js';

const routes = {
  '#/import': () => '<report-loader></report-loader>',
  '#/overview': () => '<report-overview></report-overview>',
  '#/patterns': () => '<pattern-explorer></pattern-explorer>',
  '#/tasks': () => '<task-list></task-list>',
  '#/roles': () => `
    <role-profile></role-profile>
    <section class="card" aria-labelledby="tech-context-title" style="margin-top: var(--space-6);">
      <h2 id="tech-context-title" class="card-title">Technology Context</h2>
      <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); margin: var(--space-2) 0 var(--space-4);">
        Confirm, reject, or set the implementation technology to tailor guidance. Framework-neutral HTML guidance is always available.
      </p>
      <technology-context></technology-context>
    </section>`,
  '#/export': () => '<export-panel></export-panel>',
  '#/about': () => `
    <section class="card">
      <h2 class="card-title" style="font-size: var(--font-size-2xl);">About Open Accessibility Workbench</h2>
      <p style="color: var(--color-text-secondary); margin: var(--space-4) 0;">
        Open Accessibility Workbench turns a wall of accessibility findings into a small, role-aware set of explainable remediation tasks.
      </p>
      <div style="background-color: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm);">
        <h3 style="font-weight: 700; margin-bottom: var(--space-2);">Privacy & Operating Guarantees</h3>
        <ul style="margin-left: var(--space-4);">
          <li>100% Client-Side Processing (Zero network upload of report files).</li>
          <li>Deterministic Analysis Baseline (Works completely offline without AI models).</li>
          <li>W3C ARRM Multi-Disciplinary Role Routing.</li>
          <li>Full Data Provenance: every aggregate task traces back to its scanner evidence.</li>
        </ul>
      </div>
    </section>
  `
};

window.addEventListener('DOMContentLoaded', () => {
  const router = new Router(routes, 'app-root');
  router.init();

  // When the user confirms/rejects/replaces/resets technology, rebuild the
  // loaded tasks (contexts, blueprints, guidance) without re-parsing the report.
  technologyStore.subscribe((techState) => {
    workspaceStore.recomputeTasks(techState);
  });

  // Register service worker for offline asset caching
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // Offline caching service worker registration skipped in local dev
    });
  }

  // Polite status announcer for screen readers
  const announcer = document.getElementById('live-announcer');
  workspaceStore.subscribe((state) => {
    if (announcer && state.statusMessage) {
      announcer.textContent = state.statusMessage;
    }
  });
});
