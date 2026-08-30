import { SUPPORTED_MODELS } from '../ai/model-registry.js';

export class ModelStatus extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); display: flex; align-items: center; gap: var(--space-2);">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: var(--color-urgency-low);"></span>
        <span>Local AI Runtime Ready (Deterministic Baseline Active)</span>
      </div>
    `;
  }
}

customElements.define('model-status', ModelStatus);
