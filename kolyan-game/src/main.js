import * as THREE from 'three';
import { buildLevel, ROOM } from './level.js';
import { F_CAM } from './physics.js';
import { Player } from './player.js';
import { Monster } from './monsters.js';
import { NavGrid } from './nav.js';
import { FollowCam } from './camera.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { buildKolyan } from './characters.js';

const $ = id => document.getElementById(id);

// ------------------------------------------------------------ settings
const DEFAULTS = { sens: 1.0, vol: 0.8, quality: 'medium', autoRun: true, invert: false, fps: false };
const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem('kolyan-settings') || '{}')); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem('kolyan-settings', JSON.stringify(settings)); } catch (e) {} };

// ------------------------------------------------------------ renderer / scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#d8d4cc');
scene.fog = new THREE.Fog('#d8d4cc', 110, 260);
const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 400);

const hemi = new THREE.HemisphereLight('#fff6ea', '#6f7783', 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d8', 2.3);
sun.position.set(-60, 70, 20);
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight('#cfe0ff', 0.5);
fill.position.set(40, 30, -40);
scene.add(fill);

const level = buildLevel(scene);
const world = level.world;
const nav = new NavGrid(world, ROOM.x0, ROOM.z0, ROOM.x1, ROOM.z1, 1.5, 2.2);
const player = new Player(scene);
const monsters = ['professor', 'watcher', 'pig'].map(t => new Monster(t, scene, nav));
const follow = new FollowCam(camera);
// giants also block the camera (so it never ends up inside a monster)
const MON_R = { professor: 2.0, watcher: 3.0, pig: 4.6 };
const camBlockers = monsters.map(m => ({ m, b: world.add(0, 0, 0, 0, m.m.height * m.cfg.scale, 0, F_CAM) }));
function syncCamBlockers() {
  for (const { m, b } of camBlockers) { const r = MON_R[m.type]; b.x0 = m.x - r; b.x1 = m.x + r; b.z0 = m.z - r; b.z1 = m.z + r; }
}
const audio = new Audio();
audio.setVolume(settings.vol);

// ------------------------------------------------------------ items
function glowTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, color); grd.addColorStop(0.3, color + '88'); grd.addColorStop(1, color + '00');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = glowTexture('#ffe680');
const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const beamGeo = new THREE.CylinderGeometry(0.35, 0.9, 40, 16, 1, true);
beamGeo.translate(0, 20, 0);

function itemMesh(id) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcf33', emissive: '#a87400', emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.8 });
  if (id === 'chalk') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.0, 12), gold);
    m.rotation.z = Math.PI / 2; g.add(m);
  } else if (id === 'usb') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.28, 0.42), new THREE.MeshStandardMaterial({ color: '#2a4fe0', emissive: '#10247a', emissiveIntensity: 0.6, roughness: 0.4 })));
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.32), new THREE.MeshStandardMaterial({ color: '#d7dbe0', metalness: 0.9, roughness: 0.2 }));
    c.position.x = 0.6; g.add(c);
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 1.35), new THREE.MeshStandardMaterial({ color: '#1d2b5c', emissive: '#0a1030', roughness: 0.6 })));
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.25), gold); l.position.set(0, 0.09, -0.2); g.add(l);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(2.6, 2.6, 1); g.add(glow);
  return g;
}
const items = level.items.map(it => {
  const mesh = itemMesh(it.id);
  mesh.position.set(it.x, it.y, it.z);
  scene.add(mesh);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(it.x, it.y - 0.4, it.z);
  scene.add(beam);
  return { ...it, mesh, beam, got: false };
});
// marker beam for non-item objectives
const goalBeam = new THREE.Mesh(beamGeo, beamMat);
scene.add(goalBeam);

