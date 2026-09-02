/**
 * AquaGNN - High-Fidelity Procedural Rain & Storm Sound Engine
 * Multi-layered procedural acoustic synthesis combining:
 * 1. Continuous rain bed (Filtered stereo pink noise)
 * 2. Surface patter & wind swells (LFO-modulated brown noise)
 * 3. Granular stochastic raindrop impacts (Randomized resonant clicks)
 * 4. Distant low-frequency storm rumble for heavy precipitation
 */

class RainSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private patterGain: GainNode | null = null;
  private lfoGain: GainNode | null = null;
  private bedSource: AudioBufferSourceNode | null = null;
  private patterSource: AudioBufferSourceNode | null = null;
  private bedLowpass: BiquadFilterNode | null = null;
  private patterBandpass: BiquadFilterNode | null = null;
  private dropTimer: number | null = null;
  private rumbleTimer: number | null = null;
  private isPlaying: boolean = false;
  private currentIntensity: number = 35;

  private init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();

      // Master Output Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      const sampleRate = this.ctx.sampleRate;
      const bufferLength = sampleRate * 6; // 6-second seamless loop

      // ── Layer 1: Rain Bed (Pink Noise) ─────────────────────────
      const pinkBuffer = this.ctx.createBuffer(2, bufferLength, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const out = pinkBuffer.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferLength; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }

      this.bedSource = this.ctx.createBufferSource();
      this.bedSource.buffer = pinkBuffer;
      this.bedSource.loop = true;

      const bedHighpass = this.ctx.createBiquadFilter();
      bedHighpass.type = 'highpass';
      bedHighpass.frequency.setValueAtTime(400, this.ctx.currentTime);

      this.bedLowpass = this.ctx.createBiquadFilter();
      this.bedLowpass.type = 'lowpass';
      this.bedLowpass.frequency.setValueAtTime(3200, this.ctx.currentTime);

      this.bedGain = this.ctx.createGain();
      this.bedGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      this.bedSource.connect(bedHighpass);
      bedHighpass.connect(this.bedLowpass);
      this.bedLowpass.connect(this.bedGain);
      this.bedGain.connect(this.masterGain);
      this.bedSource.start(0);

      // ── Layer 2: Texture & Patter (Modulated Brown Noise) ──────
      const brownBuffer = this.ctx.createBuffer(2, bufferLength, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const out = brownBuffer.getChannelData(ch);
        let lastOut = 0.0;
        for (let i = 0; i < bufferLength; i++) {
          const white = Math.random() * 2 - 1;
          out[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = out[i];
          out[i] *= 3.5;
        }
      }

      this.patterSource = this.ctx.createBufferSource();
      this.patterSource.buffer = brownBuffer;
      this.patterSource.loop = true;

      this.patterBandpass = this.ctx.createBiquadFilter();
      this.patterBandpass.type = 'bandpass';
      this.patterBandpass.frequency.setValueAtTime(1600, this.ctx.currentTime);
      this.patterBandpass.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.patterGain = this.ctx.createGain();
      this.patterGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      // LFO for natural wind/gust dynamics
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime); // 0.2 Hz swell
      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      lfo.connect(this.lfoGain.gain);
      lfo.start(0);

      this.patterSource.connect(this.patterBandpass);
      this.patterBandpass.connect(this.patterGain);
      this.patterGain.connect(this.masterGain);
      this.patterSource.start(0);

    } catch (e) {
      console.warn('[RainAudio] Web Audio initialization warning:', e);
    }
  }

  /**
   * Generates organic micro-droplet impact sounds
   */
  private spawnDroplet() {
    if (!this.ctx || !this.isPlaying || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const dropGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Random frequency between 1400Hz - 3600Hz for water droplets
      const freq = 1400 + Math.random() * 2200;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.035);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, now);
      filter.Q.setValueAtTime(3.0, now);

      const dropVol = 0.015 + Math.random() * 0.045;
      dropGain.gain.setValueAtTime(dropVol, now);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(filter);
      filter.connect(dropGain);
      dropGain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Ignore transient audio context errors
    }
  }

  /**
   * Starts droplet spawn timer loop scaled by rain intensity
   */
  private startDropletLoop() {
    if (this.dropTimer) clearInterval(this.dropTimer);

    const scheduleNext = () => {
      if (!this.isPlaying) return;
      this.spawnDroplet();

      // Rate scales with intensity: 15ms - 120ms intervals
      const norm = Math.min(1.0, Math.max(0.1, this.currentIntensity / 140));
      const interval = Math.max(18, Math.floor(110 - norm * 90) + (Math.random() * 30 - 15));
      this.dropTimer = window.setTimeout(scheduleNext, interval);
    };

    scheduleNext();
  }

  /**
   * Occasional distant thunder rumble for high intensity (>65 mm/hr)
   */
  private triggerRumble() {
    if (!this.ctx || !this.isPlaying || !this.masterGain || this.currentIntensity < 65) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const rumbleGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(55, now);
      osc.frequency.linearRampToValueAtTime(38, now + 2.5);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(110, now);

      rumbleGain.gain.setValueAtTime(0.0001, now);
      rumbleGain.gain.linearRampToValueAtTime(0.12, now + 0.8);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc.connect(filter);
      filter.connect(rumbleGain);
      rumbleGain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 3.3);
    } catch {
      // Ignore transient errors
    }
  }

  public setIntensity(precipitationMmHr: number) {
    this.currentIntensity = precipitationMmHr;
    if (!this.ctx || !this.isPlaying || !this.masterGain || !this.bedLowpass) return;

    try {
      const now = this.ctx.currentTime;
      const normalized = Math.min(1.0, Math.max(0.08, precipitationMmHr / 140));

      // Master Volume: 0.12 (light drizzle) -> 0.45 (torrential downpour)
      const targetGain = 0.12 + normalized * 0.33;
      // High frequency brightness scales with heavy rain splatter
      const targetCutoff = 1200 + normalized * 3800;

      this.masterGain.gain.setTargetAtTime(targetGain, now, 0.2);
      this.bedLowpass.frequency.setTargetAtTime(targetCutoff, now, 0.2);

      if (this.patterBandpass) {
        this.patterBandpass.frequency.setTargetAtTime(900 + normalized * 1800, now, 0.2);
      }
    } catch (e) {
      console.warn('[RainAudio] Intensity update error:', e);
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
      this.currentIntensity = precipitationMmHr;

      const now = this.ctx.currentTime;
      const normalized = Math.min(1.0, Math.max(0.08, precipitationMmHr / 140));
      const targetGain = 0.12 + normalized * 0.33;

      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.4);

      this.setIntensity(precipitationMmHr);
      this.startDropletLoop();

      // Occasional rumble interval for severe storms
      if (this.rumbleTimer) clearInterval(this.rumbleTimer);
      this.rumbleTimer = window.setInterval(() => {
        if (Math.random() < 0.35) {
          this.triggerRumble();
        }
      }, 12000);

    } catch (e) {
      console.warn('[RainAudio] Playback error:', e);
    }
  }

  public stop() {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;
    try {
      this.isPlaying = false;
      if (this.dropTimer) clearTimeout(this.dropTimer);
      if (this.rumbleTimer) clearInterval(this.rumbleTimer);

      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.3);
    } catch (e) {
      console.warn('[RainAudio] Stop error:', e);
    }
  }
}

export const rainAudio = new RainSoundEngine();
