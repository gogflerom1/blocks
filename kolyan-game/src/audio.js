// Tiny WebAudio synth: no asset files. Starts after the first user gesture.
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.8; this.heartT = 0; this.danger = 0; }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.vol;
        this.master.connect(this.ctx.destination);
        this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.startAmbience();
      }
      if (this.ctx.state !== 'running') this.ctx.resume();
    } catch (e) { /* audio is optional */ }
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  suspend() { try { this.ctx && this.ctx.suspend(); } catch (e) {} }
  resume() { try { this.ctx && this.ctx.resume(); } catch (e) {} }

  startAmbience() {
    const c = this.ctx;
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 100;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    const g = c.createGain(); g.gain.value = 0.018;
    hum.connect(f); f.connect(g); g.connect(this.master); hum.start();
    this.ambGain = g;
  }

  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol = 0.3, freq = 800, q = 1, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  }
  play(name, v = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'jump': this.tone(320, 0.16, 'square', 0.08, 320); break;
      case 'land': this.noise(0.08, 0.25, 300, 0.8); break;
      case 'landHard': this.noise(0.18, 0.5, 180, 0.7); this.tone(90, 0.15, 'sine', 0.3, -40); break;
      case 'step': this.noise(0.03, 0.06 * v, 1400, 2); break;
      case 'climb': this.noise(0.12, 0.12, 900, 1.5); this.tone(220, 0.1, 'triangle', 0.08, 120, 0.05); break;
      case 'pickup': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.18, 0, i * 0.07)); break;
      case 'hurt': this.tone(300, 0.4, 'sawtooth', 0.22, -220); this.noise(0.25, 0.35, 500, 0.6); break;
      case 'alert': this.tone(880, 0.12, 'square', 0.12); this.tone(660, 0.25, 'square', 0.12, 0, 0.1); break;
      case 'sus': this.tone(500, 0.18, 'triangle', 0.08, 120); break;
      case 'portal': for (let i = 0; i < 8; i++) this.tone(300 + i * 90, 0.35, 'sine', 0.1, 200, i * 0.06); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, 0, i * 0.13)); break;
      case 'lose': [400, 330, 260, 196].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.12, 0, i * 0.2)); break;
      case 'click': this.tone(700, 0.05, 'square', 0.06); break;
      case 'deny': this.tone(180, 0.18, 'square', 0.1); break;
    }
  }
  // heartbeat that speeds up with danger (0..1)
  tick(dt, danger) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.danger = danger;
    if (danger < 0.15) return;
    this.heartT -= dt;
    if (this.heartT <= 0) {
      this.heartT = 1.1 - danger * 0.65;
      this.tone(60, 0.12, 'sine', 0.25 * danger);
      this.tone(55, 0.1, 'sine', 0.18 * danger, 0, 0.16);
    }
  }
}
