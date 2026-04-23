import { Audio } from 'expo-av';

class SoundService {
  private isEnabled = true;

  async playClick() {
    // Simple tone or ignore for now as procedural audio is complex in RN
    // Real native apps would use small pre-recorded samples
  }

  async playRemove() {
    // Stub
  }

  async playError() {
    // Stub
  }

  async playSuccess() {
    // Stub
  }
}

export const soundService = new SoundService();
