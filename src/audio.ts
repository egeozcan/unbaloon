export class AudioManager {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playTap(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playPop(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Layer 1: White noise burst
    const bufferSize = Math.ceil(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.03);

    // Layer 2: Mid-frequency thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.02);
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  }

  // ── Surprise event sounds ──────────────────────────────────────────────────

  playRainbowWhoosh(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const bufferSize = Math.ceil(ctx.sampleRate * 1.0);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.value = 2;
    bandpass.frequency.setValueAtTime(200, now);
    bandpass.frequency.exponentialRampToValueAtTime(800, now + 1.0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.6);
    gain.gain.linearRampToValueAtTime(0, now + 1.0);
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(-1, now);
    panner.pan.linearRampToValueAtTime(1, now + 1.0);
    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 1.0);
  }

  playConfettiPatter(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 20; i++) {
      const time = now + Math.random() * 1.5;
      const bufSize = Math.ceil(ctx.sampleRate * 0.002);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bufSize; j++) { d[j] = Math.random() * 2 - 1; }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.1, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.01);
      src.connect(hp);
      hp.connect(g);
      g.connect(ctx.destination);
      src.start(time);
      src.stop(time + 0.01);
    }
  }

  playStarSparkle(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const freqs = [1200, 1600, 2000, 2400];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startTime = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  playBubbleBloop(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // ── Silly sounds ───────────────────────────────────────────────────────────

  playQuack(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.1;
      const osc = ctx.createOscillator();
      const bandpass = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, t);
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 800;
      bandpass.Q.value = 3;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  playBoing(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    const times = [0, 0.08, 0.15, 0.22, 0.3, 0.4];
    const freqs = [600, 200, 450, 180, 350, 150];
    times.forEach((t, i) => { osc.frequency.setValueAtTime(freqs[i], now + t); });
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playSlideWhistle(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.25);
    osc.frequency.linearRampToValueAtTime(300, now + 0.5);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playGiggle(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.15;
      const osc = ctx.createOscillator();
      const tremolo = ctx.createOscillator();
      const tremoloGain = ctx.createGain();
      const masterGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500 + i * 50, t);
      tremolo.type = 'sine';
      tremolo.frequency.value = 8;
      tremoloGain.gain.value = 0.08;
      masterGain.gain.setValueAtTime(0.15, t);
      masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      tremolo.connect(tremoloGain);
      tremoloGain.connect(masterGain.gain);
      osc.connect(masterGain);
      masterGain.connect(ctx.destination);
      osc.start(t);
      tremolo.start(t);
      osc.stop(t + 0.12);
      tremolo.stop(t + 0.12);
    }
  }

  // ── Animal sounds ──────────────────────────────────────────────────────────

  playMeow(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playRibbit(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    }
  }

  playTweet(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.015;
      const freq = i % 2 === 0 ? 1800 : 2200;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.015);
    }
  }

  // ── Special balloon and finale sounds ─────────────────────────────────────

  playStarChime(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1000, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);
    // Slightly detuned shimmer
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1007, now);
    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.6);
  }

  playRainbowHarp(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const freqs = [523.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5,G5,C6,E6,G6
    freqs.forEach((freq, i) => {
      const t = now + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  playFinaleCelebration(): void {
    this.playStarSparkle();
    this.playRainbowWhoosh();
    this.playConfettiPatter();
  }

  // ── Helicopter sounds ──────────────────────────────────────────────────────

  // Quiet little "pew" for each dart so rapid fire doesn't get grating.
  playDartShoot(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Rising whir as the helicopter spins up.
  playHelicopterSpawn(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.5);
    // Tremolo to suggest rotor chop.
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(8, now);
    lfo.frequency.linearRampToValueAtTime(16, now + 0.5);
    lfoGain.gain.value = 0.06;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.15);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.6);
    lfo.stop(now + 0.6);
  }

  // ── Plane sounds ───────────────────────────────────────────────────────────

  // Rising propeller-engine "vroom" as the plane takes off.
  playPlaneSpawn(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(190, now + 0.4);
    osc.frequency.linearRampToValueAtTime(150, now + 0.7);
    // Fast tremolo for the propeller chop.
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(22, now);
    lfo.frequency.linearRampToValueAtTime(34, now + 0.6);
    lfoGain.gain.value = 0.05;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1200;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.12);
    gain.gain.linearRampToValueAtTime(0, now + 0.7);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.7);
    lfo.stop(now + 0.7);
  }

  // ── Bulldozer sounds ─────────────────────────────────────────────────────

  // Low, gruff diesel engine turning over as the bulldozer rolls out.
  playBulldozerSpawn(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(38, now);
    osc.frequency.linearRampToValueAtTime(70, now + 0.5);
    osc.frequency.linearRampToValueAtTime(58, now + 0.8);
    // Slow, chunky tremolo for the diesel chug.
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(7, now);
    lfo.frequency.linearRampToValueAtTime(11, now + 0.7);
    lfoGain.gain.value = 0.07;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 600;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.12);
    gain.gain.linearRampToValueAtTime(0, now + 0.85);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.85);
    lfo.stop(now + 0.85);
  }

  // Short crunchy squish for each crush "bite" — kept quiet as it repeats.
  playBulldozerCrush(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    // Gritty noise scrape.
    const bufferSize = Math.ceil(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1400, now);
    lowpass.frequency.exponentialRampToValueAtTime(400, now + 0.08);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    noise.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.08);
    // Low metallic thud underneath.
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.06);
    oscGain.gain.setValueAtTime(0.14, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Soft filtered "fwoosh" as a homing missile launches.
  playMissileLaunch(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const bufferSize = Math.ceil(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.value = 1.2;
    bandpass.frequency.setValueAtTime(500, now);
    bandpass.frequency.exponentialRampToValueAtTime(1400, now + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.25);
  }

  // Putt-putt diesel chug as the tractor rolls on — lighter and quicker than the
  // bulldozer's, with a brighter tremolo.
  playTractorSpawn(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.linearRampToValueAtTime(96, now + 0.4);
    osc.frequency.linearRampToValueAtTime(82, now + 0.75);
    // Brisk putt-putt tremolo.
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(12, now);
    lfo.frequency.linearRampToValueAtTime(16, now + 0.7);
    lfoGain.gain.value = 0.08;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 850;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + 0.8);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.8);
    lfo.stop(now + 0.8);
  }

  // Soft padded "thunk" as a balloon settles onto the trailer bed. Quiet, since
  // it can fire repeatedly as the bed fills.
  playTractorLoad(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // Rain cloud summon: a low thunder rumble under a soft swelling rain hiss.
  playRainSpawn(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Rain hiss: band-passed white noise that swells in and settles to a patter.
    const dur = 0.9;
    const bufferSize = Math.ceil(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1700;
    bandpass.Q.value = 0.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.11, now + 0.25);
    noiseGain.gain.linearRampToValueAtTime(0.05, now + dur);
    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);

    // Low thunder rumble.
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(72, now);
    osc.frequency.exponentialRampToValueAtTime(44, now + 0.6);
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.linearRampToValueAtTime(0.17, now + 0.12);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.72);
  }

  // ── Excavator sounds ─────────────────────────────────────────────────────────

  // Chugging diesel start-up with a hydraulic whine on top as the excavator rolls
  // out — gruffer than the tractor, brightened by the servo whine.
  playExcavatorSpawn(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    // Diesel rumble.
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(46, now);
    osc.frequency.linearRampToValueAtTime(84, now + 0.5);
    osc.frequency.linearRampToValueAtTime(70, now + 0.8);
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(8, now);
    lfo.frequency.linearRampToValueAtTime(12, now + 0.7);
    lfoGain.gain.value = 0.07;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 700;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.12);
    gain.gain.linearRampToValueAtTime(0, now + 0.85);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.85);
    lfo.stop(now + 0.85);
    // Hydraulic servo whine sweeping up.
    const whine = ctx.createOscillator();
    const whineGain = ctx.createGain();
    whine.type = 'triangle';
    whine.frequency.setValueAtTime(320, now + 0.2);
    whine.frequency.exponentialRampToValueAtTime(640, now + 0.7);
    whineGain.gain.setValueAtTime(0.0001, now + 0.2);
    whineGain.gain.linearRampToValueAtTime(0.05, now + 0.4);
    whineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    whine.connect(whineGain);
    whineGain.connect(ctx.destination);
    whine.start(now + 0.2);
    whine.stop(now + 0.8);
  }

  // Hydraulic whir rising to a clamp "clunk" as the bucket grabs a balloon.
  playExcavatorGrab(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    // Servo whir: a quick upward sweep.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1100;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
    // Clamp clunk at the end of the whir.
    const clunk = ctx.createOscillator();
    const clunkGain = ctx.createGain();
    clunk.type = 'square';
    clunk.frequency.setValueAtTime(160, now + 0.12);
    clunk.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    clunkGain.gain.setValueAtTime(0.12, now + 0.12);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    clunk.connect(clunkGain);
    clunkGain.connect(ctx.destination);
    clunk.start(now + 0.12);
    clunk.stop(now + 0.22);
  }

  // Short metallic bite for each bucket chomp — kept quiet as it repeats.
  playExcavatorChomp(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    // Clanky metal noise.
    const bufferSize = Math.ceil(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(2200, now);
    bandpass.frequency.exponentialRampToValueAtTime(900, now + 0.06);
    bandpass.Q.value = 1.4;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.06);
    // Low clank underneath.
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.05);
    oscGain.gain.setValueAtTime(0.1, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // ── Fire truck sounds ────────────────────────────────────────────────────────

  // Fire truck summon: a cheerful two-whoop siren over a rumbling engine, capped with
  // a soft water-whoosh as the hose opens up.
  playFiretruckSpawn(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Engine rumble underneath.
    const engine = ctx.createOscillator();
    const engineGain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(58, now);
    engine.frequency.linearRampToValueAtTime(88, now + 0.5);
    engine.frequency.linearRampToValueAtTime(74, now + 0.9);
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 760;
    engineGain.gain.setValueAtTime(0, now);
    engineGain.gain.linearRampToValueAtTime(0.1, now + 0.12);
    engineGain.gain.linearRampToValueAtTime(0, now + 0.95);
    engine.connect(lowpass);
    lowpass.connect(engineGain);
    engineGain.connect(ctx.destination);
    engine.start(now);
    engine.stop(now + 0.95);

    // Siren: two "wee-ooo" whoops sweeping up then down.
    const siren = ctx.createOscillator();
    const sirenGain = ctx.createGain();
    siren.type = 'triangle';
    const whoop = (t0: number) => {
      siren.frequency.setValueAtTime(620, t0);
      siren.frequency.linearRampToValueAtTime(990, t0 + 0.2);
      siren.frequency.linearRampToValueAtTime(640, t0 + 0.4);
    };
    whoop(now);
    whoop(now + 0.42);
    sirenGain.gain.setValueAtTime(0.0001, now);
    sirenGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    sirenGain.gain.setValueAtTime(0.08, now + 0.82);
    sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.92);
    siren.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    siren.start(now);
    siren.stop(now + 0.92);

    // Water-whoosh tail: band-passed noise swelling in as the jet starts.
    const dur = 0.5;
    const bufferSize = Math.ceil(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1400, now + 0.7);
    bandpass.frequency.linearRampToValueAtTime(2400, now + 1.0);
    bandpass.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now + 0.7);
    noiseGain.gain.linearRampToValueAtTime(0.07, now + 0.86);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.18);
    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now + 0.7);
    noise.stop(now + 1.2);
  }
}
