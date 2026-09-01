import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { configureEnv, loadModel, generate, disposeModel, hasWebGPU } from '../../src/ai/model-runtime.js';
import { AiConsentStore, MODEL_SOURCES, DEFAULT_MODEL_SOURCE } from '../../src/state/ai-consent.js';

/**
 * Phase 15: the model runtime WIRING is unit-tested with an injected mock library
 * (no network, no WebGPU). Real model download + inference are verified manually
 * on a WebGPU-capable machine (this environment cannot run them).
 */

function mockTransformers() {
  const calls = { pipeline: [], progress: [] };
  const env = { backends: { onnx: { wasm: {} } } };
  const fakePipeline = Object.assign(
    async (prompt, opts) => { calls.pipeline.push({ prompt, opts }); return [{ generated_text: '{"summary":"ok"}' }]; },
    { dispose: async () => { fakePipeline.disposed = true; } }
  );
  const tf = {
    env,
    pipeline: async (taskType, modelId, opts) => {
      if (opts?.progress_callback) opts.progress_callback({ status: 'progress', file: 'model.onnx', progress: 42 });
      calls.pipelineCreate = { taskType, modelId, opts };
      return fakePipeline;
    }
  };
  return { tf, env, fakePipeline, calls };
}

describe('Phase 15: model runtime env configuration', () => {
  test('huggingface source targets the HF host and self-hosted WASM', () => {
    const env = { backends: { onnx: { wasm: {} } } };
    configureEnv(env, 'huggingface');
    assert.equal(env.allowLocalModels, false);
    assert.equal(env.allowRemoteModels, true);
    assert.match(env.remoteHost, /huggingface\.co/);
    assert.ok(env.backends.onnx.wasm.wasmPaths.endsWith('wasm/'));
  });

  test('github-release source without a configured base is rejected (no silent HF fallback)', () => {
    // VITE_MODEL_RELEASE_BASE is unset in the test env, so this must throw rather
    // than quietly falling back to Hugging Face.
    const env = { backends: { onnx: { wasm: {} } } };
    assert.throws(() => configureEnv(env, 'github-release'), /GitHub-release model host/i);
  });
});

describe('Phase 15: model runtime load/generate/dispose (mocked)', () => {
  test('loadModel creates a text-generation pipeline and forwards progress', async () => {
    const { tf, calls } = mockTransformers();
    const progress = [];
    const { pipeline, device } = await loadModel({
      modelId: 'test/model', source: 'huggingface', device: 'wasm',
      transformersModule: tf, onProgress: (p) => progress.push(p)
    });
    assert.equal(calls.pipelineCreate.taskType, 'text-generation');
    assert.equal(calls.pipelineCreate.modelId, 'test/model');
    assert.equal(device, 'wasm');
    assert.ok(progress.some(p => p.progress === 42 && p.file === 'model.onnx'));
    assert.ok(pipeline);
  });

  test('loadModel honours an already-aborted signal without creating a pipeline', async () => {
    const { tf, calls } = mockTransformers();
    const ac = new AbortController(); ac.abort();
    await assert.rejects(() => loadModel({ modelId: 'm', source: 'huggingface', device: 'wasm', transformersModule: tf, signal: ac.signal }), /cancelled/i);
    assert.equal(calls.pipelineCreate, undefined);
  });

  test('generate returns the raw generated text (unshaped)', async () => {
    const { fakePipeline } = mockTransformers();
    const text = await generate(fakePipeline, 'prompt', { maxNewTokens: 32 });
    assert.equal(text, '{"summary":"ok"}');
  });

  test('disposeModel calls dispose and is safe to call twice', async () => {
    const { fakePipeline } = mockTransformers();
    await disposeModel(fakePipeline);
    assert.equal(fakePipeline.disposed, true);
    await disposeModel(fakePipeline); // no throw
    await disposeModel(null);         // no throw
  });

  test('hasWebGPU is false in Node (no navigator.gpu)', () => {
    assert.equal(hasWebGPU(), false);
  });
});

describe('Phase 15: model-source selection (consent store)', () => {
  test('defaults to the documented default and only accepts known sources', () => {
    const store = new AiConsentStore();
    assert.equal(store.state.modelSource, DEFAULT_MODEL_SOURCE);
    store.setModelSource('github-release');
    assert.equal(store.state.modelSource, 'github-release');
    store.setModelSource('not-a-source');
    assert.equal(store.state.modelSource, 'github-release', 'unknown source is ignored');
    assert.ok(MODEL_SOURCES[DEFAULT_MODEL_SOURCE]);
  });
});
