export function lexicalSearchGuidance(chunks = [], query = '') {
  if (!query || !Array.isArray(chunks)) return [];
  const q = query.toLowerCase();
  return chunks.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.text.toLowerCase().includes(q) ||
    c.ruleIds.some(r => r.toLowerCase().includes(q))
  );
}
