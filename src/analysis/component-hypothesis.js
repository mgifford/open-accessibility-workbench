/**
 * Hypothesizes shared components or templates from recurring pattern clusters.
 * Detects multi-rule shared components (e.g. header having contrast + link-name + landmark issues).
 */

export function buildComponentHypotheses(patternClusters, totalPagesInScan = 1) {
  if (!Array.isArray(patternClusters)) {
    return [];
  }

  const hypotheses = [];

  for (const cluster of patternClusters) {
    const locator = cluster.representativeLocator.toLowerCase();
    const html = cluster.representativeHtml.toLowerCase();

    let name = 'Isolated Element';
    let confidence = 'low';
    let rationale = 'Occurs on a single page or element without confirmed shared template signals.';

    if (cluster.upstreamPatternId) {
      confidence = 'high';
      if (locator.includes('social') || html.includes('social') || html.includes('linkedin') || html.includes('twitter')) {
        name = 'Shared Social Links Component';
        rationale = `High-confidence shared component verified by upstream pattern ${cluster.upstreamPatternId} and social iconography across ${cluster.pagesCount} pages.`;
      } else if (locator.includes('header') || locator.includes('nav')) {
        name = 'Site Header / Navigation Template';
        rationale = `High-confidence header/nav template component recurring across ${cluster.pagesCount} pages.`;
      } else if (locator.includes('footer')) {
        name = 'Global Footer Component';
        rationale = `High-confidence footer component recurring across ${cluster.pagesCount} pages.`;
      } else if (locator.includes('node__meta') || locator.includes('author') || locator.includes('article')) {
        name = 'Content Teaser / Byline Template';
        rationale = `Shared content entity / node teaser template occurring across multiple entity displays.`;
      } else {
        name = `Shared ${cluster.ruleId} Component`;
        rationale = `High-confidence pattern ID ${cluster.upstreamPatternId} recurring across ${cluster.pagesCount} pages.`;
      }
    } else if (cluster.pagesCount > 1 || cluster.occurrencesCount >= 3) {
      confidence = cluster.pagesCount >= Math.max(2, Math.floor(totalPagesInScan * 0.5)) ? 'high' : 'medium';
      if (locator.includes('social') || html.includes('social') || html.includes('icon')) {
        name = 'Probable Social / Icon Links Component';
        rationale = `Recurring markup structure found on ${cluster.pagesCount} pages indicates a shared component.`;
      } else if (locator.includes('footer')) {
        name = 'Probable Global Footer';
        rationale = `Footer container failure recurring across ${cluster.pagesCount} pages.`;
      } else if (locator.includes('nav') || locator.includes('menu')) {
        name = 'Probable Navigation Component';
        rationale = `Navigation menu failure recurring across ${cluster.pagesCount} pages.`;
      } else {
        name = `Probable Shared Template Element (${cluster.ruleId})`;
        rationale = `Consistent DOM signature appearing across ${cluster.pagesCount} pages.`;
      }
    }

    hypotheses.push({
      clusterId: cluster.id,
      name,
      confidence,
      rationale
    });
  }

  return hypotheses;
}
