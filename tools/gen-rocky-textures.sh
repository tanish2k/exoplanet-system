#!/usr/bin/env bash
# Regenerate the full Rocky Terrestrial PBR set from scratch via gpt-image-2.
# Albedos (fresh) -> aligned emissives (--ref albedo) -> derived data maps.
set -e
cd "$(dirname "$0")/.."
G="node tools/gen-image.mjs"
P=design-system/prompts/textures
M=assets/materials
SIZE=1024x1024

echo "### 1/3 albedos"
for id in crust-basaltic mantle-upper mantle-lower core-liquid-metal core-solid-metal; do
  echo "--- albedo: $id"
  rm -f "$M/$id"/*.png
  $G --prompt-file "$P/$id.albedo.txt" --out "$M/$id/albedo.png" --size $SIZE --quality high --model gpt-image-2
done

echo "### 2/3 emissives (ref = albedo)"
for id in mantle-upper mantle-lower core-liquid-metal core-solid-metal; do
  echo "--- emissive: $id"
  $G --prompt-file "$P/$id.emissive.txt" --out "$M/$id/emissive.png" --ref "$M/$id/albedo.png" --size $SIZE --quality high --model gpt-image-2
done

echo "### 3/3 derived data maps"
python3 tools/derive_maps.py "$M/crust-basaltic/albedo.png"    "$M/crust-basaltic"    --maps normal,roughness,height,ao --rough-base 0.90 --rough-var 0.25 --normal-strength 2.8
python3 tools/derive_maps.py "$M/mantle-upper/albedo.png"      "$M/mantle-upper"      --maps normal,roughness,height,ao --rough-base 0.88 --rough-var 0.25 --normal-strength 2.5
python3 tools/derive_maps.py "$M/mantle-lower/albedo.png"      "$M/mantle-lower"      --maps normal,roughness,height,ao --rough-base 0.85 --rough-var 0.25 --normal-strength 2.5
python3 tools/derive_maps.py "$M/core-liquid-metal/albedo.png" "$M/core-liquid-metal" --maps normal,roughness,height,metalness --rough-base 0.50 --rough-var 0.20 --normal-strength 1.8 --metal 1.0
python3 tools/derive_maps.py "$M/core-solid-metal/albedo.png"  "$M/core-solid-metal"  --maps normal,roughness,height,metalness --rough-base 0.45 --rough-var 0.15 --normal-strength 1.4 --metal 1.0

echo "ROCKY TEXTURES DONE"
