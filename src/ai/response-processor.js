/**
 * Processes raw local-AI output into a safe, structured advisor result — or
 * rejects it. AI is an OPTIONAL enhancement; when its output is malformed,
 * unsafe, or invents content, we discard it and the deterministic guidance
 * remains (spec §11.5/§11.7). This module is pure and unit-testable with no
 * model runtime.
 */

import { validateAiResponseStructure } from './response-schema.js';

const CONFIDENCE = new Set(['low', 'medium', 'high']);

/** The full structured shape the advisor must present (spec §11.5). */
function emptyShape() {
  return {
    summary: '',
    rootCauseHypothesis: '',
    confidence: 'low',
    targetBehavior: '',
    recommendedStrategy: '',
    developerDecisionsRequired: [],
    targetMarkup: null,
    sourceAwareCandidate: null,
    verification: [],
    limitations: []
  };
}

/**
 * Extracts the first JSON object from a model's raw text (models often wrap JSON
 * in prose or code fences). Returns null if none parses.
 */
export function extractJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  // Strip code fences.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Detects invented content that the model was forbidden to produce (spec §11.4).
 * Returns an array of violation strings (empty when clean).
 *
 * @param {object} data - parsed AI output
 * @param {object} [context]
 * @param {object|null} [context.sourceContext] - user-supplied source, if any
 */
export function detectInventions(data, { sourceContext = null } = {}) {
  const violations = [];
  const text = JSON.stringify(data || {});

  // A source filename may only appear if the user supplied source with that file.
  const suppliedFilename = sourceContext?.filename || null;
  const filenameMatches = text.match(/[\w./-]+\.(twig|php|jsx|tsx|vue|js|ts|html|css|scss)\b/gi) || [];
  for (const f of filenameMatches) {
    if (!suppliedFilename || f.toLowerCase() !== String(suppliedFilename).toLowerCase()) {
      violations.push(`invented source filename: ${f}`);
    }
  }

  // A source-aware candidate is forbidden unless source was supplied.
  if (data && data.sourceAwareCandidate != null && !sourceContext) {
    violations.push('sourceAwareCandidate present without supplied source');
  }

  // targetMarkup must not contain a concrete alt/aria-label/colour VALUE — those
  // are human decisions. Placeholders ({{ }} or empty) are allowed.
  const tm = data?.targetMarkup;
  if (typeof tm === 'string' && tm.trim()) {
    if (/aria-label\s*=\s*"(?!\s*\{\{)[^"]+"/i.test(tm)) violations.push('invented accessible name in aria-label');
    if (/\balt\s*=\s*"(?!\s*")(?!\s*\{\{)[^"]+"/i.test(tm)) violations.push('invented alt text');
    if (/#[0-9a-f]{3,6}\b/i.test(tm)) violations.push('invented colour value');
  }
  return violations;
}

/**
 * Validates, repairs, and safety-checks raw AI output.
 *
 * @param {string|object} raw - raw model output (text or already-parsed)
 * @param {object} [context] - { sourceContext }
 * @returns {{ ok: boolean, data?: object, reason?: string, violations?: string[] }}
 *   ok:false means the caller must fall back to deterministic guidance.
 */
export function processAiResponse(raw, context = {}) {
  const parsed = extractJson(raw);
  if (!parsed) return { ok: false, reason: 'Model output was not valid JSON.' };

  const structural = validateAiResponseStructure(parsed);
  if (!structural.valid) return { ok: false, reason: structural.error };

  // Repair into the canonical shape (coerce types, fill optionals).
  const data = { ...emptyShape(), ...parsed };
  data.confidence = CONFIDENCE.has(String(data.confidence).toLowerCase())
    ? String(data.confidence).toLowerCase() : 'low';
  for (const arrField of ['developerDecisionsRequired', 'verification', 'limitations']) {
    if (!Array.isArray(data[arrField])) data[arrField] = data[arrField] ? [String(data[arrField])] : [];
  }
  // Enforce: no source-aware candidate unless source supplied (§11.5).
  if (!context.sourceContext) data.sourceAwareCandidate = null;

  // Reject invented content (§11.4).
  const violations = detectInventions(data, context);
  if (violations.length > 0) {
    return { ok: false, reason: 'AI output contained invented content and was rejected.', violations };
  }

  return { ok: true, data };
}
