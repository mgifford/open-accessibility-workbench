/**
 * Web Worker: parse and reduce large scan reports off the main thread
 * (spec §13.1/§13.7). It performs the CPU-heavy stages — detection, parsing,
 * normalization, signature enrichment, pattern clustering, and component
 * hypotheses — and posts milestone progress so the UI stays responsive and
 * cancellable. Identity assignment (source-report id), overlap pairing, and
 * technology-aware task building stay on the main thread, which owns that state.
 *
 * Cancellation is cooperative: the main thread terminates the worker. Because the
 * worker owns no shared state, termination is safe and releases its memory.
 */

import { detectReportSource, REPORT_TYPES } from '../adapters/detect-source.js';
import { parseOpenScansReportJson } from '../adapters/open-scans/report-json.js';
import { parseOobeeReportCsv } from '../adapters/oobee/report-csv.js';
import { enrichObservationsWithSignatures } from '../analysis/canonicalize.js';
import { clusterPatternOccurrences } from '../analysis/pattern-cluster.js';
import { buildComponentHypotheses } from '../analysis/component-hypothesis.js';

function progress(id, phase, detail) {
  self.postMessage({ id, progress: { phase, detail } });
}

self.onmessage = (e) => {
  const { id, rawContent, filename } = e.data || {};
  try {
    progress(id, 'detecting', 'Identifying report format…');
    const detection = detectReportSource(rawContent, filename);
    if (!detection.recognized) {
      self.postMessage({ id, success: false, error: detection.error, explanation: detection.explanation });
      return;
    }

    // Only the finding-level formats are heavy enough to offload; the main thread
    // handles summary/aggregate/CSV formats directly (they are cheap).
    if (detection.type !== REPORT_TYPES.OPEN_SCANS_JSON && detection.type !== REPORT_TYPES.OOBEE_CSV) {
      self.postMessage({ id, success: true, offloadable: false });
      return;
    }

    let observations = [];
    let totalPages = 1;
    let rawTotals = null;
    let engines = [];
    let scanId = null;
    let scanTitle = null;
    let issueNumber = null;
    let scanMetadata = null;

    progress(id, 'parsing', 'Parsing and normalizing findings…');
    if (detection.type === REPORT_TYPES.OPEN_SCANS_JSON) {
      const parsed = parseOpenScansReportJson(detection.parsedData || rawContent, filename);
      observations = parsed.observations;
      totalPages = parsed.totalPages;
      rawTotals = parsed.rawTotals;
      engines = parsed.engines;
      scanId = parsed.scanId; scanTitle = parsed.scanTitle; issueNumber = parsed.issueNumber;
      scanMetadata = detection.parsedData?.technologies ? { technologies: detection.parsedData.technologies } : null;
    } else { // OOBEE_CSV
      const parsed = parseOobeeReportCsv(detection.parsedData || rawContent, filename);
      observations = parsed.observations;
      totalPages = parsed.totalPages;
      scanId = 'oobee-csv';
    }

    progress(id, 'clustering', `Clustering ${observations.length} observations into patterns…`);
    const enriched = enrichObservationsWithSignatures(observations);
    const clusters = clusterPatternOccurrences(enriched, totalPages);

    progress(id, 'components', `Deriving component hypotheses from ${clusters.length} patterns…`);
    const hypotheses = buildComponentHypotheses(clusters, totalPages);

    self.postMessage({
      id,
      success: true,
      offloadable: true,
      detectionType: detection.type,
      system: detection.system,
      format: detection.format,
      observations: enriched,
      clusters,
      hypotheses,
      totalPages,
      rawTotals,
      engines,
      scanId,
      scanTitle,
      issueNumber,
      scanMetadata
    });
  } catch (err) {
    self.postMessage({ id, success: false, error: (err && err.message) || 'Error during parsing' });
  }
};
