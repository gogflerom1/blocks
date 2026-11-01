"""Фигурка №67-КОРОЛЬ: комикс-персонаж (векторная отрисовка, 800x1200), в короне, с баскетбольным мячом."""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(HERE, 'RubikMono.ttf')
K = 2                      # суперсэмплинг
DW, DH = 800, 1200
INK = (12, 8, 20)
SKIN, SKIN_SH = (255, 214, 176), (232, 168, 128)
HAIR, HAIR_SH = (214, 168, 98), (170, 120, 62)
JERSEY, PIPE = (24, 22, 36), (255, 120, 40)
GOLD, GOLD_SH = (255, 216, 64), (226, 156, 22)
BALL = (255, 132, 40)


def build():
    im = Image.new('RGBA', (DW * K, DH * K), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = lambda v: v * K

    def poly(pts, fill, ow=8, close=True):
        P = [(k(x), k(y)) for x, y in pts]
        d.line(P + ([P[0]] if close else []), fill=INK, width=k(ow * 2), joint='curve')
        for x, y in P: d.ellipse([x - k(ow), y - k(ow), x + k(ow), y + k(ow)], fill=INK)
        d.polygon(P, fill=fill)

    def ell(cx, cy, rx, ry, fill, ow=8):
        d.ellipse([k(cx - rx - ow), k(cy - ry - ow), k(cx + rx + ow), k(cy + ry + ow)], fill=INK)
        d.ellipse([k(cx - rx), k(cy - ry), k(cx + rx), k(cy + ry)], fill=fill)

    def limb(pts, w, fill, ow=8):
        P = [(k(x), k(y)) for x, y in pts]
        d.line(P, fill=INK, width=k(w + ow * 2), joint='curve')
        for x, y in (P[0], P[-1]): d.ellipse([x - k(w / 2 + ow), y - k(w / 2 + ow), x + k(w / 2 + ow), y + k(w / 2 + ow)], fill=INK)
        d.line(P, fill=fill, width=k(w), joint='curve')
        for x, y in P: d.ellipse([x - k(w / 2), y - k(w / 2), x + k(w / 2), y + k(w / 2)], fill=fill)

    cx = 400
    # тень на полу
    d.ellipse([k(170), k(1118), k(630), k(1180)], fill=(0, 0, 0, 90))
    # ноги
    limb([(350, 790), (345, 960), (338, 1085)], 66, SKIN)
    limb([(450, 790), (455, 960), (462, 1085)], 66, SKIN)
    for sx in (-1, 1):
        x0 = cx + sx * 62
        poly([(x0 - sx * 46, 1066), (x0 + sx * 42, 1066), (x0 + sx * 42, 1098), (x0 + sx * 88, 1126), (x0 + sx * 88, 1158), (x0 - sx * 56, 1158), (x0 - sx * 60, 1110)], (236, 240, 250))
        poly([(x0 - sx * 58, 1136), (x0 + sx * 88, 1136), (x0 + sx * 88, 1160), (x0 - sx * 58, 1160)], (60, 56, 84), 5)
        poly([(x0 - sx * 40, 1078), (x0 + sx * 38, 1078), (x0 + sx * 38, 1094), (x0 - sx * 40, 1094)], (255, 60, 130), 4)
    # шорты
    poly([(300, 640), (500, 640), (520, 842), (410, 830), (400, 760), (390, 830), (280, 842)], JERSEY)
    d.line([(k(292), k(700)), (k(284), k(838))], fill=PIPE + (255,), width=k(9))
    d.line([(k(508), k(700)), (k(516), k(838))], fill=PIPE + (255,), width=k(9))
    # майка
    poly([(272, 372), (338, 352), (400, 410), (462, 352), (528, 372), (546, 470), (516, 668), (284, 668), (254, 470)], JERSEY)
    poly([(338, 352), (400, 410), (462, 352), (440, 346), (400, 372), (360, 346)], (46, 42, 64), 5)
    for sx in (-1, 1):
        d.line([(k(cx + sx * 146), k(404)), (k(cx + sx * 122), k(660))], fill=PIPE + (255,), width=k(11))
    # руки спереди
    limb([(296, 400), (232, 528), (312, 632)], 60, SKIN)
    limb([(504, 400), (568, 528), (488, 632)], 60, SKIN)
    # номер на груди
    ft = ImageFont.truetype(FR, K * 92)
    txt = Image.new('RGBA', (DW * K, DH * K), (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    bb = td.textbbox((0, 0), '67', font=ft, stroke_width=K * 6)
    td.text((k(cx) - (bb[2] - bb[0]) // 2 - bb[0], k(446) - bb[1]), '67', font=ft, fill=(255, 255, 255, 255), stroke_width=K * 6, stroke_fill=INK + (255,))
    im.alpha_composite(txt)
    d = ImageDraw.Draw(im)
    # шея и голова
    poly([(366, 300), (434, 300), (440, 366), (400, 396), (360, 366)], SKIN_SH)
    for sx in (-1, 1): ell(cx + sx * 92, 236, 20, 34, SKIN, 7)
    ell(cx, 230, 92, 108, SKIN)
    # волосы
    poly([(300, 218), (308, 150), (344, 112), (400, 100), (456, 112), (492, 150), (500, 218), (478, 176), (440, 150), (400, 146), (356, 152), (322, 178)], HAIR)
    poly([(308, 150), (284, 188), (300, 218)], HAIR_SH, 6)
    poly([(492, 150), (516, 188), (500, 218)], HAIR_SH, 6)
    # лицо
    for sx in (-1, 1):
        ex = cx + sx * 40
        ell(ex, 226, 25, 31, (255, 255, 255), 6)
        ell(ex + sx * 3, 232, 12, 17, INK, 0)
        d.ellipse([k(ex + sx * 3 - 9), k(222), k(ex + sx * 3 - 1), k(232)], fill=(255, 255, 255, 255))
        d.line([(k(ex - sx * 30), k(186 + (6 if sx > 0 else 6))), (k(ex + sx * 26), k(176))], fill=INK + (255,), width=k(10))
    d.line([(k(cx - 4), k(246)), (k(cx - 12), k(278)), (k(cx + 8), k(282))], fill=SKIN_SH + (255,), width=k(7), joint='curve')
    d.arc([k(cx - 44), k(262), k(cx + 44), k(322)], 22, 158, fill=INK + (255,), width=k(9))
    d.ellipse([k(cx - 70), k(268), k(cx - 44), k(288)], fill=(255, 150, 140, 150))
    d.ellipse([k(cx + 44), k(268), k(cx + 70), k(288)], fill=(255, 150, 140, 150))
    # КОРОНА
    base = [(318, 124), (482, 124), (490, 82), (452, 110), (440, 52), (410, 98), (400, 36), (390, 98), (360, 52), (348, 110), (310, 82)]
    poly(base, GOLD, 8)
    poly([(318, 124), (482, 124), (478, 150), (322, 150)], GOLD_SH, 7)
    for gx, gy, c in ((400, 36, (255, 60, 100)), (360, 52, (0, 210, 255)), (440, 52, (0, 210, 255)), (310, 82, (255, 60, 100)), (490, 82, (255, 60, 100))):
        ell(gx, gy - 6, 12, 12, c, 5)
    for gx in (350, 400, 450): ell(gx, 138, 9, 9, (255, 60, 100) if gx == 400 else (0, 210, 255), 4)
    # мяч в руках
    bx, by, br = 400, 648, 96
    ell(bx, by, br, br, BALL, 9)
    seams = Image.new('RGBA', im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(seams)
    sd.line([(k(bx), k(by - br)), (k(bx), k(by + br))], fill=INK + (255,), width=k(8))
    sd.line([(k(bx - br), k(by)), (k(bx + br), k(by))], fill=INK + (255,), width=k(8))
    for sx in (-1, 1):
        R = br * 1.08
        c0 = bx + sx * br * 1.3
        sd.arc([k(c0 - R), k(by - R), k(c0 + R), k(by + R)], -58 if sx < 0 else 122, 58 if sx < 0 else 238, fill=INK + (255,), width=k(8))
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).ellipse([k(bx - br), k(by - br), k(bx + br), k(by + br)], fill=255)
    seams.putalpha(ImageChops.multiply(seams.getchannel('A'), m))
    im.alpha_composite(seams)
    d = ImageDraw.Draw(im)
    d.arc([k(bx - br * .6), k(by - br * .75), k(bx - br * .1), k(by - br * .3)], 200, 290, fill=(255, 220, 160, 255), width=k(8))
    # пальцы поверх мяча
    for (fx, fy) in ((314, 600), (322, 638), (336, 672), (486, 600), (478, 638), (464, 672)):
        ell(fx, fy, 15, 22, SKIN, 6)
    # блик/тени: полутоновая сетка на правой нижней части
    out = im.resize((DW, DH), Image.LANCZOS)
    a = np.asarray(out).astype(np.float32)
    y, x = np.mgrid[0:DH, 0:DW].astype(np.float32)
    ang = math.radians(45); cell = 11
    u = x * math.cos(ang) + y * math.sin(ang); v = -x * math.sin(ang) + y * math.cos(ang)
    dist = np.hypot((u % cell) - cell / 2, (v % cell) - cell / 2)
    shade = np.clip(((x - 400) * .6 + (y - 600) * .25) / 220, 0, 1)
    cov = np.clip(cell * .62 * np.sqrt(shade) - dist + .5, 0, 1) * (a[..., 3] > 200)
    a[..., :3] *= (1 - .3 * cov[..., None])
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def crown_sprite(w=400):
    """корона отдельным спрайтом (для заставок)"""
    S = 3
    cw, ch = int(w), int(w * .74)
    im = Image.new('RGBA', (cw * S, ch * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    sc = cw * S / 208.0
    def P(x, y): return ((x - 296) * sc, (y - 14) * sc)
    base = [(318, 124), (482, 124), (490, 82), (452, 110), (440, 52), (410, 98), (400, 36), (390, 98), (360, 52), (348, 110), (310, 82)]
    pts = [P(x, y) for x, y in base]
    d.line(pts + [pts[0]], fill=INK, width=int(14 * S), joint='curve')
    for x, y in pts: d.ellipse([x - 7 * S, y - 7 * S, x + 7 * S, y + 7 * S], fill=INK)
    d.polygon(pts, fill=GOLD)
    band = [P(318, 124), P(482, 124), P(478, 150), P(322, 150)]
    d.line(band + [band[0]], fill=INK, width=int(12 * S), joint='curve')
    d.polygon(band, fill=GOLD_SH)
    for gx, gy, c in ((400, 36, (255, 60, 100)), (360, 52, (0, 210, 255)), (440, 52, (0, 210, 255)), (310, 82, (255, 60, 100)), (490, 82, (255, 60, 100))):
        x, y = P(gx, gy - 6); r = 12 * sc
        d.ellipse([x - r - 5 * S, y - r - 5 * S, x + r + 5 * S, y + r + 5 * S], fill=INK); d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    return im.resize((cw, ch), Image.LANCZOS)


def draw_crown(d, cx, cy, w, fill=GOLD, ow=4):
    s = w / 180.0
    pts = [(cx + (x - 400) * s, cy + (y - 80) * s) for x, y in
           [(318, 124), (482, 124), (490, 82), (452, 110), (440, 52), (410, 98), (400, 36), (390, 98), (360, 52), (348, 110), (310, 82)]]
    d.polygon(pts, fill=fill, outline=INK)
    d.line(pts + [pts[0]], fill=INK, width=ow, joint='curve')


if __name__ == '__main__':
    import sys
    build().save(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'figure.png'))
