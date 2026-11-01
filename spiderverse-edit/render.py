"""№67: ЧЕРЕЗ ВСЕЛЕННЫЕ — покадровый рендер 1920x1080@60.
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
S1, S2, S3, S4, S5, S6, S7, S8 = [k * B for k in (0, 4, 12, 16, 20, 22, 26, 32)]
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
def cam_title(T):
    p = seg(T, 0, 3 * B)
    return (440, 150, lerp(2.0, 2.35, eout(p)), lerp(4, -1.5, eout(p)))


def ts_title(T):
    if T < 3 * B: return T_REL
    p = seg(T, 3 * B, 4 * B)
    return T_REL * (1 - p ** 1.6)


def cam_game(T):
    p = seg(T, S2, S3)
    return (lerp(424, 438, eio(p)), lerp(240, 222, eio(p)), lerp(1.04, 1.22, eio(p)), -1.4 * math.sin(p * math.pi))


def ts_game(T): return (T - S2) * (4.30 / (S3 - S2))


def cam_s3(T):
    c0 = cam_game(S3)
    if T < S3B:
        return lerpcam(c0, (HEAD_SENSE[0], HEAD_SENSE[1] + 8, 2.8, 0), eio(seg(T, S3, S3B)))
    if T < S3C:
        p = seg(T, S3B, S3C)
        return (HEAD_SENSE[0], HEAD_SENSE[1] + 8, lerp(2.8, 3.05, p), lerp(0, 2.2, p))
    return lerpcam((HEAD_SENSE[0], HEAD_SENSE[1] + 8, 3.05, 2.2), (442, 150, 2.2, -3), eio(seg(T, S3C, S4)))


def ts_s3(T):
    Tq = math.floor(T * 12) / 12
    if T < S3B: return lerp(4.30, 4.40, seg(Tq, S3, S3B))
    if T < S3C: return 4.40
    return lerp(4.40, T_REL, seg(Tq, S3C, S4))


def cam_s4(T):
    a = (442, 150, 2.2, -3)
    if T < S4 + REL_HOLD: return a
    w0, w1 = S4 + REL_HOLD, S4 + REL_HOLD + .62
    b = (RIM[0], RIM[1] + 6, 2.6, 1.5)
    if T < w1: return lerpcam(a, b, eio(seg(T, w0, w1)))
    p = seg(T, w1, S5)
    return (RIM[0], RIM[1] + 6, lerp(2.6, 3.0, p), lerp(1.5, 0, p))


def ts_s4(T):
    if T < S4 + REL_HOLD: return T_REL
    Tq = math.floor(T * 12) / 12
    return lerp(T_REL, T_SWISH, seg(Tq, S4 + REL_HOLD, S5))


def cam_s5(T):
    p = seg(T, S5, S5 + .35)
    q = seg(T, S5 + .35, S6)
    return (RIM[0], RIM[1] + 10, lerp(3.7, 2.7, eexpo(p)) - .12 * q, lerp(-7, -2, eexpo(p)) + 1.5 * q)


def cam_s7(T):
    p = seg(T, S7, S7 + 1.25)
    c = lerpcam((RIM[0], RIM[1] + 30, 2.5, -2), (424, 240, 1.06, 0), eio(p))
    q = seg(T, S7 + 1.25, S8)
    return (c[0], c[1], c[2] + .08 * q, c[3] + .8 * math.sin(q * math.pi))


def ts_s7(T): return min(T_END, T_SWISH + (T - S7))


def parabola(u):
    x = BALL_REL[0] + (RIM[0] - BALL_REL[0]) * u
    y = BALL_REL[1] * (1 - u) + RIM[1] * u - 4 * 165 * u * (1 - u)
    return x, y


# ---------- рендер кадра ----------
def frame(i):
    T = i / FPS
    step = int(T * 12)
    rng = np.random.default_rng(1000 + step)
    if T < S2: return sc_title(T, step, rng)
    if T < S3: return sc_game(T, step, rng)
    if T < S4: return sc_sense(T, step, rng)
    if T < S5: return sc_flight(T, step, rng)
    if T < S6: return sc_drop(T, step, rng)
    if T < S7: return sc_multi(T, step, rng)
    if T < S8: return sc_celeb(T, step, rng)
    return sc_page(T, step, rng)


def sc_title(T, step, rng):
    a = view(ts_title(T), cam_title, T, mb=T < 3 * B)
    a = grade(a, 1.5, 1.15, .1) * .8 + .12
    a = ink(a, .6)
    a = halftone(a, 11, .7)
    rew = seg(T, 3 * B, 4 * B)
    a = chroma(a, 4 + 30 * rew ** .5)
    if rew > 0:
        a = glitch(a, .25 + .7 * rew, rng)
        y = (np.arange(H)[:, None] + int(T * 900)) % 140 < 6
        a = np.where(y[..., None], a * .4 + .5, a)
    a = vignette(grain(a, .04, step), .45)
    im = Image.fromarray(to8(a))
    out = rew
    al = 1 - eout(seg(T, 3 * B, 3.6 * B))
    jit = (rng.uniform(-30, 30) * out, rng.uniform(-10, 10) * out)
    # №67
    p = seg(T, 0, .3)
    paste(im, title_sprite('№67', 300, (255, 50, 80)), 960 + jit[0], 360 + jit[1], lerp(2.4, 1, eback(p)) if p < 1 else 1 + .015 * math.sin(T * 9), -5 + 3 * (1 - eout(p)), al)
    p = seg(T, B, B + .25)
    if p > 0: paste(im, title_sprite('ЧЕРЕЗ', 110, (255, 228, 77)), 560 - 700 * (1 - eout(p)) + jit[0], 650, 1, 3, al)
    p = seg(T, 2 * B, 2 * B + .25)
    if p > 0: paste(im, title_sprite('ВСЕЛЕННЫЕ', 110, (255, 255, 255)), 1270 + jit[0], 670 + 300 * (1 - eback(p)), lerp(1.6, 1, eout(p)), -2, al)
    if T > 3 * B + .05:
        paste(im, caption_sprite('4 СЕКУНДЫ НАЗАД...', 38), 960, 900, 1, 0, eout(seg(T, 3 * B + .05, 3 * B + .2)))
    return im


def sc_game(T, step, rng):
    ts = ts_game(T)
    a = view(ts, cam_game, T)
    a = comic_light(a, step)
    a = flash(a, .5 * (1 - seg(T, S2, S2 + .12)))
    im = Image.fromarray(to8(a))
    p = seg(T, S2 + .12, S2 + .4); q = seg(T, S3 - 1.25, S3 - 1.0)
    if p > 0 and q < 1:
        paste(im, caption_sprite('ТЕМ ВРЕМЕНЕМ,\nГДЕ-ТО В МУЛЬТИВСЕЛЕННОЙ...', 36), 470 - 700 * (1 - eback(p)) - 900 * eio(q), 150, 1, 2.5)
    p = seg(T, S3 - 1.0, S3 - .8)
    if p > 0:
        x, y = project(cam_game(T), *TAG67)
        d = ImageDraw.Draw(im)
        ty = y - 190
        d.line([(x, y - 8), (x + 40, ty + 40)], fill=(0, 0, 0), width=10)
        d.line([(x, y - 8), (x + 40, ty + 40)], fill=(255, 228, 77), width=4)
        paste(im, caption_sprite('№67', 44, (255, 60, 90), (255, 255, 255)), x + 60, ty, eback(p), -4)
    return im


def sc_sense(T, step, rng):
    ts = ts_s3(T)
    a = view(ts, cam_s3, T)
    frozen = S3B <= T < S3C
    if frozen:
        k = seg(T, S3B, S3B + .1)
        L = lum(grade(a, 1, 1.3))[..., None] ** .7
        duo = np.array([.08, .02, .2], f32) * (1 - L) + np.array([1, .3, .45], f32) * L
        a = a * (1 - .75 * k) + duo * .75 * k
        a = ink(a, .75)
        a = halftone(a, 9, .4)
        a = chroma(a, 3 + 7 * abs(math.sin(T * 11)))
        a = grain(a, .04, step)
        a = vignette(a, .55)
    else:
        a = comic_light(a, step, ht=.22, inkk=.45, ch=3)
        if T < S3B:
            x, y = project(cam_s3(T), *HEAD_SENSE)
            a = zoomblur(a, .05 * math.sin(seg(T, S3, S3B) * math.pi), (x, y), 5)
    a = flash(a, .55 * (1 - seg(T, S3B, S3B + .08)) if frozen else 0)
    im = Image.fromarray(to8(a))
    if frozen:
        x, y = project(cam_s3(T), *HEAD_SENSE)
        d = ImageDraw.Draw(im)
        sense_lines(d, x, y - 40, 1.5, rng, eback(seg(T, S3B, S3B + .18)))
        p = seg(T, S3B + .1, S3B + .3)
        paste(im, caption_sprite('ЧУТЬЁ ГОВОРИТ:\nБРОСАЙ.', 40), 1480, 860 + 300 * (1 - eback(p)), 1, -3)
    return im


def sc_flight(T, step, rng):
    ts = ts_s4(T)
    a = view(ts, cam_s4, T)
    hold = T < S4 + REL_HOLD
    if hold:
        a = grade(a, 1.6, 1.2, .1); a = ink(a, .7); a = halftone(a, 10, .6)
        a = chroma(a, 10); a = flash(a, .45 * (1 - seg(T, S4, S4 + .06)))
    else:
        rise = seg(T, S4, S5)
        a = comic_light(a, step, ht=.2, inkk=.45, ch=2 + 5 * rise)
        a = vignette(a, .25 + .3 * rise)
    im = Image.fromarray(to8(a))
    cam = cam_s4(T)
    if hold:
        x, y = project(cam, *BALL_REL)
        paste(im, sfx_sprite('THWIP!', 150), x + 260, y - 80, eback(seg(T, S4, S4 + .1)), 10)
    if T > S5 - .5:
        d = ImageDraw.Draw(im)
        x, y = project(cam, *RIM)
        r = 40 + 30 * math.sin(T * 30)
        k = seg(T, S5 - .5, S5 - .2)
        d.ellipse([x - r * 2.2, y - r, x + r * 2.2, y + r], outline=(255, 60, 90), width=int(3 + 5 * k))
    return im


def sc_drop(T, step, rng):
    a = view(T_SWISH, cam_s5, T, mb=False)
    cam = cam_s5(T)
    rx, ry = project(cam, *RIM)
    t = T - S5
    a = grade(a, 1.8, 1.2, .12) * .85 + .12
    a = ink(a, .7)
    a = halftone(a, 12, .75)
    a = zoomblur(a, .28 * (1 - eout(seg(t, 0, .3))), (rx, ry))
    a = chroma_radial(a, .012 * (1 - eout(seg(t, 0, .4))) + .002)
    if t < .22 or (step % 5 == 0 and t < .7):
        a = glitch(a, .9 if t < .22 else .35, rng)
    a = flash(a, .65 * (1 - seg(t, 0, .07)))
    im = Image.fromarray(to8(a))
    if t < .03: return im
    speedlines(im, rx, ry, 260, 70, rng, .75)
    d = ImageDraw.Draw(im)
    p = seg(t, .03, .35)
    sc = eel(p)
    sx, sy = 420, 320
    star(d, sx, sy, 320 * sc + 1, 190 * sc + 1, 14, rng, rot=step * .07)
    paste(im, sfx_sprite('SWISH!', 230), sx + rng.uniform(-6, 6), sy + rng.uniform(-6, 6), sc * (1 + .03 * math.sin(t * 20)), -8 + 2 * math.sin(t * 6))
    q = seg(t, .25, .45)
    if q > 0:
        r = 70 + 6 * math.sin(t * 25)
        d.ellipse([rx - r * 2, ry - r * .8, rx + r * 2, ry + r * .8], outline=(0, 0, 0), width=14)
        d.ellipse([rx - r * 2, ry - r * .8, rx + r * 2, ry + r * .8], outline=(255, 228, 77), width=6)
        paste(im, caption_sprite('ЧИСТО.', 40, (255, 60, 90), (255, 255, 255)), rx + 330, ry + 150, eback(q), 4)
    return im


def strip_poly(k, gut=9):
    sl = 70
    x0, x1 = k * 480, (k + 1) * 480
    return [(x0 + sl + gut, -10), (x1 + sl - gut, -10), (x1 - sl - gut, H + 10), (x0 - sl + gut, H + 10)]


def multi_layer(T, step, rng, base_im, k, off):
    name, fn = STYLES[k]
    xc = k * 480 + 240
    z = 2.35
    s = (SW / z) / W
    dir_ = 1 if k % 2 else -1
    cam = (RIM[0] - (xc - W / 2) * s, RIM[1] + 70 + dir_ * 14 * (T - S6), z, 0)
    a = fn(view(T_SWISH, lambda _: cam, T, mb=False), step)
    t = T - (S6 + k * B)
    a = flash(a, .6 * (1 - seg(t, 0, .07)))
    lay = Image.fromarray(to8(a))
    m = Image.new('L', (W, H), 0)
    poly = [(x, y + off) for x, y in strip_poly(k)]
    ImageDraw.Draw(m).polygon(poly, fill=255)
    base_im.paste(lay, (0, 0), m)
    d = ImageDraw.Draw(base_im)
    d.line(poly + [poly[0]], fill=(250, 248, 240), width=18)
    d.line(poly + [poly[0]], fill=(0, 0, 0), width=5)
    paste(base_im, caption_sprite(name, 30), xc - 30, H - 120 + off, 1, 0)


def sc_multi(T, step, rng):
    tt = T - S6
    cam = cam_s5(S6 + tt * .3)
    a = view(T_SWISH, lambda _: cam, T, mb=False)
    a = (halftone(ink(grade(a, 1.8, 1.2, .12) * .85 + .12, .7), 12, .75)) * (1 - .45 * seg(tt, 0, B))
    im = Image.fromarray(to8(a))
    for k in range(4):
        t0 = S6 + k * B
        if T < t0: continue
        p = seg(T, t0, t0 + .22)
        off = (1 - eback(p, 1.6)) * H * (1 if k % 2 else -1)
        multi_layer(T, step, rng, im, k, off)
    p = seg(T, S7 - B + .15, S7 - B + .4)
    if p > 0:
        paste(im, caption_sprite('В КАЖДОЙ ВСЕЛЕННОЙ — ЧИСТО.', 40), 960, 110, eback(p), 0)
    return im


def sc_celeb(T, step, rng):
    a = view(ts_s7(T), cam_s7, T)
    beat = ((T - S7) / B) % 1
    a = comic_light(a, step, ht=.2, inkk=.42, ch=2 + 6 * (1 - beat) ** 3)
    im = Image.fromarray(to8(a))
    # панели улетают
    pp = seg(T, S7, S7 + .3)
    if pp < 1:
        for k in range(4):
            off = eio(pp) * H * 1.1 * (-1 if k % 2 else 1)
            multi_layer(S7 - .001, step, rng, im, k, off)
    p = seg(T, S7 + .55, S7 + .8)
    q = seg(T, S8 - .45, S8 - .25)
    if p > 0 and q < 1:
        paste(im, caption_sprite('ЗАЛ:', 32), 300, 150 - 400 * eio(q), eback(p), -3)
        paste(im, sfx_sprite('AAAAAAA!', 170, (255, 255, 255), (255, 200, 60)), 690, 190 - 400 * eio(q), eback(seg(T, S7 + .7, S7 + .95)) * (1 + .04 * math.sin(T * 25)), -4)
    return im


_page_cache = {}
def page_panels():
    if 'p' in _page_cache: return _page_cache['p']
    s1 = view(4.40, lambda _: (HEAD_SENSE[0], HEAD_SENSE[1] + 8, 2.6, 0), 0, mb=False)
    s1 = ink(grade(s1, 1.3, 1.2), .7)
    L = lum(s1)[..., None]; s1 = np.array([.08, .02, .2], f32) * (1 - L) + np.array([1, .3, .45], f32) * L
    s2 = st_pop(view(T_SWISH, lambda _: (RIM[0], RIM[1] + 30, 2.6, 0), 0, mb=False), 0)
    i1 = Image.fromarray(to8(s1)); x, y = project((HEAD_SENSE[0], HEAD_SENSE[1] + 8, 2.6, 0), *HEAD_SENSE)
    sense_lines(ImageDraw.Draw(i1), x, y - 40, 1.6, np.random.default_rng(3))
    _page_cache['p'] = (i1, Image.fromarray(to8(s2)))
    return _page_cache['p']


_paper = None
def paper():
    global _paper
    if _paper is None:
        a = np.empty((H, W, 3), f32); a[:] = PAPER
        g = grid(14, 45)
        y = np.linspace(0, 1, H, dtype=f32)[:, None]
        r = 14 * .7 * np.sqrt(.06 + .1 * y)
        cov = np.clip(r - g + .5, 0, 1)
        a *= 1 - cov[..., None] * (1 - np.array([1, .35, .5], f32))
        _paper = Image.fromarray(to8(a))
    return _paper


def panel(page, img, box, rot, scale_in, d_off=(0, 0)):
    x0, y0, x1, y1 = box
    w, h = int((x1 - x0) * scale_in), int((y1 - y0) * scale_in)
    if w < 4: return
    src = img.resize((w, h), Image.BICUBIC)
    fr = Image.new('RGBA', (w + 24, h + 24), (0, 0, 0, 255))
    fr.paste(src, (12, 12))
    fr = fr.rotate(rot, expand=True, resample=Image.BICUBIC)
    cx, cy = (x0 + x1) / 2 + d_off[0], (y0 + y1) / 2 + d_off[1]
    sh = Image.new('RGBA', fr.size, (0, 0, 0, 0)); sh.paste((20, 10, 30, 160), (0, 0), fr)
    page.paste(sh, (int(cx - fr.width / 2 + 18), int(cy - fr.height / 2 + 18)), sh)
    page.paste(fr, (int(cx - fr.width / 2), int(cy - fr.height / 2)), fr)


def sc_page(T, step, rng):
    t = T - S8
    last = view(T_END, cam_s7, S8 - .001, mb=False)
    last = comic_light(last, step, ht=.2, inkk=.42, ch=2)
    lim = Image.fromarray(to8(last))
    p = eout(seg(t, 0, .45))
    page = paper().copy()
    big = (70, 70, 1210, 1010)
    # большой кадр сжимается в панель
    bx0, by0 = lerp(0, big[0], p), lerp(0, big[1], p)
    bx1, by1 = lerp(W, big[2], p), lerp(H, big[3], p)
    s1, s2 = page_panels()
    q1 = seg(t, B, B + .22); q2 = seg(t, 2 * B, 2 * B + .22)
    if q1 > 0: panel(page, s1, (1260, 70, 1850, 520), 2.5, eback(q1))
    if q2 > 0: panel(page, s2, (1260, 560, 1850, 1010), -2, eback(q2))
    panel(page, lim, (bx0, by0, bx1, by1), -1.2 * p, 1)
    d = ImageDraw.Draw(page)
    q3 = seg(t, 2 * B + .05, 2 * B + .35)
    if q3 > 0:
        sc = eel(q3)
        star(d, 300, 250, 210 * sc + 1, 130 * sc + 1, 12, rng, rot=step * .05, fill=(255, 60, 90))
        paste(page, title_sprite('№67', 130, (255, 228, 77), 10), 300, 250, sc, -8)
    n = int(clamp((t - 3 * B) / .6) * 22)
    if n > 0:
        paste(page, caption_sprite('ПРОДОЛЖЕНИЕ СЛЕДУЕТ...'[:n].ljust(22), 34), 860, 930, 1, -1.5)
    # «камера» по странице
    zz = 1 + .045 * eio(seg(t, 0, TOTAL - S8))
    rot = -1.0 * eio(seg(t, .3, TOTAL - S8))
    page = page.rotate(rot, resample=Image.BICUBIC, center=(W / 2, H / 2), fillcolor=(250, 242, 222))
    nw, nh = int(W * zz), int(H * zz)
    page = page.resize((nw, nh), Image.BICUBIC).crop(((nw - W) // 2, (nh - H) // 2 - 6, (nw - W) // 2 + W, (nh - H) // 2 + H - 6))
    a = grain(tof(page), .02, step)
    return Image.fromarray(to8(a))


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
