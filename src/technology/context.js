import { detectTechnologyFromObservations } from './detect.js';

/**
 * Resolves the technology context for a set of observations under the current
 * user confirmation / rejection state.
 * @param {Array<object>} observations
 * @param {string|null} userConfirmedTech
 * @param {object|null} scanMetadata
 * @param {string[]} [rejected]
 */
export function getTechnologyContext(observations = [], userConfirmedTech = null, scanMetadata = null, rejected = []) {
  return detectTechnologyFromObservations(observations, userConfirmedTech, scanMetadata, rejected);
}
