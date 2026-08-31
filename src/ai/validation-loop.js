/**
 * Bounded generate→validate→feedback→retry loop (spec §12.1).
 *
 * A generated candidate is validated by deterministic validators. On failure,
 * exact feedback is produced and ONE retry is attempted. After a second failure
 * the loop stops and returns deterministic guidance — a failed candidate is
 * NEVER presented as successful. Both attempts are recorded for presentation and
 * export.
 */

import { runValidationSuite } from '../validation/registry.js';
import { processAiResponse } from './response-processor.js';

const MAX_ATTEMPTS = 2;

/** Honest outcome statuses — never "WCAG fixed"/"compliant"/"solved". */
export const LOOP_OUTCOME = {
  READY_FOR_REVIEW: 'ready-for-human-review',
  UNRESOLVED: 'unresolved-failure',
  NO_CANDIDATE: 'no-usable-candidate'
};

/**
 * @param {object} params
 * @param {string} params.ruleId
 * @param {(feedback: string|null, attempt: number) => Promise<string|object>} params.generate
 *   Produces a raw candidate; receives validation feedback + attempt number.
 * @param {object} [params.validationContext] - passed to runValidationSuite
 *   (e.g. { fgHex, bgHex, isLargeText, originalSnippet }).
 * @param {object|null} [params.sourceContext] - user-supplied source, if any.
 * @param {() => boolean} [params.isCancelled] - polled between attempts.
 * @returns {Promise<{
 *   outcome: string,
 *   finalCandidate: object|null,
 *   attempts: Array<object>,
 *   candidateChanged: boolean|null,
 *   manualVerificationRequired: string[]
 * }>}
 */
export async function runValidationLoop({ ruleId, generate, validationContext = {}, sourceContext = null, isCancelled = () => false }) {
  const attempts = [];
  let feedback = null;
  let firstCandidateText = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (isCancelled()) {
      return finalize(LOOP_OUTCOME.NO_CANDIDATE, null, attempts, 'Cancelled during generation.');
    }

    const raw = await generate(feedback, attempt);

    if (isCancelled()) {
      return finalize(LOOP_OUTCOME.NO_CANDIDATE, null, attempts, 'Cancelled after generation.');
    }

    // Structural + invention safety on the AI output itself.
    const processed = processAiResponse(raw, { sourceContext });
    if (!processed.ok) {
      attempts.push(record(attempt, null, { passed: false, status: `Automated check failed: ${processed.reason}`, errors: processed.violations || [processed.reason] }));
      feedback = `Your previous output was rejected: ${processed.reason}. Return valid JSON with no invented content.`;
      continue;
    }

    const candidate = processed.data;
    const candidateText = candidate.targetMarkup || candidate.sourceAwareCandidate || '';
    if (attempt === 1) firstCandidateText = candidateText;

    // Deterministic rule validation of the candidate markup.
    const validation = runValidationSuite(ruleId, candidateText, validationContext);
    attempts.push(record(attempt, candidate, validation));

    if (validation.passed) {
      const changed = attempt === 1 ? null : (candidateText !== firstCandidateText);
      return finalize(LOOP_OUTCOME.READY_FOR_REVIEW, candidate, attempts, null, changed, manualFrom(ruleId, validation));
    }

    // Failed: build exact feedback for the next attempt.
    feedback = exactFeedback(validation);
  }

  // Both attempts failed (or produced no usable candidate).
  return finalize(LOOP_OUTCOME.UNRESOLVED, null, attempts, 'Deterministic guidance returned after the retry limit.', null, ['Full manual accessibility verification required.']);
}

function record(attempt, candidate, validation) {
  return {
    attempt,
    candidatePresent: Boolean(candidate),
    status: validation.status,
    passed: Boolean(validation.passed),
    errors: validation.errors || [],
    warnings: validation.warnings || [],
    validationDetails: {
      ratio: validation.ratio ?? undefined,
      requiredThreshold: validation.requiredThreshold ?? undefined,
      requiresPageVerification: validation.requiresPageVerification ?? undefined
    }
  };
}

function exactFeedback(validation) {
  const parts = [validation.status];
  if (validation.errors?.length) parts.push(`Fix: ${validation.errors.join('; ')}`);
  return parts.join(' ');
}

function manualFrom(ruleId, validation) {
  const manual = [];
  if (validation.requiresPageVerification) manual.push('Page-level verification required (computed styles/geometry not available statically).');
  // Meaningfulness is always a human judgement for content rules.
  if (/link-name|button-name|accessible-name|image-alt/.test(ruleId)) {
    manual.push('A human must confirm the wording is meaningful and correct.');
  }
  return manual;
}

export const VALIDATOR_VERSION = '1.0.0';

/**
 * Builds the export record for a completed loop (spec §12.6): one entry per
 * attempt, with validator, version, status, inputs, results, and remaining
 * manual verification. Statuses map to passed | failed | insufficient-evidence.
 */
export function buildValidationExport(loopResult, { ruleId, validationContext = {} } = {}) {
  const statusFor = (a) => a.validationDetails?.requiresPageVerification && !a.passed
    ? 'insufficient-evidence'
    : (a.passed ? 'passed' : 'failed');
  return {
    outcome: loopResult.outcome,
    candidateChanged: loopResult.candidateChanged,
    manualVerificationRequired: loopResult.manualVerificationRequired || [],
    attempts: (loopResult.attempts || []).map(a => ({
      validator: ruleId,
      validatorVersion: VALIDATOR_VERSION,
      attempt: a.attempt,
      status: statusFor(a),
      humanReadableStatus: a.status,
      inputs: {
        fgHex: validationContext.fgHex, bgHex: validationContext.bgHex,
        isLargeText: validationContext.isLargeText
      },
      results: { passed: a.passed, errors: a.errors, ...a.validationDetails },
      manualVerificationRequired: loopResult.manualVerificationRequired || []
    }))
  };
}

function finalize(outcome, finalCandidate, attempts, note, candidateChanged = null, manualVerificationRequired = []) {
  return {
    outcome,
    finalCandidate,
    attempts,
    candidateChanged,
    manualVerificationRequired,
    note: note || null
  };
}
