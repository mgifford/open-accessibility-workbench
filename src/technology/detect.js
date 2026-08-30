/**
 * Technology detection engine.
 * Priority: User confirmed > Scanner metadata > Imported detector > Strong local evidence > Weak heuristics.
 */

export function detectTechnologyFromObservations(observations = [], userConfirmedTech = null, scanMetadata = null) {
  // 1. User confirmation outranks all detectors
  if (userConfirmedTech && userConfirmedTech !== 'unknown') {
    return {
      name: userConfirmedTech,
      category: getCategoryForTech(userConfirmedTech),
      confidence: 'high',
      source: 'user',
      evidence: ['User confirmed technology stack in workspace preferences.']
    };
  }

  // 2. Scan metadata from upstream
  if (scanMetadata?.technologies && Array.isArray(scanMetadata.technologies) && scanMetadata.technologies.length > 0) {
    const top = scanMetadata.technologies[0];
    return {
      name: top.name,
      category: top.category || 'Framework',
      confidence: 'high',
      source: 'metadata',
      evidence: top.evidence || ['Report metadata emitted upstream.']
    };
  }

  // 3. Scan title or URL signals
  const evidenceList = [];
  let detected = null;

  for (const obs of observations) {
    const html = obs.evidence.renderedHtml || '';
    const loc = obs.evidence.locator || '';
    const title = obs.page.title || '';
    const url = obs.page.submittedUrl || '';

    // Drupal signals
    if (html.includes('data-history-node-id') || html.includes('node__meta') || title.includes('Drupal') || url.includes('drupal')) {
      evidenceList.push('DOM contains Drupal entity markup / data-history-node-id attributes');
      detected = 'Drupal';
      break;
    }

    // WordPress signals
    if (html.includes('wp-content') || html.includes('wp-block') || loc.includes('wp-')) {
      evidenceList.push('DOM contains WordPress wp-content / wp-block markers');
      detected = 'WordPress';
      break;
    }

    // React signals
    if (html.includes('data-reactroot') || loc.includes('react-')) {
      evidenceList.push('DOM contains React root markers');
      detected = 'React';
      break;
    }
  }

  if (detected) {
    return {
      name: detected,
      category: getCategoryForTech(detected),
      confidence: 'medium',
      source: 'detector',
      evidence: evidenceList
    };
  }

  return {
    name: 'Native HTML / CSS',
    category: 'Standards',
    confidence: 'low',
    source: 'heuristic',
    evidence: ['Standard HTML5 markup without framework-specific signatures.']
  };
}

function getCategoryForTech(name) {
  const lower = name.toLowerCase();
  if (lower.includes('drupal') || lower.includes('wordpress')) return 'CMS';
  if (lower.includes('react') || lower.includes('vue') || lower.includes('angular')) return 'Frontend Framework';
  return 'Standards';
}
