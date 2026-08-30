export function parseOobeeItemsSummary(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  return {
    system: 'oobee',
    format: 'scanItemsSummary.json',
    granularity: 'aggregate',
    mustFix: Number(json.mustFix || 0),
    goodToFix: Number(json.goodToFix || 0),
    needsReview: Number(json.needsReview || 0),
    totalItems: Number(json.totalItems || 0)
  };
}

export function parseOobeeIssuesSummary(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  return {
    system: 'oobee',
    format: 'scanIssuesSummary.json',
    granularity: 'aggregate',
    issues: Array.isArray(json) ? json : []
  };
}

export function parseOobeePagesSummary(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  return {
    system: 'oobee',
    format: 'scanPagesSummary.json',
    granularity: 'page',
    totalPagesScanned: Number(json.totalPagesScanned || 0),
    pagesScanned: Array.isArray(json.pagesScanned) ? json.pagesScanned : [],
    pagesNotScanned: Array.isArray(json.pagesNotScanned) ? json.pagesNotScanned : []
  };
}

export function parseOobeePagesDetail(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  return {
    system: 'oobee',
    format: 'scanPagesDetail.json',
    granularity: 'page',
    pages: Array.isArray(json) ? json : []
  };
}
