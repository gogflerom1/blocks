import { F_MONSTER } from './physics.js';

// 2D occupancy grid used by monsters (they are giants walking the aisles).
export class NavGrid {
  constructor(world, minX, minZ, maxX, maxZ, cell, radius) {
    this.minX = minX; this.minZ = minZ; this.cell = cell;
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = minX + (i + 0.5) * cell, z = minZ + (j + 0.5) * cell;
      let b = x < minX + radius || x > maxX - radius || z < minZ + radius || z > maxZ - radius;
      if (!b) for (const bx of world.boxes) {
        if (!(bx.f & F_MONSTER)) continue;
        if (x > bx.x0 - radius && x < bx.x1 + radius && z > bx.z0 - radius && z < bx.z1 + radius) { b = true; break; }
      }
      this.blocked[j * this.w + i] = b ? 1 : 0;
    }
    this.prev = new Int32Array(this.w * this.h);
    this.queue = new Int32Array(this.w * this.h);
    this.stamp = new Uint32Array(this.w * this.h);
    this.gen = 1;
  }
  ci(x) { return Math.min(this.w - 1, Math.max(0, Math.floor((x - this.minX) / this.cell))); }
  cj(z) { return Math.min(this.h - 1, Math.max(0, Math.floor((z - this.minZ) / this.cell))); }
  cx(i) { return this.minX + (i + 0.5) * this.cell; }
  cz(j) { return this.minZ + (j + 0.5) * this.cell; }
  free(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.blocked[j * this.w + i]; }
  freeAt(x, z) { return this.free(this.ci(x), this.cj(z)); }

  nearestFree(x, z, maxR = 12) {
    const i0 = this.ci(x), j0 = this.cj(z);
    if (this.free(i0, j0)) return [i0, j0];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || !this.free(i, j)) continue;
        const d = (this.cx(i) - x) ** 2 + (this.cz(j) - z) ** 2;
        if (d < bd) { bd = d; best = [i, j]; }
      }
      if (best) return best;
    }
    return null;
  }

  // BFS path (8-neighbour) from world pos to world pos. Returns array of [x,z] or null.
  path(sx, sz, tx, tz) {
    const s = this.nearestFree(sx, sz, 4), t = this.nearestFree(tx, tz, 14);
    if (!s || !t) return null;
    const W = this.w, gen = ++this.gen;
    const si = s[1] * W + s[0], ti = t[1] * W + t[0];
    let qh = 0, qt = 0;
    this.queue[qt++] = si; this.stamp[si] = gen; this.prev[si] = -1;
    let found = si === ti;
    while (qh < qt && !found) {
      const c = this.queue[qh++];
      const ci = c % W, cj = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const di = DI[k], dj = DJ[k];
        const ni = ci + di, nj = cj + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
        const n = nj * W + ni;
        if (this.stamp[n] === gen) continue;
        this.stamp[n] = gen; this.prev[n] = c; this.queue[qt++] = n;
        if (n === ti) { found = true; break; }
      }
    }
    if (!found) return null;
    const out = [];
    for (let c = ti; c !== -1; c = this.prev[c]) out.push([this.cx(c % W), this.cz((c / W) | 0)]);
    out.reverse();
    out[out.length - 1] = this.freeAt(tx, tz) ? [tx, tz] : out[out.length - 1];
    return out;
  }

  // straight walkable line check between two world points
  lineFree(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      if (!this.freeAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
    }
    return true;
  }
}
const DI = [1, -1, 0, 0, 1, 1, -1, -1];
const DJ = [0, 0, 1, -1, 1, -1, 1, -1];
