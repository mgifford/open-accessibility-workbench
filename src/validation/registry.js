import { validateStructuralGuardrails } from './structural.js';
import { validateColorContrast } from './contrast.js';
import { validateAccessibleNamePresence } from './accessible-name.js';
import { validateImageAltPresence } from './image-alt.js';
import { validateLabelInName } from './label-in-name.js';
import { validateLanguageTag } from './language.js';
import { validateLandmarkStructure } from './landmarks.js';
import { validateTargetSize } from './target-size.js';

export const VALIDATOR_REGISTRY = {
  structural: validateStructuralGuardrails,
  'color-contrast': validateColorContrast,
  'accessible-name': validateAccessibleNamePresence,
  'link-name': validateAccessibleNamePresence,
  'button-name': validateAccessibleNamePresence,
  'image-alt': validateImageAltPresence,
  'label-in-name': validateLabelInName,
  'html-has-lang': validateLanguageTag,
  region: validateLandmarkStructure,
  'target-size': validateTargetSize
};

export function runValidationSuite(ruleId, candidateCode, context = {}) {
  // Always run structural guardrails first
  const structuralResult = validateStructuralGuardrails(candidateCode, context.originalSnippet);
  if (!structuralResult.passed) {
    return structuralResult;
  }

  // Run rule-specific validator if available
  const validator = VALIDATOR_REGISTRY[ruleId];
  if (validator) {
    if (ruleId === 'color-contrast' && context.fgHex && context.bgHex) {
      return validator(context.fgHex, context.bgHex, context.isLargeText);
    }
    if (ruleId === 'link-name' || ruleId === 'button-name' || ruleId === 'accessible-name') {
      return validator(candidateCode);
    }
    if (ruleId === 'image-alt') {
      return validator(candidateCode);
    }
    if (ruleId === 'region') {
      return validator(candidateCode);
    }
    if (ruleId === 'html-has-lang' && context.lang) {
      return validator(context.lang);
    }
  }

  return structuralResult;
}
