"""№67 КОРОЛЬ — «чистая» версия: меньше анимаций, больше эффекта.
Огонь под ногами при приёме пасса и броске → SWISH → трон-референс с эффектами победы.
python3 render4.py SRC.mp4 out.mp4 [--frames a:b]   (референс: env THRONE_IMG)"""
import sys, os, math, json, subprocess
import numpy as np
from functools import lru_cache
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import render as R
import render3 as R3
import track
import figure
from render import (W, H, FPS, B, f32, clamp, seg, lerp, eio, eout, eexpo, eback, eel, to8, tof, lum, lerpcam,
                    fit, project, view, grade, ink, halftone, chroma, zoomblur, grain, vignette, flash, sv_grade,
                    popmap, grid, PAPER, RIM, T_END, FR)
from render3 import (b2, b8, b11, b12, b15, b16, b20, b24, b32, cam_A, cam_E, S, ring_burst, trail, sparkle,
                     chunk, king_combo, overlay, comp, halftone_grow, outline, paste)

b = lambda k: k * B
b28, b30, b36, b39 = b(28), b(30), b(36), b(39)
TOTAL = 40 * B
NFR = int(TOTAL * FPS)
INK = (12, 8, 20)
THRONE = os.environ.get('THRONE_IMG', '/tmp/claude-0/-home-user-blocks/d05dd6ae-a3a4-5fd5-9fb6-8a543209f2ba/scratchpad/throne.png')
EVENTS = dict(R3.EVENTS)
EVENTS.update({'celeb': b24, 'throne': b28, 'ball': b30, 'total': TOTAL, 'fire': b11, 'fire_end': b16 + 1.0})
for k_ in ('replay', 'end', 'figure'): EVENTS.pop(k_, None)


def ts_of(T):
    if T < b24: return R3.ts_of(T)
    if T < b28: return lerp(6.40, 8.10, seg(T, b24, b28))
    return 4.55


# ------------------------- камеры (видны ноги → огонь) -------------------------
def cam_B(T):
    c = R3.cam_B(T)
    return (c[0], c[1] + 34, c[2] - .1, c[3])


def cam_C(T):
    p = eio(seg(T, b12, b15))
    return (lerp(462, 450, p), lerp(256, 262, p), lerp(1.6, 1.72, p), lerp(-1.5, 1.0, p))


def cam_D(T):
    if T < b16:
        p = eio(seg(T, b15, b16))
        return (lerp(450, 446, p), lerp(262, 252, p), lerp(1.72, 1.7, p), lerp(1.0, 0, p))
    p = eio(seg(T, b16 + .34, b20 - .12))
    return lerpcam((446, 252, 1.7, 0.0), (RIM[0] - 6, RIM[1] + 36, 2.55, 1.0), p)


def cam_G(T):
    return lerpcam((RIM[0] - 40, RIM[1] + 80, 2.2, -1.5), (424, 240, 1.06, 0), eio(seg(T, b24, b24 + 1.3)))


# ------------------------- ОГОНЬ -------------------------
def _tongue(d, bx, by, w, h, lean, col, ow=0):
    n = 12
    L = []; Rr = []
    for i in range(n + 1):
        u = i / n
        wd = w * (1 - u) ** 1.1 + w * .38 * math.sin(u * math.pi)
        y = by - h * math.sin(u * math.pi / 2) ** 1.1
        xo = lean * u * u
        L.append((bx - wd + xo, y)); Rr.append((bx + wd + xo, y))
    poly = L + Rr[::-1][1:]
    d.polygon(poly, fill=col)
    if ow: d.line(poly + [poly[0]], fill=INK, width=ow, joint='curve')


