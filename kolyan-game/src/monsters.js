import * as THREE from 'three';
import { buildProfessor, buildWatcher, buildPig, optimize } from './characters.js';
import { F_SIGHT } from './physics.js';
import { iconSprite } from './textures.js';

const DEG = Math.PI / 180;
export const TYPES = {
  professor: {
    name: 'THE PROFESSOR', build: buildProfessor, scale: 9.6, patrol: 3.1, chase: 5.7, search: 3.8,
    view: 36, fov: 110 * DEG, rate: 1.15, deskMult: 0.6, hear: 0.8, lose: 3.0, turn: 3.2, reach: 4.4, jitter: 0,
    route: [[-10, 40, 1.5], [-10, 12, 0], [-10, -26, 2], [10, -26, 0], [10, 12, 0], [10, 40, 1.5]],
  },
  watcher: {
    name: 'THE WATCHER', build: buildWatcher, scale: 9.4, patrol: 4.4, chase: 7.8, search: 5.5,
    view: 32, fov: 150 * DEG, rate: 1.6, deskMult: 1.45, hear: 1.0, lose: 1.5, turn: 9, reach: 4.6, jitter: 1,
    route: [[-44, 40, 1.2], [-44, 20, 0.6], [-44, 2, 1.5], [-44, -27, 1], [-24, -28, 1.5], [-44, -27, 0.5], [-44, 8, 0.8]],
  },
  pig: {
    name: 'THE PIG QUEEN', build: buildPig, scale: 9.6, patrol: 2.3, chase: 4.6, search: 3.0,
    view: 22, fov: 100 * DEG, rate: 0.9, deskMult: 0.35, hear: 1.7, lose: 3.5, turn: 2.2, reach: 4.6, jitter: 0,
    route: [[-32, -30, 2], [-4, -29, 1], [13, -31, 4], [42, -31, 2], [44, -10, 2], [42, -31, 0.5], [13, -31, 4], [-4, -29, 1]],
  },
};

const ICON_Q = iconSprite('?', '#ffd23f');
const ICON_E = iconSprite('!', '#ff3b3b');

