#!/usr/bin/env python3
"""Derive PBR data maps from an albedo (true data maps, not model guesses).

Usage:
  python3 tools/derive_maps.py <albedo.png> <outdir> [--maps normal,roughness,height,ao,metalness]
      [--rough-base 0.85] [--rough-var 0.30] [--normal-strength 2.5]
      [--ao-strength 1.2] [--metal 1.0]

normal = OpenGL (+Y up) tangent-space, from a Sobel of the height (luminance).
roughness/height/ao = grayscale data. metalness = flat fill. Same resolution as albedo.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter


def getarg(name, default=None):
    flag = f"--{name}"
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


albedo_path = sys.argv[1]
outdir = sys.argv[2]
maps = getarg("maps", "normal,roughness,height,ao").split(",")
rough_base = float(getarg("rough-base", "0.85"))
rough_var = float(getarg("rough-var", "0.30"))
normal_strength = float(getarg("normal-strength", "2.5"))
ao_strength = float(getarg("ao-strength", "1.2"))
metal_val = float(getarg("metal", "1.0"))

os.makedirs(outdir, exist_ok=True)
img = Image.open(albedo_path).convert("RGB")
W, Hh = img.size
arr = np.asarray(img).astype(np.float32) / 255.0
lum = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]


def save_gray(a, name):
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L").save(os.path.join(outdir, name))


# height = lightly smoothed luminance (bright = raised, dark crevice = low)
height_img = Image.fromarray((np.clip(lum, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.2))
height = np.asarray(height_img).astype(np.float32) / 255.0
if "height" in maps:
    height_img.save(os.path.join(outdir, "height.png"))

if "normal" in maps:
    gy, gx = np.gradient(height)
    nx = -gx * normal_strength
    ny = gy * normal_strength            # OpenGL +Y up (image rows go down -> flip)
    nz = np.ones_like(height)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / ln, ny / ln, nz / ln], axis=-1)
    Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8), "RGB").save(os.path.join(outdir, "normal.png"))

if "roughness" in maps:
    save_gray(rough_base + (0.5 - lum) * rough_var, "roughness.png")

if "ao" in maps:
    blur = np.asarray(Image.fromarray((height * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255.0
    save_gray(1.0 - np.clip(blur - height, 0, 1) * ao_strength, "ao.png")

if "metalness" in maps:
    save_gray(np.full((Hh, W), metal_val, np.float32), "metalness.png")

print(f"derived {maps} -> {outdir} ({W}x{Hh})")
