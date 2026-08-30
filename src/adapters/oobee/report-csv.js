import { parseCSV } from '../../utils/csv-parser.js';
import { normalizeOobeeCsvRecords } from './normalize.js';

export function parseOobeeReportCsv(content, filename = 'report.csv') {
  const records = typeof content === 'string' ? parseCSV(content) : content;
  const observations = normalizeOobeeCsvRecords(records, filename);

  const pagesSet = new Set();
  const severityCounts = { mustFix: 0, goodToFix: 0, needsReview: 0, total: 0 };

  for (const obs of observations) {
    if (obs.page.submittedUrl) {
      pagesSet.add(obs.page.submittedUrl);
    }
    const cat = obs.classification.sourceCategory;
    if (cat === 'mustFix') severityCounts.mustFix++;
    else if (cat === 'goodToFix') severityCounts.goodToFix++;
    else if (cat === 'needsReview') severityCounts.needsReview++;
    severityCounts.total++;
  }

  return {
    system: 'oobee',
    format: 'report.csv',
    granularity: 'finding',
    totalPages: pagesSet.size,
    severityCounts,
    observations
  };
}
