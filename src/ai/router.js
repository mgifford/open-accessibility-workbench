/**
 * Capability-driven provider routing (ADR 0001).
 *
 * Picks the highest-preference AI route the current session actually supports:
 *   browser-ready        → browser Prompt API, offer now
 *   browser-downloadable → browser Prompt API, disclose + offer to prepare
 *   transformers-worker  → only when built (VITE_AI_RUNTIME) AND WebGPU is usable
 *   deterministic        → always the floor
 *
 * Routing is a preference order, not a promise: a chosen route may still reject
 * at run time, and the caller falls back down this list to deterministic.
 */

import { probeBrowserCapabilities, capabilityDecision } from './browser-capabilities.js';
import { FEATURES } from '../state/features.js';

/**
 * @param {object} report - from probeBrowserCapabilities()
 * @param {object} [opts]
 * @param {boolean} [opts.transformersBuilt] - is the VITE_AI_RUNTIME build active
 * @returns {{ route: string, browser: string, transformersOffered: boolean, reason: string }}
 */
export function decideRoute(report, opts = {}) {
  const transformersBuilt = opts.transformersBuilt ?? FEATURES.aiModelRuntime;
  const browser = capabilityDecision(report); // browser-ready | browser-downloadable | no-browser-prompt-api
  const webgpuUsable = Boolean(report?.compute?.webgpu);
  const transformersOffered = Boolean(transformersBuilt && webgpuUsable);

  if (browser === 'browser-ready') {
    return { route: 'browser-prompt', browser, transformersOffered, reason: 'The browser exposes a ready built-in AI.' };
  }
  if (browser === 'browser-downloadable') {
    return { route: 'browser-prompt-downloadable', browser, transformersOffered, reason: 'The browser can download a built-in AI (browser-managed).' };
  }
  if (transformersOffered) {
    return { route: 'transformers', browser, transformersOffered, reason: 'No built-in browser AI; a WebGPU-capable local model is available in this build.' };
  }
  return {
    route: 'deterministic',
    browser,
    transformersOffered,
    reason: transformersBuilt
      ? (report?.compute?.webgpuReason || 'No usable model route; deterministic guidance is used.')
      : 'No built-in browser AI and no local model in this build; deterministic guidance is used.'
  };
}

/** Convenience: probe the current session and decide in one call. */
export async function probeAndDecide(root = globalThis, opts = {}) {
  const report = await probeBrowserCapabilities(root, opts.timeoutMs);
  return { report, decision: decideRoute(report, opts) };
}
