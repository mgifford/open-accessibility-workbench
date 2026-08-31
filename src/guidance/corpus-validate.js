/**
 * Corpus provenance & licence enforcement (spec §10.2). Shared by the RAG build
 * script and its tests. Throws on: missing source, missing licence, missing/
 * duplicate id, unknown corpus revision, or a licence outside the allowlist.
 */

export const COMPATIBLE_LICENSES = new Set(['W3C-Document', 'CC-BY-4.0', 'CC0-1.0', 'MIT', 'Apache-2.0']);

export function validateCorpus(chunks, { corpusRevision, chunkRevision = 'unversioned', retrievedDate = null } = {}) {
  if (!corpusRevision) throw new Error('RAG build failed: unknown corpus revision.');
  if (!Array.isArray(chunks)) throw new Error('RAG build failed: corpus is not an array.');

  const seen = new Set();
  const out = [];
  for (const c of chunks) {
    if (!c || !c.id) throw new Error(`RAG build failed: chunk missing stable id (title="${c?.title || '?'}").`);
    if (seen.has(c.id)) throw new Error(`RAG build failed: duplicate chunk id "${c.id}".`);
    seen.add(c.id);
    if (!c.source) throw new Error(`RAG build failed: chunk "${c.id}" missing source.`);
    if (!c.license) throw new Error(`RAG build failed: chunk "${c.id}" missing licence.`);
    if (!COMPATIBLE_LICENSES.has(c.license)) {
      throw new Error(`RAG build failed: chunk "${c.id}" licence "${c.license}" is not in the compatible allowlist.`);
    }
    out.push({
      ...c,
      wcag: c.wcag || [],
      ruleIds: c.ruleIds || [],
      revision: c.revision || chunkRevision,
      retrievedDate: c.retrievedDate || retrievedDate
    });
  }
  return out;
}
