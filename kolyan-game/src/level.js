import * as THREE from 'three';
import { World, F_SOLID, F_SIGHT, F_CAM, F_MONSTER } from './physics.js';
import * as T from './textures.js';

// Room bounds (1 unit = 10 cm). Students face -Z (the chalkboard).
export const ROOM = { x0: -48, x1: 48, z0: -52, z1: 46, h: 32 };
const DESK_H = 7.5, DESK_W = 12, DESK_D = 6, TOP = 0.5;
const SEAT_Y = 4.55;
const FULL = F_SOLID | F_SIGHT | F_CAM;

const unitBox = new THREE.BoxGeometry(1, 1, 1);
unitBox.translate(0, 0.5, 0); // origin at bottom center
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 14);
unitCyl.translate(0, 0.5, 0);

const WHITE = new THREE.Color(1, 1, 1);
class Batcher {
  constructor() { this.groups = new Map(); }
  add(geo, material, m, color) {
    const key = geo.uuid + material.uuid;
    if (!this.groups.has(key)) this.groups.set(key, { geo, material, mats: [], colors: [] });
    const g = this.groups.get(key);
    g.mats.push(m.clone());
    g.colors.push(color ? new THREE.Color(color) : null);
  }
  build(scene) {
    for (const g of this.groups.values()) {
      const im = new THREE.InstancedMesh(g.geo, g.material, g.mats.length);
      const hasColor = g.colors.some(Boolean);
      g.mats.forEach((m, i) => {
        im.setMatrixAt(i, m);
        if (hasColor) im.setColorAt(i, g.colors[i] || WHITE);
      });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      scene.add(im);
    }
  }
}

