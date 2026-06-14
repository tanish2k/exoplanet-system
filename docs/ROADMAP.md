# Exoplanet Visual System — Build Roadmap

> Objective: an ultra-realistic exoplanet simulation web app, built on a codified
> design system. Three layers — **design tokens** (incl. scientific material
> tokens), **React UI components**, and a **Three.js planet engine** — share one
> source of truth. The 16:9 reference board is a *generated artifact* of that
> system, not a separate deliverable.

Principle: **risk-first iterations.** Prove the hardest fidelity question before
building a system on top of it. Each iteration is a self-contained probe with a
pass/fail gate against the reference image.

---

## Where we are

**Phase A (render fidelity) is complete.** Every render primitive the board needs
is proven in shader code.

- ✅ **01 — Atmosphere & rim scattering.** Raymarched single-scattering, six archetypes.
- ✅ **02 — Surfaces & weather.** Turbulent gas bands + GRS, terrestrial w/ oceans &
  clouds, ice giant.
- ✅ **03 — Cutaway.** The risk gate — sliced strata walls + intact molten core orb.
- ✅ **04 — Lighting & star types.** Planckian-locus star color, terminator/crescent/
  system-context scenarios.
- ✅ **Capture pipeline** (`tools/capture.mjs`) — GPU headless Chrome, supersampled stills.
- ✅ **Public repo + README**.

Open gaps: no codified tokens yet (Phase B next), typography undecided, README
showcase still shows only the atmosphere set.

---

## Phase A — Finish the render fidelity (the risky stuff)

Stay in GLSL/WebGL2 here. All the planet/atmosphere/cutaway prior art is GLSL;
this is where we find the ceiling. TSL/WebGPU migration is Phase E.

### Iteration 03 — The cutaway  ✅ DONE (risk gate PASSED)
The hero of the whole board, and the single hardest asset. **Result: it works.**
Hybrid cutaway — crust + mantle sliced into flat strata walls, molten core kept
as an intact glowing 3D orb in the opening. Reads as a realistic anatomy diagram,
fully in shader code. See `docs/renders/cutaway-hero.png`. The board is achievable.

- Wedge-removed sphere (shader clip planes, or CSG via `three-bvh-csg`)
- Capped cross-sections: concentric strata on the cut faces — atmosphere shell,
  crust, mantle, outer core, inner core — each a distinct material
- Triplanar PBR rock/metal/ice on cut faces (CC0 textures: PolyHaven / ambientCG)
- Emissive molten core, selective bloom, subsurface glow bleeding into the mantle
- Still-quality path: accumulation or `three-gpu-pathtracer` for the hero render
- Expose layer-boundary radii so the UI annotation system can attach callouts
- **Gate:** reads as "realistic digital illustration" next to the reference hero?
- Effort: human ~3–4 days / CC ~half a day. The 60% of total render difficulty.

### Iteration 02 — Surface detail & weather  ✅ DONE
Killed the "blobby" softness. Three surface algorithms in one shader:

- Gas giant: domain-warped turbulent bands + a Great-Red-Spot spiral vortex
- Terrestrial: fBm continents, ocean depth gradient + sun-glint specular, cloud
  shell, polar ice caps, normal-mapped land
- Ice giant: softer Neptune-style banding + a bright storm
- **Gate passed:** all three read at reference quality. Storm tint is palette-
  driven (`uColE`) so gas reads red, ice reads white. See `docs/renders/surface-*`.

### Iteration 04 — Lighting, star types & context  ✅ DONE
- Star color from temperature via the **Planckian locus** (Tanner-Helland blackbody
  fit), driving the star disk, the planet's light, and the atmosphere rim from one
  Kelvin value. M-dwarf (3000K, warm) → G (5800K, neutral) → A (9500K, blue-white).
- Scenarios: terminator, red-dwarf crescent, full phase, star-system context with a
  cratered moon (planet casts an eclipse shadow on it). See `docs/renders/lighting-*`.
- This blackbody fn becomes a token in Phase B: star type → temp → color, everywhere.

---

## Phase B — Codify the system (tokens as source of truth)

This is what makes it a design *system* the app can consume, not a gallery.

- **Monorepo:** pnpm workspaces + TypeScript. `packages/{tokens, planet-engine,
  ui, board}` and `apps/simulator`.
- **tokens package:** `design-tokens.json` (W3C format). Style Dictionary builds →
  `tokens.css` (custom props), `tokens.ts` (typed constants), `tokens.shader.js`
  (uniform sets).
