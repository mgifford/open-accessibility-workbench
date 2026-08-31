/**
 * Local-data management (spec §13.2). The Workbench stores only PREFERENCES
 * locally — never report contents. This lists exactly what is stored and clears
 * it on request.
 */

export const LOCAL_DATA_ITEMS = [
  { key: 'oaw_capability_profile', label: 'Capability profile (the areas you selected you can change)' },
  { key: 'oaw.taskStatus.v2', label: 'Task statuses (open/in-progress/done, if you opted in to save them)' },
  { key: 'oaw.taskStatus.v1', label: 'Task statuses (legacy)' },
  { key: 'oaw.technology.v1', label: 'Technology confirmation/rejection preferences' },
  { key: 'oaw.aiConsent.v1', label: 'Local-AI consent preference' }
];

/** Removes all Workbench preference keys from localStorage. Never throws. */
export function clearLocalData() {
  let removed = 0;
  for (const item of LOCAL_DATA_ITEMS) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(item.key) !== null) {
        localStorage.removeItem(item.key);
        removed++;
      }
    } catch { /* storage unavailable — nothing to clear */ }
  }
  return { removed, items: LOCAL_DATA_ITEMS };
}

/** Reports which preference keys currently hold data. */
export function listStoredData() {
  return LOCAL_DATA_ITEMS.filter((item) => {
    try { return typeof localStorage !== 'undefined' && localStorage.getItem(item.key) !== null; }
    catch { return false; }
  });
}
