"""№67 HERO CUT — стиль Spider-Verse, все анимации завязаны на игрока №67.
Выход → пасс → «подумал» → бросок → полёт мяча → попадание.
Использование: python3 render3.py SRC.mp4 out_video.mp4 [--frames a:b] [--png dir]
"""
import sys, os, math, json, subprocess
import numpy as np
from functools import lru_cache
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont
import render as R
import track
import figure
from render import (W, H, FPS, B, f32, clamp, seg, lerp, eio, eout, eexpo, eback, eel, to8, tof, lum,
                    lerpcam, fit, project, view, grade, ink, halftone, chroma, chroma_radial, zoomblur, glitch,
                    grain, vignette, flash, edges, sv_grade, popmap, paper, inset, sfx_sprite, caption_sprite,
                    paste, star, speedlines, sense_lines, grid, PAPER, INKS, RIM, T_END, FR, FB, SW)

b = lambda k: k * B
TOTAL = 44 * B
NFR = int(TOTAL * FPS)
b2, b8, b9, b11, b12, b15, b16, b20, b24, b27, b32, b34 = [b(k) for k in (2, 8, 9, 11, 12, 15, 16, 20, 24, 27, 32, 34)]
HOLD = 0.1
# узлы времени: (выходное T, время исходника)
KN = [(0, 0.0), (b2, 0.0), (b8, 2.90), (b9, 3.20), (b11, 3.80), (b11 + HOLD, 3.80), (b12, 3.88), (b15, 4.30),
      (b16, 4.58), (b20, 5.80), (b20 + .05, 5.80), (b24, 6.40)]
T_PASS0 = b9 + (3.30 - 3.20) / (3.80 - 3.20) * (b11 - b9)
EVENTS = {'off0': b16 + (4.85 - 4.58) / 1.22 * 4 * B, 'off1': b16 + (5.45 - 4.58) / 1.22 * 4 * B, 'ring': b16 + (5.35 - 4.58) / 1.22 * 4 * B, 'beat': B, 'walk': b2, 'pass0': T_PASS0, 'catch': b11, 'think': b12, 'release': b16, 'swish': b20,
          'replay': b24, 'celeb': b27, 'end': b32, 'figure': b34, 'total': TOTAL}


def ts_of(T):
    if b24 <= T < b27: return 4.58
    if T >= b27: return lerp(5.90, T_END, seg(T, b27, b32)) if T < b32 else 4.55
    if T >= b(12) and T < b20 or (b20 <= T < b24):  # «на двойках»
        T = math.floor(T * 12) / 12
    for (t0, s0), (t1, s1) in zip(KN, KN[1:]):
        if T <= t1: return lerp(s0, s1, seg(T, t0, t1))
    return KN[-1][1]


def S(cam): return fit(cam)[2] * W / SW   # пикселей экрана на пиксель исходника


# ------------------------- спрайты -------------------------
@lru_cache(maxsize=32)
def chunk(text, size, top=(255, 236, 60), bot=(255, 90, 110), stroke=20, ext=20, shadow=(0, 200, 255), font=FR):
    ft = ImageFont.truetype(font, size)
    bb = ft.getbbox(text, stroke_width=stroke)
    pad = ext + 40
    w, h = bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    ox, oy = pad - bb[0] - ext // 2, pad - bb[1] - ext // 2
    sh = shadow + (255,)
    d.text((ox + ext + 12, oy + ext + 8), text, font=ft, fill=sh, stroke_width=stroke, stroke_fill=sh)
    for k in range(ext, 0, -1):
        c = (255, 40 + k * 2, 120, 255)
        d.text((ox + k, oy + k), text, font=ft, fill=c, stroke_width=stroke, stroke_fill=c)
    d.text((ox, oy), text, font=ft, fill=(8, 6, 14, 255), stroke_width=stroke, stroke_fill=(8, 6, 14, 255))
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).text((ox, oy), text, font=ft, fill=255)
    g = np.linspace(0, 1, h, dtype=f32)[:, None, None]
    grad = (np.array(top, f32) * (1 - g) + np.array(bot, f32) * g).repeat(w, 1)
    img.paste(Image.fromarray(grad.astype(np.uint8)), (0, 0), m)
    return img


@lru_cache(maxsize=32)
def outline(text, size, color, wd=10, font=FR):
    ft = ImageFont.truetype(font, size)
    bb = ft.getbbox(text, stroke_width=wd)
    w, h = bb[2] - bb[0] + 60, bb[3] - bb[1] + 60
    m1 = Image.new('L', (w, h), 0); m0 = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m1).text((30 - bb[0], 30 - bb[1]), text, font=ft, fill=255, stroke_width=wd, stroke_fill=255)
    ImageDraw.Draw(m0).text((30 - bb[0], 30 - bb[1]), text, font=ft, fill=255)
    ring = Image.fromarray(np.clip(np.asarray(m1, np.int16) - np.asarray(m0, np.int16), 0, 255).astype(np.uint8))
    img = Image.new('RGBA', (w, h), color + (255,)); img.putalpha(ring)
    return img


