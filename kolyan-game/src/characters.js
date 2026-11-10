import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matCache = new Map();
export function mat(color, rough = 0.75, metal = 0, extra = {}) {
  const key = color + '|' + rough + '|' + metal + '|' + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  return matCache.get(key);
}

const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 12),
};

function mesh(geo, material, px = 0, py = 0, pz = 0, sx = 1, sy = 1, sz = 1, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(px, py, pz);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
const sph = (m, x, y, z, r, p, sx = 1, sy = 1, sz = 1) => mesh(G.sphere, m, x, y, z, r * sx, r * sy, r * sz, p);
const cyl = (m, x, y, z, r, h, p, r2) => mesh(G.cyl, m, x, y, z, r, h, r2 ?? r, p);
const box = (m, x, y, z, sx, sy, sz, p) => mesh(G.box, m, x, y, z, sx, sy, sz, p);

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function glasses(parent, y, z, r, sep, color, lensColor) {
  const frame = mat(color, 0.3, 0.8);
  const ring = new THREE.TorusGeometry(r, r * 0.12, 8, 24);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(ring, frame);
    m.position.set(s * sep, y, z);
    parent.add(m);
    if (lensColor) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat(lensColor, 0.1, 0, { transparent: true, opacity: 0.35 }));
      lens.position.set(s * sep, y, z + 0.002);
      parent.add(lens);
    }
    box(frame, s * (sep + r + 0.06), y, z - 0.09, 0.012, 0.012, 0.2, parent); // temples
  }
  box(frame, 0, y + r * 0.3, z + 0.005, sep * 2 - r * 1.6, 0.012, 0.012, parent);
}

// ---------------------------------------------------------------- KOLYAN
export function buildKolyan() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const skin = mat('#eec3a3', 0.65);
  const tee = mat('#2a4fe0', 0.8);
  const pants = mat('#1b2235', 0.9);
  const strap = mat('#121726', 0.7);
  const shoe = mat('#0d0d10', 0.45);
  const hair = mat('#2a1d14', 0.9);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(body, s * 0.13, 0.8, 0);
    cyl(pants, 0, -0.34, 0, 0.155, 0.7, leg, 0.17);
    box(shoe, 0, -0.73, 0.05, 0.2, 0.13, 0.34, leg);
    legs.push(leg);
  }
  const torso = pivot(body, 0, 0.8, 0);
  cyl(pants, 0, 0.17, 0, 0.3, 0.42, torso, 0.31);       // high wide work pants
  const chest = mesh(new THREE.CapsuleGeometry(0.25, 0.18, 6, 16), tee, 0, 0.56, 0, 1, 1, 0.85, torso);
  chest.castShadow = true;
  box(mat('#ffffff', 0.6), -0.09, 0.62, 0.215, 0.12, 0.08, 0.01, torso); // tee logo
  for (const s of [-1, 1]) {
    box(strap, s * 0.12, 0.55, 0.205, 0.055, 0.42, 0.03, torso);
    box(strap, s * 0.12, 0.55, -0.205, 0.055, 0.42, 0.03, torso);
    box(strap, s * 0.12, 0.33, 0.27, 0.07, 0.07, 0.02, torso); // buckle
  }
  cyl(skin, 0, 0.83, 0, 0.07, 0.12, torso);
  const head = pivot(torso, 0, 0.96, 0);
  sph(skin, 0, 0.0, 0, 0.2, head, 0.95, 1.05, 1);
  sph(hair, 0, 0.07, -0.01, 0.205, head, 1, 0.62, 1.03); // buzz cut
  for (const s of [-1, 1]) {
    sph(skin, s * 0.19, -0.01, 0, 0.045, head);
    sph(mat('#2b2b2b', 0.3), s * 0.072, 0.015, 0.175, 0.024, head);
    box(hair, s * 0.075, 0.075, 0.183, 0.08, 0.016, 0.01, head);
  }
  sph(skin, 0, -0.035, 0.195, 0.032, head);
  box(mat('#9c4f45', 0.6), 0, -0.1, 0.18, 0.08, 0.014, 0.01, head);
  glasses(head, 0.015, 0.2, 0.062, 0.075, '#c8ccd2', '#dfe8f0');

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(torso, s * 0.3, 0.68, 0);
    sph(tee, 0, -0.02, 0, 0.1, arm);
    cyl(tee, 0, -0.1, 0, 0.095, 0.18, arm);
    cyl(skin, 0, -0.36, 0, 0.06, 0.42, arm, 0.055);
    sph(skin, 0, -0.6, 0, 0.068, arm);
    arms.push(arm);
  }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, body, torso, head, legs, arms };
}

