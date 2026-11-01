"""Оригинальный трек 140 BPM + SFX + живой звук зала из исходника.
python3 music.py SRC.mp4 out.wav [--stems dir]"""
import sys, os, subprocess, wave
import numpy as np

SR = 44100
B = 60 / 140
TOTAL = 38 * B
N = int(TOTAL * SR) + 1
rng = np.random.default_rng(67)


def bt(b): return b * B  # бит -> секунды
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR


def add(buf, sig, t0, gain=1.0):
    i = int(round(t0 * SR))
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), len(buf) - i)
    if n > 0: buf[i:i + n] += sig[:n] * gain


def fftfilt(x, lo=None, hi=None, q=1.0):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** (4 * q))
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** (4 * q))
    return np.fft.irfft(X * g, len(x))


def sweep_filter(x, cut, mode='lp', win=2048):
    """ОЛА-фильтр с меняющейся частотой среза; cut(t)->Гц"""
    hop = win // 2; out = np.zeros(len(x) + win); w = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / SR)
    xp = np.concatenate([x, np.zeros(win)])
    for i in range(0, len(x), hop):
        c = cut(i / SR)
        g = 1 / np.sqrt(1 + (f / c) ** 6) if mode == 'lp' else 1 / np.sqrt(1 + (c / np.maximum(f, 1)) ** 6)
        if mode == 'bp': g = np.exp(-((np.log2(np.maximum(f, 1) / c)) ** 2) * 6)
        out[i:i + win] += np.fft.irfft(np.fft.rfft(xp[i:i + win] * w) * g, win)
    return out[:len(x)]


def env(n, a=.005, d=.2, s=0.0, r=.05, dur=None):
    t = np.arange(n) / SR
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if dur is not None:
        e *= np.clip(1 - (t - dur) / r, 0, 1)
    return e


def osc_saw(f, d, harm=24, detune=0.0):
    t = tt(d); s = np.zeros_like(t)
    for k in range(1, harm + 1):
        if f * k > 15000: break
        s += np.sin(2 * np.pi * f * k * t * (1 + detune)) / k
    return s * .6


def osc_sq(f, d, harm=15):
    t = tt(d); s = np.zeros_like(t)
    for k in range(1, harm + 1, 2):
        if f * k > 14000: break
        s += np.sin(2 * np.pi * f * k * t) / k
    return s * .8


# ---------- барабаны ----------
def kick(gain=1.0):
    t = tt(.5)
    ph = 2 * np.pi * np.cumsum(48 + 140 * np.exp(-t * 32)) / SR
    k = np.sin(ph) * np.exp(-t * 7) + .3 * np.exp(-t * 300) * rng.normal(0, 1, len(t))
    return np.tanh(k * 1.6) * gain


def snare():
    t = tt(.35)
    n = fftfilt(rng.normal(0, 1, len(t)), 1200, 9000) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28)
    clap = np.zeros_like(t)
    for o in (0, .011, .023):
        i = int(o * SR); clap[i:] += fftfilt(rng.normal(0, 1, len(t) - i), 900, 5000) * np.exp(-t[:len(t) - i] * 40)
    return np.tanh((n * .9 + tone * .8 + clap * .5) * 1.3)


def hat(open_=False):
    d = .35 if open_ else .06
    t = tt(d)
    return fftfilt(rng.normal(0, 1, len(t)), 7000, 16000) * np.exp(-t * (11 if open_ else 70))


def crash(d=2.0):
    t = tt(d)
    return fftfilt(rng.normal(0, 1, len(t)), 4000, 15000) * np.exp(-t * 2.2)


def bass808(m, d, glide_from=None):
    t = tt(d)
    f = mtof(m) * np.ones_like(t)
    if glide_from is not None: f = mtof(m) + (mtof(glide_from) - mtof(m)) * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return np.tanh(s * 2.2) * env(len(t), .003, 1.8, .0, .06, d - .06)


