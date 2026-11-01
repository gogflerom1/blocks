"""БАС-ТРЕК под «67-КОРОЛЬ» (render4.py): 140 BPM, события из events4.json.
python3 music4.py SRC.mp4 out.wav [--stems dir]"""
import sys, os, json, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
EV = json.load(open(os.path.join(HERE, 'events4.json')))
SR = 44100
B = EV['beat']
TOTAL = EV['total']
N = int(TOTAL * SR) + 1
rng = np.random.default_rng(67)
bt = lambda k: k * B


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
    hop = win // 2; out = np.zeros(len(x) + win); w = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / SR)
    xp = np.concatenate([x, np.zeros(win)])
    for i in range(0, len(x), hop):
        c = cut(i / SR)
        if mode == 'lp': g = 1 / np.sqrt(1 + (f / c) ** 6)
        elif mode == 'hp': g = 1 / np.sqrt(1 + (c / np.maximum(f, 1)) ** 6)
        else: g = np.exp(-((np.log2(np.maximum(f, 1) / c)) ** 2) * 6)
        out[i:i + win] += np.fft.irfft(np.fft.rfft(xp[i:i + win] * w) * g, win)
    return out[:len(x)]


def env(n, a=.005, d=.2, s=0.0, r=.05, dur=None):
    t = np.arange(n) / SR
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if dur is not None: e *= np.clip(1 - (t - dur) / r, 0, 1)
    return e


def osc_saw(f, d, harm=24, detune=0.0):
    t = tt(d); s = np.zeros_like(t)
    for k in range(1, harm + 1):
        if f * k > 15000: break
        s += np.sin(2 * np.pi * f * k * t * (1 + detune)) / k
    return s * .6


# ---------------- инструменты ----------------
def kick(g=1.0, deep=True):
    t = tt(.6)
    ph = 2 * np.pi * np.cumsum(44 + 150 * np.exp(-t * 34)) / SR
    k = np.sin(ph) * np.exp(-t * (5.5 if deep else 8)) + .35 * np.exp(-t * 350) * rng.normal(0, 1, len(t))
    return np.tanh(k * 1.8) * g


def clap():
    t = tt(.4)
    n = fftfilt(rng.normal(0, 1, len(t)), 1000, 8000) * np.exp(-t * 14)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    cl = np.zeros_like(t)
    for o in (0, .011, .024):
        i = int(o * SR); cl[i:] += fftfilt(rng.normal(0, 1, len(t) - i), 900, 5500) * np.exp(-t[:len(t) - i] * 38)
    return np.tanh((n * .8 + tone * .7 + cl * .6) * 1.3)


def hat(o=False, v=1.0):
    d = .3 if o else .05
    t = tt(d)
    return fftfilt(rng.normal(0, 1, len(t)), 7000, 16000) * np.exp(-t * (12 if o else 80)) * v


def crash(d=2.2):
    t = tt(d)
    return fftfilt(rng.normal(0, 1, len(t)), 3500, 15000) * np.exp(-t * 2.0)


def bass808(m, d, glide_from=None, drive=2.8):
    t = tt(d)
    f = mtof(m) * np.ones_like(t)
    if glide_from is not None: f = mtof(m) + (mtof(glide_from) - mtof(m)) * np.exp(-t * 14)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    s += .35 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-t * 5) + .18 * np.sin(2 * np.pi * np.cumsum(f * 3) / SR) * np.exp(-t * 8)
    return np.tanh(s * (drive + .6)) * env(len(t), .003, 1.5, 0, .08, d - .08)


def reese(m, d, wob=0.0):
    t = tt(d)
    s = osc_saw(mtof(m), d, 20, .004) + osc_saw(mtof(m), d, 20, -.004) + osc_saw(mtof(m) * 2, d, 16, .006) * .5
    lfo = 1.0
    if wob:
        out = np.zeros_like(s)
        out = sweep_filter(s, lambda x: 220 + 520 * (.5 + .5 * np.sin(2 * np.pi * wob * x)), 'lp')
        s = out
    else:
        s = fftfilt(s, hi=420)
    return np.tanh(s * 2.0) * env(len(t), .01, 3, .9, .06, d - .06) * .5


