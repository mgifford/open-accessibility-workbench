import { detectReportSource, REPORT_TYPES } from '../adapters/detect-source.js';
import { parseOpenScansReportJson } from '../adapters/open-scans/report-json.js';
import { parseOpenScansOverlapJson } from '../adapters/open-scans/overlap-json.js';
import { parseOpenScansReportCsv } from '../adapters/open-scans/report-csv.js';
import { parseOobeeReportCsv } from '../adapters/oobee/report-csv.js';
import { ingestSummaryFormat } from '../adapters/summary-ingest.js';
import { decompressGzipB64 } from '../adapters/oobee/decompress.js';
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
            <input type="file" id="file-input" accept=".json,.csv,.txt,.b64" style="margin: 0 auto; display: block;" aria-describedby="file-hint" />
            <p id="file-hint" style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2);">
              Supported: Open Scans report.json / report.csv, Oobee report.csv / summary JSONs, and compressed Oobee .json.gz.b64
            </p>
          </div>

          <div id="error-container" style="display: none; background-color: var(--color-urgency-critical-bg); color: var(--color-urgency-critical); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-urgency-critical);" role="alert"></div>

          <div style="display: flex; gap: var(--space-4); align-items: center; flex-wrap: wrap;">
            <span style="font-size: var(--font-size-sm); color: var(--color-text-muted);">Quick Sample Reports:</span>
            <button type="button" class="btn btn-secondary" id="load-sample-openscans">Load Open Scans Sample (Issue #347)</button>
            <button type="button" class="btn btn-secondary" id="load-sample-pattern">Load Pattern-Reduction Demo</button>
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
    const samplePatternBtn = this.querySelector('#load-sample-pattern');
    const sampleOobeeBtn = this.querySelector('#load-sample-oobee');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.loadFile(file);
    });

    sampleOsBtn.addEventListener('click', async () => {
      try {
        const text = await this.fetchSample('open-scans/report.json');

        // Sibling discovery: an Open Scans report.json is normally accompanied
        // by report-overlap.json. Load it too so scanner stats display; its
        // absence must not break the primary import.
        let overlapText = null;
        try {
          overlapText = await this.fetchSample('open-scans/report-overlap.json');
        } catch { /* overlap is optional */ }

        this.processFileContent(text, 'report.json', overlapText);
      } catch (err) {
        this.showError('Could not load sample file: ' + err.message);
      }
    });

    samplePatternBtn.addEventListener('click', async () => {
      try {
        const text = await this.fetchSample('open-scans/report-pattern-demo.json');
        this.processFileContent(text, 'report-pattern-demo.json');
      } catch (err) {
        this.showError('Could not load sample file: ' + err.message);
      }
    });

    sampleOobeeBtn.addEventListener('click', async () => {
      try {
        const text = await this.fetchSample('oobee/report.csv');
        this.processFileContent(text, 'report.csv');
      } catch (err) {
        this.showError('Could not load sample file: ' + err.message);
      }
    });
  }

  /**
   * Fetches a bundled sample report from the app's own origin. Samples live
   * under public/samples so Vite copies them into the production build (unlike
   * tests/fixtures, which is not shipped). BASE_URL keeps this correct under a
   * GitHub Pages subpath deployment.
   */
  async fetchSample(relPath) {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}samples/${relPath}`);
    if (!res.ok) throw new Error(`sample not found (HTTP ${res.status})`);
    return res.text();
  }

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      let text = e.target.result;
      // Compressed Oobee payloads: .json.gz.b64 (base64-encoded gzip). Decompress
      // locally before detection; report a clear error if the browser lacks the
      // needed API rather than feeding garbage to the detector.
      if (/\.json\.gz\.b64$/i.test(file.name)) {
        try {
          text = await decompressGzipB64(text);
        } catch (err) {
          this.showError('Could not decompress this .json.gz.b64 file: ' + err.message);
          return;
        }
      }
      this.processFileContent(text, file.name.replace(/\.gz\.b64$/i, ''));
    };
    reader.onerror = () => {
      this.showError('Error reading local file.');
    };
    reader.readAsText(file);
  }

  processFileContent(content, filename, overlapContent = null) {
    const errorBox = this.querySelector('#error-container');
    errorBox.style.display = 'none';

    try {
      const detection = detectReportSource(content, filename);
      if (!detection.recognized) {
        this.showError(`${detection.error}\n\n${detection.explanation}`);
        return;
      }

      // Aggregate / summary formats do not carry finding-level evidence, so
      // they are stored as a summary the overview renders directly rather than
      // being pushed through the pattern/task pipeline.
      const summaryData = ingestSummaryFormat(detection, content);
      if (summaryData) {
        workspaceStore.setState({
          loaded: true,
          sourceSummary: { system: detection.system, format: detection.format, filename, granularity: summaryData.granularity },
          observations: [],
          clusters: [],
          hypotheses: [],
          tasks: [],
          overlapData: detection.type === REPORT_TYPES.OPEN_SCANS_OVERLAP_JSON ? summaryData.overlap : null,
          summaryData,
          statusMessage: `Summary report loaded (${detection.format}).`
        });
        window.location.hash = '#/overview';
        return;
      }

      let observations = [];
      let totalPages = 1;
      let rawTotals = null;
      let engines = [];
      let pageSummaries = null;
      let sourceSummary = { system: detection.system, format: detection.format, filename };

      if (detection.type === REPORT_TYPES.OPEN_SCANS_JSON) {
        const parsed = parseOpenScansReportJson(detection.parsedData || content, filename);
        observations = parsed.observations;
        totalPages = parsed.totalPages;
        rawTotals = parsed.rawTotals;
        engines = parsed.engines;
        sourceSummary = {
          ...sourceSummary, scanId: parsed.scanId, scanTitle: parsed.scanTitle,
          issueNumber: parsed.issueNumber, totalPages, engines
        };
      } else if (detection.type === REPORT_TYPES.OPEN_SCANS_CSV) {
        // Page-level summary CSV: no finding-level evidence, but real per-page
        // and per-engine failure counts the overview can display truthfully.
        const parsed = parseOpenScansReportCsv(detection.parsedData || content);
        totalPages = parsed.totalPages;
        pageSummaries = parsed.pages;
        rawTotals = summarizeCsvTotals(parsed.pages);
        sourceSummary = {
          ...sourceSummary, scanId: String(parsed.pages[0]?.issueNumber || 'open-scans-csv'),
          scanTitle: parsed.pages[0]?.scanTitle || '', totalPages, granularity: 'page'
        };
      } else if (detection.type === REPORT_TYPES.OOBEE_CSV) {
        const parsed = parseOobeeReportCsv(detection.parsedData || content, filename);
        observations = parsed.observations;
        totalPages = parsed.totalPages;
        sourceSummary = { ...sourceSummary, scanId: 'oobee-csv', totalPages };
      } else {
        this.showError(
          `The "${detection.type}" format is recognized but not yet supported for full ingestion in this view.\n\n` +
          detection.explanation || ''
        );
        return;
      }

      // Attach cross-scanner overlap statistics when available.
      let overlapData = null;
      if (overlapContent) {
        try {
          overlapData = parseOpenScansOverlapJson(overlapContent);
        } catch { /* overlap is optional; ignore a malformed sibling */ }
      }

      const enriched = enrichObservationsWithSignatures(observations);
      const clusters = clusterPatternOccurrences(enriched, totalPages);
      const hypotheses = buildComponentHypotheses(clusters, totalPages);
      const tasks = buildRemediationTasks(clusters, hypotheses, totalPages);

      workspaceStore.setState({
        loaded: true,
        sourceSummary: { ...sourceSummary, rawTotals, pageSummaries },
        observations: enriched,
        clusters,
        hypotheses,
        tasks,
        overlapData,
        summaryData: null,
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
    // role="alert" announces automatically; make the error keyboard-reachable
    // so a keyboard-only user lands on the explanation.
    errorBox.setAttribute('tabindex', '-1');
    errorBox.focus();
  }
}

/**
 * Rolls up an Open Scans summary CSV's per-page rows into artifact-level totals
 * for display. These are page-summary counts, not finding-level evidence.
 */
function summarizeCsvTotals(pages = []) {
  const sum = (key) => pages.reduce((acc, p) => acc + (p[key] || 0), 0);
  return {
    axe: { failed: sum('axeFailed'), passed: sum('axePassed') },
    qualweb: { failed: sum('qualwebFailed') },
    alfa: { failed: sum('alfaFailed') },
    duplicateFindings: sum('duplicateFindings')
  };
}

customElements.define('report-loader', ReportLoader);
