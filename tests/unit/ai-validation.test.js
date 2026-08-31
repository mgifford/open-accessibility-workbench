import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runValidationLoop, buildValidationExport, LOOP_OUTCOME } from '../../src/ai/validation-loop.js';
import { runValidationSuite } from '../../src/validation/registry.js';
import { validateColorContrast } from '../../src/validation/contrast.js';
import { validateImageAltPresence } from '../../src/validation/image-alt.js';
import { validateLanguageTag } from '../../src/validation/language.js';

const base = {
  summary: 's', rootCauseHypothesis: 'r', confidence: 'low', targetBehavior: 't',
  recommendedStrategy: 'x', developerDecisionsRequired: [], sourceAwareCandidate: null,
  verification: [], limitations: []
};
const cleanLink = { ...base, targetMarkup: '<a href="{{h}}"><span class="visually-hidden">{{p}}</span></a>' };
const gen = (out) => async () => out;

describe('Phase 12: bounded validation loop', () => {
  test('valid candidate passes on the first attempt', async () => {
    const r = await runValidationLoop({ ruleId: 'link-name', generate: gen(cleanLink) });
    assert.equal(r.outcome, LOOP_OUTCOME.READY_FOR_REVIEW);
    assert.equal(r.attempts.length, 1);
    assert.ok(r.finalCandidate);
  });

  test('invalid candidate generates exact feedback given to the retry', async () => {
    let seenFeedback = null;
    await runValidationLoop({
      ruleId: 'link-name',
      generate: async (feedback, attempt) => {
        if (attempt === 2) { seenFeedback = feedback; return cleanLink; }
        return { ...base, targetMarkup: '<script>alert(1)</script>' };
      }
    });
    assert.ok(seenFeedback, 'retry received feedback');
    assert.match(seenFeedback, /script/i);
  });

  test('one retry succeeds (attempt 1 fails, attempt 2 passes)', async () => {
    let n = 0;
    const r = await runValidationLoop({
      ruleId: 'link-name',
      generate: async () => (++n === 1 ? { ...base, targetMarkup: '<a onclick="x()">y</a>' } : cleanLink)
    });
    assert.equal(r.outcome, LOOP_OUTCOME.READY_FOR_REVIEW);
    assert.equal(r.attempts.length, 2);
    assert.equal(r.attempts[0].passed, false);
    assert.equal(r.attempts[1].passed, true);
  });

  test('second retry fails and STOPS with deterministic guidance (candidate not presented)', async () => {
    const r = await runValidationLoop({ ruleId: 'link-name', generate: gen({ ...base, targetMarkup: '<script>x</script>' }) });
    assert.equal(r.outcome, LOOP_OUTCOME.UNRESOLVED);
    assert.equal(r.finalCandidate, null); // a failed candidate is NEVER surfaced
    assert.equal(r.attempts.length, 2);   // bounded at 2
    assert.ok(r.manualVerificationRequired.length > 0);
  });

  test('cancellation during retry stops the loop', async () => {
    let n = 0;
    const r = await runValidationLoop({
      ruleId: 'link-name',
      generate: async () => { n++; return { ...base, targetMarkup: '<script>x</script>' }; },
      isCancelled: () => n >= 1 // cancel after first generation
    });
    assert.equal(r.outcome, LOOP_OUTCOME.NO_CANDIDATE);
  });

  test('a failed candidate never receives success wording', async () => {
    const r = await runValidationLoop({ ruleId: 'link-name', generate: gen({ ...base, targetMarkup: '<script>x</script>' }) });
    const text = JSON.stringify(r);
    assert.ok(!/WCAG fixed|compliant|accessibility solved|guaranteed/i.test(text));
    for (const a of r.attempts) assert.ok(!/passed/i.test(a.status) || a.passed);
  });
});

describe('Phase 12: structural guardrails', () => {
  const cases = {
    'script injection': '<script>alert(1)</script>',
    'javascript URL': '<a href="javascript:evil()">x</a>',
    'inline event handler': '<a onclick="x()">y</a>',
    'markdown fence': '```html\n<a></a>\n```'
  };
  for (const [name, code] of Object.entries(cases)) {
    test(`rejects ${name}`, () => {
      const r = runValidationSuite('link-name', code, {});
      assert.equal(r.passed, false);
      assert.match(r.status, /failed/i);
    });
  }
  test('rejects empty output', () => {
    assert.equal(runValidationSuite('link-name', '', {}).passed, false);
  });
});

describe('Phase 12: rule-specific validators (honest statuses)', () => {
  test('contrast: missing colour evidence -> insufficient, not failed/passed', () => {
    const r = validateColorContrast(null, null);
    assert.equal(r.passed, false);
    assert.match(r.status, /Insufficient evidence/i);
  });

  test('contrast: thresholds (normal 4.5, large 3.0)', () => {
    assert.equal(validateColorContrast('#767676', '#ffffff').passed, true);   // 4.54:1
    assert.equal(validateColorContrast('#808080', '#ffffff').passed, false);  // 3.95:1 normal
    assert.equal(validateColorContrast('#808080', '#ffffff', true).passed, true); // large text 3:1
  });

  test('image-alt: missing alt fails; mechanism-present wording (never "accessible")', () => {
    assert.equal(validateImageAltPresence('<img src="x.jpg">').passed, false);
    const present = validateImageAltPresence('<img src="x.jpg" alt="A dog">');
    assert.match(present.status, /Alternative mechanism present/i);
    assert.ok(!/is accessible/i.test(present.status));
  });

  test('image-alt: empty alt requires decorative-intent confirmation', () => {
    const r = validateImageAltPresence('<img src="x.jpg" alt="">');
    assert.match(r.status, /decorative/i);
    assert.match(r.status, /confirmation|confirm/i);
  });

  test('language: valid vs malformed BCP-47 tag', () => {
    assert.equal(validateLanguageTag('en').passed, true);
    assert.equal(validateLanguageTag('en-US').passed, true);
    assert.equal(validateLanguageTag('not a tag!!').passed, false);
    assert.equal(validateLanguageTag('').passed, false);
  });
});

describe('Phase 12: export contains both attempts (§12.6)', () => {
  test('export records each attempt with validator, version, status, manual verification', async () => {
    let n = 0;
    const loop = await runValidationLoop({
      ruleId: 'link-name',
      generate: async () => (++n === 1 ? { ...base, targetMarkup: '<script>x</script>' } : cleanLink)
    });
    const exp = buildValidationExport(loop, { ruleId: 'link-name' });
    assert.equal(exp.attempts.length, 2);
    assert.equal(exp.attempts[0].validator, 'link-name');
    assert.ok(exp.attempts[0].validatorVersion);
    assert.ok(['passed', 'failed', 'insufficient-evidence'].includes(exp.attempts[0].status));
    assert.equal(exp.attempts[0].status, 'failed');
    assert.equal(exp.attempts[1].status, 'passed');
  });

  test('contrast with no evidence exports as insufficient-evidence', async () => {
    const loop = await runValidationLoop({
      ruleId: 'color-contrast',
      generate: gen({ ...base, targetMarkup: ':root{--c: {{ colour }};}' }),
      validationContext: {} // no fgHex/bgHex
    });
    const exp = buildValidationExport(loop, { ruleId: 'color-contrast' });
    assert.ok(exp.attempts.every(a => a.status === 'insufficient-evidence'));
  });
});
