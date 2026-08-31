/**
 * Source-aware candidate (spec §9.5).
 *
 * A candidate source change may ONLY be produced when the user supplies real
 * source context (framework/language, filename, component/template name, source
 * snippet, surrounding context). Rendered scanner HTML is never a source patch
 * and must never be presented as one. When source is absent, this returns null
 * and the framework-neutral target markup remains the only guidance.
 */

/**
 * @param {object} sourceContext - user-supplied source, e.g.
 *   { framework, language, filename, componentName, snippet, surroundingContext }
 * @param {object} task
 * @returns {null | {
 *   label: 'Candidate source change',
 *   framework: string|null, language: string|null, filename: string|null,
 *   componentName: string|null, basedOnSuppliedSource: true,
 *   objective: string, note: string, suppliedSnippet: string
 * }}
 */
export function buildSourceAwareCandidate(sourceContext, task) {
  if (!sourceContext || typeof sourceContext !== 'object') return null;
  const snippet = typeof sourceContext.snippet === 'string' ? sourceContext.snippet.trim() : '';
  // Require an actual source snippet — without it there is no source to be aware
  // of, and we must not fabricate one.
  if (snippet === '') return null;

  const bp = task?.blueprint || {};
  // No deterministic source transformation exists yet, so this is honestly the
  // SUPPLIED source plus the remediation objective — not a generated candidate.
  // (Renaming it "Candidate source change" would overclaim.) A real transform is
  // a later-phase deliverable; until then we present the objective against the
  // user's own source so they can apply the change themselves.
  return {
    label: 'Supplied source context',
    framework: sourceContext.framework || null,
    language: sourceContext.language || null,
    filename: sourceContext.filename || null,
    componentName: sourceContext.componentName || null,
    basedOnSuppliedSource: true,
    transformed: false,
    objective: bp.whatNeedsToChange || 'Satisfy the accessibility requirement for this rule.',
    note: 'This is the source you supplied plus the remediation objective. The Workbench does not yet generate a transformed candidate; apply the objective to this source yourself, then validate.',
    suppliedSnippet: snippet,
    surroundingContext: typeof sourceContext.surroundingContext === 'string' ? sourceContext.surroundingContext : null
  };
}