def pad(chord, d, cut=2400):
    s = 0
    for m in chord:
        for dt in (-.004, .004): s = s + osc_saw(mtof(m), d, 18, dt)
    e = np.minimum(1, tt(d) / .2) * np.clip((d - tt(d)) / .2, 0, 1)
    return fftfilt(s * e, 120, cut) * .17


def pluck(m, d=.3, bright=5000):
    s = osc_saw(mtof(m), d, 30) + .5 * osc_saw(mtof(m) * 2, d, 12)
    return fftfilt(s * env(len(s), .002, .12), 200, bright) * .5


def stab(chord, d=.5):
    s = 0
    for m in chord: s = s + osc_saw(mtof(m), d, 30, .003) + osc_saw(mtof(m), d, 30, -.003)
    return fftfilt(s * env(len(s), .004, .2), 150, 6000) * .22


def sub_boom(d=1.6, f0=170, f1=36, g=1.0):
    t = tt(d)
    ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 7)) / SR
    return np.tanh(np.sin(ph) * 2.2) * np.exp(-t * 1.9) * g


def impact(d=1.8):
    t = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.4)
    nz = fftfilt(rng.normal(0, 1, len(t)), 60, 3000) * np.exp(-t * 7)
    return np.tanh((sub * 1.3 + nz * .6) * 1.5)


def riser(d, f0=300, f1=11000, g=1.0):
    t = tt(d)
    nz = sweep_filter(rng.normal(0, 1, len(t)), lambda x: f0 * (f1 / f0) ** (x / d), 'bp') * (t / d) ** 2
    ton = np.tanh(np.sin(2 * np.pi * np.cumsum(110 * 2 ** (t / d * 3.2)) / SR) * 2) * (t / d) ** 2.5 * .25
    return (nz + ton) * g


def whoosh(d=.5, up=True, g=1.0):
    t = tt(d)
    f = (lambda x: 500 + 5200 * (x / d)) if up else (lambda x: 5700 - 5200 * (x / d))
    return sweep_filter(rng.normal(0, 1, len(t)), f, 'bp') * np.sin(np.pi * np.minimum(1, t / d)) ** 1.2 * g


def reverb(x, dur=1.6, mix=.25, seed=1):
    r = np.random.default_rng(seed); n = int(dur * SR)
    ir = fftfilt(r.normal(0, 1, n) * np.exp(-np.arange(n) / SR * 4.2), 200, 7000); ir /= np.sqrt((ir ** 2).sum())
    L = len(x) + n
    return x + np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:len(x)] * mix


# ---------------- партитура ----------------
drums = np.zeros(N); bass = np.zeros(N); rees = np.zeros(N); syn = np.zeros(N); lead = np.zeros(N); sfx = np.zeros(N)
kick_env = np.zeros(N)
Am, F, C, G = [57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62]
ROOT = {0: 33, 1: 29, 2: 36, 3: 31}  # A1, F1, C2, G1


def K(t, g=1.0, deep=True):
    add(drums, kick(g, deep), t)
    i = int(t * SR); L = int(.2 * SR)
    seg_ = np.linspace(1, 0, L)[:max(0, min(L, N - i))]
    kick_env[i:i + len(seg_)] = np.maximum(kick_env[i:i + len(seg_)], seg_ * min(1, g))


def CL(t, g=.85): add(drums, clap(), t, g)
def H(t, v=.2, o=False): add(drums, hat(o), t, v * 2.6)


def hat_roll(t0, t1, v0=.1, v1=.3):
    n = int((t1 - t0) / (B / 8)) + 1
    for i in range(n):
        tt_ = t0 + i * (B / 8) * (1 - .4 * i / max(1, n))
        if tt_ < t1: H(tt_, v0 + (v1 - v0) * i / n)


