import { normalizeOpenScansReportJson } from './normalize.js';

export function parseOpenScansReportJson(content, filename = 'report.json') {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  const observations = normalizeOpenScansReportJson(json, filename);

  return {
    system: 'open-scans',
    format: 'report.json',
    scanId: String(json.issueNumber || json.scanTitle || 'open-scans'),
    scanTitle: json.scanTitle || '',
    issueNumber: json.issueNumber || null,
    issueUrl: json.issueUrl || null,
    scannedAt: json.scannedAt || new Date().toISOString(),
    engines: json.engines || [],
    scanContext: json.scanContext || {},
    totalPages: json.results?.length || 0,
    rawTotals: {
      axe: json.axeTotals || null,
      qualweb: json.qualwebTotals || null,
      alfa: json.alfaTotals || null
    },
    observations
  };
}
