/**
 * Technology-specific guidance that EXTENDS — never replaces — the
 * framework-neutral remediation objective (spec §8.7).
 *
 * Rules:
 * - Framework guidance is only offered when the technology is defensibly known:
 *   user-confirmed, from scan metadata, or a STRONG report-evidence marker
 *   (confidence >= medium AND source is not a weak heuristic).
 * - A low-confidence / weak-heuristic detection yields NO framework-specific
 *   text and NO source-style snippet — only the generic objective applies.
 * - The returned notes are advisory context ("where this typically lives" in the
 *   named stack), not a source patch.
 */

/** Curated, conservative per-(tech, family) notes. Keyed by technology name. */
const TECH_NOTES = {
  Drupal: {
    'accessible-name': 'In Drupal, icon links are usually rendered by a field formatter, a Twig template (e.g. a social-links or menu template), or a block — change the shared template, not individual nodes.',
    'contrast': 'In Drupal, colours typically come from the theme’s CSS/design tokens (theme libraries or a base theme). Adjust the token, then re-export the theme.',
    'structure': 'In Drupal, landmarks are usually set in page templates (html.html.twig / page.html.twig) and region templates; add semantic wrappers there.',
    'text-alternative': 'In Drupal, image alt text is often an image-field property or a media entity field; fix the field value or the field formatter rather than the rendered markup.'
  },
  WordPress: {
    'accessible-name': 'In WordPress, this markup usually comes from a theme template, a block (block.json / render callback), or a widget — edit the template or block, not each post.',
    'contrast': 'In WordPress, colours are often theme.json palette entries or block colour settings; adjust the palette token.',
    'structure': 'In WordPress, landmarks live in theme templates (header.php / footer.php / index.php) or block templates; add semantic wrappers there.',
    'text-alternative': 'In WordPress, image alt text is stored on the media attachment; correct it in the Media Library or the block’s alt field.'
  },
  React: {
    'accessible-name': 'In React, this is likely a reusable component; add the accessible name via props/JSX on the component so every instance is fixed.',
    'contrast': 'In React apps, colours are usually theme/design-token modules or CSS-in-JS; change the token, not one element.',
    'structure': 'In React, landmark structure is set by layout components; add semantic elements in the shared layout.',
    'text-alternative': 'In React, pass meaningful alt text through the image component’s props.'
  },
  Vue: {
    'accessible-name': 'In Vue, this is likely a single-file component; add the accessible name in the component template/props so all instances update.',
    'contrast': 'In Vue apps, colours are usually design tokens or SCSS variables; adjust the token.',
    'structure': 'In Vue, landmark structure is typically in a layout component; add semantic wrappers there.',
    'text-alternative': 'In Vue, bind meaningful alt text via the image component’s prop.'
  },
  Angular: {
    'accessible-name': 'In Angular, this is likely a shared component; set the accessible name in the component template/inputs.',
    'contrast': 'In Angular, colours usually live in SCSS theme files / design tokens; adjust the token.',
    'structure': 'In Angular, landmarks are typically in a layout component; add semantic elements there.',
    'text-alternative': 'In Angular, bind meaningful alt text via the component input.'
  }
};

/** Aliases so confirmed variants map to the note set. */
const TECH_ALIASES = {
  'drupal/twig': 'Drupal',
  'twig': 'Drupal',
  'wordpress': 'WordPress',
  'react': 'React',
  'vue': 'Vue',
  'angular': 'Angular'
};

function resolveTechKey(name) {
  if (!name) return null;
  if (TECH_NOTES[name]) return name;
  const alias = TECH_ALIASES[String(name).toLowerCase()];
  return alias || null;
}

/**
 * Returns supplementary, extend-only technology guidance for a task, or null.
 *
 * @param {string} remediationFamily
 * @param {object} technologyContext - the resolved TechnologyContext
 * @returns {{ technology: string, note: string, basis: string } | null}
 */
export function getTechnologyGuidance(remediationFamily, technologyContext) {
  if (!technologyContext) return null;
  const { name, confidence, source, confirmed } = technologyContext;

  // Only offer framework guidance for a defensibly-known technology: confirmed,
  // metadata, imported detector, or a STRONG report-evidence marker. Never for a
  // weak heuristic / low confidence, and never for Unknown.
  const defensible = confirmed
    || source === 'metadata'
    || source === 'detector'
    || (source === 'report-evidence' && (confidence === 'high' || confidence === 'medium'));
  if (!defensible) return null;

  const key = resolveTechKey(name);
  if (!key) return null;
  const note = TECH_NOTES[key]?.[remediationFamily];
  if (!note) return null;

  return {
    technology: key,
    note,
    basis: confirmed ? 'user-confirmed' : source
  };
}