// ------------------------------------------------------------ portal
const portal = new THREE.Group();
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.25, '#9fe7ff'); grd.addColorStop(0.6, '#3a5cff'); grd.addColorStop(1, 'rgba(40,0,120,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 6;
  for (let a = 0; a < 4; a++) {
    g.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const r = t * 120, ang = a * Math.PI / 2 + t * 7;
      const x = 128 + Math.cos(ang) * r, y = 128 + Math.sin(ang) * r;
      t === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  disc.position.y = 1.7; portal.add(disc); portal.userData.disc = disc;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.14, 12, 48), new THREE.MeshStandardMaterial({ color: '#7fd6ff', emissive: '#3aa8ff', emissiveIntensity: 2.2, roughness: 0.2 }));
  ring.position.y = 1.7; portal.add(ring);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#7fd6ff'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(7, 7, 1); glow.position.y = 1.7; portal.add(glow);
  portal.position.set(level.portal.x, level.portal.y, level.portal.z);
  portal.rotation.y = -Math.PI / 2;
  portal.visible = false;
  scene.add(portal);
}

// ------------------------------------------------------------ input
const input = new Input($('touch'), $('joy'), $('joyKnob'), {
  jump: $('bJump'), climb: $('bClimb'), action: $('bAction'), run: $('bRun'), crouch: $('bCrouch'),
});
input.onToggle = () => audio.play('click');

// ------------------------------------------------------------ game state
const G = {
  state: 'menu', items: 0, hearts: 3, time: 0, caught: 0, portalOpen: false, tut: 0,
  checkpoint: { ...level.spawn }, toastT: 0, hitT: 0, winT: 0, startYaw: 0, cpTeacher: false,
};
const game = {
  sfx: (n, v) => audio.play(n, v),
  noise(x, y, z, r) { if (G.state === 'playing') monsters.forEach(m => m.hearNoise(x, z, r)); },
  onAlert(m) { audio.play('alert'); toast(m.cfg.name, 'заметил тебя — беги и прячься!'); },
  caught(m) { if (G.state === 'playing') onCaught(m); },
  fellOut() { respawn(); },
};

function toast(big, small = '', dur = 2.2) {
  $('toast').innerHTML = big + (small ? `<small>${small}</small>` : '');
  $('toast').classList.add('show'); G.toastT = dur;
}

function setHearts() {
  [...$('hearts').children].forEach((h, i) => h.classList.toggle('off', i >= G.hearts));
}
function setItemsHud() {
  $('itemsN').textContent = `${G.items}/3`;
  [...document.querySelectorAll('#items .dots span')].forEach((s, i) => s.classList.toggle('got', items[i].got));
}

function resetMonsters() { monsters.forEach(m => m.reset()); }

function newGame() {
  G.items = 0; G.hearts = 3; G.time = 0; G.caught = 0; G.portalOpen = false; G.tut = 0; G.cpTeacher = false;
  items.forEach(it => { it.got = false; it.mesh.visible = true; it.beam.visible = false; });
  portal.visible = false;
  G.checkpoint = { ...level.spawn };
  player.reset(level.spawn);
  player.jumps = 0; player.climbs = 0; player.moved = 0;
  resetMonsters();
  follow.yaw = 0; follow.pitch = 0.32; follow.inited = false;
  G.startYaw = follow.yaw;
  setHearts(); setItemsHud();
}

function respawn() {
  player.reset(G.checkpoint);
  follow.inited = false;
}

function onCaught(m) {
  G.hearts--; G.caught++;
  audio.play('hurt');
  player.hurt(m.x, m.z);
  setHearts();
  const h = $('hearts').children[G.hearts]; if (h) { h.classList.add('pop'); setTimeout(() => h.classList.remove('pop'), 300); }
  $('vignette').classList.add('hit');
  setTimeout(() => $('vignette').classList.remove('hit'), 250);
  monsters.forEach(o => { o.sus = 0; o.cool = 2.5; if (o.state !== 'patrol') o.setState('return'); });
  if (G.hearts <= 0) {
    G.state = 'dying';
    player.frozen = true;
    setTimeout(() => showLose(m), 700);
    return;
  }
  toast(`${m.cfg.name} поймал тебя!`, `осталось сердец: ${G.hearts}`);
  $('fade').classList.add('on');
  setTimeout(() => { respawn(); player.invuln = 2.5; $('fade').classList.remove('on'); }, 320);
}

function showLose(m) {
  G.state = 'lose';
  audio.play('lose');
  $('loseBy').textContent = `${m.cfg.name} поймал Коляна. Предметы остаются при тебе.`;
  showScreen('lose');
}