- **Scientific material tokens** (the unification layer): each material carries
  physical params, not just a color.
  `iron / silicate / ice / carbon / H2He / waterVapor / CO2 / methane / exoticHaze`
  → `{ displayColor, betaR, betaM, betaA, mieG, emissive, albedo, roughness }`.
  Star types → `{ tempK, chromaticity, intensity }`.
  - 🟡 **Started early** — `iterations/03-cutaway/materials.js` is the first
    material registry: named materials (iron, silicate, ice, carbon, hpIce, magma,
    metallic-H, …) with `swatch` + shader params, composed into planets by layer
    (`core / outerCore / mantle / crust`). Live material-swap inputs in the cutaway
    GUI. Next: lift to `packages/tokens`, add atmosphere materials (scattering
    coeffs from iter01), and emit the W3C-token JSON + the legend swatches.
- **Refactor:** lift the iteration shaders into `planet-engine`; the hardcoded
  `PRESETS` in `main.js` become token lookups.
- **Gate:** change a coefficient in JSON → both the UI swatch *and* the live
  planet update. Single source of truth, proven.

---

## Phase C — UI component layer

- **Typography decision required** (we deferred the design consultation). Pick a
  distinctive display + readable UI + mono-for-data trio. Note: Space Grotesk and
  Inter are both flagged as overused/converged — worth a more distinctive display.
- **Components** (React + token CSS): `PlanetCard`, `MetricRow`, `TemperatureSlider`
  (range), `AtmosphereDots`, `CompositionLegend`, `Callout/Annotation` (interactive
  SVG leader lines — needed for live cutaways, not just the static board).
- **Icon set:** 16 monoline cyan/white SVGs — iron, rock/silicate, ice, carbon,
  magma, H/He, water vapor, CO₂, methane, ammonia, hazes, temperature, pressure,
  density, magnetic field, gravity.
- **Charts:** inline SVG sparkline + composition donut.
- **Living docs:** Storybook or Ladle.

---

## Phase D — The reference board (milestone deliverable)

- `board` route composes `tokens` + `ui` + `planet-engine` into the 16:9 sheet —
  all 9 sections matching the reference image (palette, typography, visual language,
  anatomy cutaway, atmosphere examples, core composition, icons/legend, data/UI,
  backgrounds/lighting).
- Glassmorphism chrome: `backdrop-filter` blur, thin cyan borders, inner glow.
- **8K capture:** Playwright at `deviceScaleFactor 3` on 2560×1440 → 7680×4320 PNG.
- **Golden-image regression:** per-section captures diffed on every PR — catches
  shader regressions ("someone changed the methane scattering") before they ship.
- **Milestone:** reproduces and beats the reference, fully from code, real tokens.

---

## Phase E — The simulation app

- **WebGPU/TSL migration:** flip `planet-engine` to TSL on `WebGPURenderer` with
  WebGL2 auto-fallback. Justified here because real-time interaction needs compute
  shaders — precomputed Bruneton scattering LUTs, particle weather, cloud noise.
- **Two quality tiers:** real-time (LUT scattering, 60fps) and still (accumulation /
  path-traced for screenshots). Same materials, two paths.
- **App features:** planet browser / parameterization, camera nav, data overlays
  via the UI components, live annotated cutaways, star-system view.
- **Perf:** budget, LOD, mobile fallback.

---

## Open decisions (resolve as we hit them)

1. **Sequencing** — cutaway-first (risk gate) vs. surface-first (visible polish).
   Recommend cutaway-first: it's the existential risk.
2. **WebGPU/TSL timing** — Phase E vs. earlier. Recommend Phase E; keep probes in
   GLSL where the prior art lives. Earlier only if we want to avoid a double port.
3. **Typography** — needs a real choice (deferred design consultation).
4. ~~**Data source**~~ — ✅ **DECIDED: real NASA Exoplanet Archive** catalog drives
   the planets (real radii, masses, temps, star types). Data-card content and the
   app become a genuine scientific tool, not just a showcase. Engine work is
   identical until Phase E, so this only changes app-layer scope.

---

## Rough effort shape (CC-assisted)

| Phase | What | Order |
|---|---|---|
| A | Cutaway → surfaces → lighting (3 probes) | next |
| B | Monorepo + tokens + engine refactor | after risk gate |
| C | Typography + components + icons | parallel-able with B |
| D | Board assembly + 8K capture + regression | milestone |
| E | TSL migration + the actual app | the long pole |
