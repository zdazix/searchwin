# Soft, grainy colour-field backgrounds for SearchWin.ai (assets/img/bg).
# Blurred blobs of colour, a little directional smear and film grain. Needs numpy and Pillow.
# Usage: python3 tools/gen-backgrounds.py assets/img/bg
import sys, pathlib
import numpy as np
from PIL import Image, ImageFilter

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1280, 854


def rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def field(base_top, base_bottom, blobs, rng, smear=(0, 0), streaks=None, grain=7.0, vignette=0.12):
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    img = rgb(base_top) * (1 - yy) + rgb(base_bottom) * yy
    img = np.broadcast_to(img, (H, W, 3)).copy()
    gy, gx = np.mgrid[0:H, 0:W].astype(np.float32)
    for col, cx, cy, rx, ry, a in blobs:
        d = ((gx / W - cx) / rx) ** 2 + ((gy / H - cy) / ry) ** 2
        m = (np.exp(-d * 1.6) * a)[..., None]
        img = img * (1 - m) + rgb(col) * m
    if streaks:
        col, n, alpha = streaks
        layer = np.zeros((H, W), np.float32)
        for _ in range(n):
            cx, cy = rng.uniform(-.1, 1.1), rng.uniform(.05, .95)
            rx, ry = rng.uniform(.12, .35), rng.uniform(.012, .05)
            d = ((gx / W - cx) / rx) ** 2 + ((gy / H - cy) / ry) ** 2
            layer = np.maximum(layer, np.exp(-d * 2.0) * rng.uniform(.4, 1))
        m = (layer * alpha)[..., None]
        img = img * (1 - m) + rgb(col) * m
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    im = im.filter(ImageFilter.GaussianBlur(20))
    if smear[0] or smear[1]:
        # Directional smear: blur a thin, stretched copy and scale it back
        sx, sy = smear
        small = im.resize((max(8, W // sx), max(8, H // sy)), Image.BICUBIC)
        im = small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
    arr = np.asarray(im, np.float32)
    d = ((gx / W - .5) ** 2 + (gy / H - .5) ** 2) / .5
    arr *= (1 - vignette * d ** 1.4)[..., None]
    arr += rng.normal(0, grain, (H, W))[..., None]
    arr += rng.normal(0, grain * .35, (H, W, 3))
    return arr


def save(arr, name, q=68):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(OUT / f'{name}.webp', 'WEBP', quality=q, method=6)
    print(name, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')


rng = np.random.default_rng(4)
# Sky: deep blue with soft cloud streaks
save(field('#2C6C98', '#5E9CC6', [
    ('#1D5683', .15, .8, .45, .4, .8), ('#8EBEDD', .8, .3, .5, .35, .6), ('#3F84B4', .55, .65, .4, .3, .5),
], rng, smear=(10, 3), streaks=('#F2F6FA', 26, .85), grain=8), 'bg-sky')

rng = np.random.default_rng(8)
# Meadow: olive, cream and sage, smeared on the diagonal
save(field('#D8D1B6', '#B9B184', [
    ('#8E8A55', .2, .75, .35, .45, .8), ('#EFE9D8', .7, .25, .45, .35, .8), ('#A6A273', .85, .8, .35, .4, .6),
    ('#C9BE8E', .45, .5, .3, .3, .5), ('#7A7F4E', .05, .2, .25, .3, .5),
], rng, smear=(12, 4), grain=9), 'bg-meadow')

rng = np.random.default_rng(15)
# Sunset: peach, coral and violet
save(field('#F4C9A6', '#B67FB1', [
    ('#F09A7A', .25, .55, .45, .35, .8), ('#F7DEC0', .75, .2, .45, .3, .8), ('#8F6FB8', .85, .85, .4, .4, .7),
    ('#E5747A', .55, .75, .35, .3, .5),
], rng, smear=(8, 3), grain=8), 'bg-sunset')

rng = np.random.default_rng(23)
# Lagoon: teal, mint and a little blue
save(field('#7FC3B5', '#2F7E86', [
    ('#D9EBCF', .7, .2, .45, .3, .8), ('#3A6FA2', .15, .85, .4, .4, .6), ('#55A79C', .45, .55, .4, .35, .6),
    ('#A9D8C2', .9, .7, .3, .35, .5),
], rng, smear=(10, 3), grain=8), 'bg-lagoon')

rng = np.random.default_rng(31)
# Peach: warm cream with a lilac drift
save(field('#F5E6D8', '#E9C8B3', [
    ('#D4CBEA', .8, .3, .4, .35, .75), ('#F1B89F', .2, .75, .4, .35, .7), ('#FBF3EA', .4, .2, .4, .3, .8),
    ('#C9D7E8', .95, .9, .3, .3, .5),
], rng, smear=(9, 3), grain=7), 'bg-peach')

rng = np.random.default_rng(42)
# Night: dark plum, teal and brown for the dark bands
save(field('#20181F', '#140F0C', [
    ('#3D2440', .2, .25, .4, .35, .7), ('#1E3A40', .85, .7, .45, .4, .6), ('#3A2414', .55, .95, .5, .3, .7),
    ('#2E3A1A', .75, .05, .35, .25, .45),
], rng, smear=(10, 3), grain=4.5, vignette=.2), 'bg-night', q=66)
