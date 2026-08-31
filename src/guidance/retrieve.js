/**
 * Local retrieval (spec §10). Exact/deterministic relationships take precedence
 * over probabilistic retrieval — embeddings are NEVER used to rediscover known
 * mappings (e.g. color-contrast → 1.4.3). Every result carries its source,
 * framework, licence, match type, and the reason it was retrieved. The whole
 * workflow runs locally with no cloud services.
 *
 * Order (highest precedence first):
 *   1. exact         — curated chunk whose ruleIds contain the rule
 *   2. deterministic — the curated deterministic rule guidance block
 *   3. technology    — chunk matching the confirmed technology framework
 *   4. lexical       — free-text/metadata search (deterministic ordering)
 *   5. semantic      — optional, disabled by default (see semanticSearch)
 */

import { RAG_CORPUS, RAG_MANIFEST } from './rag-corpus.generated.js';
import { getExactRuleGuidance } from './exact-rule.js';

/** Normalizes a chunk into the presentation shape required by §10.6. */
function present(chunk, matchType, reason) {
  return {
    id: chunk.id,
    title: chunk.title,
    source: chunk.source,
    sourceUrl: chunk.sourceUrl || null,
    framework: chunk.framework || null,
    language: chunk.language || null,
    license: chunk.license,
    revision: chunk.revision || null,
    retrievedDate: chunk.retrievedDate || null,
    wcag: chunk.wcag || [],
    ruleIds: chunk.ruleIds || [],
    text: chunk.text,
    matchType,               // 'exact' | 'deterministic' | 'technology' | 'lexical' | 'semantic'
    retrievalReason: reason, // string[] explaining WHY
    appliesToConfirmedTech: null // set by the caller when tech is known
  };
}

const FRAMEWORK_ALIASES = {
  'drupal/twig': ['drupal', 'twig', 'php', 'html'],
  'drupal': ['drupal', 'twig', 'php', 'html'],
  'wordpress': ['wordpress', 'php', 'html'],
  'react': ['react', 'javascript', 'jsx'],
  'vue': ['vue', 'javascript'],
  'angular': ['angular', 'typescript', 'javascript'],
  'web components': ['web components', 'javascript', 'html'],
  'html': ['html']
};

function frameworkMatches(chunkFramework, confirmedTech) {
  if (!chunkFramework || !confirmedTech) return false;
  const aliases = FRAMEWORK_ALIASES[String(confirmedTech).toLowerCase()] || [String(confirmedTech).toLowerCase()];
  return aliases.includes(String(chunkFramework).toLowerCase());
}

/**
 * Retrieves guidance for a rule, in deterministic precedence order.
 *
 * @param {object} params
 * @param {string} params.ruleId
 * @param {string[]} [params.wcag]
 * @param {object|null} [params.technologyContext] - resolved technology; only a
 *   CONFIRMED technology influences technology-tier retrieval (a guess must not).
 * @param {string} [params.query] - optional free text for lexical search
 * @param {object[]} [params.corpus] - override corpus (tests)
 * @returns {{ results: object[], manifest: object }}
 */
