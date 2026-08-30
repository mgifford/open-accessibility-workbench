/**
 * Structural guardrails for candidate remediation code and generated snippets.
 */

export function validateStructuralGuardrails(candidateCode, originalSnippet = '') {
  const errors = [];
  const warnings = [];

  if (!candidateCode || typeof candidateCode !== 'string' || candidateCode.trim().length === 0) {
    return {
      passed: false,
      status: 'Automated check failed: Empty candidate output.',
      errors: ['Candidate code is empty.']
    };
  }

  const trimmed = candidateCode.trim();

  // 1. Check for unparsed markdown fences
  if (trimmed.includes('```')) {
    errors.push('Candidate contains unescaped markdown code fences (```).');
  }

  // 2. Check for script injection or unsafe javascript protocols
  if (/<script\b/i.test(trimmed)) {
    errors.push('Candidate contains forbidden <script> tag.');
  }
  if (/href=["']\s*javascript:/i.test(trimmed) || /src=["']\s*javascript:/i.test(trimmed)) {
    errors.push('Candidate contains unsafe javascript: URI.');
  }
  if (/\bon[a-z]+\s*=/i.test(trimmed)) {
    errors.push('Candidate contains inline event handler (e.g. onclick/onerror).');
  }

  // 3. Check for severe unexplained content deletion
  if (originalSnippet && originalSnippet.length > 50 && trimmed.length < 10) {
    warnings.push('Candidate code appears significantly shorter than original snippet.');
  }

  const passed = errors.length === 0;

  return {
    passed,
    status: passed ? 'Structural check passed' : `Automated check failed: ${errors.join(', ')}`,
    errors,
    warnings
  };
}
