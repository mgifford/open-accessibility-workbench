import { detectTechnologyFromObservations } from './detect.js';

export function getTechnologyContext(observations = [], userConfirmedTech = null, scanMetadata = null) {
  return detectTechnologyFromObservations(observations, userConfirmedTech, scanMetadata);
}
