import { parseCSV } from '../../utils/csv-parser.js';

export function parseOpenScansReportCsv(content) {
  const records = typeof content === 'string' ? parseCSV(content) : content;

  const pages = records.map(row => ({
    issueNumber: row.issue_number ? Number(row.issue_number) : null,
    scanTitle: row.scan_title || '',
    submittedUrl: row.submitted_url || '',
    finalUrl: row.final_url || '',
    pageTitle: row.page_title || '',
    httpStatus: row.http_status ? Number(row.http_status) : 200,
    browser: row.scan_browser || 'unknown',
    axePassed: Number(row.axe_passed || 0),
    axeFailed: Number(row.axe_failed || 0),
    axeFailedRules: row.axe_failed_rules ? row.axe_failed_rules.split(';').filter(Boolean) : [],
    qualwebFailed: Number(row.qualweb_failed || 0),
    qualwebFailedRules: row.qualweb_failed_rules ? row.qualweb_failed_rules.split(';').filter(Boolean) : [],
    alfaFailed: Number(row.alfa_failed || 0),
    duplicateFindings: Number(row.duplicate_findings || 0)
  }));

  return {
    system: 'open-scans',
    format: 'report.csv',
    granularity: 'page',
    totalPages: pages.length,
    pages
  };
}