export function retrieveGuidance({ ruleId, wcag = [], technologyContext = null, query = '', corpus = RAG_CORPUS } = {}) {
  const rule = String(ruleId || '').toLowerCase().trim();
  const results = [];
  const usedIds = new Set();
  const confirmedTech = technologyContext?.confirmed ? technologyContext.name : null;

  // 1. Exact rule match — a curated chunk whose ruleIds contain this rule.
  for (const chunk of corpus) {
    if ((chunk.ruleIds || []).map(r => r.toLowerCase()).includes(rule)) {
      const reason = [`Exact rule match: ${rule}`];
      const r = present(chunk, 'exact', reason);
      r.appliesToConfirmedTech = confirmedTech ? frameworkMatches(chunk.framework, confirmedTech) : null;
      results.push(r);
      usedIds.add(chunk.id);
    }
  }

  // 2. Deterministic rule guidance (curated, not from the corpus) — always
  // available, even when the corpus has no chunk for this rule.
  const det = getExactRuleGuidance(rule);
  results.push({
    id: `DET-${rule}`,
    title: det.summary,
    source: det.provenance.source,
    sourceUrl: det.provenance.sourceUrl || null,
    framework: null,
    language: null,
    license: det.provenance.license,
    revision: det.provenance.revision,
    retrievedDate: null,
    wcag: det.wcag || [],
    ruleIds: [rule],
    text: [
      det.summary,
      det.decisions?.length ? `Decisions: ${det.decisions.join(' ')}` : '',
      det.implementation?.length ? `Implementation: ${det.implementation.join(' ')}` : ''
    ].filter(Boolean).join('\n'),
    matchType: 'deterministic',
    retrievalReason: [det.curated ? `Deterministic curated guidance for ${rule}` : `Generic deterministic guidance (no curated rule entry for ${rule})`],
    appliesToConfirmedTech: null
  });

  // 3. Confirmed-technology guidance — corpus chunks matching the confirmed
  // framework. Only a CONFIRMED technology qualifies; a guess must not add
  // technology-specific results (spec §10.1/§8.2).
  if (confirmedTech) {
    for (const chunk of corpus) {
      if (usedIds.has(chunk.id)) continue;
      if (frameworkMatches(chunk.framework, confirmedTech)) {
        const r = present(chunk, 'technology', [`Technology context: ${confirmedTech} confirmed by user`, `Framework match: ${chunk.framework}`]);
        r.appliesToConfirmedTech = true;
        results.push(r);
        usedIds.add(chunk.id);
      }
    }
  }

  // 4. Lexical retrieval — only when a query is supplied. Deterministic order.
  if (query && String(query).trim()) {
    for (const hit of lexicalSearch(corpus, query, wcag)) {
      if (usedIds.has(hit.chunk.id)) continue;
      const r = present(hit.chunk, 'lexical', [`Lexical match (score ${hit.score})`, ...hit.why]);
      r.appliesToConfirmedTech = confirmedTech ? frameworkMatches(hit.chunk.framework, confirmedTech) : null;
      results.push(r);
      usedIds.add(hit.chunk.id);
    }
  }

  return { results, manifest: RAG_MANIFEST };
}

/**
 * Deterministic lexical search over title, ruleIds, WCAG, framework, language,
 * and text. Exact metadata matches outrank free-text matches; ties broken by id
 * for stable ordering (spec §10.4).
 */
export function lexicalSearch(corpus = RAG_CORPUS, query = '', wcag = []) {
  const q = String(query).toLowerCase().trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const wcagSet = new Set((wcag || []).map(String));

  const scored = [];
  for (const chunk of corpus) {
    let score = 0;
    const why = [];
    // Metadata matches (high weight).
    if ((chunk.ruleIds || []).some(r => terms.includes(r.toLowerCase()))) { score += 100; why.push('rule id'); }
    if ((chunk.wcag || []).some(w => wcagSet.has(w) || terms.includes(w))) { score += 80; why.push('WCAG'); }
    if (chunk.framework && terms.includes(chunk.framework.toLowerCase())) { score += 40; why.push('framework'); }
    if (chunk.language && terms.includes(chunk.language.toLowerCase())) { score += 30; why.push('language'); }
    if (chunk.title && terms.some(t => chunk.title.toLowerCase().includes(t))) { score += 20; why.push('title'); }
    // Free-text (low weight).
    const textMatches = terms.filter(t => (chunk.text || '').toLowerCase().includes(t)).length;
    if (textMatches) { score += textMatches; why.push('text'); }
    if (score > 0) scored.push({ chunk, score, why });
  }

  // Stable deterministic order: score desc, then id asc.
  scored.sort((a, b) => (b.score - a.score) || a.chunk.id.localeCompare(b.chunk.id));
  return scored;
}
