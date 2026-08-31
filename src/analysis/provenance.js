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
 * Verifies that a finding has complete, *resolvable* provenance on all four
 * Phase 4 axes for every constituent observation: source report, original
 * record, scanner/tool, and page. This checks that provenance IDENTIFIES and
 * RESOLVES to real things — not merely that string fields are present.
 *
 * @param {object} finding
 * @param {object} [options]
 * @param {(id: string) => object|null} [options.resolveSourceReport] - given a
 *   `source.sourceReportId`, returns the registered source-report descriptor or
 *   null. When provided, every observation MUST reference a source report that
 *   resolves. When omitted, a source report is accepted if it carries a concrete
 *   identity (system + format + a non-empty scanId or originalRef).
 * @param {(observation: object, report: object|null) => boolean} [options.resolveRecord]
 *   - given an observation and its resolved report, returns whether its
 *   recordPointer actually locates a record. When omitted, a syntactically valid
 *   pointer is required (a well-formed shape), not just any string.
 * @returns {{ complete: boolean, gaps: Array<{ index: number, axis: string, reason: string }> }}
 */
export function verifyFindingProvenance(finding, options = {}) {
  const { resolveSourceReport, resolveRecord } = options;
  const observations = Array.isArray(finding?.observations) ? finding.observations : [];
  const gaps = [];

  observations.forEach((obs, index) => {
    const src = obs?.source || {};
    const prov = obs?.provenance || {};
    const id = obs?.identity || {};
    const page = obs?.page || {};

    // --- which source report ---------------------------------------------
    let report = null;
    if (resolveSourceReport) {
      report = src.sourceReportId ? resolveSourceReport(src.sourceReportId) : null;
      if (!report) {
        gaps.push({ index, axis: 'source-report', reason: 'sourceReportId does not resolve to a registered report' });
      }
    } else {
      const hasIdentity =
        nonEmpty(src.system) && nonEmpty(src.format) && (nonEmpty(src.scanId) || nonEmpty(src.originalRef));
      if (!hasIdentity) {
        gaps.push({ index, axis: 'source-report', reason: 'missing concrete source identity (system/format/scanId|originalRef)' });
      }
    }

    // --- which original record -------------------------------------------
    if (resolveRecord) {
      if (!resolveRecord(obs, report)) {
        gaps.push({ index, axis: 'original-record', reason: 'recordPointer does not locate a source record' });
      }
    } else if (!isValidRecordPointer(src.recordPointer) && !nonEmpty(id.sourceFindingId)) {
      // Without a resolver, require a WELL-FORMED pointer or a concrete finding
      // id — a stray recordIndex or an arbitrary string is not enough.
      gaps.push({ index, axis: 'original-record', reason: 'no well-formed record pointer or finding id' });
    }

    // --- which scanner/tool ----------------------------------------------
    if (!nonEmpty(prov.scanner)) {
      gaps.push({ index, axis: 'scanner', reason: 'missing scanner' });
    }

    // --- which page -------------------------------------------------------
    if (!nonEmpty(page.submittedUrl) && !nonEmpty(page.finalUrl)) {
      gaps.push({ index, axis: 'page', reason: 'missing page url' });
    }
  });

  return { complete: observations.length > 0 && gaps.length === 0, gaps };
}

function nonEmpty(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * A record pointer is well-formed if it matches a known shape:
 *  - Open Scans: /results/{n}/{engine}/failures/{n}
 *  - Oobee CSV:  row:{n}
 */
function isValidRecordPointer(pointer) {
  if (typeof pointer !== 'string') return false;
  return /^\/results\/\d+\/[A-Za-z]+\/failures\/\d+$/.test(pointer) || /^row:\d+$/.test(pointer);
}