def flames(im, cam, ts, T, k, step=None, spread=1.0, pal=0):
    """комикс-огонь вокруг точки на полу под №67; k — интенсивность (0..1.6)"""
    if k <= .02: return
    gx, gy = track.ground(ts)[2], track.ground(ts)[3]
    s = S(cam); X, Y = project(cam, gx, gy)
    fs = math.floor(T * 12)
    rx, ry = 42 * s * spread, 11 * s * spread
    cols = [((255, 58, 96), (255, 150, 34), (255, 228, 84), (255, 252, 214)),
            ((255, 200, 40), (255, 150, 30), (255, 236, 120), (255, 255, 230))][pal]
    # подсветка пола
    pad = int(rx * 2.2)
    x0, y0, x1, y1 = int(X - pad), int(Y - pad * .9), int(X + pad), int(Y + pad * .35)
    gl = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    ImageDraw.Draw(gl).ellipse([pad - rx * 1.4, (pad * .9) - ry * 3.2, pad + rx * 1.4, (pad * .9) + ry * 3.2], fill=(255, 130, 30, int(130 * min(1, k))))
    gl = gl.filter(ImageFilter.GaussianBlur(26))
    im.paste(gl, (x0, y0), gl)
    ov = overlay(); d = ImageDraw.Draw(ov)
    n = 17
    tongs = []
    for i in range(n):
        th = i / n * 2 * math.pi + .3
        wob = .72 + .28 * math.sin(fs * 2.3 + i * 1.9)
        hh = (34 + 26 * abs(math.sin(i * 2.7 + 1.1))) * s * k * wob
        ww = (6.5 + 2.5 * math.sin(i * 1.3)) * s * (.7 + .3 * min(1, k))
        lean = math.sin(fs * 1.4 + i * 2.1) * ww * 1.1
        tongs.append((math.sin(th), X + rx * math.cos(th), Y + ry * math.sin(th), ww, hh, lean))
    for front in (False, True):
        for sn, bx, by, ww, hh, lean in sorted(tongs, key=lambda t: t[2]):
            if (sn >= 0) != front: continue
            for (sc_, c_) in ((1.0, cols[0]), (.7, cols[1]), (.44, cols[2]), (.2, cols[3])):
                _tongue(d, bx, by + 3 * (1 - sc_), ww * sc_ if sc_ < 1 else ww, hh * (1 if sc_ == 1 else .78 * sc_ + .22), lean * sc_, c_ + (255,), int(max(4, 9 * s / 4)) if sc_ == 1 else 0)
    # искры
    for j in range(int(26 * min(1, k))):
        ph = (j * 0.6180339) % 1
        u = (T * .85 + ph) % 1
        ex = X + (ph * 2 - 1) * rx * 1.3 + 16 * math.sin(u * 7 + ph * 9) * s / 4
        ey = Y - u * 230 * s / 4 - 10
        sz = (12 * (1 - u) + 3) * s / 4
        d.polygon([(ex, ey - sz), (ex + sz * .7, ey), (ex, ey + sz), (ex - sz * .7, ey)], fill=(255, 226 - int(60 * u), 90, 255), outline=INK + (255,))
    comp(im, ov)


def fire_k(T):
    if T < b11: return 0.0
    u = (T / B) % 1
    k = .72 + .5 * max(0, 1 - (T - b11) / .45) + .08 * (1 - u) ** 2
    k *= eexpo(seg(T, b11, b11 + .12))
    if T >= b16:
        k = .72 + .95 * max(0, 1 - (T - b16) / .6)
        k *= 1 - seg(T, b16 + .5, b16 + 1.05)
    return max(0, k)


# ------------------------- сцены -------------------------
def sc_reveal(T, step, rng):
    p = seg(T, 0, b2)
    cam = cam_A(b2)
    a = view(0.0, lambda _: cam, T, mb=False)
    hx, hy, _, _ = track.hero(0.0)
    X, Y = project(cam, hx, hy + 40)
    yy, xx = np.ogrid[0:H, 0:W]
    dist = np.sqrt((xx - X) ** 2 + (yy - Y) ** 2).astype(f32) / (W * .85)
    grow = np.clip((eio(p) * 1.9 - dist) * 2.6, 0, 1.15)
    dots = halftone_grow(grade(a, 1.5, 1.2), 12, grow)
    live = sv_grade(a, step)
    k = eio(seg(p, .62, 1))
    o = chroma(dots * (1 - k) + live * k, 12 * math.sin(math.pi * seg(p, .45, 1)))
    return Image.fromarray(to8(o))


def sc_walk(T, step, rng):
    ts = ts_of(T)
    a = view(ts, cam_A, T)
    return Image.fromarray(to8(sv_grade(a, step, ht=.2, inkk=.38, ch=2)))


def sc_pass(T, step, rng):
    ts = ts_of(T); cam = cam_B(T)
    a = view(ts, cam_B, T)
    c = clamp(1 - (T - b11) / .3, 0, 1) if T >= b11 else 0
    a = sv_grade(a, step, ht=.2, inkk=.4, ch=2 + 7 * c)
    im = Image.fromarray(to8(a))
    if 3.28 <= ts <= 3.85: trail(im, cam, min(ts, 3.80), .3, w=15 * S(cam) / 4)
    if T >= b11:
        X, Y = project(cam, *track.ball(3.80))
        ring_burst(im, X, Y, T - b11, S(cam) / 3.2)
        if T - b11 < .1: R.star(ImageDraw.Draw(im), X, Y, 170, 100, 10, rng, rot=step * .09, fill=(255, 228, 77))
    flames(im, cam, ts, T, fire_k(T), step)
    return im


