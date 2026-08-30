/**
 * Source detector for Open Accessibility Workbench.
 * Identifies report types from content structure rather than relying solely on file names.
 */

import { parseCSV } from '../utils/csv-parser.js';

export const REPORT_TYPES = {
  OPEN_SCANS_JSON: 'open-scans-json',
  OPEN_SCANS_OVERLAP_JSON: 'open-scans-overlap-json',
  OPEN_SCANS_CSV: 'open-scans-csv',
  OOBEE_CSV: 'oobee-csv',
  OOBEE_ITEMS_SUMMARY_JSON: 'oobee-items-summary-json',
  OOBEE_ISSUES_SUMMARY_JSON: 'oobee-issues-summary-json',
  OOBEE_PAGES_SUMMARY_JSON: 'oobee-pages-summary-json',
  OOBEE_PAGES_DETAIL_JSON: 'oobee-pages-detail-json',
  UNKNOWN: 'unknown'
};

const SUPPORTED_FORMATS_EXPLANATION = `
Supported formats:
1. Open Scans Detailed Report (report.json) - Contains finding-level results with selectors and HTML.
2. Open Scans Overlap Report (report-overlap.json) - Contains cross-engine overlap statistics.
3. Open Scans Summary CSV (report.csv) - Page-level scan statistics.
4. Oobee Detailed Report (report.csv) - Finding-level accessibility issues with severity and locators.
5. Oobee Summary JSONs (scanItemsSummary.json, scanIssuesSummary.json, scanPagesSummary.json, scanPagesDetail.json).
`.trim();

/**
 * Detects the report type from raw string or parsed object.
 * @param {string | object} rawContent
 * @param {string} [filename=""]
 * @returns {{
 *   recognized: boolean;
 *   type: string;
 *   format: string;
 *   system: 'open-scans' | 'oobee' | 'unknown';
 *   granularity: 'finding' | 'page' | 'aggregate' | 'overlap' | 'unknown';
 *   error?: string;
 *   explanation?: string;
 *   parsedData?: any;
 * }}
 */
