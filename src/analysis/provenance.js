/**
 * Provenance tracing for the canonical evidence model.
 *
 * Every Workbench finding (a remediation task) aggregates one or more
 * CanonicalObservation objects, each of which retains a full trace back to the
 * source artifact it was normalized from. These helpers answer the Phase 4
 * question for any finding: which source report, which original record, which
 * scanner/tool, and which page generated it.
 */

/**
 * Traces a single canonical observation back to its source.
 * @param {object} observation - a CanonicalObservation
 * @returns {{
 *   sourceReport: { system: string, format: string, scanId: string|null, originalRef: string|null },
 *   originalRecord: { pointer: string|null, recordIndex: number|null, findingId: string|null },
 *   scanner: string|null,
 *   page: { submittedUrl: string, finalUrl: string, title: string }
 * }}
 */
export function traceObservation(observation) {
  const src = observation?.source || {};
  const prov = observation?.provenance || {};
  const id = observation?.identity || {};
  const page = observation?.page || {};

  return {
    sourceReport: {
      system: src.system ?? null,
      format: src.format ?? null,
      scanId: src.scanId ?? null,
      originalRef: src.originalRef ?? null
    },
    originalRecord: {
      pointer: src.recordPointer ?? null,
      recordIndex: prov.sourceRecordIndex ?? null,
      findingId: id.sourceFindingId ?? null
    },
    scanner: prov.scanner ?? null,
    page: {
      submittedUrl: page.submittedUrl ?? '',
      finalUrl: page.finalUrl ?? '',
      title: page.title ?? ''
    }
  };
}

/**
 * Traces every observation underlying a Workbench finding (task or cluster).
 * Returns one trace per constituent observation, in order.
 * @param {object} finding - a RemediationTask or PatternCluster with an
 *   `observations` array.
 * @returns {Array<ReturnType<typeof traceObservation>>}
 */
export function traceFinding(finding) {
  const observations = Array.isArray(finding?.observations) ? finding.observations : [];
  return observations.map(traceObservation);
}

/**
 * Verifies that a finding has complete provenance on all four Phase 4 axes for
 * every constituent observation: source report, original record, scanner/tool,
 * and page. Returns { complete, gaps } where gaps lists any missing axis with
 * the offending observation index.
 * @param {object} finding
 * @returns {{ complete: boolean, gaps: Array<{ index: number, axis: string }> }}
 */
export function verifyFindingProvenance(finding) {
  const traces = traceFinding(finding);
  const gaps = [];

  traces.forEach((t, index) => {
    if (!t.sourceReport.system || !t.sourceReport.format) gaps.push({ index, axis: 'source-report' });
    // An original record is identified by a stable pointer, a finding id, or an
    // index — any one suffices, but at least one must be present.
    if (t.originalRecord.pointer == null && t.originalRecord.findingId == null && t.originalRecord.recordIndex == null) {
      gaps.push({ index, axis: 'original-record' });
    }
    if (!t.scanner) gaps.push({ index, axis: 'scanner' });
    if (!t.page.submittedUrl && !t.page.finalUrl) gaps.push({ index, axis: 'page' });
  });

  return { complete: traces.length > 0 && gaps.length === 0, gaps };
}
