/**
 * Explicit confidence level definitions and explanations.
 */

export const CONFIDENCE_LEVELS = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

export function explainConfidence(confidence, factors = []) {
  return {
    level: confidence,
    label: `${confidence} Confidence`,
    factors: Array.isArray(factors) ? factors : []
  };
}
