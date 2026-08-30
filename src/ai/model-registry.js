/**
 * Registry of supported small language models for client-side execution.
 */

export const SUPPORTED_MODELS = [
  {
    id: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    name: 'SmolLM2 135M Instruct',
    params: '135M',
    approxDownloadMb: 140,
    recommendedFor: 'Low memory devices / Fast WASM CPU inference',
    quantization: 'q4'
  },
  {
    id: 'Qwen/Qwen2.5-0.5B-Instruct',
    name: 'Qwen2.5 0.5B Instruct',
    params: '500M',
    approxDownloadMb: 350,
    recommendedFor: 'Standard desktop with WebGPU / High accuracy',
    quantization: 'q4'
  }
];

export function getRecommendedModel() {
  return SUPPORTED_MODELS[0];
}
