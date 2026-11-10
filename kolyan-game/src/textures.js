import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function tex(c, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function woodTexture() {
  const [c, g] = canvas(512, 256);
  const r = rand(7);
  g.fillStyle = '#c9a774';
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 140; i++) {
    const y = r() * 256;
    g.strokeStyle = `rgba(${120 + r() * 40},${80 + r() * 30},${40 + r() * 20},${0.08 + r() * 0.18})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * (2 + r() * 4));
    g.stroke();
  }
  for (let i = 0; i < 6; i++) { // knots
    const x = r() * 512, y = r() * 256;
    const grd = g.createRadialGradient(x, y, 1, x, y, 10 + r() * 10);
    grd.addColorStop(0, 'rgba(110,70,35,0.35)');
    grd.addColorStop(1, 'rgba(110,70,35,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(x, y, 26, 8, 0, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

export function floorTexture() {
  const [c, g] = canvas(512, 512);
  const r = rand(3);
  g.fillStyle = '#a7a9ab';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 120 + r() * 90;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + r() * 0.4})`;
    const s = 1 + r() * 2.5;
    g.fillRect(r() * 512, r() * 512, s, s);
  }
  g.strokeStyle = 'rgba(80,80,85,0.25)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 512, 512);
  return tex(c, [12, 12]);
}

