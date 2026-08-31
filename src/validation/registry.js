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

  // Run rule-specific validator if available.
  const validator = VALIDATOR_REGISTRY[ruleId];
  if (validator) {
    if (ruleId === 'color-contrast') {
      // Only a contrast check with explicit colours is meaningful; without them
      // we must NOT imply the candidate passed on structural grounds alone.
      if (context.fgHex && context.bgHex) {
        return validator(context.fgHex, context.bgHex, context.isLargeText);
      }
      return insufficient('Contrast cannot be checked: explicit foreground/background colours were not supplied.');
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
    if (ruleId === 'html-has-lang') {
      if (context.lang) return validator(context.lang);
      return insufficient('Language cannot be checked: no lang value was supplied.');
    }
    if (ruleId === 'target-size') {
      // The target-size validator itself reports insufficient evidence when
      // geometry is absent; delegate to it.
      return validator(context);
    }
  }

  // No rule-specific validator: structural passed, but rule conformance is not
  // proven — say so rather than implying a clean pass.
  return {
    ...structuralResult,
    status: 'Structural check passed (no rule-specific validator for this rule).',
    ruleValidated: false
  };
}

function insufficient(detail) {
  return {
    passed: false,
    status: `Insufficient evidence to validate: ${detail}`,
    requiresPageVerification: true,
    ruleValidated: false
  };
}
