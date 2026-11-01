"""№67 — монтаж в стиле Spider-Verse, покадровый рендер 1920x1080@60.
Использование: python3 render.py SRC.mp4 out_video.mp4 [--frames a:b] [--png dir]
"""
import sys, os, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from functools import lru_cache
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1920, 1080, 60
SW, SH, SFPS = 848, 480, 30
B = 60 / 140
TOTAL = 38 * B
NFR = int(TOTAL * FPS)
FB = os.path.join(HERE, 'Bangers.ttf')
FR = os.path.join(HERE, 'RubikMono.ttf')
f32 = np.float32

# ключевые точки исходника
T_REL, T_SWISH, T_END = 4.58, 5.80, 8.366
RIM = (555.0, 66.0)
HEAD_SENSE = (436.0, 218.0)
BALL_REL = (452.0, 110.0)
TAG67 = (430.0, 222.0)

# сцены (сек вывода)
S1, S2, S3, S4, S5, S6, S7, S8 = [k * B for k in (0, 2, 12, 16, 20, 22, 26, 32)]
S3B, S3C = S3 + 1.5 * B, S3 + 3 * B
REL_HOLD = 0.12

FRAMES = None


def load(src):
    global FRAMES
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    FRAMES = np.frombuffer(raw, np.uint8).reshape(-1, SH, SW, 3)


# ---------- утилиты ----------
def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def seg(t, a, b): return clamp((t - a) / (b - a))
def lerp(a, b, t): return a + (b - a) * t
def eio(t): return 4 * t ** 3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def eout(t): return 1 - (1 - t) ** 3
def eexpo(t): return 1 if t >= 1 else 1 - 2 ** (-10 * t)
def eback(t, s=2.2): t -= 1; return 1 + (s + 1) * t ** 3 + s * t ** 2
def eel(t):
    if t <= 0: return 0
    if t >= 1: return 1
    return 2 ** (-9 * t) * math.sin((t * 10 - .75) * 2 * math.pi / 3) + 1
def to8(a): return (np.clip(a, 0, 1) * 255 + .5).astype(np.uint8)
def tof(im): return np.asarray(im, dtype=f32) / 255
def lum(a): return a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
def lerpcam(c0, c1, t): return tuple(lerp(x, y, t) for x, y in zip(c0, c1))


# ---------- камера ----------
def fit(cam):
    cx, cy, z, rot = cam
    c, s = abs(math.cos(math.radians(rot))), abs(math.sin(math.radians(rot)))
    hw0, hh0 = SW / 2, SW / 2 * 9 / 16
    zmin = max((hw0 * c + hh0 * s) / (SW / 2), (hw0 * s + hh0 * c) / (SH / 2))
    z = max(z, zmin)
    hw, hh = (hw0 * c + hh0 * s) / z, (hw0 * s + hh0 * c) / z
    cx = clamp(cx, hw, SW - hw); cy = clamp(cy, hh, SH - hh)
    return cx, cy, z, rot


def coeffs(cam):
    cx, cy, z, rot = fit(cam)
    s = (SW / z) / W
    c, n = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    return (s * c, s * n, cx - s * c * W / 2 - s * n * H / 2,
            -s * n, s * c, cy + s * n * W / 2 - s * c * H / 2)


def project(cam, x, y):
    cx, cy, z, rot = fit(cam)
    s = (SW / z) / W
    c, n = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    dx, dy = x - cx, y - cy
    return W / 2 + (c * dx - n * dy) / s, H / 2 + (n * dx + c * dy) / s


def srcimg(ts):
    i = int(round(ts * SFPS)); i = max(0, min(len(FRAMES) - 1, i))
    return Image.fromarray(FRAMES[i])