def pad(chord, d):
    s = 0
    for m in chord:
        for dt in (-.004, .004):
            s = s + osc_saw(mtof(m), d, 18, dt)
    e = np.minimum(1, tt(d) / .25) * np.clip((d - tt(d)) / .2, 0, 1)
    return fftfilt(s * e, 120, 2400) * .18


def pluck(m, d=.3, bright=5000):
    s = osc_saw(mtof(m), d, 30) + .5 * osc_sq(mtof(m) * 2, d)
    return fftfilt(s * env(len(s), .002, .12), 200, bright) * .5


def stab(chord, d=.6):
    s = 0
    for m in chord: s = s + osc_saw(mtof(m), d, 30, .003) + osc_saw(mtof(m), d, 30, -.003)
    return fftfilt(s * env(len(s), .004, .22), 150, 6000) * .22


def impact(d=1.6):
    t = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.6)
    nz = fftfilt(rng.normal(0, 1, len(t)), 60, 3000) * np.exp(-t * 7)
    return np.tanh((sub * 1.2 + nz * .6) * 1.4)


def reverb(x, dur=1.6, mix=.25, seed=1):
    r = np.random.default_rng(seed); n = int(dur * SR)
    ir = r.normal(0, 1, n) * np.exp(-np.arange(n) / SR * 4.2)
    ir = fftfilt(ir, 200, 7000); ir /= np.sqrt((ir ** 2).sum())
    L = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:len(x)]
    return x + y * mix


# ---------- аранжировка ----------
Am, F, C, G, E = [57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62], [52, 56, 59]
drums = np.zeros(N); bass = np.zeros(N); syn = np.zeros(N); lead = np.zeros(N); sfx = np.zeros(N); kick_env = np.zeros(N)


def K(b, g=1.0):
    add(drums, kick(g), bt(b)); i = int(bt(b) * SR); kick_env[i:i + int(.18 * SR)] = np.maximum(kick_env[i:i + int(.18 * SR)], np.linspace(1, 0, int(.18 * SR))[:max(0, min(int(.18 * SR), N - i))])
def S(b, g=.8): add(drums, snare(), bt(b), g)
def Hh(b, g=.22, o=False): add(drums, hat(o), bt(b), g)


def groove_bar(b0, chord_root, chord, full=True, hats16=False):
    for k in (0, 1.75, 2.5): K(b0 + k)
    S(b0 + 2)
    for k in np.arange(0, 4, .25 if hats16 else .5):
        Hh(b0 + k, .2 if (k * 2) % 2 == 0 else .13)
    if hats16:
        for k in (3.5, 3.625, 3.75, 3.875): Hh(b0 + k, .12)
    Hh(b0 + 3.5, .15, True)
    add(bass, bass808(chord_root, bt(1.7)), bt(b0))
    add(bass, bass808(chord_root, bt(.7), chord_root + 12), bt(b0 + 2.5))
    add(syn, pad(chord, bt(4)), bt(b0))


# bar0: «печать» кадра -> вход бита на бит 2
p0 = pad(Am, bt(4))
add(syn, sweep_filter(p0, lambda x: 300 * (3000 / 300) ** min(1, x / bt(2))), 0, .9)
crk = np.zeros(int(bt(4) * SR)); idx = rng.integers(0, len(crk), 200); crk[idx] = rng.normal(0, .5, len(idx))
add(sfx, fftfilt(crk, 1500, 9000), 0, .4)
tp = tt(bt(2))
add(sfx, sweep_filter(rng.normal(0, 1, len(tp)), lambda x: 600 * (9000 / 600) ** (x / bt(2)), 'bp') * (tp / bt(2)) ** 2, 0, .25)
K(2); S(3, .55)
for k in np.arange(2, 4, .5): Hh(k, .18)
add(bass, bass808(45, bt(1.6)), bt(2))
for o, m in [(2, 69), (2.75, 72), (3.25, 76)]: add(lead, pluck(m, .35, 3000), bt(o), .45)

