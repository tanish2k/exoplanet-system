# Exoplanet Visual System

A code-only design system and rendering engine for an ultra-realistic exoplanet
simulation. Everything is rendered in real time with Three.js + GLSL shaders. No
AI image assets, no painted textures — the planets are physics.

![H₂/He gas giant, 4K render from a single-scattering GLSL shader](docs/renders/hero.png)

<sub>Hero: H₂/He gas giant, rendered at 3840×2160 from a ~100-line single-scattering
fragment shader. The blue limb is Rayleigh scattering; the amber ring is starlight
transmitting through the deep atmosphere; the soft terminator and bloom are all in code.</sub>

> Status: early. Building the design system one fidelity probe at a time, finding
> the ceiling of what real-time WebGL shaders can reach before locking the system.

> Built with Anthropic's **Fable 5** model (via Claude Code) as a showcase of what
> it can do: reasoning about atmospheric-scattering physics, writing the GLSL,
> driving a GPU-accelerated headless capture pipeline, and iterating on visual
> fidelity from rendered screenshots — end to end, in code.

## Why

The goal is a NASA-grade scientific interface for visualising exoplanets —
planetary core composition and atmospheric layers — backed by a shader engine
good enough that the same materials drive both the UI swatches and the live
planets. "Methane atmosphere" is not a color pick; it is an absorption
coefficient that produces the same teal in a legend dot and on a rendered globe.

## Iterations

Each iteration is a self-contained probe that pushes one aspect of fidelity.

### 01 · Atmosphere & rim scattering

Whole scene raytraced in a single fragment shader: planet sphere, single-scattering
atmosphere (Rayleigh + Mie + wavelength-dependent absorption), star, procedural
starfield and nebula. UnrealBloom + AgX tone mapping on top.

Six physically-distinct atmosphere archetypes:

| | | |
|:---:|:---:|:---:|
| ![Thin atmosphere](docs/renders/thin.png) | ![H₂/He gas giant](docs/renders/h2he.png) | ![Water vapor sub-Neptune](docs/renders/water-vapor.png) |
| **Thin** — dusty, barely-there shell | **H₂/He gas giant** — deep blue Rayleigh limb | **Water vapor** — heavy Mie haze, soft white-cyan |
| ![CO₂ terrestrial](docs/renders/co2.png) | ![Methane ice giant](docs/renders/methane.png) | ![Exotic haze](docs/renders/exotic-haze.png) |
| **CO₂ terrestrial** — dense amber | **Methane ice giant** — teal, red light absorbed | **Exotic haze** — violet-magenta forward scatter |

Every archetype is driven by scattering/absorption coefficients, not hand-picked
colors. The methane teal and exotic-haze violet fall out of the physics: methane
absorbs red, so what is left reads teal.

Live: drag to orbit, scroll to zoom, `lil-gui` panel for every parameter, press
`C` for a 3× supersampled still.

## Run it

```bash
npm install
npm run dev          # vite dev server
# open http://localhost:5174/iterations/01-atmosphere/
```

## High-res capture

gstack's bundled headless browser has no working WebGL, so captures drive Chrome
for Testing with GPU (Metal) acceleration directly:

```bash
node tools/capture.mjs <url> <out.png> \
  --preset "H2/He (gas giant)" \
  --set "sunAzimuth=112,sunElevation=6,betaRScale=0.32" \
  --width 1280 --height 720 --scale 3 \
  --view-steps 256 --light-steps 32
```

`--scale 3` on a 1280×720 viewport yields a 3840×2160 still. `--set` overrides any
exposed shader/post parameter; `--preset` selects an atmosphere archetype.

## Stack

- **Three.js** (WebGL2) + raw GLSL fragment shaders
- **lil-gui** for live parameter tuning
- **Vite** dev server / bundler
- **playwright-core** + Chrome for Testing for GPU-accelerated high-res capture

## License

MIT
