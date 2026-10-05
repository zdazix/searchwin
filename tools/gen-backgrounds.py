# Procedural landscape backgrounds for SearchWin.ai (assets/img/bg). Needs numpy and Pillow.
# Usage: python3 tools/gen-backgrounds.py assets/img/bg
import numpy as np
from PIL import Image, ImageFilter
import sys, pathlib

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1800, 1200


def hex2rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def ramp(t, stops):
    """t in [0,1] (any shape) -> RGB via color stops [(pos, '#hex'), ...]."""
    t = np.clip(t, 0, 1)
    pos = np.array([p for p, _ in stops], np.float32)
    cols = np.stack([hex2rgb(c) for _, c in stops])
    out = np.empty(t.shape + (3,), np.float32)
    for ch in range(3):
        out[..., ch] = np.interp(t, pos, cols[:, ch])
    return out


def value_noise(h, w, cell, rng):
    gh, gw = h // cell + 3, w // cell + 3
    grid = rng.random((gh, gw)).astype(np.float32)
    img = Image.fromarray(grid, mode='F').resize((gw * cell, gh * cell), Image.BICUBIC)
    return np.asarray(img, dtype=np.float32)[:h, :w]


def fbm(h, w, cell, octaves, rng, gain=0.5):
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for _ in range(octaves):
        total += amp * value_noise(h, w, max(2, cell), rng)
        norm += amp
        amp *= gain
        cell = max(2, cell // 2)
    return total / norm


def noise1d(n, points, rng):
    xs = np.linspace(0, 1, points)
    ys = rng.random(points)
    return np.interp(np.linspace(0, 1, n), xs, ys).astype(np.float32)


def smooth1d(a, k):
    ker = np.ones(k, np.float32) / k
    return np.convolve(np.pad(a, k, mode='edge'), ker, mode='same')[k:-k]


def ridge_line(w, base, amp, rng, waves=3, lo=0.6, hi=3.2, wobble=0.02):
    x = np.linspace(0, 1, w, dtype=np.float32)
    y = np.full(w, base, np.float32)
    for _ in range(waves):
        f = rng.uniform(lo, hi)
        y += amp * rng.uniform(0.35, 1.0) * np.sin(2 * np.pi * (f * x + rng.random()))
    y += wobble * (smooth1d(smooth1d(noise1d(w, 40, rng), 61), 61) - 0.5)
    return smooth1d(y, 9)


def layer(img, ridge, top_col, bot_col, depth, rng, shade=0.18, ripples=0.0, soft=1.6):
    """Paint a terrain layer below `ridge` (fractions of H) onto img (H, W, 3)."""
    h, w, _ = img.shape
    yy = np.arange(h, dtype=np.float32)[:, None] / h
    r = ridge[None, :]
    below = yy - r
    alpha = np.clip(below * h / soft + 0.5, 0, 1)  # anti-aliased edge
    t = np.clip(below / depth, 0, 1) ** 0.8
    col = top_col[None, None, :] * (1 - t[..., None]) + bot_col[None, None, :] * t[..., None]
    # sunlit vs shadow side from the slope of the ridge
    slope = np.gradient(smooth1d(ridge, 81)) * w
    light = smooth1d(np.tanh(slope * 3.0), 121)[None, :]
    fall = np.exp(-np.clip(below, 0, None) / (depth * 0.6))
    col *= (1 - shade * light * fall)[..., None]
    if ripples:
        xx = np.arange(w, dtype=np.float32)[None, :] / w
        wav = np.sin((xx * 90 + yy * 260 + 6 * fbm(h, w, 160, 3, rng)) * 1.0)
        col *= (1 + ripples * wav * np.clip(below / depth, 0, 1))[..., None]
    img[:] = img * (1 - alpha[..., None]) + col * alpha[..., None]


def glow(img, cx, cy, rx, ry, color, strength):
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = ((xx / w - cx) / rx) ** 2 + ((yy / h - cy) / ry) ** 2
    g = np.exp(-d * 2.2)[..., None] * strength
    img[:] = img * (1 - g) + hex2rgb(color)[None, None, :] * g


def grain(img, rng, sigma=4.0):
    n = rng.normal(0, sigma, img.shape[:2]).astype(np.float32)
    img += n[..., None]


def vignette(img, amount=0.18):
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = ((xx / w - 0.5) ** 2 + (yy / h - 0.5) ** 2) / 0.5
    img *= (1 - amount * d ** 1.4)[..., None]


def save(img, name, q=80):
    arr = np.clip(img, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr, 'RGB')
    im.save(OUT / f'{name}.webp', 'WEBP', quality=q, method=6)
    print(name, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')


def sky(h, w, stops, rng, clouds=0.0, cloud_col='#FFFFFF', horizon=0.6):
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None] * np.ones((1, w), np.float32)
    img = ramp(yy / horizon, stops)
    if clouds:
        c = np.asarray(Image.fromarray(fbm(h, w // 3, 220, 6, rng), mode='F').resize((w, h), Image.BICUBIC), dtype=np.float32)
        c = np.clip((c - 0.48) * 3.0, 0, 1) ** 1.6
        c *= np.clip(1.15 - yy / horizon, 0, 1)
        img[:] = img * (1 - clouds * c[..., None]) + hex2rgb(cloud_col)[None, None, :] * clouds * c[..., None]
    return img


# 1. Dune at golden hour: warm cream sky, sand ridges --------------------------
rng = np.random.default_rng(7)
img = sky(H, W, [(0, '#EFE6D6'), (0.55, '#F1DFC4'), (1, '#EBC9A0')], rng, clouds=0.35, cloud_col='#FBF5EA', horizon=0.62)
glow(img, 0.72, 0.42, 0.5, 0.32, '#FFF3DC', 0.55)
for base, amp, top, bot, depth, shade, rip in [
    (0.56, 0.035, '#E6CBA6', '#DDB98E', 0.30, 0.06, 0.0),
    (0.64, 0.045, '#D9AE7F', '#C9955F', 0.28, 0.12, 0.0),
    (0.74, 0.055, '#C38A57', '#A86C3E', 0.26, 0.20, 0.015),
    (0.86, 0.06, '#9C6438', '#6E4022', 0.22, 0.26, 0.025),
]:
    layer(img, ridge_line(W, base, amp, rng), hex2rgb(top), hex2rgb(bot), depth, rng, shade=shade, ripples=rip)
vignette(img, 0.12)
grain(img, rng, 4.2)
save(img, 'bg-dune')

# 2. Olive hills: sage sky, layered meadows (#E7EBD1 → #D8DEBA → #717E3B) -------
rng = np.random.default_rng(11)
img = sky(H, W, [(0, '#EEF0E3'), (0.7, '#E7EBD1'), (1, '#DCE2C2')], rng, clouds=0.25, cloud_col='#FAFBF4', horizon=0.6)
glow(img, 0.3, 0.38, 0.55, 0.3, '#FBFBEF', 0.5)
for base, amp, top, bot, depth, shade in [
    (0.55, 0.03, '#D3DAB2', '#C9D1A2', 0.3, 0.05),
    (0.63, 0.04, '#B8C384', '#A8B46D', 0.28, 0.10),
    (0.73, 0.05, '#97A55A', '#7F8C45', 0.26, 0.16),
    (0.86, 0.05, '#76833C', '#56612A', 0.22, 0.22),
]:
    layer(img, ridge_line(W, base, amp, rng, lo=0.4, hi=2.0), hex2rgb(top), hex2rgb(bot), depth, rng, shade=shade)
vignette(img, 0.12)
grain(img, rng, 4.0)
save(img, 'bg-olive')

# 3. Earth with a lime glow at the top: for dark brown sections ---------------
rng = np.random.default_rng(3)
yy = np.linspace(0, 1, H, dtype=np.float32)[:, None] * np.ones((1, W), np.float32)
img = ramp(yy, [(0, '#2C1C10'), (0.6, '#26180D'), (1, '#1E130A')])
tex = fbm(H, W, 520, 6, rng)
img *= (0.86 + 0.28 * tex)[..., None]
glow(img, 0.7, -0.14, 0.45, 0.34, '#98C913', 0.17)
glow(img, 0.12, 1.05, 0.5, 0.45, '#7A4521', 0.38)
glow(img, 0.92, 0.95, 0.4, 0.4, '#4A2C16', 0.35)
grain(img, rng, 5.0)
save(img, 'bg-earth', q=78)

# 4. Dusk horizon: deep amber sky with dark land, for the closing call to action
rng = np.random.default_rng(21)
img = sky(H, W, [(0, '#2A1A0F'), (0.45, '#5C3620'), (0.8, '#B9733F'), (1, '#E3A262')], rng, clouds=0.18, cloud_col='#F0B577', horizon=0.66)
glow(img, 0.62, 0.64, 0.35, 0.12, '#FFD49A', 0.55)
for base, amp, top, bot, depth, shade in [
    (0.66, 0.02, '#6B4229', '#5A3620', 0.3, 0.06),
    (0.74, 0.035, '#3E2617', '#311D11', 0.28, 0.10),
    (0.86, 0.04, '#24160C', '#170E07', 0.2, 0.12),
]:
    layer(img, ridge_line(W, base, amp, rng, lo=0.5, hi=2.4), hex2rgb(top), hex2rgb(bot), depth, rng, shade=shade)
vignette(img, 0.25)
grain(img, rng, 4.6)
save(img, 'bg-dusk', q=78)

# 5. Pale sky with soft clouds: cool counterpoint, used under visibility visuals
rng = np.random.default_rng(5)
img = sky(H, W, [(0, '#D9E0E4'), (0.6, '#E8E8E2'), (1, '#F3EEE4')], rng, clouds=0.55, cloud_col='#FFFFFF', horizon=1.0)
glow(img, 0.8, 0.2, 0.5, 0.4, '#FFFBF2', 0.35)
vignette(img, 0.08)
grain(img, rng, 3.6)
save(img, 'bg-sky')

# 6. Clay mesa: rust and sand bands, a warmer variant for the methodology panel
rng = np.random.default_rng(42)
img = sky(H, W, [(0, '#F2E6D8'), (0.7, '#EAD3BC'), (1, '#E2BE9C')], rng, clouds=0.3, cloud_col='#FBF3E8', horizon=0.55)
glow(img, 0.25, 0.4, 0.45, 0.3, '#FFF1DC', 0.45)
for base, amp, top, bot, depth, shade, rip in [
    (0.52, 0.02, '#D9A988', '#CF9774', 0.3, 0.05, 0.0),
    (0.62, 0.05, '#C27D57', '#AE6744', 0.3, 0.14, 0.0),
    (0.76, 0.045, '#9A5534', '#7E4128', 0.25, 0.2, 0.01),
    (0.9, 0.04, '#6A3720', '#4C2615', 0.2, 0.24, 0.02),
]:
    layer(img, ridge_line(W, base, amp, rng, lo=0.8, hi=3.5), hex2rgb(top), hex2rgb(bot), depth, rng, shade=shade, ripples=rip)
vignette(img, 0.12)
grain(img, rng, 4.2)
save(img, 'bg-clay')