def view(ts, camf, T, mb=True):
    """кадр исходника через виртуальную камеру + моушн-блюр по скорости камеры"""
    im = srcimg(ts)
    n = 1
    if mb:
        a, b = fit(camf(T - 1 / 120)), fit(camf(T + 1 / 120))
        disp = (abs(a[0] - b[0]) + abs(a[1] - b[1])) * W * b[2] / SW + abs(a[2] - b[2]) / b[2] * 900 + abs(a[3] - b[3]) * 16
        n = int(clamp(disp / 7, 1, 7))
    if n == 1:
        return tof(im.transform((W, H), Image.AFFINE, coeffs(camf(T)), Image.BICUBIC))
    acc = np.zeros((H, W, 3), f32)
    for k in range(n):
        tt = T + (k / (n - 1) - .5) / FPS * .5
        acc += np.asarray(im.transform((W, H), Image.AFFINE, coeffs(camf(tt)), Image.BILINEAR), f32)
    return acc / (n * 255)


# ---------- эффекты ----------
_grid = {}
def grid(cell, ang):
    k = (cell, ang)
    if k not in _grid:
        y, x = np.mgrid[0:H, 0:W].astype(f32)
        c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        u, v = x * c + y * s, -x * s + y * c
        du, dv = (u % cell) - cell / 2, (v % cell) - cell / 2
        _grid[k] = np.sqrt(du * du + dv * dv).astype(f32)
    return _grid[k]


INKS = [(15, (0.0, .62, .9)), (75, (.95, .12, .52)), (0, (1.0, .9, .05)), (45, (.06, .05, .09))]
PAPER = np.array([.98, .95, .87], f32)


