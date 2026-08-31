/**
 * Build RAG manifest and curated browser subset index.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ragDir = path.resolve(__dirname, '../public/data/rag');

if (!fs.existsSync(ragDir)) {
  fs.mkdirSync(ragDir, { recursive: true });
}

// Deterministic build stamp so regenerating with unchanged source data leaves
// the tracked manifest byte-identical (no dirty working tree). It tracks the
// source corpus revision, not wall-clock time; override with SOURCE_BUILD_DATE
// for a real dated release.
const sourceCorpusRevision = '2026-08-29';
const buildDate = process.env.SOURCE_BUILD_DATE || sourceCorpusRevision;

const manifest = {
  version: '1.0.0',
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  modelRevision: 'main',
  vectorDimension: 384,
  sourceCorpusRevision,
  buildDate,
  itemCount: 4,
  license: 'CC-BY-4.0 / W3C Software and Document Notice',
  provenance: 'Curated knowledge base from W3C ARRM, WCAG 2.2 Techniques, and Open Accessibility Workbench remediation patterns.'
};

const guidanceChunks = [
  {
    id: 'RAG-LINK-NAME-01',
    title: 'Accessible Names for Icon and Graphic Links',
    source: 'W3C WCAG Technique H30 / ARIA8',
    sourceUrl: 'https://www.w3.org/WAI/WCAG22/Techniques/html/H30',
    framework: 'html',
    language: 'html',
    wcag: ['2.4.4', '4.1.2'],
    ruleIds: ['link-name'],
    license: 'W3C Document License',
    text: 'When an anchor tag contains only an icon or image, provide an accessible name using visually hidden text (<span class="sr-only">Label</span>) or aria-label on the link itself. Never place aria-label on child decorative elements.'
  },
  {
    id: 'RAG-CONTRAST-01',
    title: 'Color Contrast Ratios and Theme Design Tokens',
    source: 'W3C WCAG Understanding 1.4.3',
    sourceUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    framework: 'css',
    language: 'css',
    wcag: ['1.4.3'],
    ruleIds: ['color-contrast'],
    license: 'W3C Document License',
    text: 'Text and images of text must have a contrast ratio of at least 4.5:1 for normal text (under 18pt or 14pt bold) and 3:1 for large text. Modify CSS design tokens rather than hardcoded inline colors to remediate recurring issues across components.'
  },
  {
    id: 'RAG-IMAGE-ALT-01',
    title: 'Text Alternatives for Functional vs Decorative Images',
    source: 'W3C WAI Web Accessibility Tutorials: Images',
    sourceUrl: 'https://www.w3.org/WAI/tutorials/images/',
    framework: 'html',
    language: 'html',
    wcag: ['1.1.1'],
    ruleIds: ['image-alt'],
    license: 'W3C Document License',
    text: 'Informative images require descriptive alt text representing the visual content. Purely decorative images must use an empty alt attribute (alt="") so screen readers skip them cleanly.'
  },
  {
    id: 'RAG-LANDMARK-01',
    title: 'Structuring Page Layout with HTML5 Landmarks',
    source: 'W3C ARIA Landmarks Example',
    sourceUrl: 'https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/',
    framework: 'html',
    language: 'html',
    wcag: ['1.3.1', '2.4.1'],
    ruleIds: ['region', 'landmark-one-main'],
    license: 'W3C Document License',
    text: 'Ensure all perceptible content on a webpage resides within semantic landmark elements such as header, nav, main, footer, and aside. Each page should contain exactly one main landmark.'
  }
];

fs.writeFileSync(path.join(ragDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(ragDir, 'guidance.json'), JSON.stringify(guidanceChunks, null, 2));

console.log('RAG manifest and curated guidance index generated successfully.');
