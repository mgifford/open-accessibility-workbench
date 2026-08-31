/**
 * Feature flags. The optional local-AI advisor is gated OFF until Phase 11
 * delivers explicit model-download consent and the AI worker requirements. The
 * entire core workflow (Phases 0–10) functions with AI disabled, so this stays
 * false in the shipped build.
 */
export const FEATURES = {
  // Phase 11: the local-AI advisor is now consent-gated (no download on load,
  // explicit enable required, deterministic fallback everywhere), so the
  // consent-first panel may be shown. It stays entirely optional.
  aiAdvisor: true
};