def halftone(a, cell=10, mix=1.0):
    sm = tof(Image.fromarray(to8(a)).resize((W // 3, H // 3), Image.BILINEAR).resize((W, H), Image.BILINEAR))
    k = 1 - sm.max(axis=2)
    d = 1 - k + 1e-4
    vals = [(1 - sm[..., 0] - k) / d, (1 - sm[..., 1] - k) / d, (1 - sm[..., 2] - k) / d, k * .95]
    out = np.empty_like(a); out[:] = PAPER
    for v, (ang, ink) in zip(vals, INKS):
        r = cell * .7 * np.sqrt(np.clip(v, 0, 1))
        cov = np.clip(r - grid(cell, ang) + .5, 0, 1)
        out *= 1 - cov[..., None] * (1 - np.array(ink, f32))
    return a * (1 - mix) + out * mix if mix < 1 else out


def grade(a, sat=1.35, con=1.12, tint=.07):
    L = lum(a)[..., None]
    a = L + (a - L) * sat
    a = (a - .5) * con + .5
    a = a + tint * ((1 - L) ** 2 * np.array([-.3, .1, .4], f32) + L ** 2 * np.array([.35, .05, -.25], f32))
    return np.clip(a * 1.08 + .02, 0, 1) ** .85


def edges(a, thr=.06, gain=7, half=True):
    L = lum(a)
    if half: L = L.reshape(H // 2, 2, W // 2, 2).mean(axis=(1, 3))
    gx = np.zeros_like(L); gy = np.zeros_like(L)
    gx[:, 1:-1] = L[:, 2:] - L[:, :-2]; gy[1:-1] = L[2:] - L[:-2]
    e = np.clip((np.hypot(gx, gy) - thr) * gain, 0, 1)
    if half: e = tof(Image.fromarray(to8(e)).resize((W, H), Image.BILINEAR))
    return e


def ink(a, strength=.6, thr=.06):
    return a * (1 - strength * edges(a, thr)[..., None])


def chroma(a, d, dy=0):
    d, dy = int(round(d)), int(round(dy))
    if d == 0 and dy == 0: return a
    o = a.copy()
    o[..., 0] = np.roll(np.roll(a[..., 0], d, 1), dy, 0)
    o[..., 2] = np.roll(np.roll(a[..., 2], -d, 1), -dy, 0)
    return o


def chroma_radial(a, k):
    if k < 1e-4: return a
    o = a.copy()
    for ch, s in ((0, 1 + 2 * k), (1, 1 + k)):
        im = Image.fromarray(to8(a[..., ch]))
        nw, nh = int(W * s), int(H * s)
        im = im.resize((nw, nh), Image.BILINEAR).crop(((nw - W) // 2, (nh - H) // 2, (nw - W) // 2 + W, (nh - H) // 2 + H))
        o[..., ch] = tof(im)
    return o


def glitch(a, amt, rng):
    o = a.copy()
    for _ in range(int(3 + amt * 16)):
        y = int(rng.integers(0, H)); h = int(rng.integers(4, int(16 + amt * 90)))
        dx = int(rng.normal(0, amt * 140)); sl = slice(y, min(H, y + h))
        o[sl] = np.roll(o[sl], dx, 1)
        if rng.random() < .5: o[sl, :, 0] = np.roll(o[sl, :, 0], dx // 2 + 10, 1)
    for _ in range(int(amt * 7)):
        x, y = int(rng.integers(0, W - 300)), int(rng.integers(0, H - 80))
        w, h = int(rng.integers(40, 300)), int(rng.integers(8, 60))
        o[y:y + h, x:x + w] = o[y:y + h, x:x + w][..., [2, 0, 1]]
    return o


def zoomblur(a, amt, center, n=7):
    if amt < .005: return a
    im = Image.fromarray(to8(a)).resize((W // 2, H // 2), Image.BILINEAR)
    cx, cy = center[0] / 2, center[1] / 2
    acc = np.zeros((H // 2, W // 2, 3), f32)
    for k in range(n):
        s = 1 + amt * k / (n - 1)
        acc += np.asarray(im.transform(im.size, Image.AFFINE, (1 / s, 0, cx - cx / s, 0, 1 / s, cy - cy / s), Image.BILINEAR), f32)
    bl = tof(Image.fromarray((acc / n).astype(np.uint8)).resize((W, H), Image.BILINEAR))
    y, x = np.ogrid[0:H, 0:W]
    m = np.clip(np.hypot((x - center[0]) / W, (y - center[1]) / H) * 2.2, 0, 1)[..., None].astype(f32)
    return a * (1 - m) + bl * m


_noise = None
def grain(a, amt, step):
    global _noise
    if _noise is None:
        r = np.random.default_rng(5)
        _noise = [r.normal(0, 1, (H // 2, W // 2)).astype(f32) for _ in range(6)]
    n = _noise[step % 6].repeat(2, 0).repeat(2, 1)
    return a + n[..., None] * amt


_vig = None
def vignette(a, amt=.35):
    global _vig
    if _vig is None:
        y, x = np.ogrid[0:H, 0:W]
        _vig = (1 - np.clip(np.hypot((x - W / 2) / (W * .62), (y - H / 2) / (H * .62)) ** 2.2, 0, 1)).astype(f32)
    return a * (1 - amt + amt * _vig[..., None])


def comic_light(a, step, ht=.18, inkk=.38, ch=2):
    a = grade(a)
    a = ink(a, inkk)
    if ht > 0: a = halftone(a, 8, ht)
    a = chroma(a, ch)
    a = grain(a, .025, step)
    return vignette(a, .3)


# ---- стили мультивселенной ----
def st_noir(a, step):
    L = lum(a)
    L = np.clip((L - .38) * 2.0 + .5, 0, 1)
    L = L * (1 - .85 * edges(a, .05, 9))
    o = np.stack([L * .95, L * .97, L * 1.05], -1)
    return vignette(grain(o, .07, step), .6)


def st_pop(a, step):
    a = grade(a, 2.0, 1.25, .12)
    a = ink(a, .8)
    return halftone(a, 14, 1)


def st_8bit(a, step):
    im = Image.fromarray(to8(grade(a, 1.6, 1.2))).resize((160, 90), Image.BOX)
    im = im.quantize(colors=14, method=Image.Quantize.MEDIANCUT).convert('RGB')
    return tof(im.resize((W, H), Image.NEAREST))


def st_neon(a, step):
    e = edges(a, .035, 10)
    gl = tof(Image.fromarray(to8(e)).filter(ImageFilter.GaussianBlur(9)))
    x = np.linspace(0, 1, W, dtype=f32)[None, :]
    col = np.stack([.2 + .8 * x, .9 - .7 * x, np.ones_like(x)], -1)
    base = a * np.array([.18, .1, .3], f32)
    o = base + e[..., None] * col * 1.2 + gl[..., None] * col * 1.1
    return chroma(np.clip(o, 0, 1), 6)


STYLES = [('НУАР', st_noir), ('ПОП-АРТ', st_pop), ('8-БИТ', st_8bit), ('НЕОН', st_neon)]


# ---------- графика поверх ----------
@lru_cache(maxsize=64)
def sfx_sprite(text, size, top=(255, 236, 60), bot=(255, 120, 20), stroke=10, ext=16, shadow=(0, 190, 240)):
    font = ImageFont.truetype(FB, size)
    bb = font.getbbox(text, stroke_width=stroke)
    pad = ext + 40
    w, h = bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    ox, oy = pad - bb[0] - ext // 2, pad - bb[1] - ext // 2
    sh = shadow + (255,)
    d.text((ox + ext + 10, oy + ext + 6), text, font=font, fill=sh, stroke_width=stroke, stroke_fill=sh)
    for k in range(ext, 0, -1):
        c = (30 + k * 3, 8, 40 + k * 2, 255)
        d.text((ox + k, oy + k), text, font=font, fill=c, stroke_width=stroke, stroke_fill=c)
    d.text((ox, oy), text, font=font, fill=(0, 0, 0, 255), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).text((ox, oy), text, font=font, fill=255)
    g = np.linspace(0, 1, h, dtype=f32)[:, None, None]
    grad = (np.array(top, f32) * (1 - g) + np.array(bot, f32) * g).repeat(w, 1)
    img.paste(Image.fromarray(grad.astype(np.uint8)), (0, 0), m)
    # блик-полоса
    hl = Image.new('L', (w, h), 0); ImageDraw.Draw(hl).rectangle([0, oy + bb[1] + 4, w, oy + bb[1] + (bb[3] - bb[1]) // 4], fill=110)
    hl = Image.fromarray(np.minimum(np.asarray(hl), np.asarray(m)))
    img.paste((255, 255, 255, 255), (0, 0), hl)
    return img


@lru_cache(maxsize=64)
def caption_sprite(lines, size=34, bg=(255, 228, 77), fg=(10, 10, 14), border=6):
    font = ImageFont.truetype(FR, size)
    ls = lines.split('\n')
    bbs = [font.getbbox(l) for l in ls]
    lw = max(b[2] - b[0] for b in bbs); lh = int(size * 1.35)
    pw, ph = 26, 18
    w, h = lw + pw * 2 + border * 2 + 14, lh * len(ls) + ph * 2 + border * 2 + 14
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rectangle([14, 14, w - 1, h - 1], fill=(0, 0, 0, 255))
    d.rectangle([0, 0, w - 15, h - 15], fill=(0, 0, 0, 255))
    d.rectangle([border, border, w - 15 - border, h - 15 - border], fill=bg + (255,))
    for i, l in enumerate(ls):
        d.text((border + pw, border + ph + i * lh - bbs[i][1] + 2), l, font=font, fill=fg + (255,))
    return img


@lru_cache(maxsize=32)
def title_sprite(text, size, fill, stroke=12, shadow=(0, 200, 255), font=FR):
    ft = ImageFont.truetype(font, size)
    bb = ft.getbbox(text, stroke_width=stroke)
    w, h = bb[2] - bb[0] + 60, bb[3] - bb[1] + 60
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    ox, oy = 20 - bb[0], 20 - bb[1]
    d.text((ox + 14, oy + 10), text, font=ft, fill=shadow + (255,), stroke_width=stroke, stroke_fill=shadow + (255,))
    d.text((ox, oy), text, font=ft, fill=fill + (255,), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    return img


def paste(base, spr, x, y, scale=1.0, rot=0.0, alpha=1.0):
    if scale <= .01 or alpha <= .01: return
    s = spr
    if abs(scale - 1) > .003:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.BICUBIC)
    if abs(rot) > .05: s = s.rotate(rot, expand=True, resample=Image.BICUBIC)
    if alpha < 1:
        s = s.copy(); s.putalpha(Image.fromarray((np.asarray(s.getchannel('A'), f32) * alpha).astype(np.uint8)))
    base.paste(s, (int(x - s.width / 2), int(y - s.height / 2)), s)


def star(d, cx, cy, r1, r2, n, rng, rot=0, fill=(255, 225, 40), outline=(0, 0, 0), ow=12, shadow=True):
    pts = []
    for k in range(n * 2):
        a = rot + k * math.pi / n
        r = (r1 if k % 2 == 0 else r2) * (1 + rng.uniform(-.12, .12))
        pts.append((cx + math.cos(a) * r * 1.25, cy + math.sin(a) * r))
    if shadow: d.polygon([(x + 22, y + 18) for x, y in pts], fill=(220, 20, 70))
    d.polygon(pts, fill=fill, outline=outline, width=ow)


def speedlines(base, cx, cy, r0, n, rng, alpha=.85, col=(255, 255, 255)):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi); wd = rng.uniform(.004, .018)
        r = r0 * rng.uniform(.9, 1.5)
        d.polygon([(cx + math.cos(a) * r, cy + math.sin(a) * r),
                   (cx + math.cos(a - wd) * 2600, cy + math.sin(a - wd) * 2600),
                   (cx + math.cos(a + wd) * 2600, cy + math.sin(a + wd) * 2600)], fill=int(255 * alpha))
    base.paste(col, (0, 0), m)


def sense_lines(d, cx, cy, sc, rng, k=1.0):
    for i in range(9):
        a = i / 9 * 2 * math.pi + rng.uniform(-.15, .15) - math.pi / 2
        r1, r2 = 95 * sc, (95 + 150 * k) * sc
        pts = []
        steps = 7
        for j in range(steps + 1):
            r = lerp(r1, r2, j / steps); off = (18 * sc) * (1 if j % 2 else -1) * rng.uniform(.6, 1.2)
            pts.append((cx + math.cos(a) * r - math.sin(a) * off, cy + math.sin(a) * r + math.cos(a) * off))
        d.line(pts, fill=(0, 0, 0), width=int(16 * sc), joint='curve')
        d.line([(x + 4, y + 2) for x, y in pts], fill=(255, 40, 80), width=int(7 * sc), joint='curve')
        d.line([(x - 4, y - 2) for x, y in pts], fill=(30, 200, 255), width=int(4 * sc), joint='curve')


def flash(a, amt, col=(1, 1, 1)):
    if amt <= 0: return a
    return a * (1 - amt) + np.array(col, f32) * amt


# ---------- таймлайн ----------
def cam_game(T):
    p = seg(T, S1, S3)
    return (lerp(424, 438, eio(p)), lerp(240, 222, eio(p)), lerp(1.02, 1.22, eio(p)), -1.2 * math.sin(p * math.pi))


def ts_game(T): return max(0.0, (T - S2) * (4.30 / (S3 - S2)))


def cam_s3(T):
    c0 = cam_game(S3)
    if T < S3B:
        return lerpcam(c0, (HEAD_SENSE[0], HEAD_SENSE[1] + 8, 2.7, 0), eio(seg(T, S3, S3B)))
    if T < S3C:
        p = seg(T, S3B, S3C)
        return (HEAD_SENSE[0], HEAD_SENSE[1] + 8, lerp(2.7, 2.9, p), lerp(0, 1.8, p))
    return lerpcam((HEAD_SENSE[0], HEAD_SENSE[1] + 8, 2.9, 1.8), (442, 150, 2.2, -2.5), eio(seg(T, S3C, S4)))


def ts_s3(T):
    Tq = math.floor(T * 12) / 12
    if T < S3B: return lerp(4.30, 4.40, seg(Tq, S3, S3B))
    if T < S3C: return 4.40
    return lerp(4.40, T_REL, seg(Tq, S3C, S4))


def cam_s4(T):
    a = (442, 150, 2.2, -2.5)
    if T < S4 + REL_HOLD: return a
    w0, w1 = S4 + REL_HOLD, S4 + REL_HOLD + .62
    b = (RIM[0], RIM[1] + 6, 2.6, 1.2)
    if T < w1: return lerpcam(a, b, eio(seg(T, w0, w1)))
    p = seg(T, w1, S5)
    return (RIM[0], RIM[1] + 6, lerp(2.6, 2.95, p), lerp(1.2, 0, p))


def ts_s4(T):
    if T < S4 + REL_HOLD: return T_REL
    Tq = math.floor(T * 12) / 12
    return lerp(T_REL, T_SWISH, seg(Tq, S4 + REL_HOLD, S5))


def cam_s5(T):
    p = seg(T, S5, S5 + .35)
    q = seg(T, S5 + .35, S6)
    return (RIM[0], RIM[1] + 10, lerp(3.5, 2.7, eexpo(p)) - .1 * q, lerp(-5, -1.5, eexpo(p)) + 1.0 * q)


def cam_rep(T):
    p = seg(T, S6, S7)
    return (RIM[0] + 2, RIM[1] + 18, lerp(3.0, 3.45, eio(p)), lerp(2.5, -1.5, eio(p)))


def ts_rep(T):
    Tq = math.floor(T * 12) / 12
    return lerp(5.58, 5.96, seg(Tq, S6, S7 - .1))


def cam_s7(T):
    p = seg(T, S7, S7 + 1.3)
    c = lerpcam((RIM[0], RIM[1] + 30, 2.5, -1.5), (424, 240, 1.06, 0), eio(p))
    q = seg(T, S7 + 1.3, S8)
    return (c[0], c[1], c[2] + .07 * q, c[3] + .6 * math.sin(q * math.pi))


def ts_s7(T): return min(T_END, T_SWISH + (T - S7))


# ---------- палитра мультфильма ----------
POP = np.array([[.05, .03, .16], [.55, .05, .45], [.98, .25, .45], [1.0, .82, .25], [1.0, .98, .9]], f32)


def popmap(a):
    L = np.clip(lum(a), 0, 1) * (len(POP) - 1)
    i = np.minimum(L.astype(int), len(POP) - 2); f = (L - i)[..., None]
    return POP[i] * (1 - f) + POP[i + 1] * f


def sv_grade(a, step, ht=.16, inkk=.32, ch=2):
    """спокойный «спайдерверс»-грейд: глубокие тени, мадженто-циан сплит, точки в полутонах"""
    a = grade(a, 1.3, 1.16, .09)
    a = ink(a, inkk)
    if ht > 0: a = halftone(a, 8, ht)
    a = chroma(a, ch)
    a = grain(a, .015, step)
    return vignette(a, .22)


_paper = None
def paper():
    global _paper
    if _paper is None:
        a = np.empty((H, W, 3), f32); a[:] = PAPER
        g = grid(12, 45)
        y = np.linspace(0, 1, H, dtype=f32)[:, None]
        cov = np.clip(12 * .7 * np.sqrt(.03 + .07 * y) - g + .5, 0, 1)
        a *= 1 - cov[..., None] * (1 - np.array([.95, .45, .6], f32))
        _paper = Image.fromarray(to8(a))
    return _paper


def paper_bg(T):
    return paper().copy()


def inset(img, scale, rot, T, border=14):
    """кадр как панель комикса на бумаге"""
    page = paper_bg(T)
    w, h = int(W * scale), int(H * scale)
    src = img.resize((w, h), Image.BICUBIC)
    fr = Image.new('RGBA', (w + border * 2, h + border * 2), (12, 8, 18, 255))
    fr.paste(src, (border, border))
    fr = fr.rotate(rot, expand=True, resample=Image.BICUBIC)
    sh = Image.new('RGBA', fr.size, (0, 0, 0, 0)); sh.paste((40, 10, 40, 120), (0, 0), fr)
    page.paste(sh, (int(W / 2 - fr.width / 2 + 16), int(H / 2 - fr.height / 2 + 16)), sh)
    page.paste(fr, (int(W / 2 - fr.width / 2), int(H / 2 - fr.height / 2)), fr)
    return page


# ---------- рендер кадра ----------
def frame(i):
    T = i / FPS
    step = int(T * 12)
    rng = np.random.default_rng(1000 + step)
    if T < S2: return sc_reveal(T, step, rng)
    if T < S3: return sc_game(T, step, rng)
    if T < S4: return sc_sense(T, step, rng)
    if T < S5: return sc_flight(T, step, rng)
    if T < S6: return sc_drop(T, step, rng)
    if T < S7: return sc_replay(T, step, rng)
    if T < S8: return sc_celeb(T, step, rng)
    return sc_end(T, step, rng)


def halftone_grow(a, cell, grow):
    sm = tof(Image.fromarray(to8(a)).resize((W // 3, H // 3), Image.BILINEAR).resize((W, H), Image.BILINEAR))
    k = 1 - sm.max(axis=2); d = 1 - k + 1e-4
    vals = [(1 - sm[..., 0] - k) / d, (1 - sm[..., 1] - k) / d, (1 - sm[..., 2] - k) / d, k * .95]
    out = np.empty_like(a); out[:] = PAPER
    for v, (ang, ink_) in zip(vals, INKS):
        r = cell * .7 * np.sqrt(np.clip(v, 0, 1)) * grow
        cov = np.clip(r - grid(cell, ang) + .5, 0, 1)
        out *= 1 - cov[..., None] * (1 - np.array(ink_, f32))
    return out


def sc_reveal(T, step, rng):
    """кадр «печатается» точками и оживает"""
    p = seg(T, S1, S2)
    a = view(0.0, cam_game, T, mb=False)
    live = sv_grade(a, step)
    dots = halftone_grow(grade(a, 1.5, 1.2), 12, eout(seg(p, 0, .55)))
    dots = dots * (1 - .55 * eout(seg(p, .25, .7)) * edges(a, .06)[..., None])
    k = eio(seg(p, .55, 1))
    o = dots * (1 - k) + live * k
    o = chroma(o, 10 * math.sin(math.pi * seg(p, .5, 1)))
    return Image.fromarray(to8(o))


def sc_game(T, step, rng):
    a = view(ts_game(T), cam_game, T)
    return Image.fromarray(to8(sv_grade(a, step)))


def sc_sense(T, step, rng):
    ts = ts_s3(T)
    a = view(ts, cam_s3, T)
    frozen = S3B <= T < S3C
    if frozen:
        k = eout(seg(T, S3B, S3B + .12))
        g = grade(a, 1, 1.3)
        duo = popmap(g * .9 + .05)
        a = g * (1 - .8 * k) + duo * .8 * k
        a = ink(a, .6)
        a = halftone(a, 9, .32)
        a = chroma(a, 3 + 4 * abs(math.sin(T * 9)))
        a = vignette(grain(a, .02, step), .35)
    else:
        a = sv_grade(a, step, ht=.2, inkk=.4, ch=3)
        if T < S3B:
            x, y = project(cam_s3(T), *HEAD_SENSE)
            a = zoomblur(a, .04 * math.sin(seg(T, S3, S3B) * math.pi), (x, y), 5)
    im = Image.fromarray(to8(a))
    if frozen:
        x, y = project(cam_s3(T), *HEAD_SENSE)
        sense_lines(ImageDraw.Draw(im), x, y - 40, 1.45, rng, eback(seg(T, S3B, S3B + .2)))
    return im


def sc_flight(T, step, rng):
    a = view(ts_s4(T), cam_s4, T)
    if T < S4 + REL_HOLD:
        t = seg(T, S4, S4 + REL_HOLD)
        a = grade(a, 1.5, 1.2, .1); a = ink(a, .6); a = halftone(a, 10, .5 * (1 - t))
        a = chroma(a, 12 * (1 - t) + 2)
    else:
        rise = seg(T, S4, S5)
        a = sv_grade(a, step, ht=.18, inkk=.4, ch=2 + 4 * rise)
        a = vignette(a, .15 + .25 * rise)
    return Image.fromarray(to8(a))


def sc_drop(T, step, rng):
    a = view(T_SWISH, cam_s5, T, mb=False)
    cam = cam_s5(T)
    rx, ry = project(cam, *RIM)
    t = T - S5
    a = grade(a, 1.7, 1.2, .1) * .88 + .1
    a = ink(a, .6)
    a = halftone(a, 11, .7)
    a = zoomblur(a, .24 * (1 - eout(seg(t, 0, .3))), (rx, ry))
    a = chroma_radial(a, .01 * (1 - eout(seg(t, 0, .4))) + .002)
    if t < .12: a = glitch(a, .6, rng)
    a = flash(a, .6 * (1 - seg(t, 0, .07)))
    im = Image.fromarray(to8(a))
    if t < .03: return im
    speedlines(im, rx, ry, 300, 36, rng, .55)
    d = ImageDraw.Draw(im)
    p = seg(t, .03, .35); sc = eel(p)
    sx, sy = 430, 330
    star(d, sx, sy, 300 * sc + 1, 180 * sc + 1, 12, rng, rot=step * .05)
    paste(im, sfx_sprite('SWISH!', 220), sx, sy, sc * (1 + .02 * math.sin(t * 16)), -7 + 1.5 * math.sin(t * 5))
    return im


def replay_img(T, step):
    a = view(ts_rep(T), cam_rep, T, mb=False)
    g = grade(a, 1.2, 1.25)
    o = popmap(g) * .75 + g * .25
    o = ink(o, .55)
    o = halftone(o, 9, .45)
    o = chroma(o, 4)
    return Image.fromarray(to8(grain(o, .02, step)))


def sc_replay(T, step, rng):
    p = eout(seg(T, S6, S6 + .3))
    img = replay_img(T, step)
    sc = lerp(1.0, .9, p)
    rot = lerp(0, -1.3, p)
    return inset(img, sc, rot, T)


def sc_celeb(T, step, rng):
    a = view(ts_s7(T), cam_s7, T)
    a = sv_grade(a, step, ht=.16, inkk=.34, ch=2)
    im = Image.fromarray(to8(a))
    p = eio(seg(T, S7, S7 + .32))
    if p < 1:
        im = inset(im, lerp(.9, 1.0, p), lerp(-1.3, 0, p), T, border=int(14 * (1 - p)) + 1)
    return im


def sc_end(T, step, rng):
    t = T - S8
    a = view(T_END, cam_s7, S8 - .001, mb=False)
    live = sv_grade(a, step, ht=.16, inkk=.34, ch=2)
    k = eio(seg(t, .1, 1.2))
    printed = halftone(ink(grade(a, 1.4, 1.2), .5), 10, .55)
    o = live * (1 - k) + printed * k
    im = Image.fromarray(to8(o))
    p = eout(seg(t, 0, .7))
    page = inset(im, lerp(1.0, .86, p), lerp(0, -1.2, p), T, border=int(1 + 13 * p))
    q = seg(t, 2 * B, 2 * B + .35)
    if q > 0:
        ft = ImageFont.truetype(FR, 54)
        lay = Image.new('RGBA', (300, 120), (0, 0, 0, 0))
        ImageDraw.Draw(lay).text((10, 20), '№67', font=ft, fill=(12, 8, 18, 255))
        paste(page, lay, 1700, 1010 + 20 * (1 - eout(q)), 1, 0, eout(q))
    zz = 1 + .03 * eio(seg(t, 0, TOTAL - S8))
    nw, nh = int(W * zz), int(H * zz)
    page = page.resize((nw, nh), Image.BICUBIC).crop(((nw - W) // 2, (nh - H) // 2, (nw - W) // 2 + W, (nh - H) // 2 + H))
    return page


def work(i):
    return i, frame(i).tobytes()


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    rng_ = (0, NFR)
    pngdir = None
    if '--frames' in sys.argv:
        a, b = sys.argv[sys.argv.index('--frames') + 1].split(':'); rng_ = (int(a), int(b))
    if '--png' in sys.argv: pngdir = sys.argv[sys.argv.index('--png') + 1]; os.makedirs(pngdir, exist_ok=True)
    load(src)
    idx = list(range(*rng_))
    if pngdir:
        with Pool(4) as pool:
            for i, buf in pool.imap(work, idx):
                Image.frombytes('RGB', (W, H), buf).save(f'{pngdir}/f{i:04d}.png')
        sys.exit()
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                           '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for n, (i, buf) in enumerate(pool.imap(work, idx, chunksize=2)):
            ff.stdin.write(buf)
            if n % 60 == 0: print('frame', i, flush=True)
    ff.stdin.close(); ff.wait()
    print('done', NFR)