export function buildLevel(scene) {
  const world = new World();
  const B = new Batcher();
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3(), S = new THREE.Vector3();

  const woodTex = T.woodTexture();
  const mats = {
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, color: '#e8d2ae' }),
    metal: new THREE.MeshStandardMaterial({ color: '#9da3aa', roughness: 0.35, metalness: 0.65 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.4, metalness: 0.6 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#1f2024', roughness: 0.95 }),
    plastic: new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.5 }),
    prop: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.6 }),
    radiator: new THREE.MeshStandardMaterial({ color: '#e9e9e4', roughness: 0.5 }),
    podium: new THREE.MeshStandardMaterial({ map: woodTex, color: '#d8a070', roughness: 0.55 }),
  };

  // visual + collision box, bottom-anchored
  function box(cx, y0, cz, sx, sy, sz, material, flags = FULL, color, rotY = 0) {
    Q.setFromAxisAngle(V.set(0, 1, 0), rotY);
    M.compose(V.set(cx, y0, cz), Q, S.set(sx, sy, sz));
    if (material) B.add(unitBox, material, M, color);
    if (flags) world.add(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2, flags);
  }
  function cyl(cx, y0, cz, r, h, material, color) {
    M.compose(V.set(cx, y0, cz), Q.identity(), S.set(r, h, r));
    B.add(unitCyl, material, M, color);
  }
  function lyingCyl(cx, cy, cz, r, len, axis, material, color) { // axis: 'x' | 'z'
    Q.setFromAxisAngle(axis === 'x' ? V.set(0, 0, 1) : V.set(1, 0, 0), Math.PI / 2);
    M.compose(new THREE.Vector3(cx + (axis === 'x' ? len / 2 : 0), cy, cz - (axis === 'z' ? len / 2 : 0)), Q, S.set(r, len, r));
    B.add(unitCyl, material, M, color);
  }
  const block = (x0, z0, x1, z1, y1 = 10) => world.add(x0, 0, z0, x1, y1, z1, F_MONSTER);

  // ------------------------------------------------------------ room shell
  const floorMat = new THREE.MeshStandardMaterial({ map: T.floorTexture(), roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((ROOM.x0 + ROOM.x1) / 2, 0, (ROOM.z0 + ROOM.z1) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  world.add(ROOM.x0 - 5, -2, ROOM.z0 - 5, ROOM.x1 + 5, 0, ROOM.z1 + 5, FULL);

  const wallTex = T.wallTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
  const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, H = ROOM.h;
  const wallDefs = [
    [0, (ROOM.z0 + ROOM.z1) / 2, W, D, ROOM.x0, 'x'], // handled below
  ];
  void wallDefs;
  const walls = [
    { w: W, pos: [0, H / 2, ROOM.z0], rot: 0 },
    { w: W, pos: [0, H / 2, ROOM.z1], rot: Math.PI },
    { w: D, pos: [ROOM.x0, H / 2, (ROOM.z0 + ROOM.z1) / 2], rot: Math.PI / 2 },
    { w: D, pos: [ROOM.x1, H / 2, (ROOM.z0 + ROOM.z1) / 2], rot: -Math.PI / 2 },
  ];
  for (const wd of walls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wd.w, H), wallMat);
    m.position.set(...wd.pos); m.rotation.y = wd.rot; m.receiveShadow = true;
    scene.add(m);
  }
  const wallF = F_SOLID | F_SIGHT | F_CAM | F_MONSTER;
  world.add(ROOM.x0 - 4, 0, ROOM.z0 - 4, ROOM.x1 + 4, 60, ROOM.z0, wallF);
  world.add(ROOM.x0 - 4, 0, ROOM.z1, ROOM.x1 + 4, 60, ROOM.z1 + 4, wallF);
  world.add(ROOM.x0 - 4, 0, ROOM.z0, ROOM.x0, 60, ROOM.z1, wallF);
  world.add(ROOM.x1, 0, ROOM.z0, ROOM.x1 + 4, 60, ROOM.z1, wallF);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, (ROOM.z0 + ROOM.z1) / 2);
  scene.add(ceil);
  // skirting
  box(0, 0, ROOM.z1 - 0.15, W, 0.8, 0.3, mats.plastic, 0, '#000');
  box(ROOM.x1 - 0.15, 0, (ROOM.z0 + ROOM.z1) / 2, 0.3, 0.8, D, mats.plastic, 0);

  // ceiling lights (emissive, no real lights)
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff7e8', emissiveIntensity: 1.4 });
  for (const lx of [-24, 0, 24]) for (const lz of [-36, -8, 20]) {
    M.compose(V.set(lx, H - 0.3, lz), Q.identity(), S.set(2.2, 0.3, 18));
    B.add(unitBox, lampMat, M);
  }

  // ------------------------------------------------------------ front wall: chalkboard + screen
  const board = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), new THREE.MeshStandardMaterial({ map: T.chalkboardTexture(), roughness: 0.9 }));
  board.position.set(0, 13.5, ROOM.z0 + 0.35); scene.add(board);
  box(0, 7.2, ROOM.z0 + 0.15, 37, 13, 0.3, mats.metal, 0);
  box(0, 7.0, ROOM.z0 + 0.6, 36, 0.3, 1.0, mats.metal, F_SOLID | F_CAM); // chalk tray
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ map: T.screenTexture(), emissive: '#ffffff', emissiveMap: T.screenTexture(), emissiveIntensity: 0.55, roughness: 0.3 }));
  screen.position.set(0, 25.5, ROOM.z0 + 0.62); scene.add(screen);
  box(0, 20.6, ROOM.z0 + 0.3, 16.8, 9.8, 0.6, mats.plastic, 0);

  // ------------------------------------------------------------ window wall with blinds + radiators
  const winMat = new THREE.MeshStandardMaterial({ map: T.windowTexture(), emissive: '#e8f2ff', emissiveIntensity: 0.9 });
  const slatMat = new THREE.MeshStandardMaterial({ color: '#f6f6f2', roughness: 0.8, side: THREE.DoubleSide });
  const slatGeo = new THREE.PlaneGeometry(0.95, 1);
  slatGeo.translate(0, 0.5, 0);
  for (const [za, zb] of [[-42, -24], [-14, 4], [14, 32]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(zb - za, 18), winMat);
    win.rotation.y = Math.PI / 2; win.position.set(ROOM.x0 + 0.05, 18, (za + zb) / 2);
    scene.add(win);
    for (let z = za + 0.5; z < zb; z += 1.0) {
      Q.setFromAxisAngle(V.set(0, 1, 0), Math.PI / 2 + 0.55);
      M.compose(V.set(ROOM.x0 + 0.9, 9.5, z), Q, S.set(1, 18, 1));
      B.add(slatGeo, slatMat, M);
    }
    box(ROOM.x0 + 0.4, 27.5, (za + zb) / 2, 0.8, 0.5, zb - za + 1, mats.white, 0);
    // radiator (climbable, blocks monsters)
    box(ROOM.x0 + 0.9, 1.5, (za + zb) / 2, 1.2, 5.5, (zb - za) * 0.7, mats.radiator, F_SOLID | F_CAM | F_MONSTER);
    for (let z = za + 3; z < zb - 3; z += 0.7) box(ROOM.x0 + 1.55, 1.7, z, 0.12, 5.1, 0.12, mats.radiator, 0);
    box(ROOM.x0 + 1.0, 8.7, (za + zb) / 2, 2.0, 0.4, zb - za + 1, mats.white, F_SOLID | F_CAM); // sill
  }

  // ------------------------------------------------------------ door (right wall, front)
  box(ROOM.x1 - 0.2, 0, -41, 0.4, 22, 11, mats.white, 0);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 18), new THREE.MeshStandardMaterial({ color: '#cfe0ea', emissive: '#b8cfdc', emissiveIntensity: 0.4, roughness: 0.1 }));
  for (const gz of [-43.5, -38.5]) {
    const g = glass.clone(); g.rotation.y = -Math.PI / 2; g.position.set(ROOM.x1 - 0.45, 11.5, gz); scene.add(g);
  }

  // ------------------------------------------------------------ furniture helpers
  function desk(cx, cz) {
    box(cx, DESK_H - TOP, cz, DESK_W, TOP, DESK_D, mats.wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      box(cx + sx * (DESK_W / 2 - 0.45), 0, cz + sz * (DESK_D / 2 - 0.4), 0.45, DESK_H - TOP, 0.45, mats.metal, F_SOLID | F_SIGHT);
    for (const sx of [-1, 1]) box(cx + sx * (DESK_W / 2 - 0.45), 0.9, cz, 0.3, 0.3, DESK_D - 0.8, mats.metal, F_SOLID);
    box(cx, DESK_H - TOP - 0.6, cz - DESK_D / 2 + 0.4, DESK_W - 1.2, 0.6, 0.15, mats.metal, F_SOLID | F_SIGHT);
    block(cx - DESK_W / 2, cz - DESK_D / 2, cx + DESK_W / 2, cz + DESK_D / 2);
  }
  // office chair, facing -Z unless face = 1 (+Z). (cx,cz) = seat center.
  function chair(cx, cz, red = false, face = -1) {
    const fab = red ? '#6b2230' : null;
    const seatMat = red ? mats.prop : mats.fabric;
    box(cx, SEAT_Y - 0.55, cz, 4.4, 0.55, 4.2, seatMat, FULL, fab);
    box(cx, SEAT_Y + 0.35, cz - face * 2.05, 4.2, 5.6, 0.5, seatMat, FULL, fab);
    box(cx, SEAT_Y - 0.2, cz - face * 1.75, 0.5, 0.6, 0.3, mats.darkMetal, 0);
    box(cx, 0.6, cz, 0.6, SEAT_Y - 1.15, 0.6, null, F_SOLID);
    cyl(cx, 0.6, cz, 0.28, SEAT_Y - 1.1, mats.metal);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3;
      Q.setFromAxisAngle(V.set(0, 1, 0), a);
      M.compose(new THREE.Vector3(cx + Math.sin(a) * 1.0, 0.25, cz + Math.cos(a) * 1.0), Q, S.set(0.4, 0.3, 2.1));
      B.add(unitBox, mats.plastic, M);
      cyl(cx + Math.sin(a) * 2.0, 0, cz + Math.cos(a) * 2.0, 0.22, 0.3, mats.plastic);
    }
    box(cx, 0.1, cz, 3.6, 0.35, 0.45, null, F_SOLID);
    box(cx, 0.1, cz, 0.45, 0.35, 3.6, null, F_SOLID);
    block(cx - 2.2, cz - 2.1 - (face < 0 ? 0 : 0.3), cx + 2.2, cz + 2.1 + (face < 0 ? 0.3 : 0));
  }
  function stack(cx, y0, cz, books, flags = FULL) { // books: [w,h,d,color]
    let y = y0;
    books.forEach(([w, h, d, c], i) => {
      const ox = (i % 2 ? 0.08 : -0.06), oz = (i % 3 ? -0.05 : 0.07);
      box(cx + ox, y, cz + oz, w, h, d, mats.prop, flags, c);
      box(cx + ox + 0.04, y + 0.04, cz + oz, w - 0.04, h - 0.08, d + 0.02, mats.white, 0); // page edge
      y += h;
    });
    return y;
  }
  function backpack(cx, cz, color, h = 2.4) {
    box(cx, 0, cz, 3.0, h, 1.8, mats.prop, FULL, color);
    box(cx, 0.35, cz + 0.95, 2.2, h * 0.5, 0.25, mats.prop, 0, color);
    box(cx, h, cz, 1.0, 0.3, 0.2, mats.plastic, 0);
  }
  function pen(cx, y, cz, len, axis, color) { lyingCyl(cx, y + 0.06, cz, 0.06, len, axis, mats.prop, color); }

  // ------------------------------------------------------------ desks & chairs
  const COLS = [-34, -20, 0, 20, 34];
  const ROWS = [-18, -2, 14, 30];
  const skipChairs = new Set(['0,30,1']); // keep a gap next to the start
  for (const rz of ROWS) for (const cx of COLS) {
    desk(cx, rz);
    for (const s of [-1, 1]) {
      if (skipChairs.has(`${cx},${rz},${s}`)) continue;
      chair(cx + s * 3, rz + 5, cx === 0 && rz === -18 && s === -1);
    }
  }

  // ------------------------------------------------------------ start desk props (center, back row)
  const SD = { x: 0, z: 30, y: DESK_H };
  const nb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2.2), [mats.white, mats.white, new THREE.MeshStandardMaterial({ map: T.notebookTexture(), roughness: 0.9 }), mats.white, mats.white, mats.white]);
  nb.position.set(2.2, SD.y + 0.06, 31.2); nb.rotation.y = 0; nb.receiveShadow = true; nb.castShadow = true;
  scene.add(nb);
  world.add(0.6, SD.y, 30.1, 3.8, SD.y + 0.12, 32.3);
  // red book (Mark Manson) — first step
  const redBook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 2.0), [mats.white, mats.white,
    new THREE.MeshStandardMaterial({ map: T.bookTexture('МАРК МЭНСОН', '#c9262c'), roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: '#c9262c' }), new THREE.MeshStandardMaterial({ color: '#c9262c' }), new THREE.MeshStandardMaterial({ color: '#c9262c' })]);
  redBook.position.set(-2.0, SD.y + 0.175, 29.2); redBook.castShadow = true; redBook.receiveShadow = true;
  scene.add(redBook);
  world.add(-2.7, SD.y, 28.2, -1.3, SD.y + 0.35, 30.2);
  // textbook tower (item 1 on top)
  const towerTop = stack(-4.3, SD.y, 28.9, [
    [2.4, 0.55, 1.9, '#2c4f8a'], [2.2, 0.5, 1.8, '#6a8f3a'], [2.3, 0.6, 1.85, '#7a3b6e'],
    [2.0, 0.45, 1.7, '#d18a2a'], [2.1, 0.5, 1.75, '#355e5a'],
  ]);
  // airpods case ("black case")
  box(3.8, SD.y, 28.6, 0.75, 0.3, 0.6, mats.plastic, FULL);
  box(3.8, SD.y + 0.3, 28.6, 0.72, 0.02, 0.02, mats.white, 0);
  pen(-0.5, SD.y, 28.0, 1.4, 'x', '#1d3fbf');
  pen(4.4, SD.y, 32.4, 1.6, 'z', '#e8c53a');
  // skeleton-hand back scratcher: bridge to the left block
  lyingCyl(-10, SD.y + 0.2, 31.5, 0.16, 9.0, 'x', mats.metal);
  for (let f = 0; f < 5; f++) {
    lyingCyl(-15.9, SD.y + 0.18, 30.9 + f * 0.3, 0.07, 1.4, 'x', mats.metal);
  }
  box(-15.0, SD.y, 31.5, 1.1, 0.25, 1.6, mats.metal, 0);
  box(-10, SD.y, 31.5, 9.0, 0.36, 1.0, null, FULL);

  // ------------------------------------------------------------ other desk clutter
  const clutter = [
    [-34, 30, '#3d6fb5'], [20, 30, '#b55a3d'], [34, 14, '#2f7d5b'], [0, 14, '#8a3d9e'], [20, -2, '#b5953d'], [-20, 30, '#3d9eb5'],
  ];
  for (const [cx, cz, c] of clutter) {
    stack(cx + 3, DESK_H, cz - 1, [[2.4, 0.5, 1.9, c], [2.1, 0.45, 1.7, '#e5e1d6']]);
    pen(cx - 2, DESK_H, cz + 1, 1.5, 'x', '#222');
  }
  // paper sheets
  for (const [cx, cz] of [[-20, 14], [0, -2], [34, -18], [-34, -2]]) box(cx - 2, DESK_H, cz, 2.1, 0.06, 2.9, mats.white, F_SOLID);

  // ------------------------------------------------------------ meter rulers (bridges between rows)
  function ruler(cx, z0, z1) {
    box(cx, DESK_H, (z0 + z1) / 2, 1.0, 0.22, z1 - z0, mats.prop, FULL, '#e3c27a');
    for (let z = z0 + 0.5; z < z1; z += 1) box(cx - 0.35, DESK_H + 0.22, z, 0.3, 0.01, 0.05, mats.plastic, 0);
  }
  ruler(-34, 0.5, 11.5);     // L1: row 14 -> row -2
  ruler(-20, -15.5, -4.5);   // L2: row -2 -> row -18

  // ------------------------------------------------------------ floor stepping stones (climb routes)
  backpack(-26.9, 20.3, '#2d3b55');              // route to L2 row14 (after item 2)
  stack(-27.1, 0, -12.5, [[2.6, 0.7, 2.0, '#8a2f2f'], [2.4, 0.8, 1.9, '#2f5a8a'], [2.2, 0.7, 1.8, '#5a8a2f']]); // L1 row -18 chair
  backpack(-13.3, 4.8, '#55402d');               // L2 row -2 outer chair
  backpack(13.3, 20.4, '#3b2d55');               // R1 row 14
  backpack(-6.8, 35.5, '#5a1f1f', 2.2);             // way back up to the start desk

  // ------------------------------------------------------------ teacher zone (front right)
  const TD = { x: 27, z: -42, w: 16, d: 8, h: 7.6 };
  box(TD.x, TD.h - 0.6, TD.z, TD.w, 0.6, TD.d, mats.wood);
  box(TD.x - TD.w / 2 + 0.6, 0, TD.z, 0.6, TD.h - 0.6, TD.d - 0.4, mats.wood, F_SOLID | F_SIGHT);
  box(TD.x + TD.w / 2 - 0.6, 0, TD.z, 0.6, TD.h - 0.6, TD.d - 0.4, mats.wood, F_SOLID | F_SIGHT);
  box(TD.x, 1.0, TD.z - TD.d / 2 + 0.3, TD.w - 1.2, TD.h - 1.6, 0.3, mats.wood, F_SOLID | F_SIGHT);
  block(TD.x - TD.w / 2, TD.z - TD.d / 2, TD.x + TD.w / 2, TD.z + TD.d / 2);
  // monitor + keyboard + papers + mug
  box(24, TD.h, -44.5, 1.6, 0.2, 1.2, mats.plastic, FULL);
  box(24, TD.h + 0.2, -44.5, 0.4, 1.6, 0.4, mats.plastic, FULL);
  box(24, TD.h + 1.6, -44.5, 6.0, 3.6, 0.35, mats.plastic, FULL);
  const mon = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.2), new THREE.MeshStandardMaterial({ map: T.screenTexture(), emissive: '#ffffff', emissiveMap: T.screenTexture(), emissiveIntensity: 0.7 }));
  mon.position.set(24, TD.h + 3.4, -44.3); scene.add(mon);
  box(24, TD.h, -41.2, 4.2, 0.25, 1.4, mats.prop, FULL, '#2a2a2e');
  stack(19.8, TD.h, -43.5, [[2.1, 0.4, 2.9, '#f2f0ea'], [2.1, 0.5, 2.9, '#ebe7dc'], [2.1, 0.4, 2.9, '#f2f0ea']]);
  cyl(21.0, TD.h, -39.6, 0.45, 1.0, mats.prop, '#d9d4c8');
  chair(27, -35.9, true, -1); // teacher chair (burgundy)
  // waste bin as first step
  cyl(31.2, 0, -35.6, 1.35, 2.4, mats.prop, '#43474d');
  box(31.2, 0, -35.6, 2.6, 2.4, 2.6, null, FULL | F_MONSTER);

  // lectern (кафедра) front-left
  box(-38, 0, -45, 7, 10.5, 5, mats.podium, FULL | F_MONSTER);
  box(-38, 10.5, -45.3, 7.6, 0.5, 5.8, mats.podium, FULL);
  box(-33.5, 0, -45, 2.0, 1.6, 2.6, mats.prop, FULL | F_MONSTER, '#7a2020'); // box near lectern
  // a cabinet on the back wall
  box(-30, 0, ROOM.z1 - 3, 18, 14, 6, mats.wood, FULL | F_MONSTER);
  box(38, 0, ROOM.z1 - 3, 12, 9, 6, mats.wood, FULL | F_MONSTER);

  B.build(scene);

  return {
    world,
    spawn: { x: 1.8, y: SD.y + 0.2, z: 32.0, yaw: Math.PI },
    items: [
      { id: 'chalk', name: 'ЗОЛОТОЙ МЕЛ', x: -4.3, y: towerTop + 0.45, z: 28.9 },
      { id: 'usb', name: 'ФЛЕШКА', x: -21.8, y: 0.9, z: 20.2 },
      { id: 'zachetka', name: 'ЗАЧЁТКА', x: -36.5, y: DESK_H + 0.5, z: -19.4 },
    ],
    teacher: { x: 24, y: TD.h, z: -41.2, desk: TD },
    portal: { x: 31.0, y: TD.h, z: -41.5 },
    zones: {
      teacherDesk: { x0: TD.x - TD.w / 2, x1: TD.x + TD.w / 2, z0: TD.z - TD.d / 2, z1: TD.z + TD.d / 2, y: TD.h - 0.1 },
      front: { z1: -24 },
    },
    checkpoints: {
      afterChalk: { x: -2.0, y: SD.y + 0.4, z: 29.2 },
      afterUsb: { x: -26.9, y: 2.6, z: 20.3 },
      afterZachetka: { x: -36.5, y: DESK_H + 0.1, z: -18.4 },
      teacher: { x: 31.2, y: 2.5, z: -35.6 },
    },
  };
}
