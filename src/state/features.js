/**
 * Feature flags. The optional local-AI advisor is gated OFF until Phase 11
 * delivers explicit model-download consent and the AI worker requirements. The
 * entire core workflow (Phases 0–10) functions with AI disabled, so this stays
 * false in the shipped build.
 */
export const FEATURES = {
  // Set true only once Phase 11 (model consent + worker + validation loop) lands.
  aiAdvisor: false
};