// ---------------------------------------------------------------- PROFESSOR
export function buildProfessor() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const suit = mat('#121216', 0.6);
  const shirt = mat('#1d1d22', 0.7);
  const skin = mat('#e7c6ae', 0.6);
  const hair = mat('#7a5a3c', 0.9);
  const eyes = new THREE.MeshStandardMaterial({ color: '#30353a', emissive: '#000000', roughness: 0.3 });

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(body, s * 0.1, 0.98, 0);
    cyl(suit, 0, -0.46, 0, 0.075, 0.92, leg, 0.07);
    box(mat('#08080a', 0.3), 0, -0.94, 0.06, 0.11, 0.07, 0.3, leg);
    legs.push(leg);
  }
  const torso = pivot(body, 0, 0.96, 0);
  cyl(suit, 0, 0.32, 0, 0.21, 0.66, torso, 0.17);
  box(shirt, 0, 0.42, 0.13, 0.12, 0.44, 0.1, torso);
  box(mat('#f4f4f2', 0.5), 0, 0.39, 0.185, 0.045, 0.4, 0.012, torso); // white tie
  box(mat('#f4f4f2', 0.5), 0, 0.6, 0.18, 0.07, 0.05, 0.02, torso);
  for (const s of [-1, 1]) {
    const lap = box(suit, s * 0.08, 0.44, 0.17, 0.07, 0.4, 0.03, torso);
    lap.rotation.z = s * 0.25;
  }
  cyl(skin, 0, 0.72, 0, 0.055, 0.12, torso);
  const head = pivot(torso, 0, 0.86, 0.02);
  sph(skin, 0, 0, 0, 0.13, head, 0.92, 1.12, 1);
  sph(hair, 0, 0.06, -0.015, 0.135, head, 1, 0.8, 1.02);
  box(hair, 0.02, 0.08, 0.11, 0.2, 0.06, 0.04, head).rotation.z = -0.25; // fringe
  for (const s of [-1, 1]) {
    sph(eyes, s * 0.045, 0.01, 0.115, 0.022, head);
    sph(skin, s * 0.125, -0.005, 0, 0.03, head);
  }
  box(mat('#9b6a5e', 0.6), 0, -0.07, 0.12, 0.06, 0.01, 0.01, head);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(torso, s * 0.24, 0.6, 0);
    cyl(suit, 0, -0.38, 0, 0.065, 0.78, arm, 0.055);
    cyl(skin, 0, -0.84, 0, 0.04, 0.16, arm);
    for (let f = -1; f <= 1; f++) cyl(skin, f * 0.022, -0.98, 0.01, 0.013, 0.14, arm);
    arms.push(arm);
  }
  torso.rotation.x = 0.12;
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, body, torso, head, legs, arms, eyes, height: 1.95 };
}

// ---------------------------------------------------------------- WATCHER
export function buildWatcher() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const skin = mat('#bdbdbd', 0.7);
  const tee = mat('#efefef', 0.85);
  const pants = mat('#5d5d5d', 0.85);
  const hair = mat('#202020', 0.95);
  const eyes = new THREE.MeshStandardMaterial({ color: '#101010', emissive: '#000000', roughness: 0.2 });

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(body, s * 0.09, 0.6, 0);
    cyl(pants, 0, -0.28, 0, 0.07, 0.56, leg);
    box(mat('#1a1a1a', 0.4), 0, -0.57, 0.04, 0.1, 0.06, 0.2, leg);
    legs.push(leg);
  }
  const torso = pivot(body, 0, 0.58, 0);
  cyl(tee, 0, 0.22, 0, 0.17, 0.46, torso, 0.16);
  const head = pivot(torso, 0, 0.75, 0);
  sph(skin, 0, 0, 0, 0.33, head, 0.95, 1, 0.95);
  sph(skin, 0, -0.2, 0.05, 0.2, head, 1.1, 0.7, 1); // heavy jaw
  // curly hair
  const curl = mat('#262626', 0.95);
  const rnd = (() => { let s = 99; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2;
    const e = 0.15 + rnd() * 1.1;
    if (Math.sin(a) > 0.55 && e < 0.7) continue; // keep face clear
    const r = 0.34;
    const x = Math.cos(e) * Math.sin(a) * r * 0.98, z = Math.cos(e) * Math.cos(a) * r * 0.95 - 0.02;
    const y = Math.sin(e) * r + 0.05;
    if (z > 0.18 && y < 0.18) continue;
    mesh(G.sphereLo, curl, x, y, z, 0.09, 0.08, 0.09, head);
  }
  sph(hair, 0, 0.12, -0.03, 0.33, head, 1, 0.75, 0.98);
  for (const s of [-1, 1]) {
    sph(mat('#f2f2f2', 0.3), s * 0.11, 0.0, 0.27, 0.06, head);
    sph(eyes, s * 0.11, 0.0, 0.31, 0.032, head);
    sph(skin, s * 0.33, -0.02, 0, 0.06, head);
    box(hair, s * 0.11, 0.1, 0.29, 0.12, 0.022, 0.02, head);
  }
  sph(skin, 0, -0.07, 0.32, 0.05, head);
  box(mat('#7a7a7a', 0.6), 0, -0.2, 0.29, 0.12, 0.018, 0.02, head);
  glasses(head, 0.01, 0.33, 0.115, 0.125, '#d5d5d5', '#e6e6e6');
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(torso, s * 0.2, 0.4, 0);
    cyl(tee, 0, -0.05, 0, 0.065, 0.12, arm);
    cyl(skin, 0, -0.26, 0, 0.045, 0.34, arm);
    sph(skin, 0, -0.45, 0, 0.05, arm);
    arms.push(arm);
  }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, body, torso, head, legs, arms, eyes, height: 1.55 };
}