export class Monster {
  constructor(type, scene, nav) {
    this.type = type; this.cfg = TYPES[type]; this.nav = nav;
    this.m = this.cfg.build();
    optimize(this.m.root);
    this.m.root.scale.setScalar(this.cfg.scale);
    scene.add(this.m.root);
    this.eyeY = this.m.height * this.cfg.scale * 0.88;
    this.icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICON_Q, depthTest: false, transparent: true }));
    this.icon.scale.set(2.6, 2.6, 1);
    this.icon.renderOrder = 10;
    scene.add(this.icon);
    this.reset();
  }
  reset() {
    const r = this.cfg.route[0];
    this.x = r[0]; this.z = r[1]; this.yaw = Math.PI;
    this.state = 'patrol'; this.ri = 1; this.wait = 0; this.path = null; this.pi = 0; this.repath = 0;
    this.sus = 0; this.lastX = this.x; this.lastZ = this.z; this.stateT = 0; this.seen = false; this.lostT = 0;
    this.speed = 0; this.phase = Math.random() * 6; this.senseT = Math.random() * 0.1; this.vis = 0;
    this.twitchT = 0; this.headYaw = 0; this.searchPts = null; this.cool = 0;
    this.setPath(this.cfg.route[1][0], this.cfg.route[1][1]);
    this.sync(0);
  }
  setState(s) {
    if (this.state === s) return;
    this.state = s; this.stateT = 0; this.path = null; this.repath = 0;
  }
  setPath(tx, tz) {
    this.path = this.nav.path(this.x, this.z, tx, tz);
    this.pi = this.path && this.path.length > 1 ? 1 : 0;
    this.goalX = tx; this.goalZ = tz;
  }

  // returns true when the end of the path is reached
  follow(dt, speed) {
    if (!this.path || this.pi >= this.path.length) { this.speed = 0; return true; }
    // look ahead for a straight shot
    for (let k = Math.min(this.path.length - 1, this.pi + 5); k > this.pi; k--) {
      if (this.nav.lineFree(this.x, this.z, this.path[k][0], this.path[k][1])) { this.pi = k; break; }
    }
    const [tx, tz] = this.path[this.pi];
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { this.pi++; if (this.pi >= this.path.length) { this.speed = 0; return true; } return false; }
    const want = Math.atan2(dx, dz);
    let a = want - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
    this.yaw += Math.sign(a) * Math.min(Math.abs(a), this.cfg.turn * dt);
    const align = Math.max(0.15, Math.cos(a));
    const v = speed * align;
    this.x += dx / d * Math.min(d, v * dt);
    this.z += dz / d * Math.min(d, v * dt);
    this.speed = v;
    return false;
  }
  faceTo(tx, tz, dt, rate = this.cfg.turn) {
    const want = Math.atan2(tx - this.x, tz - this.z);
    let a = want - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
    this.yaw += Math.sign(a) * Math.min(Math.abs(a), rate * dt);
    return Math.abs(a);
  }

  // perception: 0..1 how well the player is seen this instant
  sense(player, world) {
    const c = this.cfg;
    const px = player.x, py = player.y, pz = player.z;
    const dx = px - this.x, dz = pz - this.z;
    const dh = Math.hypot(dx, dz);
    if (dh > c.view) return 0;
    const fwdX = Math.sin(this.yaw + this.headYaw), fwdZ = Math.cos(this.yaw + this.headYaw);
    const cos = (dx * fwdX + dz * fwdZ) / (dh || 1);
    if (dh > 4 && cos < Math.cos(c.fov / 2)) return 0;
    if (player.covered && (player.crouching || player.y < 1)) return 0;
    const ey = this.eyeY;
    let visible = false;
    for (const hy of [player.crouching ? 0.6 : 1.0, player.crouching ? 1.0 : 1.7]) {
      const tx = px - this.x, ty = py + hy - ey, tz = pz - this.z;
      const L = Math.hypot(tx, ty, tz);
      const t = world.raycast(this.x, ey, this.z, tx / L, ty / L, tz / L, L - 0.2, F_SIGHT);
      if (t < 0) { visible = true; break; }
    }
    if (!visible) return 0;
    let f = 0.35 + 0.65 * (1 - dh / c.view);
    if (py > 5) f *= c.deskMult;
    if (player.crouching) f *= 0.45;
    if (player.running) f *= 1.3;
    if (player.covered) f *= 0.25;
    if (dh < 6) f *= 1.8;
    return f;
  }

  hearNoise(x, z, radius) {
    if (this.state === 'chase') return;
    const d = Math.hypot(x - this.x, z - this.z);
    if (d > radius * this.cfg.hear) return;
    this.lastX = x; this.lastZ = z;
    this.sus = Math.max(this.sus, 0.45);
    this.setState('suspicious');
  }

  update(dt, player, world, game, active) {
    const c = this.cfg;
    this.stateT += dt;
    this.cool = Math.max(0, this.cool - dt);
    // perception at ~15 Hz
    this.senseT -= dt;
    if (this.senseT <= 0) {
      this.senseT = 0.066;
      this.vis = active && player.invuln <= 0 && this.cool <= 0 ? this.sense(player, world) : 0;
    }
    const seeing = this.vis > 0;
    if (seeing) { this.lastX = player.x; this.lastZ = player.z; this.lostT = 0; }
    else this.lostT += dt;
    if (seeing) this.sus = Math.min(1, this.sus + this.vis * c.rate * dt * (this.state === 'search' ? 2 : 1));
    else if (this.state !== 'chase') this.sus = Math.max(0, this.sus - dt * 0.18);

    if (c.jitter) { // nervous head twitches
      this.twitchT -= dt;
      if (this.twitchT <= 0) { this.twitchT = 0.4 + Math.random() * 1.3; this.headTarget = (Math.random() - 0.5) * 1.6; }
      this.headYaw += ((this.headTarget || 0) - this.headYaw) * Math.min(1, dt * 12);
    } else this.headYaw *= 0.9;

    switch (this.state) {
      case 'patrol': {
        if (this.wait > 0) { this.wait -= dt; this.speed = 0; }
        else {
          const r = c.route[this.ri];
          if (!this.path) this.setPath(r[0], r[1]);
          const sp = c.patrol * (c.jitter ? (0.6 + 0.7 * Math.abs(Math.sin(this.stateT * 2.3))) : 1);
          if (this.follow(dt, sp)) { this.wait = r[2]; this.ri = (this.ri + 1) % c.route.length; this.path = null; }
        }
        if (this.sus > 0.3) this.setState('suspicious');
        break;
      }
      case 'suspicious': {
        if (this.stateT < 0.7) { this.faceTo(this.lastX, this.lastZ, dt); this.speed = 0; }
        else {
          this.repath -= dt;
          if (this.repath <= 0 || !this.path) { this.setPath(this.lastX, this.lastZ); this.repath = 0.6; }
          if (this.follow(dt, c.patrol * 0.8) && !seeing) this.setState('search');
        }
        if (this.sus >= 1) { this.setState('chase'); game.onAlert(this); }
        else if (this.sus <= 0 && this.stateT > 2) this.setState('search');
        break;
      }
      case 'chase': {
        this.repath -= dt;
        const tx = seeing ? player.x : this.lastX, tz = seeing ? player.z : this.lastZ;
        if (this.repath <= 0 || !this.path) { this.setPath(tx, tz); this.repath = 0.3; }
        const done = this.follow(dt, c.chase);
        if (done && seeing) this.faceTo(player.x, player.z, dt, c.turn * 2);
        // grab
        const dh = Math.hypot(player.x - this.x, player.z - this.z);
        if (seeing && dh < c.reach && player.y < 11.5 && player.invuln <= 0) {
          game.caught(this);
          this.cool = 3; this.sus = 0; this.setState('return');
          break;
        }
        if (this.lostT > c.lose) { this.sus = 0.6; this.setState('search'); }
        break;
      }
      case 'search': {
        if (!this.searchPts) {
          this.searchPts = [[this.lastX, this.lastZ]];
          for (let i = 0; i < 2; i++) this.searchPts.push([this.lastX + (Math.random() - 0.5) * 16, this.lastZ + (Math.random() - 0.5) * 16]);
          this.searchI = 0; this.lookT = 0;
        }
        if (this.lookT > 0) {
          this.lookT -= dt; this.speed = 0;
          this.yaw += Math.sin(this.stateT * 2.2) * dt * 1.6;
        } else {
          const p = this.searchPts[this.searchI];
          if (!this.path) this.setPath(p[0], p[1]);
          if (this.follow(dt, c.search)) { this.path = null; this.lookT = 1.4; this.searchI++; }
          if (this.searchI >= this.searchPts.length) { this.searchPts = null; this.setState('return'); }
        }
        if (this.sus >= 1) { this.searchPts = null; this.setState('chase'); game.onAlert(this); }
        else if (this.stateT > 9) { this.searchPts = null; this.setState('return'); }
        break;
      }
      case 'return': {
        if (!this.path) {
          let best = 0, bd = Infinity;
          c.route.forEach((r, i) => { const d = Math.hypot(r[0] - this.x, r[1] - this.z); if (d < bd) { bd = d; best = i; } });
          this.ri = best; this.setPath(c.route[best][0], c.route[best][1]);
        }
        if (this.follow(dt, c.patrol)) { this.setState('patrol'); this.path = null; }
        if (this.sus > 0.3) this.setState('suspicious');
        break;
      }
    }
    this.sync(dt);
  }

  sync(dt) {
    const m = this.m, c = this.cfg;
    m.root.position.set(this.x, 0, this.z);
    m.root.rotation.y = this.yaw;
    const sp = this.speed;
    this.phase += dt * (1.2 + sp * 0.55);
    const s = Math.sin(this.phase);
    const amp = Math.min(0.75, sp * 0.13);
    m.legs[0].rotation.x = s * amp; m.legs[1].rotation.x = -s * amp;
    m.arms[0].rotation.x = -s * amp * 0.8; m.arms[1].rotation.x = s * amp * 0.8;
    m.body.position.y = Math.abs(Math.cos(this.phase)) * 0.02 * Math.min(1, sp);
    if (this.type === 'pig') m.body.rotation.z = s * 0.06 * Math.min(1, sp + 0.2);
    if (this.type === 'professor' && this.state === 'chase') { m.arms[0].rotation.x = -1.3 + s * 0.2; m.arms[1].rotation.x = -1.3 - s * 0.2; }
    if (this.type === 'watcher') m.head.rotation.y = this.headYaw;
    else m.head.rotation.y = Math.sin(this.phase * 0.3) * 0.15 * (this.state === 'search' ? 4 : 1);
    const hot = this.state === 'chase';
    m.eyes.emissive.set(hot ? '#ff1a1a' : this.state === 'suspicious' || this.state === 'search' ? '#ffb000' : '#000000');
    m.eyes.emissiveIntensity = hot ? 3 : 1.2;
    const show = this.state === 'suspicious' || this.state === 'search' || hot;
    this.icon.visible = show;
    if (show) {
      this.icon.material.map = hot ? ICON_E : ICON_Q;
      this.icon.position.set(this.x, this.m.height * c.scale + 2.2 + Math.sin(this.phase * 2) * 0.2, this.z);
    }
  }
}
