import * as THREE from 'three';
import { buildKolyan, optimize } from './characters.js';
import { moveBody, findLedge, F_SIGHT } from './physics.js';

const GRAV = 30, JUMP_V = 9.6, REACH = 2.5;
const SPEED = { walk: 4.2, run: 7.4, crouch: 2.3 };
const STAND_H = 1.8, CROUCH_H = 1.1;

export class Player {
  constructor(scene) {
    this.m = buildKolyan();
    optimize(this.m.root);
    scene.add(this.m.root);
    this.body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hw: 0.34, h: STAND_H, grounded: false, wasGrounded: false, hitWall: false };
    this.yaw = 0; this.phase = 0; this.coyote = 0; this.jumpBuf = 0;
    this.climb = null; this.landT = 0; this.hurtT = 0; this.invuln = 0;
    this.crouching = false; this.running = false; this.speedH = 0;
    this.ledge = null; this.stepT = 0; this.airTime = 0; this.peakVy = 0;
    this.covered = false; this.jumps = 0; this.climbs = 0; this.moved = 0;
    this.frozen = false;
  }
  get x() { return this.body.x; } get y() { return this.body.y; } get z() { return this.body.z; }

  reset(p) {
    Object.assign(this.body, { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, h: STAND_H });
    this.climb = null; this.crouching = false; this.hurtT = 0; this.landT = 0;
    if (p.yaw !== undefined) this.yaw = p.yaw;
    this.m.root.visible = true;
    this.m.root.scale.setScalar(1);
    this.sync(0);
  }

  update(dt, input, camYaw, world, game, autoRun) {
    const b = this.body;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.landT = Math.max(0, this.landT - dt);
    if (this.frozen) { this.sync(dt); return; }

    if (this.climb) { this.updateClimb(dt); this.sync(dt); return; }

    // --- input relative to camera
    const [jx, jy] = input.getMove();
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let mx = fx * jy + rx * jx, mz = fz * jy + rz * jx;
    const mag = Math.min(1, Math.hypot(mx, mz));
    if (mag > 0.001) { const l = Math.hypot(mx, mz); mx /= l; mz /= l; }

    // --- crouch with headroom check
    const wantCrouch = input.crouch;
    if (wantCrouch && !this.crouching) { this.crouching = true; b.h = CROUCH_H; }
    else if (!wantCrouch && this.crouching) {
      if (!world.overlapsAny(b.x - b.hw, b.y + 0.05, b.z - b.hw, b.x + b.hw, b.y + STAND_H, b.z + b.hw)) { this.crouching = false; b.h = STAND_H; }
    }

    this.running = !this.crouching && (input.runHeld() || (autoRun && mag > 0.92));
    const top = this.crouching ? SPEED.crouch : this.running ? SPEED.run : SPEED.walk;
    const tvx = mx * mag * top, tvz = mz * mag * top;
    const acc = b.grounded ? 38 : 12;
    const k = 1 - Math.exp(-acc * dt / 4);
    b.vx += (tvx - b.vx) * k; b.vz += (tvz - b.vz) * k;
    if (this.hurtT > 0) { b.vx *= 0.9; b.vz *= 0.9; }

    // --- ledge availability (for button label + climb)
    const dirX = mag > 0.2 ? mx : Math.sin(this.yaw), dirZ = mag > 0.2 ? mz : Math.cos(this.yaw);
    this.ledge = findLedgeMulti(world, b, dirX, dirZ);

    // --- jump / climb
    if (b.grounded) this.coyote = 0.12; else this.coyote -= dt;
    if (input.consume('jump')) this.jumpBuf = 0.14; else this.jumpBuf -= dt;
    const climbPress = input.consume('climb');
    if ((climbPress || (this.jumpBuf > 0 && b.grounded)) && this.ledge && (b.grounded || climbPress)) {
      this.startClimb(this.ledge, game); this.jumpBuf = 0; this.sync(dt); return;
    }
    if (this.jumpBuf > 0 && this.coyote > 0 && !this.crouching) {
      b.vy = JUMP_V; this.coyote = 0; this.jumpBuf = 0; this.jumps++;
      game.sfx('jump');
    }
    if (!b.grounded && this.ledge && (mag > 0.3 || input.climbHeld || input.jumpHeld) && b.vy < 8) {
      this.startClimb(this.ledge, game); this.sync(dt); return;
    }

    // --- physics
    b.vy = Math.max(-38, b.vy - GRAV * dt);
    const prevVy = b.vy;
    b.wasGrounded = b.grounded;
    const ox = b.x, oz = b.z;
    moveBody(world, b, dt);
    this.moved += Math.hypot(b.x - ox, b.z - oz);
    if (!b.grounded) { this.airTime += dt; this.peakVy = Math.min(this.peakVy, prevVy); }
    if (b.grounded && !b.wasGrounded) {
      const impact = -this.peakVy;
      if (this.airTime > 0.25) {
        this.landT = Math.min(0.3, impact / 60);
        game.sfx(impact > 16 ? 'landHard' : 'land');
        if (impact > 16) game.noise(b.x, b.y, b.z, 22);
        else if (impact > 9) game.noise(b.x, b.y, b.z, 9);
      }
      this.airTime = 0; this.peakVy = 0;
    }

    // --- facing
    this.speedH = Math.hypot(b.vx, b.vz);
    if (mag > 0.1) {
      const target = Math.atan2(mx, mz);
      let d = target - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 14);
    }

    // --- footsteps / noise
    if (b.grounded && this.speedH > 1) {
      this.stepT -= dt * this.speedH;
      if (this.stepT <= 0) {
        this.stepT = 2.6;
        game.sfx('step', this.running ? 1 : 0.5);
        if (this.running) game.noise(b.x, b.y, b.z, 13);
        else if (!this.crouching) game.noise(b.x, b.y, b.z, 4);
      }
    }

    // --- covered (something solid right above): hiding under desks / chairs
    this.covered = world.raycast(b.x, b.y + b.h + 0.05, b.z, 0, 1, 0, 6.5, F_SIGHT) >= 0;

    if (b.y < -10) game.fellOut();
    this.sync(dt);
  }

  startClimb(l, game) {
    const b = this.body;
    this.climb = { t: 0, sx: b.x, sy: b.y, sz: b.z, tx: l.x, ty: l.y, tz: l.z, dur: 0.32 + Math.min(0.35, (l.y - b.y) * 0.12) };
    b.vx = b.vy = b.vz = 0;
    this.yaw = Math.atan2(l.x - b.x, l.z - b.z);
    this.climbs++;
    game.sfx('climb');
  }
  updateClimb(dt) {
    const c = this.climb, b = this.body;
    c.t += dt;
    const u = Math.min(1, c.t / c.dur);
    const up = Math.min(1, u / 0.65), fw = Math.max(0, (u - 0.5) / 0.5);
    const e = t => t * t * (3 - 2 * t);
    b.y = c.sy + (c.ty - c.sy) * e(up);
    b.x = c.sx + (c.tx - c.sx) * e(fw);
    b.z = c.sz + (c.tz - c.sz) * e(fw);
    if (u >= 1) {
      this.climb = null; b.grounded = true; b.vy = 0;
      if (this.crouching) b.h = CROUCH_H;
      else if (b.h !== STAND_H) b.h = STAND_H;
    }
  }

  hurt(fromX, fromZ) {
    this.hurtT = 0.5; this.invuln = 2.5;
  }

  // ------------------------------------------------------------ animation
  sync(dt) {
    const m = this.m, b = this.body;
    m.root.position.set(b.x, b.y, b.z);
    m.root.rotation.y = this.yaw;
    const sp = Math.min(1, this.speedH / SPEED.run);
    const air = !b.grounded && !this.climb;
    this.phase += dt * (4 + this.speedH * 1.6) * (b.grounded ? 1 : 0.3);
    const s = Math.sin(this.phase);
    const t = performance.now() / 1000;
    let legA = 0, armA = 0, bob = 0, lean = 0, armSpread = 0, crouchY = 0, armUp = 0, kneel = 0;
    if (this.climb) {
      const u = this.climb.t / this.climb.dur;
      armUp = 2.9 - u * 1.6; legA = Math.sin(u * 9) * 0.6; lean = 0.25;
    } else if (air) {
      if (b.vy > 0) { legA = 0.5; armUp = 2.2; armSpread = 0.2; }
      else { legA = 0.2; armUp = 2.6; armSpread = 0.6; }
    } else if (this.speedH > 0.3) {
      legA = s * (0.35 + sp * 0.6); armA = -s * (0.3 + sp * 0.7);
      bob = Math.abs(Math.cos(this.phase)) * 0.06 * (0.5 + sp);
      lean = sp * 0.22;
    } else {
      bob = Math.sin(t * 2) * 0.012; armSpread = 0.05;
    }
    if (this.crouching && !this.climb) { crouchY = -0.42; kneel = 0.9; lean += 0.35; }
    const land = this.landT > 0 ? this.landT * 1.2 : 0;
    m.body.position.y = bob + crouchY - land * 0.3;
    m.torso.rotation.x = lean + land * 0.5;
    if (this.hurtT > 0) m.torso.rotation.x = -0.4 + Math.sin(t * 40) * 0.1;
    m.legs[0].rotation.x = -legA - kneel; m.legs[1].rotation.x = legA - kneel * 0.6;
    if (air) { m.legs[0].rotation.x = -legA; m.legs[1].rotation.x = legA * 0.3; }
    m.arms[0].rotation.x = armA - armUp; m.arms[1].rotation.x = -armA - armUp;
    m.arms[0].rotation.z = -armSpread - 0.08; m.arms[1].rotation.z = armSpread + 0.08;
    m.head.rotation.x = -lean * 0.5;
    m.root.visible = this.invuln > 0 && !this.frozen ? Math.floor(t * 12) % 2 === 0 : true;
  }
}

// probe a few distances so the player does not have to be pixel-perfect
function findLedgeMulti(world, b, dx, dz) {
  // negative offsets: the player is already slightly under the edge (head bumped) — still allow the grab
  for (const extra of [0, 0.35, 0.75, -0.45, -0.9]) {
    const px = b.x + dx * extra, pz = b.z + dz * extra;
    const l = findLedge(world, { x: px, y: b.y, z: pz, hw: b.hw }, dx, dz, REACH);
    if (l) {
      const cx = extra < 0 ? px : b.x, cz = extra < 0 ? pz : b.z;
      if (world.overlapsAny(cx - b.hw * 0.8, b.y + 0.6, cz - b.hw * 0.8, cx + b.hw * 0.8, l.y + 1.0, cz + b.hw * 0.8)) continue;
      return l;
    }
  }
  return null;
}
