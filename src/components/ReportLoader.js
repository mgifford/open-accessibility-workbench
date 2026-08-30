import { detectReportSource, REPORT_TYPES } from '../adapters/detect-source.js';
import { parseOpenScansReportJson } from '../adapters/open-scans/report-json.js';
import { parseOpenScansOverlapJson } from '../adapters/open-scans/overlap-json.js';
import { parseOpenScansReportCsv } from '../adapters/open-scans/report-csv.js';
import { parseOobeeReportCsv } from '../adapters/oobee/report-csv.js';
import { enrichObservationsWithSignatures } from '../analysis/canonicalize.js';
import { clusterPatternOccurrences } from '../analysis/pattern-cluster.js';
import { buildComponentHypotheses } from '../analysis/component-hypothesis.js';
import { buildRemediationTasks } from '../analysis/remediation-tasks.js';
import { workspaceStore } from '../state/workspace.js';

export class ReportLoader extends HTMLElement {
  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  render() {
    this.innerHTML = `
      <section class="card" aria-labelledby="loader-title">
        <h2 id="loader-title" class="card-title">Import Accessibility Scan Report</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">
          Load reports from <strong>Open Scans</strong> (<code>report.json</code>, <code>report-overlap.json</code>, <code>report.csv</code>)
          or <strong>Oobee</strong> (<code>report.csv</code>, summary JSONs).
          <em>All processing occurs 100% locally in your browser.</em>
        </p>

        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          <div style="border: 2px dashed var(--color-border); padding: var(--space-8); text-align: center; border-radius: var(--radius-lg);" id="dropzone">
            <label for="file-input" style="font-weight: 600; display: block; margin-bottom: var(--space-2); cursor: pointer;">
              Choose a report file or drag it here
            </label>
            <input type="file" id="file-input" accept=".json,.csv,.txt" style="margin: 0 auto; display: block;" aria-describedby="file-hint" />
            <p id="file-hint" style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">
              Supported: Open Scans report.json / report.csv, Oobee report.csv / summary JSONs
            </p>
          </div>

          <div id="error-container" style="display: none; background-color: var(--color-urgency-critical-bg); color: var(--color-urgency-critical); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-urgency-critical);" role="alert"></div>

          <div style="display: flex; gap: var(--space-4); align-items: center; flex-wrap: wrap;">
            <span style="font-size: var(--font-size-sm); color: var(--color-text-muted);">Quick Sample Reports:</span>
            <button type="button" class="btn btn-secondary" id="load-sample-openscans">Load Open Scans Sample (Issue #347)</button>
            <button type="button" class="btn btn-secondary" id="load-sample-oobee">Load Oobee Sample</button>
          </div>
        </div>
      </section>
    `;
  }

  setupListeners() {
    const fileInput = this.querySelector('#file-input');
    const dropzone = this.querySelector('#dropzone');
    const sampleOsBtn = this.querySelector('#load-sample-openscans');
    const sampleOobeeBtn = this.querySelector('#load-sample-oobee');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.loadFile(file);
    });

    sampleOsBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('tests/fixtures/open-scans/report.json');
        if (!res.ok) throw new Error('Could not fetch fixture');
        const text = await res.text();
        this.processFileContent(text, 'report.json');
      } catch (err) {
        this.showError('Could not load sample file: ' + err.message);
      }
    });

    sampleOobeeBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('tests/fixtures/oobee/report.csv');
        if (!res.ok) throw new Error('Could not fetch fixture');
        const text = await res.text();
        this.processFileContent(text, 'report.csv');
      } catch (err) {
        this.showError('Could not load sample file: ' + err.message);
      }
    });
  }

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.processFileContent(e.target.result, file.name);
    };
    reader.onerror = () => {
      this.showError('Error reading local file.');
    };
    reader.readAsText(file);
  }

  processFileContent(content, filename) {
    const errorBox = this.querySelector('#error-container');
    errorBox.style.display = 'none';

    try {
      const detection = detectReportSource(content, filename);
      if (!detection.recognized) {
        this.showError(`${detection.error}\n\n${detection.explanation}`);
        return;
      }

      let observations = [];
      let totalPages = 1;
      let sourceSummary = { system: detection.system, format: detection.format, filename };

      if (detection.type === REPORT_TYPES.OPEN_SCANS_JSON) {
        const parsed = parseOpenScansReportJson(detection.parsedData || content, filename);
        observations = parsed.observations;
        totalPages = parsed.totalPages;
        sourceSummary = { ...sourceSummary, scanId: parsed.scanId, scanTitle: parsed.scanTitle, totalPages };
      } else if (detection.type === REPORT_TYPES.OOBEE_CSV) {
        const parsed = parseOobeeReportCsv(detection.parsedData || content, filename);
        observations = parsed.observations;
        totalPages = parsed.totalPages;
        sourceSummary = { ...sourceSummary, scanId: 'oobee-csv', totalPages };
      }

      const enriched = enrichObservationsWithSignatures(observations);
      const clusters = clusterPatternOccurrences(enriched, totalPages);
      const hypotheses = buildComponentHypotheses(clusters, totalPages);
      const tasks = buildRemediationTasks(clusters, hypotheses, totalPages);

      workspaceStore.setState({
        loaded: true,
        sourceSummary,
        observations: enriched,
        clusters,
        hypotheses,
        tasks,
        statusMessage: `Report loaded. ${observations.length} observations analyzed into ${tasks.length} remediation tasks.`
      });

      // Navigate to overview
      window.location.hash = '#/overview';
    } catch (err) {
      this.showError('Failed to process report: ' + err.message);
    }
  }

  showError(msg) {
    const errorBox = this.querySelector('#error-container');
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
}

customElements.define('report-loader', ReportLoader);