def sc_think(T, step, rng):
    ts = ts_of(T); cam = cam_C(T)
    a = view(ts, cam_C, T)
    u = (T / B) % 1
    g = grade(a, 1, 1.3)
    kk = .62 * eout(seg(T, b12, b12 + .3))
    a = g * (1 - kk) + popmap(g * .9 + .05) * kk
    a = halftone(ink(a, .55), 9, .26 + .1 * (1 - u))
    a = vignette(grain(chroma(a, 2 + 3 * (1 - u) ** 2), .02, step), .36 + .22 * (1 - u) ** 3)
    im = Image.fromarray(to8(a))
    flames(im, cam, ts, T, fire_k(T), step)
    return im


def sc_shot(T, step, rng):
    ts = ts_of(T); cam = cam_D(T)
    pre = T < b16
    a = view(ts, cam_D, T)
    dT = T - b16
    if pre:
        t = seg(T, b15, b16)
        a = halftone(ink(grade(a, 1.4, 1.2, .1), .55), 10, .25 + .25 * t)
        a = chroma(a, 3 + 9 * t)
    else:
        rise = seg(T, b16, b20)
        a = sv_grade(a, step, ht=.2, inkk=.4, ch=2 + 3 * rise)
        a = vignette(a, .15 + .25 * rise)
        a = flash(a, .4 * (1 - seg(dT, 0, .07)))
    im = Image.fromarray(to8(a))
    flames(im, cam, min(ts, 4.5), T, fire_k(T), step)
    if not pre:
        if dT < .4:
            X, Y = project(cam, *track.ball(4.6))
            R.speedlines(im, X, Y, 80 + 300 * eout(dT / .4), 18, rng, .5 * (1 - dT / .4))
        if 4.58 <= ts <= 5.9: trail(im, cam, ts, .32, n=44, w=20 * S(cam) / 4.5)
    return im


def sc_celeb(T, step, rng):
    ts = ts_of(T)
    a = view(ts, cam_G, T)
    a = sv_grade(a, step, ht=.16, inkk=.34, ch=2)
    a = flash(a, .5 * (1 - seg(T - b24, 0, .1)))
    return Image.fromarray(to8(a))


# ------------------------- ТРОН -------------------------
_TH = {}


def throne():
    if not _TH:
        im = Image.open(THRONE).convert('RGB')
        _TH['im'] = im
        sc = W / im.width
        big = im.resize((W, int(im.height * sc)), Image.BICUBIC)
        top = int(big.height * .12)
        bg = big.crop((0, top, W, top + H)).filter(ImageFilter.GaussianBlur(34))
        a = tof(bg) * np.array([.62, .5, .78], f32)
        cov = np.clip(4.6 - grid(14, 45) + .5, 0, 1)
        a *= 1 - .16 * cov[..., None]
        _TH['bg'] = a
    return _TH


