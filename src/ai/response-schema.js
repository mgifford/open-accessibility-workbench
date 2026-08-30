/**
 * JSON response schema validator for local AI output.
 */

export function validateAiResponseStructure(parsedJson) {
  if (!parsedJson || typeof parsedJson !== 'object') {
    return { valid: false, error: 'Output is not a valid JSON object' };
  }

  const requiredFields = [
    'summary',
    'rootCauseHypothesis',
    'confidence',
    'targetBehavior',
    'recommendedStrategy',
    'developerDecisionsRequired'
  ];

  for (const field of requiredFields) {
    if (parsedJson[field] === undefined) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (!['low', 'medium', 'high'].includes(String(parsedJson.confidence).toLowerCase())) {
    return { valid: false, error: 'Invalid confidence value (must be low, medium, or high)' };
  }

  return { valid: true, data: parsedJson };
}
