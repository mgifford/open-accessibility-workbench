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
import './components/LocalDataControls.js';
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

      <h3 style="font-weight: 700; font-size: var(--font-size-lg); margin-top: var(--space-6);">Optional: local AI assistance</h3>
      <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); margin: var(--space-2) 0;">
        Every remediation task is fully explained by the deterministic engine — you never need AI to use the Workbench.
        On a task's detail page you can <strong>optionally</strong> turn on a local AI advisor to draft a suggested fix
        (for example, sketching the markup for an accessible name, or explaining a rule in plainer terms). It is
        <strong>off until you explicitly enable it</strong>, and no model is downloaded when the app or a report loads.
      </p>
      <div style="background-color: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm);">
        <p style="margin: 0 0 var(--space-2);"><strong>How to use it:</strong></p>
        <ol style="margin-left: var(--space-4);">
          <li>Load a report, open the <em>Tasks</em> view, and select a task to open its detail page.</li>
          <li>In the <em>Local AI advisor</em> panel, read the on-device / privacy note and choose <em>Enable local AI</em>.</li>
          <li>When your browser provides a built-in on-device model, or this deployment ships the optional model, choose <em>Generate draft suggestion</em>. A draft appears beside the deterministic guidance.</li>
        </ol>
        <p style="margin: var(--space-3) 0 var(--space-2);"><strong>What runs, and where:</strong></p>
        <ul style="margin-left: var(--space-4);">
          <li><strong>Inference is entirely on your device.</strong> Your report is never uploaded — not to us, not to any AI service.</li>
          <li>Two routes are used, whichever is available: your <strong>browser's built-in on-device AI</strong> (nothing is downloaded from this project), or a small <strong>open model run in your browser</strong> via a background worker (only in deployments built with the model runtime enabled).</li>
          <li>If a model's weights are downloaded, only the <strong>weights</strong> are fetched from the host you pick (Hugging Face or this project's release); that host sees your IP address and which model — <strong>never</strong> your report.</li>
          <li>AI output is an <strong>unverified draft for a human to review</strong>. It is never applied automatically, always shown next to the deterministic guidance, and passes the same anti-invention and validation checks — the advisor even shows what each attempt was checked against.</li>
          <li>When no usable AI is present, the panel says so honestly and the deterministic guidance works fully without it.</li>
        </ul>
        <p style="margin: var(--space-3) 0 0;"><strong>Are MCP servers involved?</strong> No. The Workbench is a self-contained, client-side web app: all AI runs in your browser, with no server-side calls and no Model Context Protocol (MCP) connections. MCP is a protocol for connecting AI <em>agents and developer tools</em> to external services — it is not part of how this app assists you. (Separately, the maintainers may use MCP or similar tooling at build time to prepare bundled data such as rule mappings; that is a development step, not a runtime feature, and it never touches your report.)</p>
      </div>

      <local-data-controls></local-data-controls>
    </section>
  `
};

/**
 * Shows the report-dependent nav links (Overview, Patterns, Tasks, Roles,
 * Export) only once a report is loaded; Import and About are always available.
 * Before a report exists those views are empty dead-ends, so hiding their links
 * keeps the navigation honest about what there is to review.
 */
function syncNav(loaded) {
  document.querySelectorAll('nav.main-nav [data-requires-report]').forEach(li => {
    li.hidden = !loaded;
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const router = new Router(routes, 'app-root');
  router.init();

  // Gate the report-dependent nav links on whether a report is loaded.
  syncNav(workspaceStore.state.loaded);
  workspaceStore.subscribe((state) => syncNav(state.loaded));

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
