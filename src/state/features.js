/**
 * Feature flags.
 *
 * `aiAdvisor` gates the optional, consent-first AI advisor PANEL. The entire core
 * workflow (Phases 0–10) functions with AI disabled, so the panel is purely
 * additive.
 *
 * `aiModelRuntime` gates the REAL on-device model runtime (Phase 15): actual
 * model download, WebGPU/WASM inference, and disposal via transformers.js. It is
 * OFF by default and must not be enabled in a deploy until real model-load and
 * inference have been verified on a WebGPU-capable machine — this environment
 * cannot run it. When false, the advisor panel is honest that no separate model
 * is downloaded and composes structured guidance deterministically.
 */
export const FEATURES = {
  aiAdvisor: true,
  // Single switch: the real runtime UI shows only when the build actually bundled
  // transformers.js + WASM (VITE_AI_RUNTIME=1). A normal build tree-shakes the
  // dependency out, so this is false and the honest scaffolded panel is shown.
  aiModelRuntime: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_RUNTIME === '1')
};