export function detectReportSource(rawContent, filename = '') {
  if (!rawContent) {
    return {
      recognized: false,
      type: REPORT_TYPES.UNKNOWN,
      format: 'empty',
      system: 'unknown',
      granularity: 'unknown',
      error: 'This file does not match a supported Open Scans or Oobee report format.',
      explanation: 'The provided file is empty.\n' + SUPPORTED_FORMATS_EXPLANATION
    };
  }

  // 1. Check if content is or can be parsed as JSON
  let jsonData = null;
  let isJson = false;

  if (typeof rawContent === 'object' && rawContent !== null) {
    jsonData = rawContent;
    isJson = true;
  } else if (typeof rawContent === 'string') {
    const trimmed = rawContent.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        jsonData = JSON.parse(trimmed);
        isJson = true;
      } catch (err) {
        // Not valid JSON, continue to CSV detection
      }
    }
  }

  if (isJson && jsonData) {
    // A. Open Scans Overlap JSON
    if (
      Array.isArray(jsonData.scannersInUse) &&
      (jsonData.scannerStats || jsonData.matrix)
    ) {
      return {
        recognized: true,
        type: REPORT_TYPES.OPEN_SCANS_OVERLAP_JSON,
        format: 'json',
        system: 'open-scans',
        granularity: 'overlap',
        parsedData: jsonData
      };
    }

    // B. Open Scans Detailed report.json
    if (
      Array.isArray(jsonData.results) &&
      (Array.isArray(jsonData.engines) || jsonData.issueNumber !== undefined || jsonData.scanTitle !== undefined)
    ) {
      return {
        recognized: true,
        type: REPORT_TYPES.OPEN_SCANS_JSON,
        format: 'json',
        system: 'open-scans',
        granularity: 'finding',
        parsedData: jsonData
      };
    }

    // C. Oobee scanItemsSummary.json
    if (
      typeof jsonData === 'object' &&
      !Array.isArray(jsonData) &&
      (jsonData.mustFix !== undefined || jsonData.goodToFix !== undefined || jsonData.needsReview !== undefined) &&
      jsonData.totalItems !== undefined
    ) {
      return {
        recognized: true,
        type: REPORT_TYPES.OOBEE_ITEMS_SUMMARY_JSON,
        format: 'json',
        system: 'oobee',
        granularity: 'aggregate',
        parsedData: jsonData
      };
    }

    // D. Oobee scanIssuesSummary.json
    if (
      Array.isArray(jsonData) &&
      jsonData.length > 0 &&
      jsonData[0].issueId !== undefined &&
      (jsonData[0].severity !== undefined || jsonData[0].issueDescription !== undefined)
    ) {
      return {
        recognized: true,
        type: REPORT_TYPES.OOBEE_ISSUES_SUMMARY_JSON,
        format: 'json',
        system: 'oobee',
        granularity: 'aggregate',
        parsedData: jsonData
      };
    }

    // E. Oobee scanPagesSummary.json
    if (
      typeof jsonData === 'object' &&
      !Array.isArray(jsonData) &&
      jsonData.totalPagesScanned !== undefined &&
      Array.isArray(jsonData.pagesScanned)
    ) {
      return {
        recognized: true,
        type: REPORT_TYPES.OOBEE_PAGES_SUMMARY_JSON,
        format: 'json',
        system: 'oobee',
        granularity: 'page',
        parsedData: jsonData
      };
    }

    // F. Oobee scanPagesDetail.json
    if (
      Array.isArray(jsonData) &&
      jsonData.length > 0 &&
      jsonData[0].url !== undefined &&
      Array.isArray(jsonData[0].issues)
    ) {
      return {
        recognized: true,
        type: REPORT_TYPES.OOBEE_PAGES_DETAIL_JSON,
        format: 'json',
        system: 'oobee',
        granularity: 'page',
        parsedData: jsonData
      };
    }
  }

  // 2. Check if content is CSV
  if (typeof rawContent === 'string') {
    try {
      const records = parseCSV(rawContent);
      if (records.length > 0) {
        const headers = Object.keys(records[0]);

        // A. Oobee finding-level CSV
        const hasOobeeSeverity = headers.some(h => /severity/i.test(h));
        const hasOobeeIssueId = headers.some(h => /issueId/i.test(h));
        const hasOobeeUrl = headers.some(h => /^url$/i.test(h));
        const hasOobeeContext = headers.some(h => /context/i.test(h));

        if (hasOobeeSeverity && (hasOobeeIssueId || hasOobeeContext) && hasOobeeUrl) {
          return {
            recognized: true,
            type: REPORT_TYPES.OOBEE_CSV,
            format: 'csv',
            system: 'oobee',
            granularity: 'finding',
            parsedData: records
          };
        }

        // B. Open Scans page summary CSV
        const hasOpenScansUrls = headers.some(h => /submitted_url/i.test(h) || /final_url/i.test(h));
        const hasOpenScansEngines = headers.some(h => /axe_failed/i.test(h) || /alfa_failed/i.test(h) || /qualweb_failed/i.test(h));

        if (hasOpenScansUrls && hasOpenScansEngines) {
          return {
            recognized: true,
            type: REPORT_TYPES.OPEN_SCANS_CSV,
            format: 'csv',
            system: 'open-scans',
            granularity: 'page',
            parsedData: records
          };
        }
      }
    } catch (err) {
      // CSV parsing error
    }
  }

  return {
    recognized: false,
    type: REPORT_TYPES.UNKNOWN,
    format: 'unknown',
    system: 'unknown',
    granularity: 'unknown',
    error: 'This file does not match a supported Open Scans or Oobee report format.',
    explanation: SUPPORTED_FORMATS_EXPLANATION
  };
}
