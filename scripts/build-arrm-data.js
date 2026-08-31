/**
 * Build the ARRM dataset consumed by the Workbench from a raw, versioned
 * snapshot of the W3C ARRM WCAG success-criteria matrix.
 *
 * Source of truth: public/data/arrm/arrm-wcag-sc.csv — a verbatim snapshot of
 * https://github.com/w3c/wai-arrm (draft branch) `_data/arrm/arrm-wcag-sc.csv`.
 * See public/data/arrm/SNAPSHOT.md for provenance.
 *
 * This script does NOT invent mappings. It parses the real matrix and preserves
 * every role's Primary/Secondary/Contributor assignment per success criterion.
 * A convenience single-primary view is derived for the UI, but the full
 * per-role level data is retained so nothing is silently lost.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../src/utils/csv-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../public/data/arrm');
const csvPath = path.join(outDir, 'arrm-wcag-sc.csv');

// --- Provenance -------------------------------------------------------------

const metadata = {
  source: 'W3C ARRM (Accessibility Roles and Responsibilities Mapping)',
  sourceRepository: 'https://github.com/w3c/wai-arrm',
  sourceFile: '_data/arrm/arrm-wcag-sc.csv',
  sourceBranch: 'draft',
  sourceUrl: 'https://www.w3.org/WAI/planning/arrm/',
  snapshotDate: '2026-08-30',
  arrmStatus: 'In-progress draft — W3C ARRM Community Group',
  license: 'CC-BY-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'W3C Accessibility Roles and Responsibilities Mapping (ARRM) Community Group',
  note: 'Role assignments below are a faithful parse of the ARRM matrix. The Workbench adds a Testing/QA role for capability routing; it is NOT part of W3C ARRM and is tagged source: "open-accessibility-workbench-extension".'
};

// ARRM's five roles, mapped to the Workbench's internal role ids. These names
// and ids come directly from the ARRM matrix columns.
const ARRM_ROLE_COLUMNS = [
  { column: 'Business', id: 'business', name: 'Business', arrm: true,
    description: 'Sets product requirements, policy, and priorities that shape accessibility outcomes.',
    canChange: ['Product/business requirements', 'Governance/process'] },
  { column: 'Content Authoring', id: 'content', name: 'Content Authoring', arrm: true,
    description: 'Creates text, alt text, headings, captions, link meaning, page language, and media alternatives.',
    canChange: ['Page content and media', 'Content structure', 'CMS configuration'] },
  { column: 'Visual Design', id: 'visual-design', name: 'Visual Design', arrm: true,
    description: 'Defines color contrast, typography scale, visual layout, focus indicator styling, and iconography.',
    canChange: ['CSS/design tokens', 'Visual design'] },
  { column: 'User Experience (UX) Design', id: 'ux-design', name: 'User Experience (UX) Design', arrm: true,
    description: 'Designs keyboard workflows, landmark layout, form error flows, focus order, and interactive patterns.',
    canChange: ['UX/interaction design'] },
  { column: 'Front-End Development', id: 'frontend-dev', name: 'Front-End Development', arrm: true,
    description: 'Implements semantic HTML, ARIA, CSS layout, DOM hierarchy, keyboard event handling, and focus management.',
    canChange: ['HTML/templates/components', 'CSS/design tokens', 'JavaScript/interactions', 'Design systems/components'] }
];

// Workbench-added role, NOT part of W3C ARRM. Tagged so the UI can label it.
const EXTENSION_ROLES = [
  { id: 'qa-testing', name: 'Testing / QA', arrm: false,
    source: 'open-accessibility-workbench-extension',
    description: 'Verifies fixes via automated re-scan and manual/assistive-technology testing.',
    canChange: ['Automated/manual testing'] }
];

const roles = [
  ...ARRM_ROLE_COLUMNS.map(({ column, ...role }) => ({ ...role, source: 'w3c-arrm' })),
  ...EXTENSION_ROLES
];

// --- Parse the ARRM matrix --------------------------------------------------

/**
 * Parses an ARRM cell (e.g. "P, S, C" or "P,S" or "" or "C") into an array of
 * level codes among P (Primary), S (Secondary), C (Contributor).
 */
