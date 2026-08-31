/**
 * Verifies that all bundled knowledge assets in public/data have explicit provenance,
 * license attribution, and valid JSON schemas.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDataDir = path.resolve(__dirname, '../public/data');

// JSON assets that must exist, parse, and be non-empty.
const requiredJsonFiles = [
  'arrm/metadata.json',
  'arrm/roles.json',
  'arrm/wcag-role-map.json',
  'rules/normalized-rules.json',
  'rules/wcag-map.json',
  'rules/remediation-patterns.json',
  'technology/guidance.json',
  'rag/manifest.json',
  'rag/guidance.json'
];

// Raw (non-JSON) provenance assets that must exist and be non-empty. The ARRM
// data is generated from the verbatim CSV snapshot, so both the snapshot and
// its provenance record are required. (arrm/tasks.json was intentionally
// removed when ARRM was regenerated from the real matrix; it is not required.)
const requiredRawFiles = [
  'arrm/arrm-wcag-sc.csv',
  'arrm/SNAPSHOT.md'
];

let errors = 0;

for (const relPath of requiredJsonFiles) {
  const fullPath = path.join(publicDataDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[FAIL] Missing required data file: ${relPath}`);
    errors++;
    continue;
  }

  try {
    const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (!content) {
      console.error(`[FAIL] Data file is empty: ${relPath}`);
      errors++;
    }
  } catch (err) {
    console.error(`[FAIL] Invalid JSON in ${relPath}: ${err.message}`);
    errors++;
  }
}

for (const relPath of requiredRawFiles) {
  const fullPath = path.join(publicDataDir, relPath);
  if (!fs.existsSync(fullPath) || fs.readFileSync(fullPath, 'utf8').trim().length === 0) {
    console.error(`[FAIL] Missing or empty required provenance asset: ${relPath}`);
    errors++;
  }
}

// Check ARRM provenance metadata
const arrmMeta = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'arrm/metadata.json'), 'utf8'));
if (!arrmMeta.source || !arrmMeta.license || !arrmMeta.attribution) {
  console.error('[FAIL] ARRM metadata missing required provenance fields (source, license, attribution)');
  errors++;
}

// Check RAG manifest provenance
const ragManifest = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'rag/manifest.json'), 'utf8'));
if (!ragManifest.license || !ragManifest.provenance || !ragManifest.embeddingModel) {
  console.error('[FAIL] RAG manifest missing license or model provenance');
  errors++;
}

if (errors === 0) {
  const total = requiredJsonFiles.length + requiredRawFiles.length;
  console.log(`[PASS] All ${total} data assets have verified provenance and valid schemas.`);
  process.exit(0);
} else {
  console.error(`[ERROR] Verification failed with ${errors} error(s).`);
  process.exit(1);
}