# bars1-2: грув
groove_bar(4, 45, Am, hats16=False)
groove_bar(8, 41, F, hats16=True)
mel1 = [(0, 69), (.75, 72), (1.5, 76), (2.5, 74), (3, 72)]
for b0 in (4, 8):
    for o, m in mel1: add(lead, pluck(m + (0 if b0 == 4 else -4), .35, 3500), bt(b0 + o), .5)

# bar3: чутьё — наезд, стоп, slow-mo
for k in (0, 1.75): K(12 + k)
S(14, .5)
add(bass, bass808(43, bt(1.5)), bt(12))
p3 = np.zeros(int(bt(4) * SR)); p3 += pad(G, bt(4))
add(syn, sweep_filter(p3, lambda x: max(250, 2400 * np.exp(-x * 2.2))), bt(12))
tg = tt(.9)
ting = sum(np.sin(2 * np.pi * f * tg + 2 * np.sin(2 * np.pi * f * 1.41 * tg) * np.exp(-tg * 4)) for f in (2637, 3136, 3951))
ting *= (0.6 + .4 * np.sin(2 * np.pi * 17 * tg)) * np.exp(-tg * 3.5)
add(sfx, ting, bt(13.5), .09)
add(sfx, impact(.8), bt(13.5), .35)
for k in np.arange(15, 16, 1 / 8): S(k, .15 + .5 * (k - 15))

# bar4: полёт — THWIP, свип, райзер
tw = tt(.6)
wh = sweep_filter(rng.normal(0, 1, len(tw)), lambda x: 400 + 4000 * np.sin(np.pi * min(1, x / .6)), 'bp') * np.sin(np.pi * np.minimum(1, tw / .6))
add(sfx, wh, bt(16) + .12, .45)
dr = bt(4)
tr = tt(dr)
riser = sweep_filter(rng.normal(0, 1, len(tr)), lambda x: 300 * (12000 / 300) ** (x / dr), 'bp') * (tr / dr) ** 2
riser += osc_saw(1, dr, 1) * 0
rs = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (tr / dr * 3)) / SR)
riser += np.tanh(rs * 2) * (tr / dr) ** 2.5 * .25
add(sfx, riser, bt(16), .5)
rc = crash(bt(4))[::-1] * np.linspace(0, 1, len(crash(bt(4)))) ** 2
add(sfx, rc, bt(16), .5)
for k in range(4): add(drums, kick(.55 + .1 * k), bt(16 + k))
add(bass, np.sin(2 * np.pi * mtof(28) * tr) * .5 * np.minimum(1, tr / .3), bt(16), .7)

# bar5..7: ДРОП
add(sfx, impact(2.2), bt(20), .9)
add(drums, crash(2.5), bt(20), .45)
tsw = tt(.45)
add(sfx, fftfilt(rng.normal(0, 1, len(tsw)), 2500, 12000) * np.sin(np.pi * tsw / .45) ** .5 * np.exp(-tsw * 3), bt(20) - .05, .35)
for k in range(5):  # глитч-статтеры
    g = rng.normal(0, 1, int(.04 * SR)); g = np.round(g * 4) / 4
    add(sfx, fftfilt(g, 400, 6000), bt(20) + .03 + k * .06, .25)
chords = [(45, Am), (41, F), (48, C), (43, G)]
groove_bar(20, 45, Am, hats16=True)
groove_bar(24, 41, F, hats16=True)
groove_bar(28, 48, C, hats16=True)
for k in (20, 22, 24, 26, 28, 30): add(syn, stab([45 + (0 if k < 24 else -4 if k < 28 else 3), 57, 60, 64], .35), bt(k), .6)
riff = [(0, 81), (.5, 79), (.75, 76), (1.5, 74), (2, 76), (2.5, 72), (3, 74), (3.5, 69)]
for b0, sh in ((20, 0), (24, -4), (28, 3)):
    for o, m in riff:
        add(lead, pluck(m + (sh if o >= 2 else 0) - 12, .32, 7000), bt(b0 + o), .75)