// ---------------------------------------------------------------- PIG QUEEN (generic cartoon pig)
export function buildPig() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const pink = mat('#f2a7b4', 0.85);
  const pinkD = mat('#e48b9c', 0.8);
  const hoof = mat('#4a3227', 0.5);
  const vest = mat('#151515', 0.6);
  const gold = mat('#f2c230', 0.3, 0.8);
  const eyes = new THREE.MeshStandardMaterial({ color: '#1a1010', emissive: '#000000', roughness: 0.2 });

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(body, s * 0.2, 0.36, 0);
    cyl(pink, 0, -0.16, 0, 0.13, 0.32, leg, 0.11);
    cyl(hoof, 0, -0.33, 0.01, 0.11, 0.07, leg);
    legs.push(leg);
  }
  const torso = pivot(body, 0, 0.34, 0);
  sph(pink, 0, 0.36, 0, 0.5, torso, 1.05, 0.95, 0.95);
  // open black vest: cylinder segment leaving the belly visible
  const vg = new THREE.CylinderGeometry(0.5, 0.55, 0.42, 24, 1, true, Math.PI * 0.18, Math.PI * 1.64);
  const v = new THREE.Mesh(vg, new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.6, side: THREE.DoubleSide }));
  v.position.set(0, 0.52, 0); v.rotation.y = Math.PI; v.castShadow = true;
  torso.add(v);
  sph(vest, 0, 0.45, 0.46, 0.035, torso); // button
  // curly tail
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 16, Math.PI * 1.6), pinkD);
  tail.position.set(0, 0.3, -0.5); tail.rotation.y = Math.PI / 2;
  torso.add(tail);
  const head = pivot(torso, 0, 0.92, 0.02);
  sph(pink, 0, 0, 0, 0.3, head, 1, 0.92, 0.95);
  const snout = cyl(pinkD, 0, -0.06, 0.29, 0.11, 0.1, head);
  snout.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    sph(mat('#5a2a33', 0.5), s * 0.04, -0.06, 0.345, 0.022, head);
    sph(mat('#ffffff', 0.3), s * 0.1, 0.07, 0.25, 0.045, head);
    sph(eyes, s * 0.1, 0.07, 0.285, 0.025, head);
    const ear = mesh(G.cone, pink, s * 0.2, 0.25, 0, 0.1, 0.22, 0.05, head);
    ear.rotation.z = -s * 0.5; ear.rotation.x = 0.3;
  }
  // crown
  cyl(gold, 0, 0.3, -0.02, 0.13, 0.07, head);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    mesh(G.cone, gold, Math.sin(a) * 0.11, 0.38, Math.cos(a) * 0.11 - 0.02, 0.035, 0.1, 0.035, head);
  }
  sph(mat('#c0182b', 0.2, 0.3), 0, 0.31, 0.12, 0.025, head);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(torso, s * 0.48, 0.55, 0.05);
    cyl(pink, 0, -0.17, 0, 0.09, 0.34, arm, 0.08);
    cyl(hoof, 0, -0.37, 0, 0.08, 0.08, arm);
    arm.rotation.z = s * 0.35;
    arms.push(arm);
  }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, body, torso, head, legs, arms, eyes, height: 1.45 };
}

// Merge sibling meshes that share a material (per pivot) to cut draw calls.
export function optimize(root) {
  const groups = [];
  root.traverse(o => { if (!o.isMesh) groups.push(o); });
  for (const g of groups) {
    const byMat = new Map();
    for (const c of g.children) {
      if (!c.isMesh || c.isSprite) continue;
      if (!byMat.has(c.material)) byMat.set(c.material, []);
      byMat.get(c.material).push(c);
    }
    for (const [material, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map(m => { m.updateMatrix(); const ge = m.geometry.index ? m.geometry.clone() : m.geometry.clone(); return ge.applyMatrix4(m.matrix); });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      list.forEach(m => g.remove(m));
      const mm = new THREE.Mesh(merged, material);
      mm.castShadow = true;
      g.add(mm);
    }
  }
  return root;
}
