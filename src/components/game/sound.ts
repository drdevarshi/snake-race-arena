/**
 * Tiny synthesized sound system (Web Audio API) — no audio files needed.
 * The AudioContext is created lazily on the first user gesture (browser autoplay rules).
 */
type Wave = OscillatorType;

class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  sfxEnabled = true;
  musicEnabled = false;

  /** Call from a user gesture (click/keydown/touch). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(freq: number, dur: number, wave: Wave = "square", vol = 0.5, when = 0, slideTo?: number, dest?: AudioNode) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(dest ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.4) {
    if (!this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(this.master);
    src.start();
  }

  apple() { if (this.sfxEnabled) { this.tone(880, 0.08, "square", 0.25); this.tone(1320, 0.1, "square", 0.2, 0.06); } }
  pickup() { if (this.sfxEnabled) [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.3, i * 0.05)); }
  shield() { if (this.sfxEnabled) this.tone(1200, 0.3, "sine", 0.4, 0, 400); }
  tunnel() { if (this.sfxEnabled) this.tone(300, 0.25, "sawtooth", 0.15, 0, 1200); }
  crash() { if (this.sfxEnabled) { this.noise(0.35, 0.5); this.tone(180, 0.4, "sawtooth", 0.3, 0, 50); } }
  countdown(final = false) { if (this.sfxEnabled) this.tone(final ? 1046 : 523, final ? 0.3 : 0.12, "square", 0.3); }
  win() { if (this.sfxEnabled) [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.18, "square", 0.25, i * 0.11)); }

  /* ------------------------------ music ------------------------------- */
  private static readonly BASS = [55, 55, 65.4, 49];
  private static readonly ARP = [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 246.9];

  setMusic(on: boolean) {
    this.musicEnabled = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 50);
  }

  private stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic() {
    if (!this.ctx || !this.musicGain) return;
    const beat = 0.15;
    while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
      const when = this.nextNoteTime - this.ctx.currentTime;
      const bar = Math.floor(this.step / 8) % 4;
      const arp = SoundSystem.ARP[this.step % 8] * (bar === 3 ? 0.89 : 1);
      this.tone(arp * 2, beat * 0.9, "triangle", 0.25, when, undefined, this.musicGain);
      if (this.step % 4 === 0) this.tone(SoundSystem.BASS[bar], beat * 3.5, "sawtooth", 0.35, when, undefined, this.musicGain);
      this.nextNoteTime += beat;
      this.step++;
    }
  }

  dispose() {
    this.stopMusic();
  }
}

export const sound = new SoundSystem();
