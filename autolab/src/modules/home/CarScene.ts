import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LAYERS, LayerId } from '../../content/systems';

/*
  Голографическая машина: прозрачный кузов с френелем + контурные линии, внутри — узлы, раскрашенные по системам.
  Координаты в метрах: x — вперёд, y — вверх, z — вправо. Передний привод, поперечный рядный 4-цилиндровый мотор.
*/

const XF = 2.2, XR = -2.12, XC = (XF + XR) / 2, HL = (XF - XR) / 2;
const BELT = 0.97;
const WB = 1.3, WR = 0.315, TRACK = 0.77;
const ARCH = 0.4;
const NU = 190, NV = 76;
const HOOD_X0 = 0.68, HOOD_X1 = 2.02, HATCH_X1 = -1.12;
const HOOD_V = [18, NV - 1 - 18], HATCH_V = [14, NV - 1 - 14];

const TOP: [number, number][] = [
  [2.2, 0.56], [2.18, 0.68], [2.08, 0.78], [1.85, 0.84], [1.3, 0.9], [0.68, 0.97], [0.32, 1.18], [-0.04, 1.39],
  [-0.5, 1.45], [-1.12, 1.42], [-1.45, 1.27], [-1.8, 1.08], [-2.02, 1.0], [-2.1, 0.9], [-2.14, 0.66],
];

function topY(x: number) {
  for (let i = 0; i < TOP.length - 1; i++) {
    const [x0, y0] = TOP[i], [x1, y1] = TOP[i + 1];
    if (x <= x0 && x >= x1) {
      const ym = i > 0 ? TOP[i - 1][1] : y0, yp = i < TOP.length - 2 ? TOP[i + 2][1] : y1;
      const t = (x0 - x) / (x0 - x1);
      // Catmull-Rom по y — мягкий силуэт
      const t2 = t * t, t3 = t2 * t;
      return 0.5 * (2 * y0 + (-ym + y1) * t + (2 * ym - 5 * y0 + 4 * y1 - yp) * t2 + (-ym + 3 * y0 - 3 * y1 + yp) * t3);
    }
  }
  return x > 0 ? TOP[0][1] : TOP[TOP.length - 1][1];
}
const botY = (x: number) => 0.23 + Math.max(0, x - 1.9) * 0.35 + Math.max(0, -1.85 - x) * 0.45;
const halfW = (x: number) => {
  const xn = Math.min(1, Math.abs((x - XC) / HL));
  return 0.89 * Math.pow(1 - Math.pow(xn, 6), 1 / 6);
};