def groove(bar_b, root, chord, heavy=True, claps=True, sparse=False):
    t0 = bt(bar_b)
    for o in (0, 1.75, 2.5) if heavy else (0, 2):
        K(t0 + bt(o))
    if claps: CL(t0 + bt(2))
    for i in range(16):
        if sparse and i % 2: continue
        H(t0 + bt(i / 4), .2 if i % 4 == 0 else .12 if i % 2 == 0 else .08)
    H(t0 + bt(3.5), .14, True)
    add(bass, bass808(root, bt(1.7)), t0, 1.0)
    add(bass, bass808(root, bt(.6), root + 12), t0 + bt(2.5), .9)
    if heavy: add(bass, bass808(root + 7, bt(.4)), t0 + bt(1.75), .8)
    add(syn, pad(chord, bt(4)), t0, .8)


# bar0: «печать» кадра, вход на b2
add(syn, pad(Am, bt(4), 2400) * .8, 0)
add(syn, sweep_filter(pad(Am, bt(2)), lambda x: 250 * (3500 / 250) ** (x / bt(2))), 0, .9)
crk = np.zeros(int(bt(2) * SR)); idx = rng.integers(0, len(crk), 170); crk[idx] = rng.normal(0, .5, len(idx))
add(sfx, fftfilt(crk, 1500, 9000), 0, .45)
add(sfx, riser(bt(2), 500, 9000), 0, .3)
add(sfx, sub_boom(1.4, 150, 40, .8), bt(2))
K(bt(2), 1.0); CL(bt(3), .6); H(bt(2.5), .2); H(bt(3.5), .2)
add(bass, bass808(33, bt(2)), bt(2), 1.0)
# b4–b8: выход — грув A
groove(4, 33, Am)
for o, m in [(0, 69), (.75, 72), (1.5, 76), (2.5, 74), (3, 72)]: add(lead, pluck(m, .35, 3500), bt(4 + o), .45)
# b8–b12: пасс
groove(8, 29, F, heavy=True, claps=False, sparse=True)
add(sfx, riser(bt(3.0), 300, 7000), bt(8), .5)
add(sfx, whoosh(.5, True, .6), EV['pass0'] - .1)
for k in range(4): add(drums, kick(.5), bt(10 + k * .5))
hat_roll(bt(10), bt(11), .1, .3)
# ловля: удар мяча + сабовый пунш
tc = EV['catch']
sl = tt(.06); slap = fftfilt(rng.normal(0, 1, len(sl)), 600, 5000) * np.exp(-sl * 90)
add(sfx, slap, tc, 1.0)
add(sfx, sub_boom(.9, 110, 42, 1.0), tc)
CL(tc, 1.0); K(tc, 1.0)
add(sfx, crash(1.2), tc, .25)
# b12–b16: думает — сердцебиение + глухой пад
th = EV['think']
add(syn, sweep_filter(pad(Am, bt(3.2), 2000), lambda x: 300 + 650 * x / bt(3)), th, 1.0)
for k in range(3):
    t0 = th + k * B
    for o, g in ((0, 1.0), (.3, .6)):
        tb = tt(.35)
        hb = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tb * 10) + 36) / SR) * np.exp(-tb * 9)
        add(bass, np.tanh(hb * 2) , t0 + o * B, g * .9)
        i = int((t0 + o * B) * SR); L = int(.2 * SR); sg = np.linspace(1, 0, L)[:max(0, min(L, N - i))]
        kick_env[i:i + len(sg)] = np.maximum(kick_env[i:i + len(sg)], sg * .6)
