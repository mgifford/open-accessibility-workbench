export function parseOpenScansOverlapJson(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;

  return {
    system: 'open-scans',
    format: 'report-overlap.json',
    generatedAt: json.generatedAt || null,
    issueNumber: json.issueNumber || null,
    scanTitle: json.scanTitle || '',
    scannersInUse: Array.isArray(json.scannersInUse) ? json.scannersInUse : [],
    scannerStats: json.scannerStats || {},
    matrix: json.matrix || {},
    duplicateFindingTotals: json.duplicateFindingTotals || 0,
    overlapEntries: Array.isArray(json.overlapEntries) ? json.overlapEntries : [],
    actConsensusEntries: Array.isArray(json.actConsensusEntries) ? json.actConsensusEntries : []
  };
}
