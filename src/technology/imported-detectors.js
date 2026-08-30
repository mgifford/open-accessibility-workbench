export function parseImportedDetectorJson(content) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  return Array.isArray(json.technologies) ? json.technologies : [];
}