function collect(it) {
  it.got = true; it.mesh.visible = false; it.beam.visible = false;
  G.items++;
  audio.play('pickup');
  setItemsHud();
  toast(`+ ${it.name}`, `${G.items}/3 · чекпоинт сохранён`);
  const cp = { afterChalk: 'chalk', afterUsb: 'usb', afterZachetka: 'zachetka' };
  for (const k in cp) if (cp[k] === it.id) G.checkpoint = { ...level.checkpoints[k] };
  if (G.tut < 3) G.tut = 3;
}

function onTeacherDesk() {
  const z = level.zones.teacherDesk;
  return player.x > z.x0 && player.x < z.x1 && player.z > z.z0 && player.z < z.z1 && player.y >= z.y;
}

// objective: text + target position
function objective() {
  if (G.tut === 0) return { t: 'Джойстик слева — идти. Веди пальцем справа — камера.', p: items[0] };
  if (G.tut === 1) return { t: 'Нажми JUMP и запрыгни на красную книгу', p: { x: -2, y: 7.9, z: 29.2 } };
  const next = items.find(i => !i.got);
  if (next) {
    if (next.id === 'chalk') return { t: 'Залезь на стопку учебников: у края жми CLIMB. Возьми ЗОЛОТОЙ МЕЛ (ACTION)', p: next };
    if (next.id === 'usb') return { t: 'Спрыгни с парты. ФЛЕШКА — под стулом в левом ряду. Не попадись PROFESSOR', p: next };
    return { t: 'Рюкзак → стул → парта. По линейкам к ЗАЧЁТКЕ на первой парте у окна', p: next };
  }
  if (!G.portalOpen) {
    if (onTeacherDesk()) return { t: 'Подойди к клавиатуре и нажми ACTION — открой портал', p: level.teacher };
    return { t: 'Доберись до стола преподавателя: урна → стул → стол', p: { x: 31.2, y: 2.4, z: -35.6 } };
  }
  return { t: 'Портал открыт! Прыгай в него!', p: level.portal };
}
const HINTS = [
  'Свайп по правой половине экрана крутит камеру.',
  'JUMP — прыжок. Около края он становится CLIMB.',
  'В прыжке толкай джойстик к краю — Колян схватится сам.',
  'Под партами тебя почти не видно. CROUCH — тише и незаметнее.',
  'Падай с парты смело: Колян лёгкий. Но громкое приземление слышно.',
  'PIG QUEEN слышит шаги и бег. У доски иди пригнувшись.',
];

// ------------------------------------------------------------ screens
const screens = ['menu', 'settings', 'howto', 'pause', 'lose', 'win'];
let settingsReturn = 'menu';
function showScreen(name) {
  screens.forEach(s => $(s).classList.toggle('hidden', s !== name));
  const playing = name === null;
  $('hud').classList.toggle('hidden', !playing && G.state !== 'paused');
  $('controls').classList.toggle('hidden', !playing);
  input.enabled = playing;
  if (!playing) input.reset();
}

function requestFs() {
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  } catch (e) {}
}

function startPlaying(fresh) {
  audio.unlock();
  if (fresh) newGame();
  G.state = 'playing';
  showScreen(null);
  last = performance.now();
}

$('mPlay').onclick = () => { requestFs(); startPlaying(true); };
$('mSettings').onclick = () => { settingsReturn = 'menu'; openSettings(); };
$('mHow').onclick = () => showScreen('howto');
$('hBack').onclick = () => showScreen('menu');
$('pauseBtn').addEventListener('pointerdown', e => { e.stopPropagation(); pause(); });
$('pResume').onclick = () => { G.state = 'playing'; showScreen(null); audio.resume(); };
$('pSettings').onclick = () => { settingsReturn = 'pause'; openSettings(); };
$('pRestart').onclick = () => startPlaying(true);
$('pMenu').onclick = toMenu;
$('lRetry').onclick = () => {
  G.hearts = 3; setHearts(); resetMonsters(); player.frozen = false; respawn(); player.invuln = 2.5;
  G.state = 'playing'; showScreen(null);
};
$('lRestart').onclick = () => { player.frozen = false; startPlaying(true); };
$('lMenu').onclick = () => { player.frozen = false; toMenu(); };
$('wAgain').onclick = () => { player.frozen = false; startPlaying(true); };
$('wMenu').onclick = () => { player.frozen = false; toMenu(); };
document.querySelectorAll('.mb').forEach(b => b.addEventListener('pointerdown', () => { audio.unlock(); audio.play('click'); }));

