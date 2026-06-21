#!/usr/bin/env python3
"""Derive legend swatch colors FROM the actual material textures (no drift).

For each material: average the albedo, and (for emissive materials) the dominant
color of the glowing pixels. swatch = albedo blended toward glow, so the legend dot
matches the material's lit/rendered appearance. Emits swatches.json + tokens.json.

Run: python3 packages/tokens/build-swatches.py
"""
import json
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MAT = os.path.join(ROOT, 'assets', 'materials')
materials = json.load(open(os.path.join(HERE, 'materials.json')))


def arr(path):
    return np.asarray(Image.open(path).convert('RGB'), dtype=np.float32).reshape(-1, 3)


def to_hex(c):
    return '#%02x%02x%02x' % tuple(int(max(0, min(255, round(x)))) for x in c)


swatches = {}
for mid, meta in materials.items():
    d = os.path.join(MAT, mid)
    albedo = arr(os.path.join(d, 'albedo.png')).mean(axis=0)
    glow = None
    ep = os.path.join(d, 'emissive.png')
    if 'emissive' in meta['maps'] and os.path.exists(ep):
        em = arr(ep)
        lum = em.mean(axis=1)
        bright = em[lum > 40]          # only the actually-glowing pixels
        if len(bright) > 50:
            glow = bright.mean(axis=0)
    swatch = albedo * 0.4 + glow * 0.6 if glow is not None else albedo
    swatches[mid] = {
        'albedo': to_hex(albedo),
        'glow': to_hex(glow) if glow is not None else None,
        'swatch': to_hex(swatch),
    }

json.dump(swatches, open(os.path.join(HERE, 'swatches.json'), 'w'), indent=2)

# combined W3C-ish token file for downstream UI / board consumption
tokens = {'materials': {mid: {**materials[mid], **swatches[mid]} for mid in materials}}
json.dump(tokens, open(os.path.join(HERE, 'tokens.json'), 'w'), indent=2)
print(f'wrote swatches.json + tokens.json for {len(materials)} materials')
