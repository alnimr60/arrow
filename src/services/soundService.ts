/**
 * Sound Service using Web Audio API to generate procedural sound effects.
 * This ensures the game is self-contained and doesn't need external assets.
 */

class SoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private init() {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      }
      
      if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as any) === 'interrupted')) {
        this.ctx.resume().catch(err => {
          // Silently fail if resume is blocked by browser policy
        });
      }
    } catch (e) {
      // Catch fatal initialization errors
    }
  }

  public resume() {
    this.init();
  }

  private createVoice(freq: number, type: OscillatorType, duration: number, volume: number, endFreq?: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 2, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playClick() {
    this.createVoice(1200, 'sine', 0.04, 0.15);
  }

  playLaunch() {
    // High-pitched "zip" sound
    this.createVoice(800, 'sine', 0.1, 0.1, 2400);
  }

  playRemove(direction: string) {
    const now = this.ctx?.currentTime || 0;
    
    // Direction-based frequency shifts for "color-specific" feel
    const baseFreqs: Record<string, number> = {
      up: 600,    // Higher/Rose
      down: 300,  // Lower/Amber
      left: 450,  // Mid/Blue
      right: 500  // Mid/Emerald
    };
    
    const freq = baseFreqs[direction] || 400;
    
    // Layered sound for "punch" - varied by direction
    this.createVoice(freq, 'square', 0.15, 0.15, freq * 2);
    this.createVoice(freq / 4, 'sine', 0.1, 0.25, freq / 8);
  }

  playRotate() {
    this.createVoice(400, 'sine', 0.2, 0.1, 200);
    this.createVoice(200, 'sine', 0.1, 0.1, 400);
  }

  playSwitch() {
    this.createVoice(700, 'triangle', 0.1, 0.1, 900);
    this.createVoice(900, 'triangle', 0.1, 0.05, 700);
  }

  playShift() {
    this.createVoice(200, 'sawtooth', 0.3, 0.05, 300);
  }

  playMove() {
    this.createVoice(300, 'sine', 0.1, 0.05, 450);
  }

  playPop() {
    this.createVoice(1200, 'sine', 0.05, 0.1, 1500);
  }

  playError() {
    this.createVoice(150, 'square', 0.2, 0.1, 80);
    this.createVoice(145, 'sawtooth', 0.2, 0.05, 75);
  }

  playLevelStart() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    // Rising chromatic scale
    [440, 554.37, 659.25].forEach((f, i) => {
      this.createVoice(f, 'sine', 0.15, 0.05);
    });
  }

  playLevelComplete() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    [659.25, 830.61, 987.77].forEach((f, i) => {
      setTimeout(() => {
        this.createVoice(f, 'sine', 0.2, 0.08);
      }, i * 50);
    });
  }

  playSuccess() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    
    // Major 7th chord sweep
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.50]; 
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createVoice(freq, 'sine', 0.6, 0.12, freq * 1.02);
      }, i * 80);
    });
  }

  playHint() {
    this.createVoice(880, 'sine', 0.1, 0.1, 1100);
  }
}

export const soundService = new SoundService();
