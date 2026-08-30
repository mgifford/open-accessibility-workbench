import { getSavedProfile, saveProfile } from '../roles/capability-profile.js';

class ProfileStore {
  constructor() {
    this.state = getSavedProfile();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  toggleCapability(cap) {
    const list = new Set(this.state.selectedCapabilities || []);
    if (list.has(cap)) list.delete(cap);
    else list.add(cap);
    this.state.selectedCapabilities = Array.from(list);
    saveProfile(this.state);
    this.notify();
  }

  setCapabilities(caps) {
    this.state.selectedCapabilities = caps;
    saveProfile(this.state);
    this.notify();
  }
}

export const profileStore = new ProfileStore();
