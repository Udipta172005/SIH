/**
 * AquaGNN - Procedural Web Audio API Rain & Storm Sound Engine
 * Synthesizes dynamic, realistic ambient rainfall audio with intensity-driven
 * filtering and volume modulation based on live precipitation (mm/hr).
 */

class RainSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private isPlaying: boolean = false;

  private init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Filter Chain: Source -> Highpass -> Lowpass -> MasterGain -> Speakers
      this.highpassFilter = this.ctx.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.setValueAtTime(280, this.ctx.currentTime);

      this.lowpassFilter = this.ctx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);

      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.masterGain);

      // Generate 5-second stereo pink noise buffer for realistic rain sound texture
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 5;
      const noiseBuffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const output = noiseBuffer.getChannelData(channel);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
          b6 = white * 0.115926;
        }
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuffer;
      this.noiseSource.loop = true;
      this.noiseSource.connect(this.highpassFilter);
      this.noiseSource.start(0);
    } catch (e) {
      console.warn('[RainAudio] Web Audio initialization failed:', e);
    }
  }

  public setIntensity(precipitationMmHr: number) {
    if (!this.ctx || !this.isPlaying || !this.masterGain || !this.lowpassFilter) return;
    try {
      const now = this.ctx.currentTime;
      // Map 0 - 160 mm/hr to volume (0.05 - 0.40) and filter cutoff (600Hz - 3200Hz)
      const normalized = Math.min(1.0, Math.max(0.08, precipitationMmHr / 140));
      const targetGain = 0.05 + normalized * 0.35;
      const targetCutoff = 700 + normalized * 2500;

      this.masterGain.gain.setTargetAtTime(targetGain, now, 0.25);
      this.lowpassFilter.frequency.setTargetAtTime(targetCutoff, now, 0.25);
    } catch (e) {
      console.warn('[RainAudio] Error adjusting intensity:', e);
    }
  }

  public play(precipitationMmHr: number = 35) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.isPlaying = true;
      const now = this.ctx.currentTime;
      const normalized = Math.min(1.0, Math.max(0.08, precipitationMmHr / 140));
      const targetGain = 0.05 + normalized * 0.35;

      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.3);
      this.setIntensity(precipitationMmHr);
    } catch (e) {
      console.warn('[RainAudio] Error starting rain audio:', e);
    }
  }

  public stop() {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;
    try {
      this.isPlaying = false;
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.25);
    } catch (e) {
      console.warn('[RainAudio] Error stopping rain audio:', e);
    }
  }
}

export const rainAudio = new RainSoundEngine();
