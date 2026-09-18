import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPromptApiUsable } from '../../src/ai/browser-capabilities.js';

/** Builds a fake LanguageModel whose session.prompt returns `reply` (or throws). */
function fakeModel(reply, { throwOn = null } = {}) {
  return {
    create: async () => ({
      prompt: async (p) => {
        if (throwOn) throw new Error(throwOn);
        return typeof reply === 'function' ? reply(p) : reply;
      },
      destroy() {}
    })
  };
}

describe('verifyPromptApiUsable', () => {
  test('accepts a real model that answers the probe', async () => {
    const r = await verifyPromptApiUsable(fakeModel('READY'));
    assert.equal(r.usable, true);
  });

  test('accepts a short plausible answer even if the token drifted', async () => {
    const r = await verifyPromptApiUsable(fakeModel('Ok.'));
    assert.equal(r.usable, true);
  });

  test('rejects a stub that echoes the prompt back', async () => {
    // The Chromium stub prepends a notice then echoes the input verbatim.
    const stub = fakeModel((p) => `On-device model is not available in Chromium, this API is just echoing back the input:\n${p}`);
    const r = await verifyPromptApiUsable(stub);
    assert.equal(r.usable, false);
    assert.match(r.reason, /echo|not actually available|not available/i);
  });

  test('rejects an explicit "not available" reply', async () => {
    const r = await verifyPromptApiUsable(fakeModel('The on-device model is not available here.'));
    assert.equal(r.usable, false);
  });

  test('rejects empty output', async () => {
    const r = await verifyPromptApiUsable(fakeModel('   '));
    assert.equal(r.usable, false);
    assert.match(r.reason, /no output/i);
  });

  test('rejects a long off-topic answer that lacks the expected token', async () => {
    const long = 'x'.repeat(200);
    const r = await verifyPromptApiUsable(fakeModel(long));
    assert.equal(r.usable, false);
  });

  test('reports unusable (not throw) when the model errors', async () => {
    const r = await verifyPromptApiUsable(fakeModel(null, { throwOn: 'session boom' }));
    assert.equal(r.usable, false);
    assert.match(r.reason, /self-test failed|boom/i);
  });

  test('reports unusable when there is no create()', async () => {
    const r = await verifyPromptApiUsable({});
    assert.equal(r.usable, false);
  });
});