function parseCell(value) {
  if (!value) return [];
  return value
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(v => v === 'P' || v === 'S' || v === 'C');
}

const csvText = fs.readFileSync(csvPath, 'utf8');
const rows = parseCSV(csvText);

const wcagRoleMap = {};

for (const row of rows) {
  const sc = (row['WCAG SC'] || '').trim();
  if (!sc) continue;

  const level = (row['Level'] || '').trim(); // A / AA / AAA

  // Full faithful per-role assignments for this SC.
  const roleLevels = {};
  const primary = [];
  const secondaryAll = [];
  const contributorAll = [];

  for (const { column, id } of ARRM_ROLE_COLUMNS) {
    const levels = parseCell(row[column]);
    if (levels.length === 0) continue;
    roleLevels[id] = levels;
    if (levels.includes('P')) primary.push(id);
    if (levels.includes('S')) secondaryAll.push(id);
    if (levels.includes('C')) contributorAll.push(id);
  }

  // Derived single-primary view for the UI. When ARRM assigns multiple
  // primaries, column order (Business→Content→Visual→UX→FE) is a deterministic
  // tiebreak; the remaining primaries are surfaced as coPrimary. Secondary and
  // contributor lists exclude any role already shown at a higher level so the
  // UI never lists the same role twice.
  const primaryId = primary[0] || null;
  const coPrimary = primary.slice(1);
  const higher = new Set([primaryId, ...coPrimary].filter(Boolean));
  const secondary = secondaryAll.filter(id => !higher.has(id));
  const shown = new Set([...higher, ...secondary]);
  const contributors = contributorAll.filter(id => !shown.has(id));

  wcagRoleMap[sc] = {
    wcagLevel: level,
    // Faithful full model: role id -> array of P/S/C (nothing dropped).
    roleLevels,
    primary: primaryId,
    coPrimary,
    secondary,
    contributors,
    source: 'w3c-arrm'
  };
}

// --- Write outputs ----------------------------------------------------------

fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'roles.json'), JSON.stringify(roles, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'wcag-role-map.json'), JSON.stringify(wcagRoleMap, null, 2) + '\n');

// Emit a generated JS module so the runtime role router (src/roles/arrm.js)
// consumes the SAME data as the published snapshot, synchronously, without a
// runtime fetch. Regenerate with `npm run build:data` — do not hand-edit.
const rolesById = {};
for (const r of roles) rolesById[r.id] = { name: r.name, arrm: r.arrm !== false };
const generatedModulePath = path.resolve(__dirname, '../src/roles/arrm-wcag-map.generated.js');
const generated =
  `// GENERATED by scripts/build-arrm-data.js from public/data/arrm/arrm-wcag-sc.csv\n` +
  `// (a verbatim snapshot of W3C ARRM, w3c/wai-arrm draft, CC-BY-4.0).\n` +
  `// Do NOT edit by hand — run \`npm run build:data\` to regenerate.\n` +
  `export const ARRM_METADATA = ${JSON.stringify({ source: metadata.source, sourceUrl: metadata.sourceUrl, license: metadata.license, snapshotDate: metadata.snapshotDate }, null, 2)};\n\n` +
  `export const ARRM_ROLES_BY_ID = ${JSON.stringify(rolesById, null, 2)};\n\n` +
  `export const ARRM_WCAG_MAP = ${JSON.stringify(wcagRoleMap, null, 2)};\n`;
fs.writeFileSync(generatedModulePath, generated);

console.log(`ARRM dataset generated from ${path.basename(csvPath)}: ${Object.keys(wcagRoleMap).length} success criteria, ${roles.length} roles (${ARRM_ROLE_COLUMNS.length} ARRM + ${EXTENSION_ROLES.length} extension).`);
