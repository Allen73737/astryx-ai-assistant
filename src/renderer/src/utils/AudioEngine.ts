class UltraCinematicAudioEngine {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private masterGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackNode: GainNode | null = null;

  private init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);
      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.value = 0.4;
      this.feedbackNode = this.ctx.createGain();
      this.feedbackNode.gain.value = 0.3;
      this.delayNode.connect(this.feedbackNode);
      this.feedbackNode.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  public async unlock() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public playBootSequence() {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.delayNode) return;
    const t = this.ctx.currentTime;
    const powerOsc = this.ctx.createOscillator();
    powerOsc.type = 'sine';
    powerOsc.frequency.setValueAtTime(50, t);
    powerOsc.frequency.exponentialRampToValueAtTime(1200, t + 2.5);
    const powerGain = this.ctx.createGain();
    powerGain.gain.setValueAtTime(0, t);
    powerGain.gain.linearRampToValueAtTime(0.3, t + 2.0);
    powerGain.gain.exponentialRampToValueAtTime(0.01, t + 2.5);
    powerOsc.connect(powerGain);
    powerGain.connect(this.masterGain);
    powerOsc.start(t);
    powerOsc.stop(t + 2.6);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 2.5);
    filter.Q.value = 5;
    filter.connect(this.masterGain);
    [-10, 0, 10].forEach(detune => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 40;
      osc.detune.value = detune;
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 1.0);
      gain.gain.linearRampToValueAtTime(0.4, t + 2.4);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 2.6);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(t);
      osc.stop(t + 2.7);
    });

    const act = t + 2.5;
    const chordNotes = [
      { freq: 261.63, gain: 0.12 },
      { freq: 329.63, gain: 0.10 },
      { freq: 392.00, gain: 0.08 },
      { freq: 523.25, gain: 0.06 },
    ];
    chordNotes.forEach((note, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      const g = this.ctx!.createGain();
      const stagger = act + i * 0.06;
      g.gain.setValueAtTime(0, stagger);
      g.gain.linearRampToValueAtTime(note.gain, stagger + 0.12);
      g.gain.setValueAtTime(note.gain, act + 0.8);
      g.gain.exponentialRampToValueAtTime(0.001, act + 2.0);
      osc.connect(g);
      g.connect(this.masterGain!);
      g.connect(this.delayNode!);
      osc.start(stagger);
      osc.stop(act + 2.1);
    });

    const shimmerBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const shimmerData = shimmerBuffer.getChannelData(0);
    for (let i = 0; i < shimmerBuffer.length; i++) {
      shimmerData[i] = Math.random() * 2 - 1;
    }
    const shimmerSrc = this.ctx.createBufferSource();
    shimmerSrc.buffer = shimmerBuffer;
    const shimmerFilter = this.ctx.createBiquadFilter();
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.value = 2500;
    shimmerFilter.Q.value = 0.5;
    const shimmerGain = this.ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, act);
    shimmerGain.gain.linearRampToValueAtTime(0.15, act + 0.2);
    shimmerGain.gain.setValueAtTime(0.15, act + 0.8);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, act + 2.5);
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 3.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain);
    lfoGain.connect(shimmerFilter.frequency);
    shimmerSrc.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(this.masterGain);
    shimmerGain.connect(this.delayNode);
    shimmerSrc.start(act);
    lfo.start(act);
    shimmerSrc.stop(act + 2.6);
    lfo.stop(act + 2.6);

    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(65.41, act);
    subOsc.frequency.exponentialRampToValueAtTime(32.70, act + 1.2);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0, act);
    subGain.gain.linearRampToValueAtTime(0.35, act + 0.08);
    subGain.gain.setValueAtTime(0.35, act + 0.6);
    subGain.gain.exponentialRampToValueAtTime(0.001, act + 2.5);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(act);
    subOsc.stop(act + 2.6);

    const clickOsc = this.ctx.createOscillator();
    clickOsc.type = 'sine';
    const clickTime = act + 1.0;
    clickOsc.frequency.setValueAtTime(800, clickTime);
    clickOsc.frequency.setValueAtTime(200, clickTime + 0.015);
    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0, clickTime);
    clickGain.gain.linearRampToValueAtTime(0.12, clickTime + 0.005);
    clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.06);
    clickOsc.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickOsc.start(clickTime);
    clickOsc.stop(clickTime + 0.07);
  }

  public playOrbState(state: string) {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    if (state === 'listening') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(1600, t + 0.1);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      if (this.delayNode) gain.connect(this.delayNode);
      osc.start(t);
      osc.stop(t + 0.4);
    } else if (state === 'processing') {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      filter.connect(this.masterGain);
      [-5, 5].forEach(detune => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 60;
        osc.detune.value = detune;
        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.5);
        gain.gain.linearRampToValueAtTime(0, t + 2.5);
        const lfo = this.ctx!.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 4;
        const lfoGain = this.ctx!.createGain();
        lfoGain.gain.value = 0.1;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        osc.connect(gain);
        gain.connect(filter);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 2.6);
        lfo.stop(t + 2.6);
      });
    } else if (state === 'error') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.6);
    }
  }

  public playClick() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.setValueAtTime(400, t + 0.02);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playSuccess() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, t);
    osc.frequency.setValueAtTime(659.25, t + 0.08);
    osc.frequency.setValueAtTime(783.99, t + 0.16);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  public playNotification() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(880, t);
    osc1.frequency.exponentialRampToValueAtTime(440, t + 0.25);
    osc2.frequency.setValueAtTime(1320, t);
    osc2.frequency.exponentialRampToValueAtTime(660, t + 0.25);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    if (this.delayNode) gain.connect(this.delayNode);
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.35);
    osc2.stop(t + 0.35);
  }

  public playElevate() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.5);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    if (this.delayNode) gain.connect(this.delayNode);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  public playScanning() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.linearRampToValueAtTime(900, t + 0.15);
    osc.frequency.linearRampToValueAtTime(1800, t + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  public playHover() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3000, t);
    osc.frequency.exponentialRampToValueAtTime(4500, t + 0.05);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.015, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  public playKeyboardTyping() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.setValueAtTime(150, t + 0.01);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.02, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  public playPageTransition() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    if (this.delayNode) gain.connect(this.delayNode);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playAlert() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    [0, 0.12].forEach((offset) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t + offset);
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.1, t + offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1);
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + offset);
      osc.stop(t + offset + 0.12);
    });
  }

  public playGearShift() {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}

export const audioEngine = new UltraCinematicAudioEngine();
