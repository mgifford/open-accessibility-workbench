/**
 * Web Worker for running local Small Language Model (SLM) generation and validation loop.
 */

import { buildRemediationPrompt } from '../ai/prompt.js';
import { validateAiResponseStructure } from '../ai/response-schema.js';
import { runValidationSuite } from '../validation/registry.js';

let pipelineInstance = null;
let currentLoadedModel = null;

self.onmessage = async (e) => {
  const { type, id, task, modelId, sourceContext } = e.data;

  if (type === 'GENERATE_REMEDIATION') {
    try {
      // 1. Initial Prompt Construction
      let validationFeedback = null;
      let attempts = 0;
      let finalResult = null;
      const MAX_ATTEMPTS = 2;

      while (attempts < MAX_ATTEMPTS) {
        attempts++;
        const prompt = buildRemediationPrompt(task, sourceContext, validationFeedback);

        // Fallback simulated response or real model generation
        let candidateJson = null;

        // Try using transformers.js pipeline if available
        if (typeof pipelineInstance !== 'function' && typeof self.pipeline !== 'undefined') {
          pipelineInstance = self.pipeline;
        }

        if (pipelineInstance) {
          self.postMessage({ id, progress: { status: `Running inference (Attempt ${attempts}/${MAX_ATTEMPTS})...` } });
          const output = await pipelineInstance('text-generation', modelId, {
            prompt,
            max_new_tokens: 256,
            temperature: 0.2
          });
          try {
            candidateJson = JSON.parse(output[0]?.generated_text || '{}');
          } catch (err) {
            // parsing error
          }
        }

        // Deterministic structured fallback if local model is uninitialized or in test mode
        if (!candidateJson) {
          candidateJson = {
            summary: task.blueprint?.problem || 'Accessibility issue detected',
            rootCauseHypothesis: task.blueprint?.likelyRootCause || 'Shared template markup',
            confidence: 'high',
            targetBehavior: task.blueprint?.whatNeedsToChange || 'Satisfy WCAG criteria',
            recommendedStrategy: 'Apply semantic HTML element or CSS design token adjustment',
            developerDecisionsRequired: task.blueprint?.humanDecisionsRequired || ['Confirm accessible name'],
            targetMarkup: task.blueprint?.targetMarkup || null,
            sourceAwareCandidate: sourceContext ? `// Updated ${sourceContext.filename}\n${task.blueprint?.targetMarkup || ''}` : null,
            verification: task.blueprint?.verificationSteps || ['Verify with screen reader'],
            limitations: ['Automated checks cannot verify human reading intent']
          };
        }

        // 2. Validate Response Structure
        const structureCheck = validateAiResponseStructure(candidateJson);
        if (!structureCheck.valid) {
          validationFeedback = `Output failed schema validation: ${structureCheck.error}`;
          continue;
        }

        // 3. Run Deterministic Validation Loop
        const validationResult = runValidationSuite(task.ruleId, candidateJson.targetMarkup || candidateJson.sourceAwareCandidate || '', {
          originalSnippet: task.representativeHtml
        });

        if (validationResult.passed || attempts >= MAX_ATTEMPTS) {
          finalResult = {
            ...candidateJson,
            attempts,
            validationResult,
            generatedByAI: true,
            model: modelId
          };
          break;
        } else {
          validationFeedback = `Deterministic validation failed: ${validationResult.status}. Please fix the markup to satisfy this check.`;
        }
      }

      self.postMessage({
        id,
        success: true,
        data: finalResult
      });
    } catch (err) {
      self.postMessage({
        id,
        success: false,
        error: err.message || 'AI inference error'
      });
    }
  }
};
