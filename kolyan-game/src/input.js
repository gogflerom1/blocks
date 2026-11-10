// Multitouch controls: dynamic joystick (left), camera drag (right), action buttons.
// Keyboard/mouse fallback exists only for desktop testing.
export class Input {
  constructor(layer, joyEl, knobEl, buttons) {
    this.layer = layer; this.joyEl = joyEl; this.knobEl = knobEl;
    this.moveX = 0; this.moveY = 0;
    this.lookDX = 0; this.lookDY = 0;
    this.jumpHeld = false; this.climbHeld = false;
    this.edges = { jump: false, climb: false, action: false };
    this.run = false; this.crouch = false;
    this.joyId = null; this.lookId = null;
    this.joyCX = 0; this.joyCY = 0; this.R = 56;
    this.keys = new Set();
    this.enabled = false;
    this.onToggle = () => {};

    const opts = { passive: false };
    layer.addEventListener('pointerdown', e => this.down(e), opts);
    window.addEventListener('pointermove', e => this.move(e), opts);
    window.addEventListener('pointerup', e => this.up(e), opts);
    window.addEventListener('pointercancel', e => this.up(e), opts);
    layer.addEventListener('contextmenu', e => e.preventDefault());

    const bind = (el, onDown, onUp) => {
      if (!el) return;
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); onDown(); }, opts);
      const off = e => { el.classList.remove('on'); if (onUp) onUp(); };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    };
    this.btn = buttons;
    bind(buttons.jump, () => { this.edges.jump = true; this.jumpHeld = true; }, () => { this.jumpHeld = false; });
    bind(buttons.climb, () => { this.edges.climb = true; this.climbHeld = true; }, () => { this.climbHeld = false; });
    bind(buttons.action, () => { this.edges.action = true; });
    bind(buttons.run, () => { this.run = !this.run; this.sync(); this.onToggle(); });
    bind(buttons.crouch, () => { this.crouch = !this.crouch; this.sync(); this.onToggle(); });

    window.addEventListener('keydown', e => {
      if (!this.enabled) return;
      const k = e.key.toLowerCase();
      if (this.keys.has(k)) return;
      this.keys.add(k);
      if (k === ' ') { this.edges.jump = true; this.jumpHeld = true; e.preventDefault(); }
      if (k === 'f') { this.edges.climb = true; this.climbHeld = true; }
      if (k === 'e') this.edges.action = true;
      if (k === 'c') { this.crouch = !this.crouch; this.sync(); }
    });
    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === ' ') this.jumpHeld = false;
      if (k === 'f') this.climbHeld = false;
    });
  }

  sync() {
    this.btn.run && this.btn.run.classList.toggle('lit', this.run);
    this.btn.crouch && this.btn.crouch.classList.toggle('lit', this.crouch);
  }

  down(e) {
    e.preventDefault();
    if (!this.enabled) return;
    const w = window.innerWidth;
    if (e.pointerType !== 'mouse' && e.clientX < w * 0.45 && this.joyId === null) {
      this.joyId = e.pointerId;
      const m = this.R + 14;
      this.joyCX = Math.max(m, Math.min(e.clientX, w * 0.45));
      this.joyCY = Math.max(m, Math.min(e.clientY, window.innerHeight - m));
      this.joyEl.style.transform = `translate(${this.joyCX}px, ${this.joyCY}px)`;
      this.joyEl.classList.add('active');
      this.updateJoy(e.clientX, e.clientY);
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookX = e.clientX; this.lookY = e.clientY;
    }
  }
  move(e) {
    if (e.pointerId === this.joyId) { e.preventDefault(); this.updateJoy(e.clientX, e.clientY); }
    else if (e.pointerId === this.lookId) {
      e.preventDefault();
      this.lookDX += e.clientX - this.lookX; this.lookDY += e.clientY - this.lookY;
      this.lookX = e.clientX; this.lookY = e.clientY;
    }
  }
  up(e) {
    if (e.pointerId === this.joyId) {
      this.joyId = null; this.moveX = 0; this.moveY = 0;
      this.joyEl.classList.remove('active');
      this.knobEl.style.transform = 'translate(-50%, -50%)';
    } else if (e.pointerId === this.lookId) this.lookId = null;
  }
  updateJoy(x, y) {
    let dx = x - this.joyCX, dy = y - this.joyCY;
    const d = Math.hypot(dx, dy);
    if (d > this.R) { dx *= this.R / d; dy *= this.R / d; }
    this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    let mx = dx / this.R, my = -dy / this.R;
    const m = Math.hypot(mx, my);
    if (m < 0.12) { mx = 0; my = 0; }
    else { const s = (m - 0.12) / 0.88 / m; mx *= s; my *= s; }
    this.moveX = mx; this.moveY = my;
  }

  // movement vector including keyboard fallback
  getMove() {
    let x = this.moveX, y = this.moveY;
    const k = this.keys;
    if (k.size) {
      if (k.has('w') || k.has('arrowup') || k.has('ц')) y += 1;
      if (k.has('s') || k.has('arrowdown') || k.has('ы')) y -= 1;
      if (k.has('a') || k.has('arrowleft') || k.has('ф')) x -= 1;
      if (k.has('d') || k.has('arrowright') || k.has('в')) x += 1;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
    }
    return [x, y];
  }
  runHeld() { return this.run || this.keys.has('shift'); }
  consume(name) { const v = this.edges[name]; this.edges[name] = false; return v; }
  takeLook() { const d = [this.lookDX, this.lookDY]; this.lookDX = 0; this.lookDY = 0; return d; }
  reset() {
    this.moveX = this.moveY = 0; this.lookDX = this.lookDY = 0;
    this.joyId = this.lookId = null; this.jumpHeld = this.climbHeld = false;
    this.edges.jump = this.edges.climb = this.edges.action = false;
    this.crouch = false; this.keys.clear();
    this.joyEl.classList.remove('active');
    this.sync();
  }
}