@lru_cache(maxsize=1)
def ball_big(d=420):
    S_ = 2
    n = d * S_
    im = Image.new('RGBA', (n + 40 * S_, n + 40 * S_), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    c = (n + 40 * S_) // 2; r = n // 2
    dr.ellipse([c - r - 12 * S_, c - r - 12 * S_, c + r + 12 * S_, c + r + 12 * S_], fill=INK + (255,))
    dr.ellipse([c - r, c - r, c + r, c + r], fill=(255, 132, 40, 255))
    sm = Image.new('RGBA', im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sm)
    w_ = 11 * S_
    sd.line([(c, c - r), (c, c + r)], fill=INK + (255,), width=w_)
    sd.line([(c - r, c), (c + r, c)], fill=INK + (255,), width=w_)
    for sx in (-1, 1):
        R_ = r * 1.08; c0 = c + sx * r * 1.3
        sd.arc([c0 - R_, c - R_, c0 + R_, c + R_], -58 if sx < 0 else 122, 58 if sx < 0 else 238, fill=INK + (255,), width=w_)
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).ellipse([c - r, c - r, c + r, c + r], fill=255)
    sm.putalpha(Image.fromarray(np.minimum(np.asarray(sm.getchannel('A')), np.asarray(m))))
    im.alpha_composite(sm)
    dr = ImageDraw.Draw(im)
    dr.arc([c - r * .66, c - r * .78, c - r * .1, c - r * .2], 200, 290, fill=(255, 224, 170, 255), width=10 * S_)
    out = im.resize((im.width // S_, im.height // S_), Image.LANCZOS)
    a = np.asarray(out).astype(f32)
    yy, xx = np.mgrid[0:out.height, 0:out.width].astype(f32)
    cell = 13; ang = math.radians(45)
    u_ = xx * math.cos(ang) + yy * math.sin(ang); v_ = -xx * math.sin(ang) + yy * math.cos(ang)
    dist = np.hypot((u_ % cell) - cell / 2, (v_ % cell) - cell / 2)
    shade = np.clip(((xx - out.width / 2) * .6 + (yy - out.height / 2) * .55) / (d * .5), 0, 1)
    cov = np.clip(cell * .62 * np.sqrt(shade) - dist + .5, 0, 1) * (a[..., 3] > 200)
    a[..., :3] *= 1 - .32 * cov[..., None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


_CR = np.random.default_rng(11)
CONF = [(_CR.uniform(0, W), _CR.uniform(90, 300), _CR.uniform(0, 1), _CR.uniform(7, 17), int(_CR.integers(0, 5)), _CR.uniform(-3, 3), _CR.random()) for _ in range(70)]
CCOL = [(255, 214, 64), (255, 246, 190), (160, 92, 230), (255, 255, 255), (255, 128, 40)]


def ball_icon(d, x, y, r, rot):
    d.ellipse([x - r - 3, y - r - 3, x + r + 3, y + r + 3], fill=INK)
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 132, 40))
    c, s_ = math.cos(rot), math.sin(rot)
    d.line([(x - c * r, y - s_ * r), (x + c * r, y + s_ * r)], fill=INK, width=3)
    d.line([(x + s_ * r, y - c * r), (x - s_ * r, y + c * r)], fill=INK, width=3)


def sc_throne(T, step, rng):
    t = T - b28
    th = throne()
    base = th['bg'].copy()
    im = Image.fromarray(to8(base))
    # вращающиеся золотые лучи
    ov = overlay(); d = ImageDraw.Draw(ov)
    cx_, cy_ = W / 2, 520
    rot = T * .22
    for i in range(0, 24, 2):
        a0 = rot + i / 24 * 2 * math.pi; a1 = rot + (i + 1) / 24 * 2 * math.pi
        d.polygon([(cx_, cy_), (cx_ + math.cos(a0) * 2600, cy_ + math.sin(a0) * 2600), (cx_ + math.cos(a1) * 2600, cy_ + math.sin(a1) * 2600)], fill=(255, 214, 64, 54))
    comp(im, ov)
    d = ImageDraw.Draw(im)
    u = (T / B) % 1
    # пламя по нижней кромке — подпись «огня под ногами»
    fl = overlay(); fd = ImageDraw.Draw(fl)
    fsx = math.floor(T * 12)
    for i in range(20):
        bx = (i + .5) / 20 * W
        hh = (120 + 100 * abs(math.sin(i * 2.3 + 1))) * (.75 + .25 * math.sin(fsx * 2.1 + i * 1.7)) * eout(seg(t, .3, 1.1))
        ww = 33 + 8 * math.sin(i * 1.3)
        lean = math.sin(fsx * 1.3 + i * 2.2) * 20
        for (sc_, c_) in ((1.0, (255, 150, 30)), (.68, (255, 214, 64)), (.4, (255, 246, 190))):
            _tongue(fd, bx, H + 6, ww * sc_, hh * sc_ if sc_ < 1 else hh, lean * sc_, c_ + (255,), 8 if sc_ == 1 else 0)
    comp(im, fl)
    # постер-панель
    pp = seg(t, .12, .6)
    ph_ = 1010; pw_ = int(ph_ * th['im'].width / th['im'].height)
    zf = 1 + .16 * eio(seg(t, .4, TOTAL - b28)) + .02 * math.sin(t * 1.3)
    cwid, chei = th['im'].width / zf, th['im'].height / zf
    cxp, cyp = lerp(561, 540, eio(seg(t, .4, 3.8))), lerp(701, 560, eio(seg(t, .4, 3.8)))
    cl = clamp(cxp - cwid / 2, 0, th['im'].width - cwid); ct = clamp(cyp - chei / 2, 0, th['im'].height - chei)
    crop = th['im'].crop((int(cl), int(ct), int(cl + cwid), int(ct + chei))).resize((pw_, ph_), Image.BICUBIC)
    # печать: лёгкая точечная текстура
    crop = Image.fromarray(to8(chroma(tof(crop), 2 + 6 * (1 - eout(seg(t, .12, .8))))))
    fr = Image.new('RGBA', (pw_ + 44, ph_ + 44), (255, 250, 232, 255))
    ImageDraw.Draw(fr).rectangle([0, 0, fr.width - 1, fr.height - 1], outline=INK + (255,), width=12)
    ImageDraw.Draw(fr).rectangle([22, 22, fr.width - 23, fr.height - 23], fill=INK + (255,))
    fr.paste(crop, (22, 22))
    fr.putalpha(Image.new('L', fr.size, 255))
    ang = -1.6 + 1.6 * (1 - eback(pp, 1.6)) * 4
    sc_in = lerp(.55, 1.0, eback(pp, 1.7)) if pp < 1 else 1 + .008 * math.sin(t * 2.4)
    fr2 = fr.resize((int(fr.width * sc_in), int(fr.height * sc_in)), Image.BICUBIC).rotate(ang, expand=True, resample=Image.BICUBIC)
    sh = Image.new('RGBA', fr2.size, (0, 0, 0, 0)); sh.paste((8, 4, 20, 150), (0, 0), fr2)
    pcx, pcy = W / 2, 540 + 10 * (1 - eout(pp)) * 6
    im.paste(sh, (int(pcx + 22 - fr2.width / 2), int(pcy + 22 - fr2.height / 2)), sh)
    im.paste(fr2, (int(pcx - fr2.width / 2), int(pcy - fr2.height / 2)), fr2)
    d = ImageDraw.Draw(im)

    def p2s(px, py):
        x = ((px - cl) / cwid - .5) * pw_ * sc_in; y = ((py - ct) / chei - .5) * ph_ * sc_in
        a_ = math.radians(-ang)
        return pcx + x * math.cos(a_) + y * math.sin(a_), pcy - x * math.sin(a_) + y * math.cos(a_)

    # блик света по постеру
    ws = seg(t, 1.1, 1.8) if t < 2.6 else seg(t, 3.4, 4.1)
    if 0 < ws < 1:
        sx = lerp(pcx - 520, pcx + 520, ws)
        band = overlay(); bd = ImageDraw.Draw(band)
        bd.polygon([(sx - 70, pcy - 560), (sx + 30, pcy - 560), (sx - 130, pcy + 560), (sx - 230, pcy + 560)], fill=(255, 255, 255, 105))
        mk = Image.new('L', (W, H), 0); ImageDraw.Draw(mk).rectangle([pcx - fr2.width / 2 + 22, pcy - fr2.height / 2 + 22, pcx + fr2.width / 2 - 22, pcy + fr2.height / 2 - 22], fill=255)
        a_ = np.minimum(np.asarray(band.getchannel('A')), np.asarray(mk))
        band.putalpha(Image.fromarray(a_)); comp(im, band)
    # вспышка победы и всплеск из короны
    cX, cY = p2s(545, 300)
    if t < .9:
        flash_k = max(0, 1 - abs(t - .5) / .12) if abs(t - .5) < .12 else 0
    ring_burst(im, cX, cY, t - .5, 2.4, (255, 214, 64), 20)
    ring_burst(im, cX, cY, t - .62, 3.4, (255, 255, 255), 14)
    # блёстки: корона и кубок
    if pp >= 1:
        dd = ImageDraw.Draw(im)
        for j, (px, py, ph0, rr) in enumerate(((545, 262, 0, 46), (430, 330, .3, 30), (668, 300, .6, 34), (920, 640, .15, 52), (860, 760, .55, 28), (962, 700, .8, 24))):
            tw = (math.sin(t * 3.4 + ph0 * 6.28) * .5 + .5) ** 1.4
            sx_, sy_ = p2s(px, py)
            sparkle(dd, sx_, sy_, 10 + rr * tw, (255, 255, 255) if j % 2 == 0 else (255, 236, 130))
    # слева: «67-КОРОЛЬ»
    pk = seg(t, .6, .95)
    if pk > 0:
        kc = king_combo()
        sc_k = .56 * eback(pk, 1.8) * (1 + .018 * (1 - u) ** 3)
        spr = kc.resize((max(1, int(kc.width * sc_k)), max(1, int(kc.height * sc_k))), Image.BICUBIC)
        yb = 6 * math.sin(t * 2 * math.pi / (2 * B))
        im.paste(spr, (int(285 - spr.width / 2), int(560 + yb - spr.height / 2)), spr)
    # справа: мяч NBA
    pb = seg(t, 1.0, 1.4)
    if pb > 0:
        bb = ball_big(380)
        rotb = -t * 55
        sqz = 1 + .12 * math.sin(clamp(pb, 0, 1) * math.pi) * (1 - pb)
        bs = eback(pb, 1.9) * (1 + .03 * (1 - u) ** 3)
        b2_ = bb.resize((max(1, int(bb.width * bs * sqz)), max(1, int(bb.height * bs / sqz))), Image.BICUBIC).rotate(rotb, expand=True, resample=Image.BICUBIC)
        by_ = 600 - 34 * abs(math.sin(t * math.pi / (2 * B) * .5)) - lerp(500, 0, eexpo(pb))
        im.paste(b2_, (int(1655 - b2_.width / 2), int(by_ - b2_.height / 2)), b2_)
        ring_burst(im, 1655, 790, t - 1.4, 1.5, (255, 128, 40), 14)
    # конфетти и мячики
    dd = ImageDraw.Draw(im)
    tc = t - .45
    if tc > 0:
        for (x0_, sp_, ph_c, sz, ci, rr_, tp) in CONF:
            y_ = ((ph_c * (H + 200) + tc * sp_) % (H + 200)) - 100
            x_ = x0_ + 30 * math.sin(tc * 1.5 + ph_c * 6)
            a_ = tc * rr_ + ph_c * 6
            if tp > .86:
                ball_icon(dd, x_, y_, sz * 1.2 + 6, a_)
            elif tp > .74:
                sparkle(dd, x_, y_, sz * 1.3 + 4, CCOL[ci])
            else:
                c, sn = math.cos(a_), math.sin(a_)
                dd.polygon([(x_ + c * sz - sn * sz * .5, y_ + sn * sz + c * sz * .5), (x_ - c * sz - sn * sz * .5, y_ - sn * sz + c * sz * .5),
                            (x_ - c * sz + sn * sz * .5, y_ - sn * sz - c * sz * .5), (x_ + c * sz + sn * sz * .5, y_ + sn * sz - c * sz * .5)], fill=CCOL[ci], outline=INK)
    a = tof(im)
    a = flash(a, .85 * max(0, 1 - abs(t - .5) / .09) if abs(t - .5) < .09 else 0, (1.0, .93, .7))
    fade = seg(T, TOTAL - .6, TOTAL)
    if fade > 0: a = a * (1 - fade) + np.array([.04, .02, .08], f32) * fade
    out = Image.fromarray(to8(grain(a, .012, step)))
    # ирис из живого кадра
    if t < .5:
        prev = sc_celeb(b28 - 1 / 60, step, rng)
        r = 1500 * eexpo(seg(t, 0, .45))
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).ellipse([W / 2 - r, 540 - r, W / 2 + r, 540 + r], fill=255)
        o2 = prev.copy(); o2.paste(out, (0, 0), m)
        ImageDraw.Draw(o2).ellipse([W / 2 - r, 540 - r, W / 2 + r, 540 + r], outline=INK, width=18)
        out = o2
    return out


def frame(i):
    T = i / FPS
    step = int(T * 12)
    rng = np.random.default_rng(3000 + step)
    if T < b2: return sc_reveal(T, step, rng)
    if T < b8: return sc_walk(T, step, rng)
    if T < b12: return sc_pass(T, step, rng)
    if T < b15: return sc_think(T, step, rng)
    if T < b20: return sc_shot(T, step, rng)
    if T < b24: return R3.sc_score(T, step, rng)
    if T < b28: return sc_celeb(T, step, rng)
    return sc_throne(T, step, rng)


def work(i): return i, frame(i).tobytes()


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    json.dump(EVENTS, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'events4.json'), 'w'), indent=1)
    rng_ = (0, NFR)
    if '--frames' in sys.argv:
        a, c = sys.argv[sys.argv.index('--frames') + 1].split(':'); rng_ = (int(a), int(c))
    R.load(src)
    idx = list(range(*rng_))
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                           '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for n, (i, buf) in enumerate(pool.imap(work, idx, chunksize=2)):
            ff.stdin.write(buf)
            if n % 60 == 0: print('frame', i, flush=True)
    ff.stdin.close(); ff.wait()
    print('done', NFR)