add(sfx, riser(bt(2.4), 400, 9000), bt(13.6), .5)
# ролл снейра перед броском
for i, tpos in enumerate(np.linspace(bt(15), bt(16) - .04, 12)): CL(tpos, .25 + .5 * i / 12)
# b16: бросок
tr = EV['release']
tw = tt(.18)
thwip = np.sin(2 * np.pi * np.cumsum(1900 * np.exp(-tw * 14) + 300) / SR) * np.exp(-tw * 14) + fftfilt(rng.normal(0, 1, len(tw)), 2000, 9000) * np.exp(-tw * 30) * .6
add(sfx, thwip, tr, .5)
K(tr, 1.0)
add(sfx, sub_boom(.8, 100, 44, .8), tr)
ts_ = EV['swish']
add(sfx, riser(ts_ - tr - .05, 300, 12000), tr, .6)
add(sfx, whoosh(.6, True, .5), tr + .1)
hat_roll(tr, ts_ - .15, .1, .32)
for k, o in enumerate((1, 2, 3)): K(bt(16 + o), .5 + .15 * k, False)
# ОГОНЬ под ногами: воспламенение, потрескивание, вспышка на броске
tfire = EV['fire']
tw = tt(.8)
ign = sweep_filter(rng.normal(0, 1, len(tw)), lambda x: 180 + 2200 * min(1, x / .18), 'lp') * np.exp(-tw * 3.2)
add(sfx, ign, tfire, 1.1)
add(sfx, whoosh(.35, True, .45), tfire - .05)
t = tfire + .05
while t < EV['fire_end']:
    tc_ = tt(.03)
    add(sfx, fftfilt(rng.normal(0, 1, len(tc_)), 1400, 7500) * np.exp(-tc_ * 130), t, rng.uniform(.05, .16))
    t += rng.uniform(.03, .1)
tw = tt(.9)
add(sfx, sweep_filter(rng.normal(0, 1, len(tw)), lambda x: 300 + 1600 * np.exp(-x * 4), 'lp') * np.exp(-tw * 3.8), tr, 1.0)
# b20: ДРОП
add(sfx, sub_boom(2.2, 190, 34, .85), ts_ - .01)
add(sfx, impact(2.4), ts_, .9)
add(drums, crash(2.6), ts_, .5)
for k in range(5):
    g_ = np.round(rng.normal(0, 1, int(.04 * SR)) * 4) / 4
    add(sfx, fftfilt(g_, 400, 6000), ts_ + .03 + k * .06, .22)


def drop_bar(b0, root, chord, wob):
    t0 = bt(b0)
    for o in (0, .75, 1.75, 2.5, 3.25): K(t0 + bt(o), 1.0 if o in (0, 1.75, 2.5) else .7)
    CL(t0 + bt(2), .95)
    for i in range(16): H(t0 + bt(i / 4), .22 if i % 4 == 0 else .13 if i % 2 == 0 else .08)
    for o in (3.5, 3.625, 3.75, 3.875): H(t0 + bt(o), .16)
    # 808 + дикий бас
    add(bass, bass808(root, bt(.7), root + 12, 3.4), t0, 1.1)
    add(bass, bass808(root, bt(.6), None, 3.2), t0 + bt(.75), .85)
    add(bass, bass808(root + 3, bt(.7), root + 15, 3.2), t0 + bt(1.75), 1.0)
    add(bass, bass808(root, bt(1.1), root + 12, 3.4), t0 + bt(2.5), 1.0)
    add(rees, reese(root + 12, bt(4), wob), t0, .6)
    add(syn, pad(chord, bt(4), 3200), t0, .6)
    add(syn, stab([root + 24, root + 31, root + 36], .35), t0, .6)
    add(syn, stab([root + 24, root + 31, root + 36], .35), t0 + bt(2), .6)


drop_bar(20, 33, Am, 3.5)
# b24–b28: праздник (живой кадр) — грув с басом
add(sfx, sub_boom(1.2, 140, 38, .7), EV['celeb'])
add(sfx, crash(1.6), EV['celeb'], .2)
drop_bar(24, 29, F, 3.5)
riff = [(0, 81), (.5, 79), (.75, 76), (1.5, 74), (2, 76), (2.5, 72), (3, 74), (3.5, 69)]
for o, m in riff: add(lead, pluck(m + (-4 if o >= 2 else 0) - 12, .32, 7000), bt(24 + o), .5)
# b28: трон — фанфара победы
tf = EV['throne']
add(sfx, whoosh(.45, True, .5), tf - .4)
fan = 0
for m in (45, 57, 61, 64, 69, 73):
    fan = fan + osc_saw(mtof(m), 2.4, 26, .003) + osc_saw(mtof(m), 2.4, 26, -.003)
add(syn, fftfilt(fan * env(len(fan), .01, 1.1, .3, .3, 2.1), 150, 6500) * .22, tf + .35)
for o, m in ((0, 76), (.5, 76), (1, 81), (2, 85)):
    add(lead, pluck(m, .6, 7000), tf + .35 + bt(o), .8)
