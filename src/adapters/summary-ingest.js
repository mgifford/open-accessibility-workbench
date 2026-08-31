/**
 * Ingestion for recognized aggregate/summary report formats that carry no
 * finding-level evidence (the four Oobee summary JSONs and a standalone Open
 * Scans overlap report). These do not flow through the pattern/task pipeline;
 * they are normalized into a `summaryData` object the overview renders directly.
 */

import { REPORT_TYPES } from './detect-source.js';
import {
  parseOobeeItemsSummary,
  parseOobeeIssuesSummary,
  parseOobeePagesSummary,
  parseOobeePagesDetail
} from './oobee/items-summary.js';
import { parseOpenScansOverlapJson } from './open-scans/overlap-json.js';

/**
 * @param {{type: string, parsedData?: any}} detection
 * @param {string|object} content
 * @returns {object|null} summaryData for aggregate formats, or null for
 *   finding-level formats (which the caller routes through the task pipeline).
 */
export function ingestSummaryFormat(detection, content) {
  const data = detection.parsedData || content;
  switch (detection.type) {
    case REPORT_TYPES.OOBEE_ITEMS_SUMMARY_JSON: {
      const p = parseOobeeItemsSummary(data);
      return {
        kind: 'oobee-items', format: p.format, granularity: 'aggregate',
        severityCounts: { mustFix: p.mustFix, goodToFix: p.goodToFix, needsReview: p.needsReview },
        totalItems: p.totalItems, totalPagesScanned: p.totalPagesScanned,
        wcagPassPercentage: p.wcagPassPercentage
      };
    }
    case REPORT_TYPES.OOBEE_ISSUES_SUMMARY_JSON: {
      const p = parseOobeeIssuesSummary(data);
      return { kind: 'oobee-issues', format: p.format, granularity: 'aggregate', issues: p.issues };
    }
    case REPORT_TYPES.OOBEE_PAGES_SUMMARY_JSON: {
      const p = parseOobeePagesSummary(data);
      return {
        kind: 'oobee-pages', format: p.format, granularity: 'page',
        scannedPagesCount: p.scannedPagesCount,
        pagesAffected: p.pagesAffected, pagesNotAffected: p.pagesNotAffected,
        pagesNotScanned: p.pagesNotScanned
      };
    }
    case REPORT_TYPES.OOBEE_PAGES_DETAIL_JSON: {
      const p = parseOobeePagesDetail(data);
      return { kind: 'oobee-pages-detail', format: p.format, granularity: 'page', pages: p.pages };
    }
    case REPORT_TYPES.OPEN_SCANS_OVERLAP_JSON: {
      const overlap = parseOpenScansOverlapJson(data);
      return { kind: 'open-scans-overlap', format: 'report-overlap.json', granularity: 'overlap', overlap };
    }
    default:
      return null;
  }
}
