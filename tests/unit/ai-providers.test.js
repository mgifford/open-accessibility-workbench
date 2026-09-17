import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deterministicProvider, createBrowserPromptProvider, REMEDIATION_SCHEMA
} from '../../src/ai/providers.js';

/**
 * ADR 0001 provider abstraction. Providers are tested through the SAME
 * anti-invention + bounded-validation gate the advisor uses — a provider never
 * widens what output is trusted. Fully mocked: no network, no worker, no WebGPU.
 */

const task = {
  ruleId: 'link-name',
  title: 'Links lack accessible names',
  wcag: '2.4.4',
  urgency: 'high',
  leverage: 'high',
  metrics: { affectedPagesCount: 3 },
  representativeLocator: '//a[1]',
  representativeHtml: '<a href="/x"><svg></svg></a>'
};

const validCandidate = {
  summary: 'Links lack accessible names.',
  rootCauseHypothesis: 'Shared icon-link component omits text.',
  confidence: 'medium',
  targetBehavior: 'Each link exposes an accessible name.',
  recommendedStrategy: 'Add visually-hidden text in the shared component.',
  developerDecisionsRequired: ['Confirm each link purpose.'],
  targetMarkup: '<a href="{{ href }}"><span class="visually-hidden">{{ purpose }}</span></a>',
  sourceAwareCandidate: null,
  verification: ['Check the accessible name.'],
  limitations: ['Names require human confirmation.']
};

// A fake browser Prompt API returning a scripted response string.
function fakeLanguageModel(responseText, { supportsConstraint = true } = {}) {
  const calls = { create: 0, prompts: [] };
  const session = {
    async prompt(text, opts) {
      calls.prompts.push({ text, opts });
      if (opts?.responseConstraint && !supportsConstraint) {
        throw new Error('unsupported option: responseConstraint');
      }
      return typeof responseText === 'function' ? responseText(text) : responseText;
    },
    destroy() { session.destroyed = true; }
  };
  return {
    root: {
      LanguageModel: {
        availability: async () => 'available',
        create: async () => { calls.create++; return session; }
      }
    },
    calls, session
  };
}

describe('deterministic provider', () => {
  test('is always available and never invents a candidate', async () => {
    assert.deepEqual(await deterministicProvider.availability(), { status: 'available', ready: true, downloadable: false });
    const r = await deterministicProvider.generate({ task });
    assert.equal(r.finalCandidate, null);
    assert.equal(r.outcome, 'no-usable-candidate');
    assert.equal(r.provenance.generatedByAI, false);
  });
});

describe('browser prompt provider: validation passthrough', () => {
  test('valid JSON candidate that passes validators becomes a reviewable draft', async () => {
    const { root, calls, session } = fakeLanguageModel(JSON.stringify(validCandidate));
    const provider = createBrowserPromptProvider(root);
    assert.equal((await provider.availability()).ready, true);

    const r = await provider.generate({ task });
    assert.ok(r.finalCandidate, 'a passing candidate should be surfaced');
    assert.equal(r.finalCandidate.summary, validCandidate.summary);
    assert.equal(r.provenance.generatedByAI, true);
    assert.equal(r.provenance.runtime, 'browser-prompt-api');
    assert.ok(calls.create >= 1);

    await provider.close();
    assert.equal(session.destroyed, true);
  });

  test('invented accessible name is rejected -> no candidate surfaced', async () => {
    const invented = { ...validCandidate, targetMarkup: '<a aria-label="Visit our LinkedIn page">x</a>' };
    const { root } = fakeLanguageModel(JSON.stringify(invented));
    const provider = createBrowserPromptProvider(root);
    const r = await provider.generate({ task });
    // The invention gate rejects both attempts; the loop returns no candidate.
    assert.equal(r.finalCandidate, null);
    assert.equal(r.provenance.generatedByAI, false);
  });

  test('non-JSON output is rejected, not surfaced', async () => {
    const { root } = fakeLanguageModel('Sorry, I cannot help with that.');
    const provider = createBrowserPromptProvider(root);
    const r = await provider.generate({ task });
    assert.equal(r.finalCandidate, null);
  });

  test('falls back to an unconstrained prompt when responseConstraint is unsupported', async () => {
    const { root, calls } = fakeLanguageModel(JSON.stringify(validCandidate), { supportsConstraint: false });
    const provider = createBrowserPromptProvider(root);
    const r = await provider.generate({ task });
    assert.ok(r.finalCandidate, 'should still succeed via the unconstrained retry');
    // First call used the constraint (and threw), a later call omitted it.
    assert.ok(calls.prompts.some((p) => p.opts?.responseConstraint));
    assert.ok(calls.prompts.some((p) => !p.opts?.responseConstraint));
  });

  test('generate before the API is ready is refused', async () => {
    const provider = createBrowserPromptProvider({
      LanguageModel: { availability: async () => 'downloadable', create: async () => ({}) }
    });
    await assert.rejects(() => provider.generate({ task }), /not ready/i);
  });

  test('unavailable browser -> availability reports unavailable', async () => {
    const provider = createBrowserPromptProvider({ navigator: {} });
    assert.equal((await provider.availability()).ready, false);
  });
});

describe('remediation schema', () => {
  test('requires the structured contract fields', () => {
    for (const f of ['summary', 'rootCauseHypothesis', 'confidence', 'recommendedStrategy', 'developerDecisionsRequired']) {
      assert.ok(REMEDIATION_SCHEMA.required.includes(f), `${f} required`);
    }
    assert.deepEqual(REMEDIATION_SCHEMA.properties.confidence.enum, ['low', 'medium', 'high']);
  });
});