@lru_cache(maxsize=8)
def badge(text='67'):
    f1 = ImageFont.truetype(FR, 74); f2 = ImageFont.truetype(FR, 31)
    b1 = f1.getbbox(text); b2_ = f2.getbbox('КОРОЛЬ')
    tw = max(b1[2] - b1[0], b2_[2] - b2_[0]); th1 = b1[3] - b1[1]; th2 = b2_[3] - b2_[1]
    w, h = tw + 70, th1 + th2 + 78
    img = Image.new('RGBA', (w + 28, h + 28 + 44), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    oy = 44
    d.rounded_rectangle([14, 14 + oy, w + 14, h + 14 + oy], 18, fill=(0, 210, 255, 255))
    d.rounded_rectangle([0, oy, w, h + oy], 18, fill=(8, 6, 14, 255))
    d.rounded_rectangle([7, 7 + oy, w - 7, h - 7 + oy], 13, fill=(255, 56, 120, 255))
    d.text((w // 2 - (b1[2] - b1[0]) // 2 - b1[0], oy + 20 - b1[1]), text, font=f1, fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(8, 6, 14, 255))
    d.rounded_rectangle([20, oy + th1 + 40, w - 20, oy + th1 + th2 + 62], 8, fill=(255, 228, 77, 255), outline=(8, 6, 14, 255), width=4)
    d.text((w // 2 - (b2_[2] - b2_[0]) // 2 - b2_[0], oy + th1 + 51 - b2_[1]), 'КОРОЛЬ', font=f2, fill=(8, 6, 14, 255))
    cr = figure.crown_sprite(96)
    img.alpha_composite(cr, (w // 2 - 48, 0))
    return img


def overlay():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def comp(im, ov): im.paste(ov, (0, 0), ov); return im


# ------------------------- эффекты -------------------------
def spot(a, cam, ts, k=1.0):
    hx, hy, fx, fy = track.hero(ts)
    fy = max(fy, track.ground(ts)[3])
    s = S(cam)
    cx, cy = project(cam, (hx + fx) / 2, (hy + fy) / 2)
    rx, ry = 62 * s, ((fy - hy) / 2 + 42) * s
    y, x = np.ogrid[0:H, 0:W]
    d = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2).astype(f32)
    m = np.clip((1.3 - d) / .6, 0, 1); m = (m * m * (3 - 2 * m))[..., None]
    g = lum(a)[..., None]
    dim = (g + (a - g) * .5) * .58
    return a * (1 - k + k * m) + dim * (k - k * m)


def ripples(ov, cam, ts, T, strength=1.0, col=((255, 228, 77), (255, 60, 130))):
    gx, gy, _, _ = (lambda g: (g[2], g[3], 0, 0))(track.ground(ts))
    s = S(cam); X, Y = project(cam, gx, gy)
    d = ImageDraw.Draw(ov)
    # плотная база под ногами
    d.ellipse([X - 46 * s, Y - 13 * s, X + 46 * s, Y + 13 * s], fill=(255, 60, 130, int(120 * strength)))
    d.ellipse([X - 30 * s, Y - 8.5 * s, X + 30 * s, Y + 8.5 * s], fill=(255, 228, 77, int(150 * strength)))
    for k in range(3):
        ph = ((T / B) + k / 3) % 1
        r = (30 + 78 * eout(ph)) * s
        al = int(255 * (1 - ph) * strength)
        wd = max(2, int((9 * (1 - ph) + 2) * (s / 3)))
        c = col[k % 2]
        d.ellipse([X - r - 4, Y - r * .3 - 4, X + r + 4, Y + r * .3 + 4], outline=(8, 6, 14, al), width=wd + 5)
        d.ellipse([X - r, Y - r * .3, X + r, Y + r * .3], outline=c + (al,), width=wd)


def tag(im, cam, ts, T, t_in, scale=1.0, dy=0, dx=30):
    p = seg(T, t_in, t_in + .22)
    if p <= 0: return
    hx, hy, _, _ = track.hero(ts)
    s = S(cam); X, Y = project(cam, hx, hy)
    bob = math.sin(T / B * math.pi * 2) * 5
    ty = max(110, Y - 105 * (s / 3.4) - 50 + bob + dy)
    d = ImageDraw.Draw(im)
    d.line([(X, Y - 18 * s / 3), (X + dx * .6, ty + 40)], fill=(8, 6, 14), width=10)
    d.line([(X, Y - 18 * s / 3), (X + dx * .6, ty + 40)], fill=(255, 228, 77), width=4)
    paste(im, badge(), X + dx, ty, eback(p) * scale, -5 + 3 * math.sin(T / B * math.pi))


def thought(im, cam, ts, T, k=1.0, dx=64, dy=-60):
    hx, hy, _, _ = track.hero(ts)
    s = S(cam); X, Y = project(cam, hx, hy)
    R0 = 32 * s
    cx, cy = X + dx * s, max(Y + dy * s, R0 * 1.12 + 14)
    d = ImageDraw.Draw(im)
    pop = eback(k)
    R0 *= pop
    if R0 < 8: return
    for fr, rr in ((.25, .1), (.5, .16), (.74, .23)):
        x = lerp(X + 6 * s, cx - R0 * .6, fr); y = lerp(Y - 26 * s, cy + R0 * .7, fr)
        r = rr * R0 * 1.4
        d.ellipse([x - r - 7, y - r - 7, x + r + 7, y + r + 7], fill=(8, 6, 14))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 250, 235))
    cl = [(0, 0, 1.0), (-.78, .12, .6), (.78, .1, .62), (-.38, -.58, .58), (.42, -.6, .56), (-.42, .56, .55), (.46, .54, .55)]
    for ox, oy, r in cl:
        d.ellipse([cx + ox * R0 - r * R0 - 9, cy + oy * R0 - r * R0 - 9, cx + ox * R0 + r * R0 + 9, cy + oy * R0 + r * R0 + 9], fill=(8, 6, 14))
    for ox, oy, r in cl:
        d.ellipse([cx + ox * R0 - r * R0, cy + oy * R0 - r * R0, cx + ox * R0 + r * R0, cy + oy * R0 + r * R0], fill=(255, 250, 235))
    # кольцо с сеткой и мячом, который влетает в такт
    u = (T / B) % 1
    rx, ry = cx + .34 * R0, cy + .05 * R0
    bx0, by0 = cx - .62 * R0, cy + .45 * R0
    d.rectangle([cx + .12 * R0, cy - .75 * R0, cx + .72 * R0, cy - .22 * R0], outline=(8, 6, 14), width=7, fill=(225, 238, 255))
    d.rectangle([cx + .3 * R0, cy - .5 * R0, cx + .54 * R0, cy - .3 * R0], outline=(255, 60, 90), width=5)
    wob = math.sin(u * 30) * 4 * max(0, (u - .65) * 3) * (u > .65)
    net = [(rx - .24 * R0, ry), (rx - .14 * R0 + wob, ry + .34 * R0), (rx + .14 * R0 + wob, ry + .34 * R0), (rx + .24 * R0, ry)]
    for x0 in np.linspace(-.24, .24, 5):
        d.line([(rx + x0 * R0, ry), (rx + x0 * .58 * R0 + wob, ry + .34 * R0)], fill=(8, 6, 14), width=4)
    d.line([net[1], net[2]], fill=(8, 6, 14), width=4)
    d.ellipse([rx - .26 * R0, ry - .06 * R0, rx + .26 * R0, ry + .06 * R0], outline=(255, 70, 40), width=8)
    if u < .68:
        v = u / .68
        bxp = lerp(bx0, rx, v); byp = lerp(by0, ry - .1 * R0, v) - math.sin(v * math.pi) * .9 * R0
    else:
        v = (u - .68) / .32
        bxp = rx; byp = lerp(ry - .1 * R0, ry + .52 * R0, v * v)
    rb = .13 * R0
    d.ellipse([bxp - rb - 5, byp - rb - 5, bxp + rb + 5, byp + rb + 5], fill=(8, 6, 14))
    d.ellipse([bxp - rb, byp - rb, bxp + rb, byp + rb], fill=(255, 140, 40))
    d.arc([bxp - rb, byp - rb, bxp + rb, byp + rb], 200, 340, fill=(8, 6, 14), width=3)


def trail(im, cam, t_end, span, n=40, w=26, col=(255, 255, 255)):
    s = S(cam); rb = 7 * s * .55
    pts = []
    for i in range(n + 1):
        t = t_end - span * (1 - i / n)
        pts.append(project(cam, *track.ball(t)))
    ov = overlay(); d = ImageDraw.Draw(ov)
    for lay, (dx, dy, c) in enumerate(((0, 0, (8, 6, 14)), (-6, -4, (0, 210, 255)), (6, 4, (255, 50, 130)), (0, 0, col))):
        for i, (x, y) in enumerate(pts):
            f = (i / n) ** 1.3
            r = max(1, (w * f + 1) * (1.5 if lay == 0 else 1.0 if lay < 3 else .55))
            d.ellipse([x + dx - r, y + dy - r, x + dx + r, y + dy + r], fill=c + (255,))
    comp(im, ov)


def ring_burst(im, X, Y, t, size=1.0, col=(255, 228, 77), n=14):
    p = seg(t, 0, .4)
    if p <= 0 or p >= 1: return
    d = ImageDraw.Draw(im)
    r = (30 + 260 * eexpo(p)) * size
    d.ellipse([X - r, Y - r * .55, X + r, Y + r * .55], outline=(8, 6, 14), width=int(22 * (1 - p)) + 4)
    d.ellipse([X - r, Y - r * .55, X + r, Y + r * .55], outline=col, width=int(12 * (1 - p)) + 2)
    rr = np.random.default_rng(int(t * 100))
    for k in range(n):
        a = k / n * 2 * math.pi + rr.uniform(-.1, .1)
        r0, r1 = r * .55, r * .55 + (90 + 140 * (1 - p)) * size
        d.line([(X + math.cos(a) * r0, Y + math.sin(a) * r0 * .7), (X + math.cos(a) * r1, Y + math.sin(a) * r1 * .7)], fill=(8, 6, 14), width=int(14 * (1 - p)) + 3)
        d.line([(X + math.cos(a) * r0, Y + math.sin(a) * r0 * .7), (X + math.cos(a) * r1, Y + math.sin(a) * r1 * .7)], fill=col, width=int(7 * (1 - p)) + 1)


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


# ------------------------- камеры -------------------------
def body(ts, lag=.1):
    hx, hy, fx, fy = track.hero(max(0, ts - lag))
    return (hx + fx) / 2, (hy + fy) / 2


def cam_A(T):
    p = seg(T, b2, b8)
    ts = ts_of(max(T, b2))
    cx, cy = body(ts)
    return (cx + 8, cy + 6, lerp(1.55, 1.95, eio(p)), lerp(-1.5, 1.0, p))


def cam_B(T):
    p = seg(T, b8, b12)
    ts = ts_of(T)
    cx, cy = body(ts)
    z = lerp(1.95, 1.7, eio(seg(T, b8, b9 + .1))) + .05 * math.sin(p * math.pi)
    # пунш при ловле
    pun = max(0, 1 - (T - b11) / .25) if T >= b11 else 0
    z += .22 * pun
    return (lerp(cx + 8, 462, eio(seg(T, b9, b11))), lerp(cy + 6, 222, eio(seg(T, b9, b11))), z, lerp(1.0, -1.5, p))


def cam_C(T):
    p = eio(seg(T, b12, b15))
    return (lerp(462, 452, p), lerp(222, 168, p), lerp(1.7, 2.05, p), lerp(-1.5, 1.2, p))


def cam_D(T):
    if T < b16:
        p = eio(seg(T, b15, b16))
        return (lerp(452, 446, p), lerp(168, 190, p), lerp(2.05, 2.3, p), lerp(1.2, 0, p))
    p = eio(seg(T, b16 + .32, b20 - .12))
    a = (446, 190, 2.3, 0.0)
    c = (RIM[0] - 6, RIM[1] + 36, 2.55, 1.0)
    return lerpcam(a, c, p)


def cam_E(T):
    p = seg(T, b20, b20 + .35); q = seg(T, b20 + .35, b24)
    return (RIM[0], RIM[1] + 10, lerp(3.5, 2.7, eexpo(p)) - .1 * q, lerp(-5, -1.5, eexpo(p)) + 1.0 * q)


CAM_F = (450, 165, 1.16, 0)


def cam_G(T):
    p = seg(T, b27, b32)
    return lerpcam((RIM[0] - 40, RIM[1] + 80, 2.2, -1.5), (424, 240, 1.06, 0), eio(seg(T, b27, b27 + 1.3))) if p < 1 else (424, 240, 1.07, 0)


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
    live = spot(sv_grade(a, step), cam, 0.0, 1.0)
    k = eio(seg(p, .62, 1))
    o = dots * (1 - k) + live * k
    o = chroma(o, 12 * math.sin(math.pi * seg(p, .45, 1)))
    im = Image.fromarray(to8(o))
    # кольцо «вылетает» из-под ног к концу
    ov = overlay()
    if p > .55: ripples(ov, cam, 0.0, T, eout(seg(p, .55, 1)) * .9)
    return comp(im, ov)


def sc_walk(T, step, rng):
    ts = ts_of(T); cam = cam_A(T)
    a = view(ts, cam_A, T)
    a = spot(sv_grade(a, step, ht=.2, inkk=.38, ch=2), cam, ts)
    im = Image.fromarray(to8(a)); ov = overlay()
    ripples(ov, cam, ts, T, .95)
    comp(im, ov)
    tag(im, cam, ts, T, b2 + B)
    return im


def sc_pass(T, step, rng):
    ts = ts_of(T); cam = cam_B(T)
    a = view(ts, cam_B, T)
    c = clamp(1 - (T - b11) / .3, 0, 1) if T >= b11 else 0
    a = spot(sv_grade(a, step, ht=.2, inkk=.4, ch=2 + 7 * c), cam, ts)
    im = Image.fromarray(to8(a)); ov = overlay()
    ripples(ov, cam, ts, T, .9)
    comp(im, ov)
    tagk = 1 + .25 * c
    tag(im, cam, ts, T, 0, tagk)
    if 3.28 <= ts <= 3.85:
        trail(im, cam, min(ts, 3.80), .3, w=24 * S(cam) / 4)
    if T >= b11:
        X, Y = project(cam, *track.ball(3.80))
        ring_burst(im, X, Y, T - b11, S(cam) / 2.8)
        if T - b11 < .1:
            s = S(cam)
            d = ImageDraw.Draw(im)
            star(d, X, Y, 190, 110, 10, rng, rot=step * .09, fill=(255, 228, 77))
    if T > b8 + .2 and T < T_PASS0 + .1:
        # стрелка-прицел на того, кто отдаёт
        X, Y = project(cam, *track.ball(3.30))
        r = 46 + 8 * math.sin(T * 25)
        d = ImageDraw.Draw(im)
        d.ellipse([X - r, Y - r, X + r, Y + r], outline=(8, 6, 14), width=12)
        d.ellipse([X - r, Y - r, X + r, Y + r], outline=(0, 210, 255), width=6)
    return im


def sc_think(T, step, rng):
    ts = ts_of(T); cam = cam_C(T)
    a = view(ts, cam_C, T)
    u = (T / B) % 1
    k = eout(seg(T, b12, b12 + .5))
    g = grade(a, 1, 1.3)
    duo = popmap(g * .9 + .05)
    kk = .8 * eout(seg(T, b12, b12 + .25))
    a = a * (1 - kk) + duo * kk
    a = spot(a, cam, ts, .9)
    a = ink(a, .6); a = halftone(a, 9, .3 + .12 * (1 - u))
    a = chroma(a, 3 + 4 * (1 - u) ** 2)
    a = vignette(grain(a, .02, step), .38 + .25 * (1 - u) ** 3)
    im = Image.fromarray(to8(a)); ov = overlay()
    ripples(ov, cam, ts, T, .85)
    comp(im, ov)
    hx, hy, _, _ = track.hero(ts)
    X, Y = project(cam, hx, hy)
    sense_lines(ImageDraw.Draw(im), X, Y - 20, 1.25 * (S(cam) / 4.5), rng, eback(seg(T, b12, b12 + .2)) * (1 if u < .35 else .25))
    thought(im, cam, ts, T, seg(T, b12 + .1, b12 + .45))
    tag(im, cam, ts, T, 0, 1.0, dy=-10, dx=-95)
    return im


def sc_shot(T, step, rng):
    ts = ts_of(T); cam = cam_D(T)
    pre = T < b16
    a = view(ts, cam_D, T)
    dT = T - b16
    if pre:
        t = seg(T, b15, b16)
        a = grade(a, 1.4, 1.2, .1)
        a = spot(a, cam, ts, .9)
        a = ink(a, .6); a = halftone(a, 10, .3 + .3 * t)
        a = chroma(a, 3 + 10 * t)
    else:
        rise = seg(T, b16, b20)
        a = spot(sv_grade(a, step, ht=.2, inkk=.4, ch=2 + 4 * rise), cam, ts, .85 * (1 - seg(T, b16, b16 + .6)))
        a = vignette(a, .15 + .25 * rise)
        if dT < .35:
            a = zoomblur(a, .05 * (1 - dT / .35), project(cam, *track.ball(max(ts, 4.58))), 5)
        a = flash(a, .45 * (1 - seg(dT, 0, .07)))
    im = Image.fromarray(to8(a)); ov = overlay()
    if ts < 4.62 or True:
        ripples(ov, cam, min(ts, 4.5), T, max(0, .8 * (1 - seg(T, b16 - .1, b16 + .5))))
    comp(im, ov)
    if pre:
        hx, hy, _, _ = track.hero(ts)
        X, Y = project(cam, hx, hy)
        sense_lines(ImageDraw.Draw(im), X, Y - 10, .7 * (S(cam) / 4.5), rng, 1 - seg(T, b15, b16))
    if not pre:
        # призрак номера «67» вылетает со спины
        hx, hy, fx, fy = track.hero(4.58)
        X, Y = project(cam, hx, hy + 8)
        if dT < .8:
            k = seg(dT, 0, .8)
            for j in range(3):
                kk = clamp(k - j * .08, 0, 1)
                if kk <= 0: continue
                paste(im, outline('67', 330, ((255, 60, 130), (0, 210, 255), (255, 228, 77))[j], 12), X, Y, lerp(.5, 1.05 + j * .12, eexpo(kk)), 0, (1 - kk) * .8)
        if dT < .5:
            X, Y = project(cam, *track.ball(4.6))
            speedlines(im, X, Y, 90 + 380 * eout(dT / .5), 26, rng, .55 * (1 - dT / .5))
        # след мяча
        if 4.58 <= ts <= 5.9:
            trail(im, cam, ts, .32, n=44, w=26 * S(cam) / 4.5)
        # индикатор мяча за кадром
        bx, by = track.ball(ts)
        X, Y = project(cam, bx, by)
        if Y < 70 and 4.7 < ts < 5.6:
            X = clamp(X, 120, W - 120)
            pu = 1 + .12 * math.sin(T * 30)
            ov = overlay(); d = ImageDraw.Draw(ov)
            yy = 78 + 8 * math.sin(T * 14)
            for s_ in range(0, 5):
                ya = yy + 70 + s_ * 34
                d.line([(X - 8, ya), (X, ya - 14), (X + 8, ya)], fill=(8, 6, 14, 255), width=10)
                d.line([(X - 8, ya), (X, ya - 14), (X + 8, ya)], fill=(255, 228, 77, 255), width=4)
            r = 42 * pu
            d.ellipse([X - r - 8, yy - r - 8, X + r + 8, yy + r + 8], fill=(8, 6, 14, 255))
            d.ellipse([X - r, yy - r, X + r, yy + r], fill=(255, 130, 40, 255))
            d.arc([X - r, yy - r, X + r, yy + r], 20, 160, fill=(8, 6, 14, 255), width=6)
            d.line([(X - r, yy), (X + r, yy)], fill=(8, 6, 14, 255), width=5)
            comp(im, ov)
        # прицел на кольцо
        if ts > 5.35:
            X, Y = project(cam, *RIM)
            k = seg(ts, 5.35, 5.8)
            r = lerp(190, 52, eout(k))
            d = ImageDraw.Draw(im)
            d.ellipse([X - r * 1.6, Y - r * .65, X + r * 1.6, Y + r * .65], outline=(8, 6, 14), width=int(12))
            d.ellipse([X - r * 1.6, Y - r * .65, X + r * 1.6, Y + r * .65], outline=(255, 60, 130), width=6)
    else:
        pass
    tag(im, cam, min(ts, 4.5), T, 0, 1.0, dy=-30)
    return im


@lru_cache(maxsize=2)
def king_combo():
    n = chunk('67', 480); kk = chunk('КОРОЛЬ', 138, (255, 236, 60), (255, 70, 120), 12, 12)
    cr = figure.crown_sprite(280)
    cw = max(n.width, kk.width)
    h = cr.height - 36 + n.height - 20 + kk.height
    img = Image.new('RGBA', (cw, h), (0, 0, 0, 0))
    img.alpha_composite(cr, ((cw - cr.width) // 2 + 20, 0))
    img.alpha_composite(n, ((cw - n.width) // 2, cr.height - 36))
    img.alpha_composite(kk, ((cw - kk.width) // 2, cr.height - 36 + n.height - 20))
    return img


def sc_score(T, step, rng):
    t = T - b20
    ts = ts_of(T); cam = cam_E(T)
    a = view(ts, cam_E, T, mb=False)
    rx, ry = project(cam, *RIM)
    a = grade(a, 1.7, 1.2, .1) * .88 + .1
    a = ink(a, .6); a = halftone(a, 11, .7)
    a = zoomblur(a, .26 * (1 - eout(seg(t, 0, .3))), (rx, ry))
    a = chroma_radial(a, .01 * (1 - eout(seg(t, 0, .4))) + .002)
    if t < .12: a = glitch(a, .6, rng)
    a = flash(a, .7 * (1 - seg(t, 0, .07)))
    im = Image.fromarray(to8(a))
    if t < .02: return im
    speedlines(im, rx, ry, 300, 36, rng, .5)
    d = ImageDraw.Draw(im)
    # ударная волна
    ring_burst(im, rx, ry + 30, t, 1.6, (255, 228, 77), 18)
    # 67 — слэм
    p = seg(t, .02, .32)
    if p > 0:
        sc = lerp(3.2, 1.0, eback(p, 1.8)) if p < 1 else 1 + .02 * math.sin(t * 16)
        sq = 1 + .14 * math.sin(clamp(p, 0, 1) * math.pi) * (1 - p)
        spr = king_combo()
        s2 = spr.resize((max(1, int(spr.width * sc * sq)), max(1, int(spr.height * sc / sq))), Image.BICUBIC)
        jit = (rng.uniform(-5, 5), rng.uniform(-5, 5)) if t < .6 else (0, 0)
        im.paste(s2, (int(1420 + jit[0] - s2.width / 2), int(580 + jit[1] - s2.height / 2)), s2)
    q = seg(t, .12, .42)
    if q > 0:
        sx, sy = 440, 310
        star(d, sx, sy, 250 * eel(q) + 1, 150 * eel(q) + 1, 12, rng, rot=step * .05)
        paste(im, sfx_sprite('SWISH!', 190), sx, sy, eel(q) * (1 + .02 * math.sin(t * 16)), -7)
    return im


def view_free(ts, cam, fill=(40, 14, 70)):
    cx, cy, z, rot = cam
    s = (SW / z) / W
    c, n = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    co = (s * c, s * n, cx - s * c * W / 2 - s * n * H / 2, -s * n, s * c, cy + s * n * W / 2 - s * c * H / 2)
    return tof(R.srcimg(ts).transform((W, H), Image.AFFINE, co, Image.BICUBIC, fillcolor=fill))


def project_free(cam, x, y):
    cx, cy, z, rot = cam
    s = (SW / z) / W
    c, n = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    dx, dy = x - cx, y - cy
    return W / 2 + (c * dx - n * dy) / s, H / 2 + (n * dx + c * dy) / s


def sc_diagram(T, step, rng):
    cam = CAM_F
    a = view_free(4.58, cam)
    g = grade(a, 1.2, 1.25)
    o = popmap(g) * .7 + g * .3
    o = ink(o, .55); o = halftone(o, 9, .4)
    im = Image.fromarray(to8(grain(chroma(o, 3), .02, step)))
    u = eout(seg(T, b24 + .1, b24 + 2 * B + .2))
    d = ImageDraw.Draw(im)
    s = cam[2] * W / SW
    hx, hy, fx, fy = track.hero(4.58)
    X, Y = project_free(cam, (hx + fx) / 2, (hy + 345) / 2 + 8)
    ra, rb = 40 * s, ((345 + 20 - hy) / 2 + 24) * s
    sw = 360 * eout(seg(T, b24, b24 + .45))
    for wd, c in ((20, (8, 6, 14)), (9, (255, 60, 130))):
        d.arc([X - ra, Y - rb, X + ra, Y + rb], -90, -90 + sw, fill=c, width=wd)
    n = 70; pts = [project_free(cam, *track.ball(lerp(4.58, 5.80, i / n))) for i in range(n + 1)]
    m = int(n * u)
    for i in range(m):
        if i % 3 == 2: continue
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        d.line([(x0, y0), (x1, y1)], fill=(8, 6, 14), width=22)
        d.line([(x0, y0), (x1, y1)], fill=(255, 228, 77), width=11)
    if m > 4:
        (x0, y0), (x1, y1) = pts[m - 1], pts[min(m, n)]
        ang = math.atan2(y1 - y0, x1 - x0)
        hx_, hy_ = x1, y1
        tri = [(hx_ + math.cos(ang) * 34, hy_ + math.sin(ang) * 34), (hx_ + math.cos(ang + 2.5) * 28, hy_ + math.sin(ang + 2.5) * 28), (hx_ + math.cos(ang - 2.5) * 28, hy_ + math.sin(ang - 2.5) * 28)]
        d.polygon(tri, fill=(255, 228, 77), outline=(8, 6, 14))
    if u > .97:
        X2, Y2 = project_free(cam, *RIM)
        rr = 44 + 8 * math.sin(T * 20)
        d.ellipse([X2 - rr * 1.5, Y2 - rr * .6, X2 + rr * 1.5, Y2 + rr * .6], outline=(8, 6, 14), width=12)
        d.ellipse([X2 - rr * 1.5, Y2 - rr * .6, X2 + rr * 1.5, Y2 + rr * .6], outline=(255, 60, 130), width=6)
    paste(im, badge(), X - 150, Y - rb - 20, eback(seg(T, b24 + .2, b24 + .5)), -4)
    p = eout(seg(T, b24, b24 + .3))
    return inset(im, lerp(1.0, .9, p), lerp(0, -1.3, p), T)


def sc_celeb(T, step, rng):
    ts = ts_of(T)
    a = view(ts, cam_G, T)
    a = sv_grade(a, step, ht=.16, inkk=.34, ch=2)
    im = Image.fromarray(to8(a))
    p = eio(seg(T, b27, b27 + .32))
    if p < 1:
        im = inset(im, lerp(.9, 1.0, p), lerp(-1.3, 0, p), T, border=int(14 * (1 - p)) + 1)
    return im


@lru_cache(maxsize=1)
def fig_sprite(): return figure.build()


@lru_cache(maxsize=1)
def title_spr(): return chunk('67-КОРОЛЬ', 215, (255, 236, 60), (255, 70, 120), 22, 22)


def sc_title(T, step, rng):
    t = T - b32
    pg = paper().copy()
    spr = title_spr()
    ring_burst(pg, W / 2, H / 2 + 60, t, 2.6, (255, 60, 130), 22)
    pk = seg(t, 0, .3)
    sc = lerp(2.6, 1.0, eback(pk, 1.6)) if pk < 1 else 1 + .012 * math.sin(t * 5)
    sq = 1 + .12 * math.sin(clamp(pk, 0, 1) * math.pi) * (1 - pk)
    sp = spr.resize((max(1, int(spr.width * sc * sq)), max(1, int(spr.height * sc / sq))), Image.BICUBIC)
    pg.paste(sp, (int(W / 2 - sp.width / 2), int(H / 2 + 60 - sp.height / 2)), sp)
    cp = seg(t, .14, .46)
    if cp > 0:
        cr = figure.crown_sprite(330)
        yy = lerp(-240, 300, eback(cp, 1.9)) if cp < 1 else 300
        pg.paste(cr, (int(W / 2 - cr.width / 2 - 20), int(yy - cr.height / 2)), cr)
        if cp >= 1:
            ring_burst(pg, W / 2, 360, t - .46, 1.1, (255, 228, 77), 12)
    a = tof(pg)
    a = chroma(a, 10 * (1 - eout(seg(t, 0, .5))))
    a = flash(a, .8 * (1 - seg(t, 0, .06)))
    return Image.fromarray(to8(grain(a, .02, step)))


def sunburst(T, n=28):
    cx, cy = W / 2, 560
    im = Image.new('RGB', (W, H), (176, 24, 120)); d = ImageDraw.Draw(im)
    rot = T * .16
    for i in range(0, n, 2):
        a0 = rot + i / n * 2 * math.pi; a1 = rot + (i + 1) / n * 2 * math.pi
        d.polygon([(cx, cy), (cx + math.cos(a0) * 2600, cy + math.sin(a0) * 2600), (cx + math.cos(a1) * 2600, cy + math.sin(a1) * 2600)], fill=(255, 64, 140))
    a = tof(im)
    cov = np.clip(4.4 - grid(14, 45) + .5, 0, 1)
    a *= 1 - .2 * cov[..., None]
    return vignette(a, .55)


def sparkle(d, x, y, r, col=(255, 255, 255)):
    pts = []
    for k in range(8):
        a = k * math.pi / 4 - math.pi / 2
        rr = r if k % 2 == 0 else r * .22
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    d.polygon(pts, fill=col, outline=(8, 6, 14))


_CF = np.random.default_rng(5)
CONF = [(_CF.uniform(0, W), _CF.uniform(80, 220), _CF.uniform(0, 1), _CF.uniform(10, 22), int(_CF.integers(0, 4)), _CF.uniform(-3, 3)) for _ in range(46)]
CONF_COL = [(255, 228, 77), (0, 210, 255), (255, 255, 255), (255, 60, 130)]


def sc_king(T, step, rng):
    t = T - b34
    im = Image.fromarray(to8(sunburst(T)))
    d = ImageDraw.Draw(im)
    u = (T / B) % 1
    rr = 400 + 16 * (1 - u) ** 3
    d.ellipse([W / 2 - rr - 12, 560 - rr - 12, W / 2 + rr + 12, 560 + rr + 12], fill=(12, 8, 20))
    d.ellipse([W / 2 - rr, 560 - rr, W / 2 + rr, 560 + rr], fill=(255, 238, 140))
    d.ellipse([W / 2 - rr * .8, 560 - rr * .8, W / 2 + rr * .8, 560 + rr * .8], fill=(255, 248, 196))
    tf = t - .15
    paste(im, outline('67', 980, (255, 60, 130), 18), W / 2, 560, 1 + .01 * math.sin(t * 3), 0, .6 * eout(seg(tf, .1, .5)))
    # круги под ногами в такт
    ov = overlay(); do = ImageDraw.Draw(ov)
    gx, gy = W / 2, 935
    do.ellipse([gx - 250, gy - 40, gx + 250, gy + 40], fill=(255, 60, 130, 130))
    do.ellipse([gx - 170, gy - 27, gx + 170, gy + 27], fill=(255, 228, 77, 170))
    for k in range(3):
        ph = ((T / B) + k / 3) % 1
        r = 170 + 360 * eout(ph); al = int(255 * (1 - ph))
        c = ((255, 228, 77), (255, 60, 130))[k % 2]
        do.ellipse([gx - r, gy - r * .22, gx + r, gy + r * .22], outline=(8, 6, 14, al), width=int(14 * (1 - ph)) + 6)
        do.ellipse([gx - r, gy - r * .22, gx + r, gy + r * .22], outline=c + (al,), width=int(8 * (1 - ph)) + 2)
    comp(im, ov)
    # конфетти
    dd = ImageDraw.Draw(im)
    if tf > .2:
        for (x0_, sp_, ph_, sz, ci, rot_) in CONF:
            y_ = ((ph_ * (H + 160) + tf * sp_) % (H + 160)) - 80
            x_ = x0_ + 28 * math.sin(tf * 1.7 + ph_ * 6)
            a_ = tf * rot_ + ph_ * 6
            c, sn = math.cos(a_), math.sin(a_)
            pts = [(x_ + c * sz - sn * sz * .5, y_ + sn * sz + c * sz * .5), (x_ - c * sz - sn * sz * .5, y_ - sn * sz + c * sz * .5),
                   (x_ - c * sz + sn * sz * .5, y_ - sn * sz - c * sz * .5), (x_ + c * sz + sn * sz * .5, y_ + sn * sz - c * sz * .5)]
            dd.polygon(pts, fill=CONF_COL[ci], outline=(8, 6, 14))
    # фигурка
    fg = fig_sprite()
    p = seg(tf, 0, .42)
    if p > 0:
        scl = .72 * (1 + .014 * (1 - u) ** 3)
        sx_ = 1 + .14 * math.sin(clamp(p, 0, 1) * math.pi) * (1 - p) * -1
        sy_ = 1 + .14 * math.sin(clamp(p, 0, 1) * math.pi) * (1 - p)
        w2, h2 = int(fg.width * scl * sx_), int(fg.height * scl * sy_)
        f2 = fg.resize((max(1, w2), max(1, h2)), Image.BICUBIC)
        bob = 7 * math.sin(max(0, tf) * 2 * math.pi / (2 * B)) if p >= 1 else 0
        rot = 1.3 * math.sin(max(0, tf) * 2 * math.pi / (4 * B)) if p >= 1 else 0
        f2 = f2.rotate(rot, expand=True, resample=Image.BICUBIC)
        yoff = lerp(700, 0, eback(p, 1.8))
        x0 = int(W / 2 - f2.width / 2)
        y0 = int(955 - f2.height + bob + yoff)
        im.paste(f2, (x0, y0), f2)
        # блёстки на короне
        if p >= 1:
            hx, hy = W / 2, 955 - fg.height * scl + 20 * scl + bob
            dd = ImageDraw.Draw(im)
            for j, (ox, oy, ph0) in enumerate(((-150, 20, 0), (140, 10, .33), (0, -80, .66), (-70, 90, .5))):
                tw = (math.sin((tf * 3.2 + ph0 * 6.28)) * .5 + .5)
                sparkle(dd, hx + ox, hy + oy, 14 + 40 * tw, (255, 255, 255) if j % 2 == 0 else (255, 236, 120))
    # плашка
    pb = seg(tf, .5, .8)
    if pb > 0:
        paste(im, caption_sprite('67-КОРОЛЬ', 70, (255, 228, 77)), W / 2, 972, eback(pb), -1.5)
    # ирис-переход из заставки
    if t < .5:
        prev = sc_title(b34 - 1 / 60, step, rng)
        r = 1500 * eexpo(seg(t, 0, .45))
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).ellipse([W / 2 - r, 560 - r, W / 2 + r, 560 + r], fill=255)
        out = prev.copy(); out.paste(im, (0, 0), m)
        ImageDraw.Draw(out).ellipse([W / 2 - r, 560 - r, W / 2 + r, 560 + r], outline=(8, 6, 14), width=18)
        im = out
    a = tof(im)
    a = chroma(a, 6 * (1 - eout(seg(t, 0, .6))))
    fade = seg(T, TOTAL - .55, TOTAL)
    if fade > 0: a = a * (1 - fade) + np.array([.05, .03, .08], f32) * fade
    return Image.fromarray(to8(grain(a, .015, step)))


def frame(i):
    T = i / FPS
    step = int(T * 12)
    rng = np.random.default_rng(2000 + step)
    if T < b2: return sc_reveal(T, step, rng)
    if T < b8: return sc_walk(T, step, rng)
    if T < b12: return sc_pass(T, step, rng)
    if T < b15: return sc_think(T, step, rng)
    if T < b20: return sc_shot(T, step, rng)
    if T < b24: return sc_score(T, step, rng)
    if T < b27: return sc_diagram(T, step, rng)
    if T < b32: return sc_celeb(T, step, rng)
    if T < b34: return sc_title(T, step, rng)
    return sc_king(T, step, rng)


def work(i):
    return i, frame(i).tobytes()


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    json.dump(EVENTS, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'events.json'), 'w'), indent=1)
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
