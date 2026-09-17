import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePath, normalizeAvailability, probeWebGpu, connectionWarning,
  probeBrowserCapabilities, capabilityDecision, LOCAL_MODEL_MIN_DEVICE_MEMORY_GB
} from '../../src/ai/browser-capabilities.js';
import { isRecoverableGpuFailure } from '../../src/ai/device.js';
import { decideRoute } from '../../src/ai/router.js';

/**
 * ADR 0001 capability probing + routing. All mocked — no network, no WebGPU.
 * Browser brand is never consulted; only page-accessible capabilities.
 */

describe('ADR 0001: availability normalization', () => {
  test('maps the several browser statuses onto one shape', () => {
    assert.deepEqual(normalizeAvailability('readily'), { status: 'available', ready: true, downloadable: false });
    assert.deepEqual(normalizeAvailability({ status: 'available' }), { status: 'available', ready: true, downloadable: false });
    assert.deepEqual(normalizeAvailability('after-download'), { status: 'downloadable', ready: false, downloadable: true });
    assert.deepEqual(normalizeAvailability('downloading'), { status: 'downloading', ready: false, downloadable: true });
    assert.deepEqual(normalizeAvailability('no'), { status: 'unavailable', ready: false, downloadable: false });
    assert.equal(normalizeAvailability('weird').ready, false);
  });

  test('resolvePath walks dotted paths safely', () => {
    assert.equal(resolvePath({ a: { b: 1 } }, 'a.b'), 1);
    assert.equal(resolvePath({}, 'a.b'), undefined);
  });
});

describe('ADR 0001: WebGPU gate (never trusts navigator.gpu existence alone)', () => {
  test('no navigator.gpu -> not usable, with a plain-language reason', async () => {
    const r = await probeWebGpu({ navigator: {} });
    assert.equal(r.usable, false);
    assert.equal(r.present, false);
    assert.match(r.reason, /does not expose WebGPU/i);
  });

  test('too little device memory -> refused even if gpu is present', async () => {
    const gpu = { requestAdapter: async () => ({}) };
    const r = await probeWebGpu({ navigator: { gpu, deviceMemory: LOCAL_MODEL_MIN_DEVICE_MEMORY_GB - 4 } });
    assert.equal(r.usable, false);
    assert.match(r.reason, /GB of memory/i);
  });

  test('gpu present but no adapter -> not usable', async () => {
    const gpu = { requestAdapter: async () => null };
    const r = await probeWebGpu({ navigator: { gpu, deviceMemory: 8 } });
    assert.equal(r.usable, false);
    assert.equal(r.adapter, false);
    assert.match(r.reason, /no graphics adapter/i);
  });

  test('gpu present with a real adapter and enough memory -> usable', async () => {
    const gpu = { requestAdapter: async () => ({ name: 'fake' }) };
    const r = await probeWebGpu({ navigator: { gpu, deviceMemory: 8 } });
    assert.equal(r.usable, true);
    assert.equal(r.adapter, true);
  });
});

describe('ADR 0001: connection warning', () => {
  test('warns on Data Saver and cellular; silent when unmetered/unknown', () => {
    assert.match(connectionWarning({ navigator: { connection: { saveData: true } } }), /Data Saver/i);
    assert.match(connectionWarning({ navigator: { connection: { type: 'cellular' } } }), /cellular/i);
    assert.equal(connectionWarning({ navigator: { connection: { effectiveType: '4g' } } }), '');
    assert.equal(connectionWarning({ navigator: {} }), '');
  });
});

describe('ADR 0001: prompt-API probing never triggers a download', () => {
  test('no API exposed -> not-exposed, no-browser-prompt-api', async () => {
    const report = await probeBrowserCapabilities({ navigator: {}, isSecureContext: true });
    assert.equal(report.prompt.detected, false);
    assert.equal(capabilityDecision(report), 'no-browser-prompt-api');
  });

  test('exposed + availability() "available" -> browser-ready, and create() is NOT called', async () => {
    let createCalls = 0;
    const root = {
      isSecureContext: true,
      navigator: {},
      LanguageModel: { availability: async () => 'available', create: async () => { createCalls++; return {}; } }
    };
    const report = await probeBrowserCapabilities(root);
    assert.equal(report.prompt.ready, true);
    assert.equal(capabilityDecision(report), 'browser-ready');
    assert.equal(createCalls, 0, 'probing must never call create()');
  });

  test('exposed + "downloadable" -> browser-downloadable', async () => {
    const root = { navigator: {}, LanguageModel: { availability: async () => 'downloadable', create: async () => ({}) } };
    const report = await probeBrowserCapabilities(root);
    assert.equal(capabilityDecision(report), 'browser-downloadable');
  });
});

describe('ADR 0001: route decision order (browser → transformers → deterministic)', () => {
  const usable = { compute: { webgpu: true } };
  const noGpu = { compute: { webgpu: false, webgpuReason: 'no adapter' } };

  test('browser-ready always wins', () => {
    const d = decideRoute({ prompt: { ready: true }, ...usable }, { transformersBuilt: true });
    assert.equal(d.route, 'browser-prompt');
  });

  test('browser-downloadable beats transformers', () => {
    const d = decideRoute({ prompt: { downloadable: true }, ...usable }, { transformersBuilt: true });
    assert.equal(d.route, 'browser-prompt-downloadable');
  });

  test('transformers only when built AND WebGPU usable', () => {
    assert.equal(decideRoute({ prompt: {}, ...usable }, { transformersBuilt: true }).route, 'transformers');
    assert.equal(decideRoute({ prompt: {}, ...usable }, { transformersBuilt: false }).route, 'deterministic');
    assert.equal(decideRoute({ prompt: {}, ...noGpu }, { transformersBuilt: true }).route, 'deterministic');
  });

  test('deterministic is the floor and reports why', () => {
    const d = decideRoute({ prompt: {}, ...noGpu }, { transformersBuilt: true });
    assert.equal(d.route, 'deterministic');
    assert.match(d.reason, /no adapter|deterministic/i);
  });
});

describe('ADR 0001: recoverable GPU failure classifier', () => {
  test('device/adapter-loss and OOM are recoverable; plain errors are not', () => {
    assert.equal(isRecoverableGpuFailure('WebGPU device lost'), true);
    assert.equal(isRecoverableGpuFailure('out of memory'), true);
    assert.equal(isRecoverableGpuFailure('Failed to fetch model.onnx'), false);
    assert.equal(isRecoverableGpuFailure(''), false);
  });
});
