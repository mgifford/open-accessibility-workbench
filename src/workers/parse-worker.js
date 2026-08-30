/**
 * Web Worker for parsing and normalizing large scan reports off the main thread.
 */

import { detectReportSource, REPORT_TYPES } from '../adapters/detect-source.js';
import { parseOpenScansReportJson } from '../adapters/open-scans/report-json.js';
import { parseOpenScansOverlapJson } from '../adapters/open-scans/overlap-json.js';
import { parseOpenScansReportCsv } from '../adapters/open-scans/report-csv.js';
import { parseOobeeReportCsv } from '../adapters/oobee/report-csv.js';
import {
  parseOobeeItemsSummary,
  parseOobeeIssuesSummary,
  parseOobeePagesSummary,
  parseOobeePagesDetail
} from '../adapters/oobee/items-summary.js';
import { enrichObservationsWithSignatures } from '../analysis/canonicalize.js';
import { clusterPatternOccurrences } from '../analysis/pattern-cluster.js';
import { buildComponentHypotheses } from '../analysis/component-hypothesis.js';
import { buildRemediationTasks } from '../analysis/remediation-tasks.js';

self.onmessage = async (e) => {
  const { id, rawContent, filename, userConfirmedTech } = e.data;

  try {
    const detection = detectReportSource(rawContent, filename);
    if (!detection.recognized) {
      self.postMessage({
        id,
        success: false,
        error: detection.error,
        explanation: detection.explanation
      });
      return;
    }

    let parsedResult = null;
    let observations = [];
    let totalPages = 1;
    let scanMetadata = null;

    if (detection.type === REPORT_TYPES.OPEN_SCANS_JSON) {
      parsedResult = parseOpenScansReportJson(detection.parsedData || rawContent, filename);
      observations = parsedResult.observations;
      totalPages = parsedResult.totalPages;
      scanMetadata = { issueNumber: parsedResult.issueNumber, scanTitle: parsedResult.scanTitle };
    } else if (detection.type === REPORT_TYPES.OPEN_SCANS_OVERLAP_JSON) {
      parsedResult = parseOpenScansOverlapJson(detection.parsedData || rawContent);
    } else if (detection.type === REPORT_TYPES.OPEN_SCANS_CSV) {
      parsedResult = parseOpenScansReportCsv(detection.parsedData || rawContent);
      totalPages = parsedResult.totalPages;
    } else if (detection.type === REPORT_TYPES.OOBEE_CSV) {
      parsedResult = parseOobeeReportCsv(detection.parsedData || rawContent, filename);
      observations = parsedResult.observations;
      totalPages = parsedResult.totalPages;
    } else if (detection.type === REPORT_TYPES.OOBEE_ITEMS_SUMMARY_JSON) {
      parsedResult = parseOobeeItemsSummary(detection.parsedData || rawContent);
    } else if (detection.type === REPORT_TYPES.OOBEE_ISSUES_SUMMARY_JSON) {
      parsedResult = parseOobeeIssuesSummary(detection.parsedData || rawContent);
    } else if (detection.type === REPORT_TYPES.OOBEE_PAGES_SUMMARY_JSON) {
      parsedResult = parseOobeePagesSummary(detection.parsedData || rawContent);
    } else if (detection.type === REPORT_TYPES.OOBEE_PAGES_DETAIL_JSON) {
      parsedResult = parseOobeePagesDetail(detection.parsedData || rawContent);
    }

    let clusters = [];
    let hypotheses = [];
    let tasks = [];

    if (observations.length > 0) {
      const enrichedObs = enrichObservationsWithSignatures(observations);
      clusters = clusterPatternOccurrences(enrichedObs, totalPages);
      hypotheses = buildComponentHypotheses(clusters, totalPages);
      tasks = buildRemediationTasks(clusters, hypotheses, totalPages, userConfirmedTech, scanMetadata);
      observations = enrichedObs;
    }

    self.postMessage({
      id,
      success: true,
      detection,
      parsedResult,
      observations,
      clusters,
      hypotheses,
      tasks,
      reductionStats: {
        rawObservationsCount: observations.length,
        patternClustersCount: clusters.length,
        hypothesesCount: hypotheses.length,
        remediationTasksCount: tasks.length
      }
    });
  } catch (err) {
    self.postMessage({
      id,
      success: false,
      error: err.message || 'Error occurred during parsing'
    });
  }
};