export function wallTexture() {
  const [c, g] = canvas(256, 256);
  const r = rand(11);
  g.fillStyle = '#e8dccb';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(${170 + r() * 60},${160 + r() * 50},${140 + r() * 40},0.08)`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  return tex(c, [8, 3]);
}

export function chalkboardTexture() {
  const [c, g] = canvas(1024, 384);
  const r = rand(5);
  g.fillStyle = '#25433a';
  g.fillRect(0, 0, 1024, 384);
  for (let i = 0; i < 60; i++) { // smudges
    g.fillStyle = `rgba(200,220,210,${0.02 + r() * 0.04})`;
    g.beginPath(); g.ellipse(r() * 1024, r() * 384, 40 + r() * 120, 10 + r() * 40, r(), 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(235,240,235,0.85)';
  g.font = 'italic 26px Georgia, serif';
  const lines = [
    [30, 50, 'σ = √( Σ(xᵢ − x̄)² f / Σf )'],
    [30, 100, 'σ² = 10.96 → σ = 3.31'],
    [30, 150, 'V = σ / x̄ · 100%'],
    [30, 200, 'V = 3.31 / 53.33 · 100 = 6.2%'],
    [30, 250, 'V < 33% — совокупность'],
    [30, 285, '   однородна'],
    [380, 50, 'x̄ = Σxf / Σf = 53.33'],
    [380, 100, 'Mo = 49     Me = 53'],
    [380, 150, 'R = xmax − xmin = 15'],
    [380, 200, 'd = Σ|x − x̄|f / Σf'],
    [720, 50, 'f(x)'],
    [720, 300, 'Mo  Me  x̄'],
  ];
  for (const [x, y, t] of lines) g.fillText(t, x, y);
  // bell curve sketch
  g.strokeStyle = 'rgba(235,240,235,0.8)'; g.lineWidth = 3;
  g.beginPath();
  for (let x = 0; x <= 260; x += 4) {
    const t = (x - 130) / 50;
    const y = 270 - Math.exp(-t * t / 2) * 190;
    x === 0 ? g.moveTo(740 + x, y) : g.lineTo(740 + x, y);
  }
  g.stroke();
  g.beginPath(); g.moveTo(730, 272); g.lineTo(1010, 272); g.moveTo(740, 60); g.lineTo(740, 280); g.stroke();
  // panel seams
  g.fillStyle = '#6c7a7a';
  g.fillRect(338, 0, 6, 384); g.fillRect(678, 0, 6, 384);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function screenTexture() {
  const [c, g] = canvas(1024, 576);
  g.fillStyle = '#2b579a';
  g.fillRect(0, 0, 1024, 40);
  g.fillStyle = '#f3f3f3';
  g.fillRect(0, 40, 1024, 40);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 80, 1024, 450);
  g.fillStyle = '#1f3d73';
  g.fillRect(0, 530, 1024, 46);
  g.fillStyle = '#fff';
  g.font = '18px Arial';
  g.fillText('Задания для самостоятельной работы — Word', 330, 27);
  g.fillStyle = '#333';
  g.font = '14px Arial';
  ['Файл', 'Главная', 'Вставка', 'Дизайн', 'Макет', 'Ссылки', 'Рассылки', 'Рецензирование', 'Вид'].forEach((s, i) => g.fillText(s, 20 + i * 100, 66));
  g.fillStyle = '#111';
  g.font = 'bold 26px "Times New Roman", serif';
  g.fillText('Задание № 1.8', 70, 130);
  g.font = '24px "Times New Roman", serif';
  const txt = [
    'По данным статистического наблюдения оказалось, что доля расходов',
    'домашних хозяйств на продукты питания в общем объёме потребительских',
    'расходов составила (в %): 55, 60, 58, 48, 49, 45, 53, 49, 57, 45,',
    '49, 53, 55, 49, 53, 49, 57, 53, 48, 55.',
    '',
    '   Требуется построить дискретный и равноинтервальный ряды',
    'распределения домашних хозяйств по расходам на продукты питания.',
  ];
  txt.forEach((s, i) => g.fillText(s, 70, 175 + i * 40));
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function notebookTexture() {
  const [c, g] = canvas(512, 360);
  g.fillStyle = '#fbfbf8';
  g.fillRect(0, 0, 512, 360);
  g.strokeStyle = 'rgba(120,150,200,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 512; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 360); g.stroke(); }
  for (let i = 0; i < 360; i += 12) { g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  g.fillStyle = '#9aa0aa';
  g.fillRect(250, 0, 12, 360);
  for (let i = 8; i < 360; i += 18) { g.fillStyle = '#c9ccd2'; g.beginPath(); g.arc(256, i, 5, 0, 7); g.fill(); }
  g.fillStyle = '#2b3fb0';
  g.font = 'italic 22px "Comic Sans MS", cursive';
  ['x̄ = 2·8 + 3·16 + ...', 'x = 3.93 ≈ 4', 'R = xmax − xmin', 'd = Σ|x − x̄|·f', 'V > 30% — вариация', '', '0,10   0,10'].forEach((s, i) => g.fillText(s, 280, 40 + i * 42));
  ['Задание 1.8', 'σ = 3.31', 'Mo = 49', 'Me = 53'].forEach((s, i) => g.fillText(s, 20, 50 + i * 42));
  return tex(c);
}

export function bookTexture(title, color, textColor = '#fff') {
  const [c, g] = canvas(256, 384);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 384);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(0, 0, 18, 384);
  g.fillStyle = textColor;
  g.font = 'bold 28px Arial';
  const words = title.split(' ');
  words.forEach((w, i) => g.fillText(w, 30, 70 + i * 36));
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fillRect(30, 300, 80, 50);
  g.fillStyle = '#000';
  for (let i = 0; i < 14; i++) g.fillRect(36 + i * 5, 306, i % 3 ? 2 : 3, 38);
  return tex(c);
}

export function windowTexture() {
  const [c, g] = canvas(128, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#f7fbff');
  grd.addColorStop(1, '#dfe9f2');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 256);
  return tex(c);
}

export function labelTexture(text, bg, fg, w = 256, h = 128, font = 'bold 72px Arial') {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
  return tex(c);
}

export function iconSprite(char, color) {
  const [c, g] = canvas(128, 128);
  g.fillStyle = color;
  g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#111'; g.stroke();
  g.fillStyle = '#111'; g.font = 'bold 84px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(char, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