/** Сечение кузова на станции x: NV точек от левого порога через крышу к правому */
function section(x: number): [number, number][] {
  const a = halfW(x), yb = botY(x), yt = topY(x), h = yt - yb, n = 4.2;
  const dense: [number, number][] = [];
  const M = 240;
  for (let i = 0; i <= M; i++) {
    const th = Math.PI - (i / M) * Math.PI;
    const c = Math.cos(th), s = Math.sin(th);
    let z = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = yb + h * Math.pow(Math.abs(s), 2 / n);
    const f = Math.min(1, Math.max(0, (y - BELT) / 0.46));
    z *= 1 - 0.23 * Math.pow(f, 0.85);
    dense.push([z, y]);
  }
  const L = [0];
  for (let i = 1; i < dense.length; i++) L.push(L[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out: [number, number][] = [];
  let k = 0;
  for (let j = 0; j < NV; j++) {
    const target = (j / (NV - 1)) * L[L.length - 1];
    while (k < L.length - 2 && L[k + 1] < target) k++;
    const t = (target - L[k]) / Math.max(1e-6, L[k + 1] - L[k]);
    out.push([dense[k][0] + (dense[k + 1][0] - dense[k][0]) * t, dense[k][1] + (dense[k + 1][1] - dense[k][1]) * t]);
  }
  return out;
}

function archPush(x: number, y: number, z: number, a: number): [number, number] {
  if (Math.abs(z) < 0.5 * a) return [x, y];
  for (const xw of [WB, -WB]) {
    const dx = x - xw, dy = y - WR;
    const d = Math.hypot(dx, dy);
    if (d < ARCH) {
      if (dy < 0) {
        const hx = Math.sqrt(Math.max(0, ARCH * ARCH - dy * dy));
        return [xw + Math.sign(dx || 1) * hx, y];
      }
      if (d < 1e-4) return [x, y];
      return [xw + (dx / d) * ARCH, WR + (dy / d) * ARCH];
    }
  }
  return [x, y];
}

const SHELL_VS = /* glsl */ `
attribute float glass;
varying vec3 vN; varying vec3 vW; varying float vGlass;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vGlass = glass;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SHELL_FS = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uHi;
varying vec3 vN; varying vec3 vW; varying float vGlass;
void main(){
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  float f = pow(1.0 - abs(dot(N, V)), 2.2);
  float scan = 0.5 + 0.5 * sin(vW.y * 70.0 - uTime * 1.6);
  vec3 body = uColor * (0.18 + 1.25 * f) + vec3(0.6, 0.9, 1.0) * pow(max(dot(N, normalize(vec3(0.3, 1.0, 0.2))), 0.0), 18.0) * 0.25;
  float a = 0.04 + 0.5 * f + 0.025 * scan + uHi * 0.15;
  float streak = smoothstep(0.86, 1.0, sin((vW.x * 0.9 + vW.y * 1.6) * 3.2));
  vec3 gc = vec3(0.03, 0.07, 0.14) + uColor * 0.55 * f + vec3(0.7, 0.9, 1.0) * streak * 0.18;
  float ga = 0.42 + 0.35 * f;
  vec3 c = mix(body, gc, vGlass);
  a = mix(a, ga, vGlass);
  gl_FragColor = vec4(c, a * uOpacity);
}`;

const FLOW_FS = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uProgress;
varying vec2 vUv;
void main(){
  if (vUv.x > uProgress) discard;
  float d = fract(vUv.x * 14.0 - uTime * 1.6);
  float pulse = smoothstep(0.0, 0.25, d) * (1.0 - smoothstep(0.35, 0.7, d));
  float head = smoothstep(uProgress - 0.04, uProgress, vUv.x) * 1.5;
  gl_FragColor = vec4(uColor * (0.6 + 1.4 * pulse + head), 0.35 + 0.65 * pulse);
}`;
const FLOW_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const GROUND_FS = /* glsl */ `
uniform float uOffset; uniform vec3 uColor;
varying vec3 vW;
float grid(vec2 p, float s){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y), 1.0); }
void main(){
  vec2 p = vW.xz + vec2(uOffset, 0.0);
  float r = length(vW.xz);
  float fade = 1.0 - smoothstep(2.5, 9.0, r);
  float g = grid(p, 0.5) * 0.35 + grid(p, 2.5) * 0.5;
  float glow = exp(-r * r * 0.18) * 0.22;
  float shadow = 1.0 - smoothstep(0.0, 1.0, length(vec2(vW.x / 2.5, vW.z / 1.15)));
  vec3 c = uColor * (g * 0.55 * fade + glow);
  gl_FragColor = vec4(c, (g * 0.6 * fade + glow + shadow * 0.55) );
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0), shadow * 0.6);
}`;
const GROUND_VS = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

type Sys = { group: THREE.Group; mats: THREE.MeshStandardMaterial[]; base: number };
export type Gear = 'P' | 'R' | 'N' | 'D';
export type FlowName = 'gas' | 'brake' | 'steer' | 'start' | 'lights';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CarScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  el: HTMLElement;
  sys = new Map<LayerId, Sys>();
  shellMat: THREE.ShaderMaterial;
  hoodPivot = new THREE.Group();
  hatchPivot = new THREE.Group();
  bodyGroup = new THREE.Group();
  wheels: { g: THREE.Group; spin: THREE.Group; front: boolean; side: number; base: THREE.Vector3 }[] = [];
  discs: THREE.Object3D[] = [];
  calipers: THREE.MeshStandardMaterial[] = [];
  steerWheel = new THREE.Group();
  fan!: THREE.Object3D;
  pulley!: THREE.Object3D;
  headMat!: THREE.MeshStandardMaterial;
  tailMat!: THREE.MeshStandardMaterial;
  beams: THREE.Mesh[] = [];
  groundMat: THREE.ShaderMaterial;
  exhaustPts: THREE.Points;
  exhaustData: { p: THREE.Vector3; v: THREE.Vector3; life: number }[] = [];
  flowMesh: THREE.Mesh | null = null;
  flowMat: THREE.ShaderMaterial | null = null;
  clock = new THREE.Clock();
  raf = 0;
  ro: ResizeObserver;
  explodeT = 0; explodeTarget = 0;
  hoodT = 0; hoodTarget = 0;
  hatchT = 0; hatchTarget = 0;
  wheelOffT = 0; wheelOffTarget = 0;
  bodyOp = 1; bodyOpTarget = 1;
  focusId: LayerId | null = null;
  hoverId: LayerId | null = null;
  camTween: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number; dur: number } | null = null;
  // «живое» состояние для свободного режима
  live = { engine: false, throttle: 0, brake: 0, steer: 0, gear: 'P' as Gear, lights: 0, speed: 0, rpm: 0, dist: 0, cranking: 0 };
  onFrame?: () => void;
  onPick?: (id: LayerId | null) => void;
  onHover?: (id: LayerId | null) => void;
  pickables: THREE.Object3D[] = [];
  private down = { x: 0, y: 0, t: 0 };
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private disposed = false;
  autoRotateUntilInteract = true;

  constructor(el: HTMLElement, opts: { autoRotate?: boolean } = {}) {
    this.el = el;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(r.domElement);
    r.domElement.style.display = 'block';
    r.domElement.style.touchAction = 'none';
    this.renderer = r;

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);
    this.camera.position.set(4.7, 2.2, -4.6);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.set(0, 0.55, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minPolarAngle = 0.15;
    this.controls.autoRotate = !!opts.autoRotate;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this.camTween = null; });

    const hemi = new THREE.HemisphereLight(0x9fc8ff, 0x0a1020, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, -3);
    const rim = new THREE.DirectionalLight(0x3de2ff, 1.2); rim.position.set(-5, 2, 4);
    this.scene.add(hemi, key, rim);

    this.groundMat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VS, fragmentShader: GROUND_FS, transparent: true, depthWrite: false,
      uniforms: { uOffset: { value: 0 }, uColor: { value: new THREE.Color('#3de2ff') } },
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.renderOrder = -1;
    this.scene.add(ground);

    this.shellMat = new THREE.ShaderMaterial({
      vertexShader: SHELL_VS, fragmentShader: SHELL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color('#3de2ff') }, uOpacity: { value: 1 }, uTime: { value: 0 }, uHi: { value: 0 } },
    });

    this.buildBody();
    this.buildSystems();

    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    this.exhaustPts = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0x9fb3c8, size: 0.09, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.exhaustPts.frustumCulled = false;
    this.scene.add(this.exhaustPts);
    for (let i = 0; i < 60; i++) this.exhaustData.push({ p: new THREE.Vector3(0, -10, 0), v: new THREE.Vector3(), life: 0 });

    r.domElement.addEventListener('pointerdown', this.onDown);
    r.domElement.addEventListener('pointerup', this.onUp);
    r.domElement.addEventListener('pointermove', this.onMove);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.loop();
  }

  // ───────────────────────── кузов
  private buildBody() {
    const pos = new Float32Array(NU * NV * 3);
    const glass = new Float32Array(NU * NV);
    for (let i = 0; i < NU; i++) {
      const x = XR + ((XF - XR) * i) / (NU - 1);
      const sec = section(x);
      const a = halfW(x), yt = topY(x);
      for (let j = 0; j < NV; j++) {
        const [z, y0] = sec[j];
        const [x1, y1] = archPush(x, y0, z, a);
        const k = (i * NV + j) * 3;
        pos[k] = x1; pos[k + 1] = y1; pos[k + 2] = z;
        const roof = x < -0.12 && x > -1.08 && y1 > yt - 0.05;
        glass[i * NV + j] = y1 > BELT + 0.03 && !roof && x < 0.62 && x > -2.0 ? 1 : 0;
      }
    }
    const ui = (x: number) => Math.round(((x - XR) / (XF - XR)) * (NU - 1));
    const hu = [ui(HOOD_X0), ui(HOOD_X1)], tu = [0, ui(HATCH_X1)];
    const inHood = (i: number, j: number) => i >= hu[0] && i < hu[1] && j >= HOOD_V[0] && j < HOOD_V[1];
    const inHatch = (i: number, j: number) => i >= tu[0] && i < tu[1] && j >= HATCH_V[0] && j < HATCH_V[1];

    const idx: number[][] = [[], [], []];
    for (let i = 0; i < NU - 1; i++)
      for (let j = 0; j < NV - 1; j++) {
        const a = i * NV + j, b = a + NV, c = b + 1, d = a + 1;
        const bucket = inHood(i, j) ? 1 : inHatch(i, j) ? 2 : 0;
        idx[bucket].push(a, b, d, b, c, d);
      }
    const mk = (indices: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
      g.setAttribute('glass', new THREE.BufferAttribute(glass, 1));
      g.setIndex(indices);
      g.computeVertexNormals();
      return g;
    };
    const shell = new THREE.Mesh(mk(idx[0]), this.shellMat);
    shell.renderOrder = 10;
    this.bodyGroup.add(shell);

    // контурные линии
    const lines: number[][] = [[], [], []];
    const P = (i: number, j: number) => [pos[(i * NV + j) * 3], pos[(i * NV + j) * 3 + 1], pos[(i * NV + j) * 3 + 2]];
    const pushSeg = (i0: number, j0: number, i1: number, j1: number, bucket: number) => lines[bucket].push(...P(i0, j0), ...P(i1, j1));
    const uLines = new Set<number>([hu[0], hu[1], tu[1]]);
    for (let i = 4; i < NU; i += 14) uLines.add(i);
    const vLines = new Set<number>([HOOD_V[0], HOOD_V[1], HATCH_V[0], HATCH_V[1], 2, NV - 3]);
    for (let j = 6; j < NV; j += 10) vLines.add(j);
    for (const i of uLines) for (let j = 0; j < NV - 1; j++) {
      const b = inHood(Math.min(i, NU - 2), j) && i < hu[1] ? 1 : inHatch(Math.min(i, NU - 2), j) && i < tu[1] ? 2 : 0;
      if (i === hu[1] || i === tu[1] || i === hu[0]) pushSeg(i, j, i, j + 1, 0);
      else pushSeg(i, j, i, j + 1, b);
    }
    for (const j of vLines) for (let i = 0; i < NU - 1; i++) {
      const b = inHood(i, Math.min(j, NV - 2)) && j < HOOD_V[1] ? 1 : inHatch(i, Math.min(j, NV - 2)) && j < HATCH_V[1] ? 2 : 0;
      pushSeg(i, j, i + 1, j, b);
    }
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3de2ff, transparent: true, opacity: 0.32, depthWrite: false });
    const mkLines = (arr: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const l = new THREE.LineSegments(g, lineMat);
      l.renderOrder = 11;
      return l;
    };
    this.bodyGroup.add(mkLines(lines[0]));

    // капот и крышка багажника — на шарнирах
    const hx = HOOD_X0, hy = topY(HOOD_X0);
    this.hoodPivot.position.set(hx, hy, 0);
    const hood = new THREE.Mesh(mk(idx[1]), this.shellMat); hood.renderOrder = 10;
    const hoodL = mkLines(lines[1]);
    hood.position.set(-hx, -hy, 0); hoodL.position.set(-hx, -hy, 0);
    this.hoodPivot.add(hood, hoodL);
    const tx = HATCH_X1, ty = topY(HATCH_X1);
    this.hatchPivot.position.set(tx, ty, 0);
    const hatch = new THREE.Mesh(mk(idx[2]), this.shellMat); hatch.renderOrder = 10;
    const hatchL = mkLines(lines[2]);
    hatch.position.set(-tx, -ty, 0); hatchL.position.set(-tx, -ty, 0);
    this.hatchPivot.add(hatch, hatchL);
    this.bodyGroup.add(this.hoodPivot, this.hatchPivot);

    // фары и фонари
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: 0xbfeaff, emissiveIntensity: 0.4, metalness: 0.2, roughness: 0.2 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x601018, emissive: 0xff2a3a, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.18, 4, 10), this.headMat);
      h.rotation.x = Math.PI / 2; h.rotation.y = -0.45 * s;
      h.position.set(2.0, 0.72, 0.56 * s);
      const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 4, 10), this.tailMat);
      t.rotation.x = Math.PI / 2; t.rotation.y = 0.4 * s;
      t.position.set(-2.04, 0.9, 0.52 * s);
      this.bodyGroup.add(h, t);
      // световые конусы (видны при включённом свете)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 32, 1, true), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uI: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform float uI; varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(0.75,0.92,1.0), pow(vUv.y,2.5) * 0.22 * uI); }',
      }));
      cone.rotation.z = Math.PI / 2;
      cone.position.set(2.0 + 2.5, 0.55, 0.56 * s);
      cone.userData.beam = true;
      this.beams.push(cone);
      this.bodyGroup.add(cone);
    }
    this.scene.add(this.bodyGroup);
    this.bodyGroup.userData.explode = new THREE.Vector3(0, 1.75, 0);
  }

  // ───────────────────────── узлы
  private mat(id: LayerId, color: string | number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const c = LAYERS.find((l) => l.id === id)!.color;
    const m = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.38, emissive: new THREE.Color(c), emissiveIntensity: 0.18, ...o });
    this.sys.get(id)!.mats.push(m);
    return m;
  }
  private add(id: LayerId, mesh: THREE.Object3D, explode?: [number, number, number]) {
    const s = this.sys.get(id)!;
    mesh.traverse((o) => { o.userData.sys = id; });
    if (explode) mesh.userData.explode = new THREE.Vector3(...explode);
    mesh.userData.base = mesh.position.clone();
    s.group.add(mesh);
    this.pickables.push(mesh);
    return mesh;
  }
  private tube(pts: [number, number, number][], r: number, m: THREE.Material, seg = 48) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 8, false), m);
  }
  private box(w: number, h: number, d: number, m: THREE.Material, p: [number, number, number]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(...p);
    return b;
  }
  private cyl(rt: number, rb: number, h: number, m: THREE.Material, p: [number, number, number], axis: 'x' | 'y' | 'z' = 'y', seg = 24) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    if (axis === 'x') c.rotation.z = Math.PI / 2;
    if (axis === 'z') c.rotation.x = Math.PI / 2;
    c.position.set(...p);
    return c;
  }

  private buildSystems() {
    for (const l of LAYERS) {
      if (l.id === 'body') continue;
      const g = new THREE.Group();
      g.userData.layer = l.id;
      this.sys.set(l.id, { group: g, mats: [], base: 0.18 });
      this.scene.add(g);
    }
    const E = 'engine' as const;
    // ДВИГАТЕЛЬ — блок, ГБЦ, крышка, катушки, впуск, поддон, шкив
    const eng = new THREE.Group();
    const steel = this.mat(E, 0x8c9ab0);
    const dark = this.mat(E, 0x3a4458);
    const accent = this.mat(E, 0xff8a4c, { emissiveIntensity: 0.35 });
    eng.add(this.box(0.42, 0.36, 0.56, steel, [0, 0, 0]));
    eng.add(this.box(0.4, 0.1, 0.58, dark, [0, 0.23, 0]));
    eng.add(this.box(0.34, 0.06, 0.56, accent, [0, 0.31, 0]));
    for (let i = 0; i < 4; i++) eng.add(this.cyl(0.028, 0.028, 0.06, dark, [0, 0.36, -0.21 + i * 0.14]));
    eng.add(this.box(0.36, 0.08, 0.5, dark, [0, -0.22, 0]));
    for (let i = 0; i < 4; i++) {
      const z = -0.21 + i * 0.14;
      eng.add(this.tube([[-0.2, 0.15, z], [-0.32, 0.2, z], [-0.38, 0.08, z * 0.6], [-0.36, -0.02, 0]], 0.022, steel, 16));
    }
    eng.add(this.box(0.1, 0.12, 0.42, steel, [-0.4, 0.0, 0]));
    const pulley = this.cyl(0.07, 0.07, 0.03, accent, [0.05, -0.1, 0.31], 'z');
    eng.add(pulley);
    this.pulley = pulley;
    eng.add(this.cyl(0.055, 0.055, 0.1, steel, [0.17, 0.12, 0.28], 'z')); // генератор
    eng.position.set(1.42, 0.52, 0.05);
    this.add(E, eng, [0.5, 0.75, 0.15]);

    // ТРАНСМИССИЯ — коробка-трансэксл, полуоси
    const G = 'gearbox' as const;
    const gm = this.mat(G, 0x8aa2c4);
    const gb = new THREE.Group();
    gb.add(this.cyl(0.2, 0.15, 0.16, gm, [0, 0, 0.08], 'z'));
    const caseM = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.22, 6, 14), gm);
    caseM.rotation.x = Math.PI / 2; caseM.position.set(-0.02, -0.02, -0.12);
    gb.add(caseM);
    gb.position.set(1.36, 0.46, -0.36);
    this.add(G, gb, [0.1, 0.45, -0.95]);
    const shaftM = this.mat(G, 0xb8c7dc);
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.add(this.tube([[1.3, 0.34, s < 0 ? -0.38 : -0.2], [1.3, 0.33, 0.45 * s], [WB, WR, (TRACK - 0.12) * s]], 0.018, shaftM, 12));
      sh.add(this.cyl(0.035, 0.035, 0.07, shaftM, [WB, WR, (TRACK - 0.14) * s], 'z'));
      this.add(G, sh, [0, 0.25, 0.35 * s]);
    }

    // ОХЛАЖДЕНИЕ — радиатор, вентилятор, патрубки, бачок
    const C = 'cooling' as const;
    const cm = this.mat(C, 0x6fd8cc, { metalness: 0.4 });
    const rad = new THREE.Group();
    rad.add(this.box(0.04, 0.34, 1.12, cm, [0, 0, 0]));
    for (let i = -5; i <= 5; i++) rad.add(this.box(0.045, 0.32, 0.006, this.mat(C, 0x2a6e68), [0, 0, i * 0.1]));
    const fan = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const blade = this.box(0.01, 0.14, 0.05, cm, [0, 0.07, 0]);
      const bg = new THREE.Group(); bg.add(blade); bg.rotation.x = (i * Math.PI) / 3;
      fan.add(bg);
    }
    fan.position.set(-0.06, 0, 0.18);
    rad.add(fan);
    this.fan = fan;
    rad.position.set(1.97, 0.5, 0);
    this.add(C, rad, [1.0, 0.25, 0]);
    this.add(C, this.tube([[1.62, 0.78, 0.1], [1.8, 0.8, 0.2], [1.95, 0.64, 0.3]], 0.022, cm, 20), [0.7, 0.45, 0]);
    this.add(C, this.tube([[1.6, 0.42, 0.25], [1.8, 0.33, 0.35], [1.95, 0.36, 0.42]], 0.022, cm, 20), [0.7, 0.2, 0]);
    this.add(C, this.box(0.14, 0.12, 0.1, this.mat(C, 0xd8f5f2, { transparent: true, opacity: 0.85 }), [1.65, 0.78, 0.55]), [0.4, 0.6, 0.2]);

    // ВЫХЛОП — коллектор, приёмная труба, катализатор, резонатор, глушитель
    const X = 'exhaust' as const;
    const xm = this.mat(X, 0xa59487, { metalness: 0.7, roughness: 0.45 });
    const hot = this.mat(X, 0xff6a3c, { emissiveIntensity: 0.4 });
    const ex = new THREE.Group();
    ex.add(this.tube([[1.66, 0.62, 0.05], [1.76, 0.42, 0.05], [1.62, 0.2, 0.1], [1.0, 0.16, 0.12], [-0.4, 0.16, 0.14], [-1.4, 0.2, 0.25], [-1.72, 0.24, 0.32]], 0.03, xm, 80));
    ex.add(this.tube([[1.66, 0.62, -0.2], [1.66, 0.64, 0.05], [1.66, 0.62, 0.28]], 0.035, hot, 10));
    const cat = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 6, 14), hot);
    cat.rotation.z = Math.PI / 2; cat.position.set(0.9, 0.17, 0.12);
    ex.add(cat);
    const res = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 6, 14), xm);
    res.rotation.z = Math.PI / 2; res.position.set(-0.3, 0.16, 0.14);
    ex.add(res);
    ex.add(this.box(0.3, 0.16, 0.55, xm, [-1.82, 0.26, 0.2]));
    ex.add(this.tube([[-1.82, 0.24, 0.45], [-2.0, 0.24, 0.5], [-2.18, 0.25, 0.5]], 0.03, xm, 10));
    this.add(X, ex, [0, -0.55, 0]);

    // ТОПЛИВО — бак, горловина, магистраль, рампа
    const F = 'fuel' as const;
    const fm = this.mat(F, 0xc99a4a, { metalness: 0.3 });
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.85, 6, 16), fm);
    tank.rotation.x = Math.PI / 2; tank.scale.set(1.6, 1, 0.75); tank.position.set(-0.95, 0.34, 0);
    this.add(F, tank, [-0.2, -0.45, 0]);
    this.add(F, this.tube([[-1.05, 0.4, 0.4], [-1.4, 0.6, 0.7], [-1.55, 0.82, 0.84]], 0.025, fm, 16), [-0.3, -0.2, 0.3]);
    this.add(F, this.tube([[-0.8, 0.3, -0.2], [0.2, 0.2, -0.3], [1.0, 0.24, -0.25], [1.15, 0.55, -0.05], [1.12, 0.62, 0.05]], 0.009, this.mat(F, 0xffb547, { emissiveIntensity: 0.5 }), 60), [0, -0.3, 0]);

    // ПОДВЕСКА — стойки МакФерсон спереди, балка сзади
    const S = 'suspension' as const;
    const sm = this.mat(S, 0x7fcf63);
    const sm2 = this.mat(S, 0x9aa8bd);
    const spring = (h: number, r: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 140; i++) { const a = i * 0.32; pts.push(new THREE.Vector3(Math.cos(a) * r, (i / 140) * h, Math.sin(a) * r)); }
      return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.011, 6, false), sm);
    };
    for (const s of [-1, 1]) {
      const st = new THREE.Group();
      st.add(this.cyl(0.028, 0.028, 0.42, sm2, [0, 0.21, 0]));
      const sp = spring(0.24, 0.07); sp.position.y = 0.22; st.add(sp);
      st.add(this.cyl(0.08, 0.08, 0.02, sm2, [0, 0.47, 0]));
      st.position.set(WB - 0.02, 0.38, (TRACK - 0.13) * s);
      st.rotation.x = 0.12 * s;
      this.add(S, st, [0, 0.3, 0.55 * s]);
      this.add(S, this.tube([[WB, 0.27, (TRACK - 0.1) * s], [WB + 0.05, 0.25, 0.35 * s], [WB - 0.25, 0.25, 0.32 * s]], 0.018, sm2, 12), [0, -0.1, 0.45 * s]);
      const rs = new THREE.Group();
      const sp2 = spring(0.2, 0.065); rs.add(sp2);
      rs.position.set(-WB + 0.08, 0.3, (TRACK - 0.2) * s);
      this.add(S, rs, [0, 0.3, 0.5 * s]);
      this.add(S, this.cyl(0.022, 0.022, 0.36, sm2, [-WB - 0.12, 0.42, (TRACK - 0.16) * s]), [0, 0.3, 0.55 * s]);
      this.add(S, this.tube([[-WB, WR, (TRACK - 0.14) * s], [-WB + 0.3, 0.3, (TRACK - 0.2) * s], [-WB + 0.55, 0.32, (TRACK - 0.22) * s]], 0.025, sm2, 12), [0, -0.1, 0.4 * s]);
    }
    this.add(S, this.box(0.08, 0.06, 1.12, sm, [-WB + 0.25, 0.3, 0]), [0, -0.25, 0]);
    this.add(S, this.tube([[WB - 0.15, 0.3, -0.62], [WB - 0.3, 0.28, -0.3], [WB - 0.3, 0.28, 0.3], [WB - 0.15, 0.3, 0.62]], 0.012, sm, 20), [0, -0.2, 0]); // стабилизатор

    // ТОРМОЗА — диски, суппорты, вакуумник, ГТЦ, магистрали
    const B = 'brakes' as const;
    const bm = this.mat(B, 0x9aa3b2, { metalness: 0.8, roughness: 0.3 });
    const bl = this.mat(B, 0xff4b5c, { emissiveIntensity: 0.45 });
    const booster = this.cyl(0.11, 0.11, 0.09, bm, [0.72, 0.72, -0.48], 'x');
    this.add(B, booster, [0.1, 0.6, -0.2]);
    this.add(B, this.cyl(0.03, 0.03, 0.16, bl, [0.84, 0.72, -0.48], 'x'), [0.1, 0.6, -0.2]);
    for (const [x, s] of [[WB, -1], [WB, 1], [-WB, -1], [-WB, 1]] as const) {
      this.add(B, this.tube([[0.9, 0.72, -0.48], [x > 0 ? 1.0 : 0.4, 0.3, 0.3 * s], [x * 0.9, 0.36, 0.55 * s], [x, 0.42, (TRACK - 0.2) * s]], 0.006, bl, 40), [0, 0.15, 0.1 * s]);
    }

    // РУЛЕВОЕ — рейка, тяги, вал, руль
    const R = 'steering' as const;
    const rm = this.mat(R, 0xb7a3e8);
    this.add(R, this.cyl(0.03, 0.03, 0.82, rm, [WB - 0.18, 0.4, 0], 'z'), [0, 0.55, 0]);
    for (const s of [-1, 1]) this.add(R, this.tube([[WB - 0.18, 0.4, 0.41 * s], [WB - 0.12, 0.41, 0.56 * s], [WB - 0.1, 0.4, (TRACK - 0.12) * s]], 0.012, rm, 10), [0, 0.55, 0.2 * s]);
    this.add(R, this.tube([[WB - 0.18, 0.43, -0.32], [0.95, 0.55, -0.36], [0.62, 0.8, -0.38], [0.36, 0.92, -0.38]], 0.016, rm, 30), [0, 0.6, 0]);
    const swm = this.mat(R, 0xd2c4f5);
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 10, 40), swm);
    this.steerWheel.add(sw);
    this.steerWheel.add(this.box(0.02, 0.02, 0.32, swm, [0, 0, 0]));
    this.steerWheel.add(this.box(0.02, 0.16, 0.02, swm, [0, -0.08, 0]));
    this.steerWheel.position.set(0.33, 0.93, -0.38);
    this.steerWheel.rotation.set(0, Math.PI / 2, 0);
    this.steerWheel.rotateX(-0.42);
    this.add(R, this.steerWheel, [0, 0.6, 0]);

    // ЭЛЕКТРИКА — АКБ, блок предохранителей, стартер, проводка
    const L = 'electrics' as const;
    const lm = this.mat(L, 0x35404f);
    const ly = this.mat(L, 0xffe45c, { emissiveIntensity: 0.5 });
    const bat = new THREE.Group();
    bat.add(this.box(0.26, 0.18, 0.16, lm, [0, 0, 0]));
    bat.add(this.box(0.27, 0.025, 0.17, ly, [0, 0.1, 0]));
    bat.add(this.cyl(0.015, 0.015, 0.03, this.mat(L, 0xff4b5c, { emissiveIntensity: 0.6 }), [0.08, 0.125, 0.05]));
    bat.add(this.cyl(0.015, 0.015, 0.03, lm, [-0.08, 0.125, 0.05]));
    bat.position.set(1.6, 0.72, -0.6);
    this.add(L, bat, [0.2, 1.1, -0.4]);
    this.add(L, this.box(0.16, 0.08, 0.12, lm, [1.22, 0.78, -0.62]), [0.1, 1.1, -0.4]);
    this.add(L, this.cyl(0.045, 0.045, 0.16, ly, [1.22, 0.4, -0.2], 'z'), [0.1, 0.5, 0]); // стартер
    this.add(L, this.tube([[1.62, 0.82, -0.52], [1.45, 0.6, -0.35], [1.25, 0.42, -0.25]], 0.01, ly, 20), [0.15, 0.8, -0.2]);
    this.add(L, this.tube([[1.22, 0.8, -0.56], [0.7, 0.9, -0.7], [-0.6, 0.6, -0.78], [-2.0, 0.9, -0.62]], 0.006, ly, 60), [0, 0.9, -0.2]);
    this.add(L, this.box(0.12, 0.04, 0.2, ly, [0.42, 0.88, 0.05]), [0, 1.0, 0]); // ЭБУ/щиток

    // САЛОН — сиденья, торпедо, педали
    const K = 'cabin' as const;
    const km = this.mat(K, 0x56637c, { metalness: 0.1, roughness: 0.8 });
    const kl = this.mat(K, 0x9fb3d6, { metalness: 0.2 });
    this.add(K, this.box(0.22, 0.2, 1.5, km, [0.48, 0.82, 0]), [0.2, 0.9, 0]);
    for (const z of [-0.38, 0.38]) {
      const seat = new THREE.Group();
      seat.add(this.box(0.48, 0.1, 0.48, km, [0, 0, 0]));
      const back = this.box(0.1, 0.6, 0.46, km, [-0.24, 0.3, 0]); back.rotation.z = 0.2;
      seat.add(back);
      seat.add(this.box(0.08, 0.14, 0.26, km, [-0.32, 0.66, 0]));
      seat.position.set(-0.15, 0.45, z);
      this.add(K, seat, [0, 1.05, 0.25 * Math.sign(z)]);
    }
    const bench = new THREE.Group();
    bench.add(this.box(0.45, 0.1, 1.35, km, [0, 0, 0]));
    const bb = this.box(0.1, 0.55, 1.35, km, [-0.24, 0.28, 0]); bb.rotation.z = 0.25; bench.add(bb);
    bench.position.set(-1.0, 0.47, 0);
    this.add(K, bench, [-0.2, 1.05, 0]);
    for (const [z, h] of [[-0.52, 0.06], [-0.4, 0.07], [-0.28, 0.1]] as const) this.add(K, this.box(0.03, h, 0.06, kl, [0.62, 0.36, z]), [0.15, 0.7, 0]);

    // КОЛЁСА
    const W = 'wheels' as const;
    const tireM = this.mat(W, 0x1b2230, { metalness: 0.0, roughness: 0.85, emissiveIntensity: 0.05 });
    const rimM = this.mat(W, 0xc8d4e6, { metalness: 0.9, roughness: 0.25, emissiveIntensity: 0.06 });
    const prof: THREE.Vector2[] = [];
    const tw = 0.205 / 2;
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      prof.push(new THREE.Vector2(0.21 + Math.sin(a) * 0.105 * (0.85 + 0.15 * Math.sin(a)), -tw * Math.cos(a)));
    }
    const tireG = new THREE.LatheGeometry(prof, 48);
    for (const [x, s] of [[WB, -1], [WB, 1], [-WB, -1], [-WB, 1]] as const) {
      const g = new THREE.Group();
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(tireG, tireM);
      tire.rotation.x = Math.PI / 2;
      spin.add(tire);
      spin.add(this.cyl(0.2, 0.2, 0.05, rimM, [0, 0, 0.05 * s], 'z', 32));
      for (let k = 0; k < 5; k++) {
        const sp = this.box(0.18, 0.035, 0.02, rimM, [0, 0, 0.08 * s]);
        const sg = new THREE.Group(); sg.add(sp); sg.rotation.z = (k * Math.PI * 2) / 5;
        sp.position.x = 0.09;
        spin.add(sg);
      }
      g.add(spin);
      g.position.set(x, WR, TRACK * s);
      this.wheels.push({ g, spin, front: x > 0, side: s, base: g.position.clone() });
      this.add(W, g, [0, 0, 0.75 * s]);
      // диск и суппорт — внутри колеса, в слое тормозов
      const disc = new THREE.Group();
      const rot = new THREE.Group();
      rot.add(this.cyl(0.15, 0.15, 0.022, bm, [0, 0, 0], 'z', 36));
      rot.add(this.cyl(0.07, 0.07, 0.03, this.mat(B, 0x5a6475), [0, 0, 0], 'z'));
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; rot.add(this.cyl(0.012, 0.012, 0.026, this.mat(B, 0x2a3140), [Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0], 'z', 8)); }
      disc.add(rot);
      disc.userData.rot = rot;
      const cm2 = this.mat(B, 0xff4b5c, { emissiveIntensity: 0.4 });
      this.calipers.push(cm2);
      const cal = this.box(0.09, 0.12, 0.06, cm2, [-0.11, 0.08, 0]);
      cal.rotation.z = 0.6;
      disc.add(cal);
      disc.position.set(x, WR, (TRACK - 0.07) * s);
      this.discs.push(disc);
      this.add(B, disc, [0, 0, 0.5 * s]);
    }
  }

  // ───────────────────────── публичное API
  setExplode(on: boolean) { this.explodeTarget = on ? 1 : 0; }
  setLayer(id: LayerId, visible: boolean) {
    if (id === 'body') { this.bodyGroup.visible = visible; return; }
    const s = this.sys.get(id); if (s) s.group.visible = visible;
  }
  setHood(open: boolean) { this.hoodTarget = open ? 1 : 0; }
  setHatch(open: boolean) { this.hatchTarget = open ? 1 : 0; }
  setWheelOff(off: boolean) { this.wheelOffTarget = off ? 1 : 0; }
  setXray(on: boolean) { this.bodyOpTarget = on ? 0.22 : 1; }

  highlight(id: LayerId | null) {
    this.focusId = id;
    this.sys.forEach((s, key) => {
      const on = id === key;
      s.mats.forEach((m) => {
        m.userData.hi = on ? 1 : 0;
        m.transparent = !!id && !on;
        m.opacity = id && !on ? 0.22 : 1;
        m.depthWrite = !(id && !on);
      });
    });
    this.bodyOpTarget = id ? (id === 'cabin' ? 0.4 : 0.32) : this.explodeTarget ? 0.6 : 1;
  }

  focus(id: LayerId | null, anchor?: [number, number, number]) {
    this.highlight(id);
    this.setHood(id === 'engine' || id === 'cooling' || id === 'electrics');
    if (!id || !anchor) { this.flyTo(new THREE.Vector3(4.7, 2.2, -4.6), new THREE.Vector3(0, 0.55, 0)); return; }
    const t = new THREE.Vector3(...anchor);
    const dir = new THREE.Vector3(anchor[0] * 0.5, 0, anchor[2] === 0 ? -1 : anchor[2]).normalize();
    const from = t.clone().add(dir.multiplyScalar(3.2)).add(new THREE.Vector3(0, 1.7, 0));
    if (id === 'engine' || id === 'cooling') from.set(t.x + 1.5, t.y + 2.1, t.z - 1.7);
    if (id === 'cabin') from.set(1.8, 2.6, -2.4);
    this.flyTo(from, t);
  }

  flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1.3) {
    this.controls.autoRotate = false;
    this.camTween = { from: this.camera.position.clone(), to: pos, tFrom: this.controls.target.clone(), tTo: target, t: 0, dur };
  }

  /** Путь энергии/жидкости для «Покажи, что происходит» */
  static FLOWS: Record<FlowName, { color: string; pts: [number, number, number][]; steps: { at: number; label: string }[] }> = {
    gas: {
      color: '#3de2ff',
      pts: [[0.62, 0.38, -0.28], [0.9, 0.6, -0.2], [1.06, 0.62, 0.05], [1.3, 0.72, 0.05], [1.42, 0.42, 0.05], [1.36, 0.46, -0.3], [1.3, 0.34, -0.3], [1.3, 0.33, 0.2], [WB, WR, TRACK - 0.1]],
      steps: [{ at: 0, label: 'Педаль газа → датчик → ЭБУ' }, { at: 0.2, label: 'Дроссель открывается: больше воздуха' }, { at: 0.38, label: 'Цилиндры: больше топлива, сильнее рабочий ход' }, { at: 0.52, label: 'Коленвал крутится быстрее' }, { at: 0.64, label: 'Сцепление/гидротрансформатор → коробка' }, { at: 0.78, label: 'Главная пара и дифференциал' }, { at: 0.92, label: 'Приводы (ШРУСы) → передние колёса' }],
    },
    brake: {
      color: '#ff4b5c',
      pts: [[0.62, 0.38, -0.4], [0.68, 0.7, -0.48], [0.84, 0.72, -0.48], [1.0, 0.3, 0.0], [1.25, 0.4, 0.5], [WB, 0.42, TRACK - 0.07]],
      steps: [{ at: 0, label: 'Педаль тормоза' }, { at: 0.18, label: 'Вакуумный усилитель умножает усилие' }, { at: 0.36, label: 'Главный цилиндр создаёт давление жидкости' }, { at: 0.6, label: 'Трубки — к каждому колесу' }, { at: 0.86, label: 'Суппорт сжимает колодками диск → тепло' }],
    },
    steer: {
      color: '#c79bff',
      pts: [[0.33, 0.93, -0.38], [0.62, 0.8, -0.38], [0.95, 0.55, -0.36], [WB - 0.18, 0.42, -0.32], [WB - 0.18, 0.4, 0.3], [WB - 0.1, 0.4, TRACK - 0.12]],
      steps: [{ at: 0, label: 'Руль' }, { at: 0.25, label: 'Рулевой вал с карданами' }, { at: 0.55, label: 'Шестерня двигает рейку' }, { at: 0.8, label: 'Тяги поворачивают кулаки и колёса' }],
    },
    start: {
      color: '#ffe45c',
      pts: [[1.6, 0.84, -0.6], [1.45, 0.62, -0.4], [1.22, 0.42, -0.2], [1.3, 0.45, 0.05], [1.59, 0.64, 0.33], [1.62, 0.84, -0.58]],
      steps: [{ at: 0, label: 'АКБ отдаёт 100–300 А' }, { at: 0.3, label: 'Стартер крутит маховик' }, { at: 0.5, label: 'Двигатель запустился' }, { at: 0.72, label: 'Генератор крутится от ремня' }, { at: 0.92, label: '≈14 В: питание + зарядка АКБ' }],
    },
    lights: {
      color: '#ffe45c',
      pts: [[1.6, 0.84, -0.6], [1.22, 0.82, -0.62], [1.5, 0.8, -0.2], [2.05, 0.75, -0.6]],
      steps: [{ at: 0, label: 'АКБ / генератор' }, { at: 0.35, label: 'Предохранитель и реле' }, { at: 0.8, label: 'Лампы фар' }],
    },
  };

  showFlow(name: FlowName | null) {
    if (this.flowMesh) { this.scene.remove(this.flowMesh); this.flowMesh.geometry.dispose(); this.flowMesh = null; }
    if (!name) return;
    const f = CarScene.FLOWS[name];
    const curve = new THREE.CatmullRomCurve3(f.pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    this.flowMat = new THREE.ShaderMaterial({
      vertexShader: FLOW_VS, fragmentShader: FLOW_FS, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(f.color) }, uTime: { value: 0 }, uProgress: { value: 0 } },
    });
    this.flowMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.034, 10, false), this.flowMat);
    this.flowMesh.renderOrder = 50;
    this.flowMesh.userData.curve = curve;
    this.scene.add(this.flowMesh);
  }
  flowProgress() { return this.flowMat ? (this.flowMat.uniforms.uProgress.value as number) : 0; }
  flowPoint(t: number) {
    const c = this.flowMesh?.userData.curve as THREE.CatmullRomCurve3 | undefined;
    return c ? c.getPoint(Math.min(1, Math.max(0, t))) : null;
  }

  /** Экранные координаты точки (px внутри контейнера); vis — смотрит ли метка на камеру */
  project(p: [number, number, number] | THREE.Vector3, normal?: [number, number, number]) {
    const v = p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(...p);
    const w = this.el.clientWidth, h = this.el.clientHeight;
    let vis = 1;
    if (normal) {
      const n = new THREE.Vector3(...normal).normalize();
      const toCam = this.camera.position.clone().sub(v).normalize();
      vis = n.dot(toCam) > -0.1 ? 1 : 0.28;
    }
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, vis, behind: v.z > 1 };
  }

  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  private onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6 || performance.now() - this.down.t > 600) return;
    this.onPick?.(this.pick(e));
  };
  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const id = this.pick(e);
    if (id !== this.hoverId) {
      this.hoverId = id;
      this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      this.onHover?.(id);
    }
  };
  private pick(e: PointerEvent): LayerId | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.pickables.filter((o) => o.parent?.visible !== false), true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      let ok = true;
      while (o) { if (!o.visible) ok = false; o = o.parent; }
      if (ok && h.object.userData.sys) return h.object.userData.sys as LayerId;
    }
    return null;
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // на узком экране отодвигаем камеру, чтобы машина влезала целиком
    this.camera.fov = w / h < 0.8 ? 50 : w / h < 1.3 ? 40 : 32;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const k = 1 - Math.pow(0.0025, dt);
    this.explodeT += (this.explodeTarget - this.explodeT) * k * 0.8;
    this.hoodT += (this.hoodTarget - this.hoodT) * k;
    this.hatchT += (this.hatchTarget - this.hatchT) * k;
    this.wheelOffT += (this.wheelOffTarget - this.wheelOffT) * k * 0.7;
    this.bodyOp += (this.bodyOpTarget - this.bodyOp) * k;
    const ex = ease(Math.min(1, Math.max(0, this.explodeT)));

    this.shellMat.uniforms.uTime.value = t;
    this.shellMat.uniforms.uOpacity.value = this.bodyOp * (1 - ex * 0.45);
    this.hoodPivot.rotation.z = this.hoodT * 1.0;
    this.hatchPivot.rotation.z = -this.hatchT * 1.15;
    const bx = this.bodyGroup.userData.explode as THREE.Vector3;
    this.bodyGroup.position.copy(bx).multiplyScalar(ex);

    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    this.sys.forEach((s) => {
      s.group.children.forEach((c) => {
        const e = c.userData.explode as THREE.Vector3 | undefined;
        const b = c.userData.base as THREE.Vector3;
        if (e && b) c.position.copy(b).addScaledVector(e, ex);
      });
      s.mats.forEach((m) => {
        const target = m.userData.hi ? 0.55 + 0.45 * pulse : (m.userData.base ?? (m.userData.base = m.emissiveIntensity));
        m.emissiveIntensity += (target - m.emissiveIntensity) * 0.2;
      });
    });

    // живая физика свободного режима
    const L = this.live;
    if (L.cranking > 0) L.cranking -= dt;
    const idle = L.engine ? 820 : 0;
    const dir = L.gear === 'R' ? -1 : 1;
    const inGear = L.engine && (L.gear === 'D' || L.gear === 'R');
    const vmax = L.gear === 'R' ? 4 : 40;
    let acc = inGear ? L.throttle * 3.2 + 0.25 : 0;
    acc -= L.brake * 9 + 0.18 + Math.abs(L.speed) * 0.02;
    if (L.gear === 'P') acc = -20;
    L.speed = Math.min(vmax, Math.max(0, L.speed + acc * dt));
    const targetRpm = L.cranking > 0 ? 250 : L.engine ? (inGear ? Math.max(idle + L.throttle * 3200, L.speed * 115 + idle * 0.6) : idle + L.throttle * 5200) : 0;
    L.rpm += (targetRpm - L.rpm) * Math.min(1, dt * 4);
    L.dist += L.speed * dt * dir;
    this.groundMat.uniforms.uOffset.value = L.dist;
    this.wheels.forEach((w, i) => {
      const spin = ((L.speed * dir) / WR) * dt;
      w.spin.rotation.z -= spin;
      // Аккерман: внутреннее колесо поворачивает сильнее
      const steer = w.front ? L.steer * (0.5 + (Math.sign(L.steer) === -w.side ? 0.0 : 0.08)) : 0;
      w.g.rotation.y = -steer;
      const off = i === 0 ? ease(this.wheelOffT) : 0;
      const e = w.g.userData.explode as THREE.Vector3;
      w.g.position.copy(w.base).addScaledVector(e, ex);
      w.g.position.y += off * 0.1;
      w.g.position.z += off * 0.6 * w.side;
      w.g.rotation.x = off * 0.3 * w.side;
      const d = this.discs[i];
      (d.userData.rot as THREE.Object3D).rotation.z -= spin;
      d.rotation.y = -steer;
      this.calipers[i].emissiveIntensity = 0.4 + L.brake * 2.2;
    });
    this.steerWheel.rotation.set(0, Math.PI / 2, 0);
    this.steerWheel.rotateX(-0.42);
    this.steerWheel.rotateZ(-L.steer * 2.6);
    if (this.fan) this.fan.rotation.z += (L.engine ? 18 : 0) * dt;
    if (this.pulley) this.pulley.rotation.y += (L.rpm / 60) * Math.PI * 2 * dt * 0.08;
    const eng = this.sys.get('engine')!.group.children[0];
    if (L.engine && eng.userData.base) eng.position.y = (eng.userData.base as THREE.Vector3).y + ex * 0.75 + Math.sin(t * 90) * 0.0025 * (1 + L.throttle);
    this.headMat.emissiveIntensity = L.lights ? (L.lights > 1 ? 4.5 : 2.6) : 0.4;
    this.tailMat.emissiveIntensity = (L.lights ? 1.4 : 0.5) + L.brake * 3;
    this.beams.forEach((b) => {
      const m = b.material as THREE.ShaderMaterial;
      m.uniforms.uI.value += ((L.lights ? (L.lights > 1 ? 1.4 : 0.8) : 0) - m.uniforms.uI.value) * 0.15;
      b.rotation.z = Math.PI / 2 + (L.lights > 1 ? 0.0 : -0.06);
    });

    // выхлоп
    const ep = this.exhaustPts.geometry.attributes.position as THREE.BufferAttribute;
    this.exhaustData.forEach((p, i) => {
      if (p.life <= 0 && L.engine && Math.random() < 0.25 + L.throttle * 0.6) {
        p.p.set(-2.2 + this.bodyGroup.position.x * 0, 0.25, 0.5);
        p.v.set(-0.6 - Math.random() * 0.5 - L.throttle, 0.15 + Math.random() * 0.2, (Math.random() - 0.5) * 0.2);
        p.life = 1;
      }
      if (p.life > 0) { p.p.addScaledVector(p.v, dt); p.life -= dt * 0.9; } else p.p.y = -10;
      ep.setXYZ(i, p.p.x, p.p.y, p.p.z);
    });
    ep.needsUpdate = true;

    if (this.flowMat) {
      this.flowMat.uniforms.uTime.value = t;
      this.flowMat.uniforms.uProgress.value = Math.min(1.02, (this.flowMat.uniforms.uProgress.value as number) + dt * 0.28);
    }

    if (this.camTween) {
      const c = this.camTween;
      c.t = Math.min(1, c.t + dt / c.dur);
      const e = ease(c.t);
      this.camera.position.lerpVectors(c.from, c.to, e);
      this.controls.target.lerpVectors(c.tFrom, c.tTo, e);
      if (c.t >= 1) this.camTween = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
