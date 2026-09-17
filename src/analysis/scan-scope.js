/**
 * Derives "what site is this and how big is the problem" facts from a loaded
 * workspace — domains, page scale, and the most common recurring patterns — so
 * every view can show the same scope header without re-deriving it. Pure
 * functions (no DOM); all inputs are already-normalized workspace data.
 */

/** Pulls the hostname from a URL string, or null if it isn't parseable. */
export function hostnameOf(url) {
  if (typeof url !== 'string' || url.trim() === '') return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

/**
 * Every page URL the scan touched, gathered from whichever evidence the report
 * carried: finding-level tasks (affectedPages), the CSV page summaries, or the
 * raw observations. De-duplicated, order-stable.
 */
export function collectPageUrls({ tasks = [], observations = [], sourceSummary = null } = {}) {
  const urls = new Set();
  for (const t of tasks) {
    for (const u of t.affectedPages || []) urls.add(u);
  }
  // CSV summary rows carry every scanned page, including ones with no task.
  for (const p of sourceSummary?.pageSummaries || []) {
    if (p.finalUrl || p.submittedUrl) urls.add(p.finalUrl || p.submittedUrl);
  }
  for (const o of observations) {
    const u = o.page?.finalUrl || o.page?.submittedUrl;
    if (u) urls.add(u);
  }
  return [...urls];
}

/**
 * Ranks the domains in scope by how many scanned pages each covers. Returns the
 * full ranked list; callers decide how many to show (e.g. top 3 + "N more").
 * @returns {Array<{ domain: string, pageCount: number }>}
 */
export function rankDomains(pageUrls = []) {
  const counts = new Map();
  for (const url of pageUrls) {
    const host = hostnameOf(url);
    if (!host) continue;
    counts.set(host, (counts.get(host) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([domain, pageCount]) => ({ domain, pageCount }))
    .sort((a, b) => b.pageCount - a.pageCount || a.domain.localeCompare(b.domain));
}

/**
 * Scale of the problem: how many pages were scanned, how many have at least one
 * finding, and the share that represents. `totalPages` comes from the source
 * summary (the real scanned count); pages-with-findings is derived from tasks'
 * affected pages (finding-level) so it is truthful even when totalPages is
 * larger than the set that produced tasks.
 */
export function scaleSummary({ tasks = [], sourceSummary = null } = {}) {
  const totalPages = sourceSummary?.totalPages || 0;
  const pagesWithFindings = new Set();
  for (const t of tasks) {
    for (const u of t.affectedPages || []) pagesWithFindings.add(u);
  }
  const withFindings = pagesWithFindings.size;
  const percentage = totalPages > 0 ? Math.round((withFindings / totalPages) * 100) : null;
  return { totalPages, pagesWithFindings: withFindings, percentage };
}

/**
 * The most common recurring patterns, ranked by reach (pages affected, then
 * occurrences). A "pattern" here is a task's remediation family — the thing that
 * makes several findings one fixable unit — so this answers "are there simple
 * common patterns that show up a lot?".
 * @returns {Array<{ family: string, ruleId: string, title: string, pageCount: number, occurrences: number, taskId: string }>}
 */
export function commonPatterns({ tasks = [] } = {}, limit = 5) {
  return [...tasks]
    .map(t => ({
      family: t.remediationFamily || t.ruleId,
      ruleId: t.ruleId,
      title: t.title,
      pageCount: t.metrics?.affectedPagesCount || 0,
      occurrences: t.metrics?.observationCount || 0,
      taskId: t.id
    }))
    .sort((a, b) => b.pageCount - a.pageCount || b.occurrences - a.occurrences)
    .slice(0, limit);
}

/**
 * One call that assembles the whole scope header model a view needs. Returns
 * null when nothing is loaded, so a caller can render nothing.
 */
export function buildScanScope(state = {}) {
  const { loaded, tasks = [], observations = [], sourceSummary = null } = state;
  if (!loaded) return null;
  const pageUrls = collectPageUrls({ tasks, observations, sourceSummary });
  const domains = rankDomains(pageUrls);
  return {
    system: sourceSummary?.system || null,
    scanId: sourceSummary?.scanId || null,
    scanTitle: sourceSummary?.scanTitle || null,
    domains,
    totalDomains: domains.length,
    scale: scaleSummary({ tasks, sourceSummary }),
    patterns: commonPatterns({ tasks })
  };
}
