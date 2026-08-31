/**
 * Source-report registry: durable identity for each imported artifact so that
 * two reports with the same filename or scan label remain distinguishable, and
 * so provenance can be *resolved* (not merely asserted) back to a known report.
 *
 * A source-report descriptor:
 *   { id, filename, system, format, scanId, contentHash, importedAt }
 * Every normalized observation carries `source.sourceReportId` referencing one.
 */

/**
 * A small, dependency-free, stable content hash (FNV-1a, 32-bit, hex). Not
 * cryptographic — it exists to give an imported artifact a durable identity and
 * to distinguish same-named reports, not to resist tampering.
 * @param {string} str
 * @returns {string} 8-hex-char hash
 */
export function contentHash(str) {
  const s = typeof str === 'string' ? str : JSON.stringify(str ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in integer range.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Builds a source-report descriptor for an imported artifact.
 * @param {object} params
 * @param {string} params.filename
 * @param {string} params.system
 * @param {string} params.format
 * @param {string|null} [params.scanId]
 * @param {string} params.rawContent - raw text used for the content hash
 * @returns {{id:string, filename:string, system:string, format:string, scanId:string|null, contentHash:string, importedAt:string}}
 */
export function makeSourceReport({ filename, system, format, scanId = null, rawContent }) {
  const hash = contentHash(rawContent);
  // id is stable for identical content+identity, but distinguishes same-named
  // reports with different content.
  const id = `src-${system}-${hash}`;
  return {
    id,
    filename: filename || null,
    system,
    format,
    scanId: scanId ?? null,
    contentHash: hash,
    importedAt: new Date().toISOString()
  };
}

/**
 * A workspace-level registry of imported source reports, keyed by id.
 */
export class SourceReportRegistry {
  constructor(reports = []) {
    this.byId = new Map(reports.map(r => [r.id, r]));
  }

  /** Registers (or returns the existing) descriptor; dedupes by id. */
  register(descriptor) {
    if (!this.byId.has(descriptor.id)) this.byId.set(descriptor.id, descriptor);
    return this.byId.get(descriptor.id);
  }

  get(id) {
    return this.byId.get(id) || null;
  }

  list() {
    return [...this.byId.values()];
  }
}