# слоу-мо повтор: обратный свиш и возврат
tw = tt(.5)
add(sfx, fftfilt(rng.normal(0, 1, len(tw)), 2500, 11000)[::-1] * np.sin(np.pi * tw / .5) ** 2, bt(22) - .1, .3)
tw = tt(.35)
add(sfx, sweep_filter(rng.normal(0, 1, len(tw)), lambda x: 1500 + 6000 * x, 'bp') * np.sin(np.pi * tw / .35), bt(26) - .05, .3)

# bar8: финальный стоп-кадр
fin = 0
for m in [33, 45, 52, 57, 60, 64, 69]:
    fin = fin + osc_saw(mtof(m), bt(6.2), 28, .003) + osc_saw(mtof(m), bt(6.2), 28, -.003)
fin = fftfilt(fin * env(len(fin), .005, 1.6, 0, .4, bt(6.2) - .4), 60, 5000) * .16
add(syn, fin, bt(32)); add(drums, kick(1.1), bt(32)); add(drums, crash(3), bt(32), .4); add(sfx, impact(2.4), bt(32), .7)
add(bass, bass808(33, bt(3)), bt(32), .8)
tb = tt(1.5)
bell = sum(np.sin(2 * np.pi * mtof(m) * tb) * np.exp(-tb * 3) for m in (81, 88))
add(lead, bell, bt(34), .25)

# ---------- живой звук ----------
src = sys.argv[1]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '2', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
orig = np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float64) / 32768
room = np.zeros((N, 2))
def place(s0, s1, t0, gain, speed=1.0, fade=.15):
    seg = orig[int(s0 * SR):int(s1 * SR)]
    if speed != 1.0:
        x = np.arange(0, len(seg) - 1, speed); i = x.astype(int); fr = (x - i)[:, None]
        seg = seg[i] * (1 - fr) + seg[i + 1] * fr
    e = np.ones(len(seg)); nf = int(fade * SR); e[:nf] = np.linspace(0, 1, nf); e[-nf:] = np.linspace(1, 0, nf)
    i0 = int(t0 * SR); n = min(len(seg), N - i0)
    room[i0:i0 + n] += seg[:n] * e[:n, None] * gain
place(0, 4.3, bt(2), .5, 1.0)
place(5.72, 8.36, bt(20) - .08, .95, fade=.05)
place(5.95, 8.36, bt(26), .55, fade=.4)

# ---------- сведение ----------
duck = 1 - .35 * np.convolve(kick_env, np.ones(200) / 200, 'same')
syn_r = reverb(syn, 1.8, .3, 1); lead_r = reverb(lead, 1.4, .25, 2)
music_mono = drums * .9 + bass * .55 * duck + syn_r * duck + lead_r * .55 * duck
L = music_mono + sfx * .9
d = int(.012 * SR)
lead_w = np.concatenate([np.zeros(d), lead_r[:-d]]) * .55 * duck
R = drums * .9 + bass * .55 * duck + syn_r * duck + lead_w + sfx * .9
mix = np.stack([L, R], 1) * .5 + room
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix *= .89 / np.abs(mix).max()
fo = int(.05 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]

out = sys.argv[2]
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
if '--stems' in sys.argv:
    dd = sys.argv[sys.argv.index('--stems') + 1]; os.makedirs(dd, exist_ok=True)
    for name, x in (('drums', drums), ('bass', bass), ('syn', syn), ('lead', lead), ('sfx', sfx)):
        with wave.open(f'{dd}/{name}.wav', 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((x / max(1e-9, np.abs(x).max()) * .8 * 32767).astype(np.int16).tobytes())
print('ok', len(mix) / SR)
