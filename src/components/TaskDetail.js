import { workspaceStore } from '../state/workspace.js';
import { formatGitHubIssue } from '../export/github-issue.js';
import { runValidationSuite } from '../validation/registry.js';
import { requestAiRemediation } from '../ai/client.js';

export class TaskDetail extends HTMLElement {
  constructor() {
    super();
    this.taskId = null;
    this.sourceCodeContext = null;
    this.aiResult = null;
    this.aiLoading = false;
  }

  static get observedAttributes() {
    return ['task-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'task-id' && oldValue !== newValue) {
      this.taskId = newValue;
      this.render();
    }
  }

  connectedCallback() {
    this.unsubscribe = workspaceStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    const { tasks, loaded } = workspaceStore.state;
    if (!loaded) {
      this.innerHTML = `<section class="card"><p>Please load a report first.</p></section>`;
      return;
    }

    const task = tasks.find(t => t.id === this.taskId) || tasks[0];
    if (!task) {
      this.innerHTML = `<section class="card"><p>Task not found.</p></section>`;
      return;
    }

    // Run deterministic validation on the target markup
    const staticValidation = runValidationSuite(task.ruleId, task.blueprint.targetMarkup || '', {
      originalSnippet: task.representativeHtml
    });

    this.innerHTML = `
      <section>
        <div style="margin-bottom: var(--space-4);">
          <a href="#/tasks" style="color: var(--color-brand-primary); text-decoration: none; font-weight: 600;">← Back to Task List</a>
        </div>

        <div class="card" style="border-top: 4px solid var(--color-brand-primary);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-2);">
            <div>
              <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-muted);">TASK ID: ${task.id}</span>
              <h2 style="font-size: var(--font-size-2xl); font-weight: 800; margin-top: var(--space-1);">${task.title}</h2>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-1);">
                Rule: <code>${task.ruleId}</code> (WCAG: ${task.wcag.join(', ') || 'N/A'})
              </div>
            </div>
            <div style="display: flex; gap: var(--space-2);">
              <span class="badge badge-${task.urgency}">Urgency: ${task.urgency}</span>
              <span class="badge badge-high">Leverage: ${task.leverage}</span>
            </div>
          </div>

          <!-- Why this matters -->
          <div style="margin: var(--space-6) 0;">
            <h3 style="font-size: var(--font-size-base); font-weight: 700; color: var(--color-text-primary); margin-bottom: var(--space-2);">
              Problem & Systemic Impact
            </h3>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--space-2);">${task.blueprint.problem}</p>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); background-color: var(--color-bg-subtle); padding: var(--space-3); border-radius: var(--radius-md);">
              ${task.blueprint.systemicRationale}
            </p>
          </div>

          <!-- Component Hypothesis & Scope -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);">
            <div style="background-color: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md);">
              <strong style="font-size: var(--font-size-xs); text-transform: uppercase; color: var(--color-text-secondary);">Component / Template Hypothesis</strong>
              <div style="font-size: var(--font-size-base); font-weight: 700; margin-top: var(--space-1);">${task.componentHypothesis?.name || 'Shared Component'}</div>
              <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-1);">${task.componentHypothesis?.rationale || ''}</p>
            </div>

            <div style="background-color: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md);">
              <strong style="font-size: var(--font-size-xs); text-transform: uppercase; color: var(--color-text-secondary);">Role Guidance (ARRM)</strong>
              <div style="font-size: var(--font-size-base); font-weight: 700; margin-top: var(--space-1);">${task.roles.primary}</div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-1);">
                Supporting: ${task.roles.secondary.join(', ') || 'None'}
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1);">
                Source: ${task.roles.source}
              </div>
            </div>
          </div>

          <!-- Human Decisions Required -->
          ${task.blueprint.humanDecisionsRequired?.length ? `
            <div style="margin-bottom: var(--space-6); background-color: var(--color-urgency-medium-bg); border-left: 4px solid var(--color-urgency-medium); padding: var(--space-4); border-radius: var(--radius-sm);">
              <h3 style="font-size: var(--font-size-sm); font-weight: 700; color: var(--color-urgency-medium); text-transform: uppercase; margin-bottom: var(--space-2);">
                Human Decision Required Before Implementation
              </h3>
              <ul style="margin-left: var(--space-4); color: var(--color-text-primary); font-size: var(--font-size-sm);">
                ${task.blueprint.humanDecisionsRequired.map(d => `<li>${d}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Observed Scanner Evidence -->
          <div style="margin-bottom: var(--space-6);">
            <h3 style="font-size: var(--font-size-base); font-weight: 700; margin-bottom: var(--space-2);">Observed Scanner Evidence</h3>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-1);">Locator:</p>
            <pre class="code-block" style="margin-bottom: var(--space-2);"><code>${escapeHtml(task.representativeLocator)}</code></pre>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: var(--space-1);">Rendered DOM Snippet:</p>
            <pre class="code-block"><code>${escapeHtml(task.representativeHtml)}</code></pre>
          </div>

          <!-- Target Markup & Deterministic Guidance -->
          ${task.blueprint.targetMarkup ? `
            <div style="margin-bottom: var(--space-6);">
              <h3 style="font-size: var(--font-size-base); font-weight: 700; margin-bottom: var(--space-2);">Deterministic Remediation Guidance</h3>
              <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-2);">${task.blueprint.whatNeedsToChange}</p>
              <pre class="code-block" style="margin-bottom: var(--space-3);"><code>${escapeHtml(task.blueprint.targetMarkup)}</code></pre>

              <!-- Validation status -->
              <div style="background-color: var(--color-bg-subtle); padding: var(--space-3); border-radius: var(--radius-sm); font-size: var(--font-size-xs);">
                <strong>Static Validation:</strong>
                <span style="color: ${staticValidation.passed ? 'var(--color-urgency-low)' : 'var(--color-urgency-critical)'}; font-weight: 600; margin-left: var(--space-1);">
                  ${staticValidation.status}
                </span>
              </div>
            </div>
          ` : ''}

          <!-- Verification Criteria -->
          <div style="margin-bottom: var(--space-6);">
            <h3 style="font-size: var(--font-size-base); font-weight: 700; margin-bottom: var(--space-2);">Verification Steps</h3>
            <ol style="margin-left: var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-secondary);">
              ${task.blueprint.verificationSteps.map(s => `<li style="margin-bottom: var(--space-1);">${s}</li>`).join('')}
            </ol>
          </div>

          <!-- Action Buttons / Handoff -->
          <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
            <button type="button" class="btn btn-secondary" id="copy-markdown-btn">Copy Task Markdown</button>
            <button type="button" class="btn btn-secondary" id="copy-github-btn">Copy GitHub Issue</button>
            <button type="button" class="btn btn-primary" id="ai-advisor-btn">Get Local AI Candidate</button>
          </div>

          <!-- AI Advisor Panel (Dynamic) -->
          <div id="ai-panel" style="margin-top: var(--space-6); display: none;"></div>
        </div>
      </section>
    `;

    this.setupListeners(task);
  }

  setupListeners(task) {
    const copyMdBtn = this.querySelector('#copy-markdown-btn');
    const copyGhBtn = this.querySelector('#copy-github-btn');
    const aiBtn = this.querySelector('#ai-advisor-btn');
    const aiPanel = this.querySelector('#ai-panel');

    if (copyMdBtn) {
      copyMdBtn.addEventListener('click', async () => {
        const md = `# ${task.title}\n\n${task.blueprint.problem}\n\n${task.blueprint.whatNeedsToChange}\n\n\`\`\`html\n${task.blueprint.targetMarkup || ''}\n\`\`\``;
        await navigator.clipboard.writeText(md);
        copyMdBtn.textContent = 'Copied Markdown!';
        setTimeout(() => copyMdBtn.textContent = 'Copy Task Markdown', 2000);
      });
    }

    if (copyGhBtn) {
      copyGhBtn.addEventListener('click', async () => {
        const gh = formatGitHubIssue(task);
        await navigator.clipboard.writeText(gh);
        copyGhBtn.textContent = 'Copied GitHub Issue!';
        setTimeout(() => copyGhBtn.textContent = 'Copy GitHub Issue', 2000);
      });
    }

    if (aiBtn) {
      aiBtn.addEventListener('click', async () => {
        aiPanel.style.display = 'block';
        aiPanel.innerHTML = `
          <div class="card" style="background-color: var(--color-brand-bg); border-color: var(--color-brand-primary);">
            <h4 style="font-weight: 700; color: var(--color-brand-primary); margin-bottom: var(--space-2);">Local AI Remediation Advisor</h4>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--space-4);">
              Runs 100% locally in your browser. Scanner evidence is strictly isolated as untrusted data.
            </p>
            <div id="ai-status">Running deterministic validation loop with local advisor...</div>
          </div>
        `;

        try {
          const result = await requestAiRemediation(task, 'HuggingFaceTB/SmolLM2-135M-Instruct', this.sourceCodeContext);
          aiPanel.innerHTML = `
            <div class="card" style="background-color: var(--color-brand-bg); border-color: var(--color-brand-primary);">
              <h4 style="font-weight: 700; color: var(--color-brand-primary); margin-bottom: var(--space-2);">Local AI Remediation Candidate</h4>
              <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-2);">
                <strong>Strategy:</strong> ${result.recommendedStrategy}
              </p>
              <pre class="code-block" style="margin-bottom: var(--space-3);"><code>${escapeHtml(result.targetMarkup || result.sourceAwareCandidate || '')}</code></pre>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                <strong>Validation Status:</strong> ${result.validationResult?.status || 'Passed'} (Completed in ${result.attempts} attempts)
              </div>
            </div>
          `;
        } catch (err) {
          aiPanel.innerHTML = `<div class="card" style="color: var(--color-urgency-critical);">AI Advisor Error: ${err.message}</div>`;
        }
      });
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

customElements.define('task-detail', TaskDetail);