for i, m in enumerate((93, 97, 100, 105, 100, 97, 93, 105, 100, 105)):
    tb = tt(.5); add(sfx, np.sin(2 * np.pi * mtof(m) * tb) * np.exp(-tb * 9), tf + .45 + i * B / 2, .1)
add(sfx, sub_boom(2.0, 200, 32, .9), tf + .35)
add(sfx, impact(1.8), tf + .35, .8)
K(tf + .35, 1.0); CL(tf + .35, .9); add(drums, crash(2.4), tf + .35, .5)
drop_bar(28, 33, Am, 3.5)
for b0, sh in ((28, 0), (32, -4), (36, 0)):
    for o, m in riff: add(lead, pluck(m + (sh if o >= 2 else 0) - 12, .32, 7000), bt(b0 + o), .55)
# b30: мяч NBA влетает — удар
tbl = EV['ball']
add(sfx, whoosh(.4, True, .5), tbl - .3)
add(sfx, sub_boom(1.0, 120, 40, .75), tbl)
add(drums, crash(1.4), tbl, .25)
drop_bar(32, 29, F, 3.5)
drop_bar(36, 33, Am, 3.5)
add(sfx, sub_boom(2.0, 150, 34, .7), bt(36))
add(sfx, crash(1.6), bt(36), .15)

# ---------------- живой звук зала ----------------
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '2', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
orig = np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float64) / 32768
room = np.zeros((N, 2))


def place(s0, s1, t0, gain, fade=.1):
    seg_ = orig[int(s0 * SR):int(s1 * SR)]
    e = np.ones(len(seg_)); nf = int(fade * SR); e[:nf] = np.linspace(0, 1, nf); e[-nf:] = np.linspace(1, 0, nf)
    i0 = int(t0 * SR); n = min(len(seg_), N - i0)
    room[i0:i0 + n] += seg_[:n] * e[:n, None] * gain


place(0.0, 3.6, bt(2), .35, .3)
place(5.72, 8.36, ts_ - .08, .95, .05)
place(5.95, 8.36, EV['celeb'], .55, .4)
place(5.95, 8.36, EV['throne'] + .35, .5, .4)

# ---------------- сведение ----------------
duck = 1 - .45 * np.convolve(kick_env, np.ones(300) / 300, 'same')
gap = np.ones(N)  # микро-тишина перед дропом
g0, g1 = int((ts_ - .14) * SR), int((ts_ - .005) * SR)
gap[g0:g1] = np.linspace(.12, .12, g1 - g0)
gap[g1:g1 + 200] = np.linspace(.12, 1, 200)
syn_r = reverb(syn, 1.8, .3, 1); lead_r = reverb(lead, 1.4, .25, 2)
mus = (drums * 1.0 + bass * .62 + rees * 1.0 + (syn_r + lead_r * .8) * 1.0 * duck) * gap
mus += sfx * .9
d = int(.012 * SR)
Lw = mus
Rw = (drums * 1.0 + bass * .62 + rees * 1.0 + (syn_r + np.concatenate([np.zeros(d), lead_r[:-d]]) * .8) * 1.0 * duck) * gap + sfx * .9
mix = np.stack([Lw, Rw], 1) * .42
mix += np.stack([fftfilt(Lw, hi=130), fftfilt(Rw, hi=130)], 1) * .06  # лёгкий басс-буст
mix += room
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix *= .89 / np.abs(mix).max()
fo = int(.55 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
out = sys.argv[2]
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
if '--stems' in sys.argv:
    dd = sys.argv[sys.argv.index('--stems') + 1]; os.makedirs(dd, exist_ok=True)
    for name, x in (('drums', drums), ('bass', bass), ('reese', rees), ('syn', syn), ('lead', lead), ('sfx', sfx)):
        with wave.open(f'{dd}/{name}.wav', 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((x / max(1e-9, np.abs(x).max()) * .8 * 32767).astype(np.int16).tobytes())
print('ok', len(mix) / SR)