function toMenu() { G.state = 'menu'; newGame(); showScreen('menu'); }
function pause() {
  if (G.state !== 'playing') return;
  G.state = 'paused'; showScreen('pause');
}

// settings UI
function openSettings() {
  $('sSens').value = settings.sens; $('sVol').value = settings.vol;
  syncSettingsUI();
  showScreen('settings');
}
function syncSettingsUI() {
  [...$('sQuality').children].forEach(b => b.classList.toggle('sel', b.dataset.q === settings.quality));
  $('sAuto').classList.toggle('on', settings.autoRun);
  $('sInvert').classList.toggle('on', settings.invert);
  $('sFps').classList.toggle('on', settings.fps);
  $('fps').classList.toggle('hidden', !settings.fps);
}
$('sSens').oninput = e => { settings.sens = +e.target.value; saveSettings(); };
$('sVol').oninput = e => { settings.vol = +e.target.value; audio.setVolume(settings.vol); saveSettings(); };
[...$('sQuality').children].forEach(b => b.onclick = () => { settings.quality = b.dataset.q; applyQuality(); syncSettingsUI(); saveSettings(); });
$('sAuto').onclick = () => { settings.autoRun = !settings.autoRun; syncSettingsUI(); saveSettings(); };
$('sInvert').onclick = () => { settings.invert = !settings.invert; syncSettingsUI(); saveSettings(); };
$('sFps').onclick = () => { settings.fps = !settings.fps; syncSettingsUI(); saveSettings(); };
$('sBack').onclick = () => showScreen(settingsReturn);

// lifecycle: pause when hidden / blurred, resume audio when back
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); audio.suspend(); }
  else { audio.resume(); last = performance.now(); }
});
window.addEventListener('pagehide', pause);
['gesturestart', 'gesturechange', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (!e.target.closest('.panel')) e.preventDefault(); }, { passive: false });

