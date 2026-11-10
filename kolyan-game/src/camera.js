import * as THREE from 'three';
import { F_CAM } from './physics.js';

export class FollowCam {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0; this.pitch = 0.32;
    this.dist = 5.4; this.cur = 5.4;
    this.target = new THREE.Vector3();
    this.inited = false;
  }
  snap(player) {
    this.target.set(player.x, player.y + 1.4, player.z);
    this.cur = this.dist; this.inited = true;
  }
  update(dt, player, world, look, sens, invertY) {
    this.yaw -= look[0] * 0.0055 * sens;
    this.pitch += look[1] * 0.0045 * sens * (invertY ? -1 : 1);
    this.pitch = Math.max(-0.5, Math.min(1.25, this.pitch));

    const h = player.crouching ? 0.95 : 1.45;
    const k = 1 - Math.exp(-14 * dt), ky = 1 - Math.exp(-9 * dt);
    if (!this.inited) this.snap(player);
    this.target.x += (player.x - this.target.x) * k;
    this.target.z += (player.z - this.target.z) * k;
    this.target.y += (player.y + h - this.target.y) * ky;

    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;
    // collision: cast from target outward plus two side rays for a fat probe
    let want = this.dist;
    const t0 = world.raycast(this.target.x, this.target.y, this.target.z, dx, dy, dz, this.dist + 0.3, F_CAM);
    if (t0 >= 0) want = Math.min(want, t0 - 0.3);
    for (const off of [-0.25, 0.25]) {
      const ox = Math.cos(this.yaw) * off, oz = -Math.sin(this.yaw) * off;
      const t = world.raycast(this.target.x + ox, this.target.y, this.target.z + oz, dx, dy, dz, this.dist + 0.3, F_CAM);
      if (t >= 0) want = Math.min(want, t - 0.25);
    }
    want = Math.max(0.55, want);
    if (want < this.cur) this.cur += (want - this.cur) * (1 - Math.exp(-30 * dt));
    else this.cur += (want - this.cur) * (1 - Math.exp(-3 * dt));
    const x = this.target.x + dx * this.cur;
    const y = Math.max(0.25, this.target.y + dy * this.cur);
    const z = this.target.z + dz * this.cur;
    this.cam.position.set(x, y, z);
    this.cam.lookAt(this.target.x, this.target.y + 0.15, this.target.z);
  }
}
