class PreferencesStore {
  constructor() {
    this.state = {
      localAiConsent: false,
      selectedModel: 'HuggingFaceTB/SmolLM2-135M-Instruct',
      theme: 'system'
    };
  }

  setConsent(consent) {
    this.state.localAiConsent = Boolean(consent);
  }
}

export const preferencesStore = new PreferencesStore();
