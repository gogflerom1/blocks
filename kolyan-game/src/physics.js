// Axis-aligned box world: collisions, raycasts, ledge probes.
// Units: 1 unit = 10 cm in the "real" classroom. Kolyan is 1.8 units tall.

export const F_SOLID = 1;     // blocks player
export const F_SIGHT = 2;     // blocks monster line of sight
export const F_CAM = 4;       // blocks camera
export const F_MONSTER = 8;   // blocks monster navigation (footprint)

export class World {
  constructor() {
    this.boxes = []; // {x0,y0,z0,x1,y1,z1,f}
  }
  add(x0, y0, z0, x1, y1, z1, f = F_SOLID | F_SIGHT | F_CAM) {
    const b = { x0, y0, z0, x1, y1, z1, f };
    this.boxes.push(b);
    return b;
  }

  overlapsAny(x0, y0, z0, x1, y1, z1, mask = F_SOLID) {
    const bs = this.boxes;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!(b.f & mask)) continue;
      if (x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1 && z1 > b.z0 && z0 < b.z1) return b;
    }
    return null;
  }

  // Ray from (ox,oy,oz) with direction (dx,dy,dz) (not necessarily normalized), t in [0,maxT].
  raycast(ox, oy, oz, dx, dy, dz, maxT, mask) {
    let best = maxT;
    let hit = null;
    const bs = this.boxes;
    const ix = 1 / (dx || 1e-12), iy = 1 / (dy || 1e-12), iz = 1 / (dz || 1e-12);
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!(b.f & mask)) continue;
      let t1 = (b.x0 - ox) * ix, t2 = (b.x1 - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (b.y0 - oy) * iy; t2 = (b.y1 - oy) * iy;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax < tmin) continue;
      t1 = (b.z0 - oz) * iz; t2 = (b.z1 - oz) * iz;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax < tmin || tmax < 0) continue;
      const t = tmin < 0 ? 0 : tmin;
      if (t < best) { best = t; hit = b; }
    }
    return hit ? best : -1;
  }

  // Highest surface top directly under point (x,z) not above y.
  groundBelow(x, z, y) {
    let best = -Infinity;
    for (const b of this.boxes) {
      if (!(b.f & F_SOLID)) continue;
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.y1 <= y + 0.01 && b.y1 > best) best = b.y1;
    }
    return best;
  }
}

// Moves a body (feet-centered AABB) through the world, resolving per axis.
// body: {x,y,z,vx,vy,vz,hw,h,grounded}
const STEP = 0.55;
export function moveBody(world, body, dt) {
  const maxD = Math.max(Math.abs(body.vx), Math.abs(body.vy), Math.abs(body.vz)) * dt;
  const steps = Math.min(8, Math.max(1, Math.ceil(maxD / 0.25)));
  const sdt = dt / steps;
  body.grounded = false;
  body.hitWall = false;
  for (let s = 0; s < steps; s++) {
    axisMove(world, body, 0, body.vx * sdt);
    axisMove(world, body, 2, body.vz * sdt);
    axisMove(world, body, 1, body.vy * sdt);
  }
}

function axisMove(world, body, axis, d) {
  if (d === 0) return;
  const hw = body.hw, h = body.h;
  if (axis === 0) body.x += d; else if (axis === 1) body.y += d; else body.z += d;
  const bs = world.boxes;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (!(b.f & F_SOLID)) continue;
    const x0 = body.x - hw, x1 = body.x + hw, y0 = body.y, y1 = body.y + h, z0 = body.z - hw, z1 = body.z + hw;
    if (!(x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1 && z1 > b.z0 && z0 < b.z1)) continue;
    if (axis === 1) {
      if (d < 0) { body.y = b.y1; body.grounded = true; if (body.vy < 0) body.vy = 0; }
      else { body.y = b.y0 - h - 0.001; if (body.vy > 0) body.vy = 0; }
    } else {
      // try step up
      const rise = b.y1 - body.y;
      if (rise > 0 && rise <= STEP && (body.grounded || body.wasGrounded) &&
          !world.overlapsAny(x0, b.y1 + 0.001, z0, x1, b.y1 + h, z1)) {
        body.y = b.y1 + 0.001;
        continue;
      }
      if (axis === 0) body.x = d > 0 ? b.x0 - hw - 0.001 : b.x1 + hw + 0.001;
      else body.z = d > 0 ? b.z0 - hw - 0.001 : b.z1 + hw + 0.001;
      body.hitWall = true;
    }
  }
}

// Ledge probe: returns {y, x, z} target standing spot or null.
export function findLedge(world, body, dirX, dirZ, reach) {
  const len = Math.hypot(dirX, dirZ);
  if (len < 0.01) return null;
  dirX /= len; dirZ /= len;
  const hw = body.hw;
  const px = body.x + dirX * (hw + 0.4), pz = body.z + dirZ * (hw + 0.4);
  let top = -Infinity, box = null;
  // find the highest surface at probe column within reach
  for (const b of world.boxes) {
    if (!(b.f & F_SOLID)) continue;
    if (px <= b.x0 || px >= b.x1 || pz <= b.z0 || pz >= b.z1) continue;
    if (b.y1 <= body.y + 0.45) continue;            // too low, just walk
    if (b.y0 > body.y + reach + 0.1) continue;      // entirely above reach
    if (b.y1 > body.y + reach) return null;         // wall too tall at this column
    if (b.y1 > top) { top = b.y1; box = b; }
  }
  if (!box) return null;
  // target: step onto the surface, fully inside its footprint if possible
  let tx = body.x + dirX * (hw * 2 + 0.35), tz = body.z + dirZ * (hw * 2 + 0.35);
  tx = Math.min(Math.max(tx, box.x0 + hw + 0.02), box.x1 - hw - 0.02);
  tz = Math.min(Math.max(tz, box.z0 + hw + 0.02), box.z1 - hw - 0.02);
  if (box.x1 - box.x0 < hw * 2 + 0.04) tx = (box.x0 + box.x1) / 2;
  if (box.z1 - box.z0 < hw * 2 + 0.04) tz = (box.z0 + box.z1) / 2;
  const ty = top + 0.002;
  // needs head clearance (allow crouch height)
  if (world.overlapsAny(tx - hw, ty, tz - hw, tx + hw, ty + 1.1, tz + hw)) return null;
  // and clearance above the player's current column while rising
  if (world.overlapsAny(body.x - hw * 0.8, body.y + 0.6, body.z - hw * 0.8, body.x + hw * 0.8, ty + 1.0, body.z + hw * 0.8)) return null;
  return { x: tx, y: ty, z: tz };
}