// ------------------------------------------------------------ quality / resize
let basePR = 1, dyn = 1;
const QUALITY = { low: { pr: 1, shadow: 0, aa: 0.75 }, medium: { pr: 1.5, shadow: 1024 }, high: { pr: 2, shadow: 2048 } };
function applyQuality() {
  const q = QUALITY[settings.quality] || QUALITY.medium;
  basePR = Math.min(window.devicePixelRatio || 1, q.pr);
  dyn = 1;
  const sh = !!q.shadow;
  renderer.shadowMap.enabled = sh;
  sun.castShadow = sh;
  if (sh) {
    sun.shadow.mapSize.set(q.shadow, q.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  }
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(basePR * dyn);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.4 ? 72 : 62;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
applyQuality();

// ------------------------------------------------------------ portrait for the HUD card
(function makeAvatar() {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#3554d8');
  s.add(new THREE.HemisphereLight('#ffffff', '#5060a0', 2.2));
  const d = new THREE.DirectionalLight('#ffffff', 1.6); d.position.set(1, 2, 3); s.add(d);
  const k = buildKolyan(); s.add(k.root);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  cam.position.set(0.25, 1.78, 1.25); cam.lookAt(0, 1.68, 0);
  const rt = new THREE.WebGLRenderTarget(128, 128, { colorSpace: THREE.SRGBColorSpace });
  renderer.setRenderTarget(rt); renderer.render(s, cam); renderer.setRenderTarget(null);
  const px = new Uint8Array(128 * 128 * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, 128, 128, px);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) img.data.set(px.subarray((127 - y) * 512, (128 - y) * 512), y * 512);
  g.putImageData(img, 0, 0);
  $('avatar').src = c.toDataURL();
  rt.dispose();
})();

// ------------------------------------------------------------ main loop
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsT = 0, adaptT = 0, slowFrames = 0, fastFrames = 0;
const tmpV = new THREE.Vector3();

function updatePlaying(dt) {
  G.time += dt;
  const look = input.takeLook();
  // fixed-ish substeps keep jumps/climbs reliable on slow phones
  const n = Math.ceil(dt / 0.034), sdt = dt / n;
  for (let i = 0; i < n && G.state === 'playing'; i++) {
    player.update(sdt, input, follow.yaw, world, game, settings.autoRun);
    monsters.forEach(m => m.update(sdt, player, world, game, G.state === 'playing'));
  }
  syncCamBlockers();
  follow.update(dt, player, world, look, settings.sens, settings.invert);

  // tutorial progression
  if (G.tut === 0 && (player.moved > 3 || G.time > 9)) G.tut = 1;
  if (G.tut === 1 && (player.jumps > 0 || player.climbs > 0 || player.y > 7.8)) G.tut = 2;

  // items & action
  let prompt = '';
  let actionReady = false;
  const actionPressed = input.consume('action');
  for (const it of items) {
    if (it.got) continue;
    const d = Math.hypot(player.x - it.x, player.y + 0.8 - it.y, player.z - it.z);
    if (d < 0.9) { collect(it); continue; }
    if (d < 2.2) {
      prompt = `ACTION — взять: ${it.name}`; actionReady = true;
      if (actionPressed) collect(it);
    }
  }
  if (onTeacherDesk() && !G.portalOpen) {
    const d = Math.hypot(player.x - level.teacher.x, player.z - level.teacher.z);
    if (d < 4) {
      actionReady = true;
      prompt = G.items >= 3 ? 'ACTION — открыть портал' : `Нужны все 3 предмета (${G.items}/3)`;
      if (actionPressed) {
        if (G.items >= 3) { G.portalOpen = true; portal.visible = true; audio.play('portal'); toast('ПОРТАЛ ОТКРЫТ', 'прыгай в него!'); }
        else audio.play('deny');
      }
    }
  }
  if (!G.cpTeacher && player.z < -30 && player.x > 14 && G.items >= 3) {
    G.cpTeacher = true; G.checkpoint = { ...level.checkpoints.teacher };
  }
  // win
  if (G.portalOpen) {
    const d = Math.hypot(player.x - level.portal.x, player.z - level.portal.z);
    if (d < 1.4 && player.y >= level.portal.y - 0.2 && player.y < level.portal.y + 3) win();
  }

  // HUD
  $('prompt').textContent = prompt;
  $('prompt').classList.toggle('show', !!prompt);
  $('bAction').classList.toggle('ready', actionReady);
  const canClimb = !!player.ledge;
  $('bJump').classList.toggle('climb', canClimb && player.body.grounded);
  $('bJump').textContent = canClimb && player.body.grounded ? 'CLIMB' : 'JUMP';
  $('bClimb').classList.toggle('ready', canClimb);
  $('controls').classList.toggle('joyon', input.joyId !== null);

  const obj = objective();
  $('objText').textContent = obj.t;
  const dx = obj.p.x - player.x, dz = obj.p.z - player.z;
  const dist = Math.hypot(dx, dz, (obj.p.y || 0) - player.y);
  $('objDist').textContent = dist > 2 ? `${(dist / 10).toFixed(1)} м` : 'здесь';
  const fwdX = -Math.sin(follow.yaw), fwdZ = -Math.cos(follow.yaw);
  const rX = Math.cos(follow.yaw), rZ = -Math.sin(follow.yaw);
  const ang = Math.atan2(dx * rX + dz * rZ, dx * fwdX + dz * fwdZ);
  $('compass').style.transform = `rotate(${ang}rad)`;
  // beams
  const target = items.find(i => !i.got);
  items.forEach(it => { it.beam.visible = it === target && G.tut >= 2; });
  goalBeam.visible = !target && !G.portalOpen;
  if (goalBeam.visible) goalBeam.position.set(obj.p.x, (obj.p.y || 0), obj.p.z);
  $('hint').textContent = HINTS[Math.floor(G.time / 9) % HINTS.length];

  let danger = 0, chasing = false;
  for (const m of monsters) { danger = Math.max(danger, m.state === 'chase' ? 1 : m.sus); if (m.state === 'chase') chasing = true; }
  $('detectFill').style.width = `${Math.round(danger * 100)}%`;
  $('detectFill').style.background = danger > 0.85 ? '#ff3b3b' : danger > 0.3 ? '#ffd23f' : '#59d98c';
  $('eyeDot').setAttribute('r', 1.6 + danger * 2.2);
  $('vignette').classList.toggle('chase', chasing);
  audio.tick(dt, danger);
}

function win() {
  G.state = 'winning';
  player.frozen = true;
  audio.play('win');
  G.winT = 0;
}

function updateWinning(dt) {
  G.winT += dt;
  const s = Math.max(0.01, 1 - G.winT / 1.2);
  player.m.root.scale.setScalar(s);
  player.m.root.rotation.y += dt * 12;
  player.m.root.position.lerp(tmpV.set(level.portal.x, level.portal.y + 1.2, level.portal.z), dt * 3);
  follow.update(dt, player, world, [0, 0], 1, false);
  if (G.winT > 1.4) {
    G.state = 'won';
    const t = Math.floor(G.time);
    $('wTime').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    $('wHearts').textContent = G.hearts;
    $('wCaught').textContent = G.caught;
    showScreen('win');
  }
}

function updateMenu(dt, t) {
  const a = t * 0.05;
  camera.position.set(Math.sin(a) * 34, 24 + Math.sin(t * 0.13) * 3, Math.cos(a) * 30 + 4);
  camera.lookAt(0, 5, -4);
  monsters.forEach(m => m.update(dt, player, world, game, false));
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) return;
  const t = now / 1000;

  if (G.state === 'playing') updatePlaying(dt);
  else if (G.state === 'winning') updateWinning(dt);
  else if (G.state === 'dying') { player.update(dt, input, follow.yaw, world, game, false); follow.update(dt, player, world, [0, 0], 1, false); }
  else if (G.state === 'menu') updateMenu(dt, t);

  // ambient animation
  items.forEach(it => { if (!it.got) { it.mesh.rotation.y += dt * 1.8; it.mesh.position.y = it.y + Math.sin(t * 2.5 + it.x) * 0.12; } });
  if (portal.visible) { portal.userData.disc.rotation.z -= dt * 3; portal.scale.setScalar(1 + Math.sin(t * 4) * 0.03); }
  beamMat.opacity = 0.16 + Math.sin(t * 3) * 0.06;
  if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) $('toast').classList.remove('show'); }

  // shadow frustum follows the action
  if (sun.castShadow) {
    const inGame = G.state !== 'menu';
    const cx = inGame ? player.x : 0, cz = inGame ? player.z : 0;
    const r = inGame ? 26 : 60;
    sun.target.position.set(cx, 0, cz);
    sun.position.set(cx - 60, 70, cz + 20);
    const sc = sun.shadow.camera;
    if (sc.right !== r) { sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 10; sc.far = 200; sc.updateProjectionMatrix(); }
  }

  renderer.render(scene, camera);

  // adaptive resolution
  fpsAcc += dt; fpsN++; adaptT += dt;
  if (dt > 1 / 26) slowFrames++; else if (dt < 1 / 50) fastFrames++;
  if (adaptT > 2) {
    const fps = fpsN / fpsAcc;
    if (settings.fps) $('fps').textContent = `${fps.toFixed(0)} fps · ${(basePR * dyn).toFixed(2)}x`;
    if (slowFrames > fpsN * 0.35 && dyn > 0.55) { dyn = Math.max(0.55, dyn - 0.12); resize(); }
    else if (fastFrames > fpsN * 0.8 && dyn < 1) { dyn = Math.min(1, dyn + 0.08); resize(); }
    fpsAcc = 0; fpsN = 0; adaptT = 0; slowFrames = 0; fastFrames = 0;
  }
}

newGame();
showScreen('menu');
$('loading').classList.add('hidden');
requestAnimationFrame(t => { last = t; frame(t); });

// PWA (ignored where service workers are unavailable)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// test hook
window.__kolyan = { G, monstersState: () => monsters.map(m => [m.type, m.state, +m.sus.toFixed(2), +m.x.toFixed(1), +m.z.toFixed(1)]), player, monsters, items, level, follow, input, world, nav, collect, startPlaying, renderer };
