# Phase A — Ultra-Realism Polish: Self-Review & Backlog

A gap analysis between our Phase A shader probes and the reference design board,
with a prioritized backlog to push the visualization closer to the reference's
photoreal quality. Done before Phase B so the unified engine inherits the best
version of each technique.

---

## How the reference achieves "ultra-realistic"

Studying the reference board's planet renders (not the UI chrome — that's Phase
B–D), three things separate it from our current output:

1. **Every render is integrated.** A single planet shows realistic *surface +
   clouds + atmospheric scattering + rim + correct star lighting* all at once.
   The hero cutaway has an Earth-like exterior (oceans, swirling clouds,
   continents) AND a glowing layered interior AND a luminous blue atmosphere
   shell — in one image. Our probes each isolate one technique.
2. **Layer legibility on the cutaways.** The interior shows *distinct* concentric
   bands — crust, mantle, outer core, inner core — each a separate material, with
   the molten core's light bleeding volumetrically into the mantle.
3. **Detail density.** Fine cloud structure, terrain micro-detail, crisp haze
   layering, saturated glow, prominent star disks, vivid nebula backdrops. It
   reads filmic/HDR, not "procedural shader."

---

## Self-review scorecard (ours vs reference)

| Element | Ours today | Reference | Gap |
|---|---|---|---|
| **Atmospheric scattering** | Rayleigh+Mie+absorption, 6 archetypes | same look | ✅ matched — our strongest |
| **Cutaway topology** | wedge + 3D core orb | wedge + glowing core | ✅ close |
| **Gas-giant bands + GRS** | domain-warped + spiral vortex | banded gas giant | ✅ strong |
| **Terrestrial surface** | oceans + clouds + continents | Earth-like | ✅ strong (iter 02) |
| **Planckian star color** | blackbody fit, M→A | warm/cool stars | ✅ matched |
| **Cutaway exterior** | generic mottled **brown rock** | photoreal **Earth** (ocean/cloud/land) | ❌ biggest gap |
| **Cutaway interior strata** | one mantle mass + core orb | distinct crust/mantle/outer-core/inner-core bands | ❌ less legible |
| **Core luminosity** | bloom, contained | volumetric light bleed into mantle | ❌ less dramatic |
| **Atmosphere crescents** | smooth lit limb | textured lit arc (bands/clouds) | ❌ lit side too soft |
| **Core-composition variety** | all 4 use rocky exterior | type-matched exteriors (gas/ice/carbon) | ❌ not differentiated |
| **Space backgrounds** | subtle starfield + faint nebula | vivid nebulae, prominent star disk | ❌ too subdued |
| **Surface micro-detail** | medium fBm | fine clouds/terrain, crisp | ⚠️ a touch soft |

**Verdict:** no single *technique* is missing. We've matched the reference on
scattering, star color, bands, and terrestrial surface. The gap is (a) **integration**
— our probes don't combine techniques into one planet — and (b) a handful of
**specific detail upgrades**, led by the cutaway exterior.

---

## Backlog (prioritized)

### P0 — the unification move (also the bridge to Phase B)
The single highest-leverage change. Build **one `planetSurface()` shader module**
that combines surface (terrestrial/gas/ice/carbon) + clouds + atmospheric
scattering + star lighting, and have every probe call it. This is the engine
Phase B will tokenize, and it closes the "integration" gap directly.

- **A1 — Unified planet shader.** Merge iter01 scattering + iter02 surface/clouds
  into one shading path. A planet = textured surface + cloud shell + scattering
  atmosphere + rim, lit by a blackbody star. (~the core of Phase B's `planet-engine`.)

### P1 — cutaway realism (the hero asset, biggest visible gap)  ✅ DONE
- **B1 — Earth-like cutaway exterior.** ✅ Terrestrial surface (oceans + depth
  gradient + sun-glint, continents, clouds, ice caps) + blue atmosphere rim now
  wraps the cutaway. Matches the reference hero.
- **B2 — Legible interior strata.** ✅ Cut wall now shows crust / upper mantle /
  lower mantle (warming toward core) + a hot outer-core ring, with interface lines
  between each.
- **B3 — Volumetric core bleed.** ✅ Warm radial gradient bleeds from the core into
  the mantle wall; white-hot inner core contained so molten orange dominates.
- **B4 — Type-matched cutaway exteriors.** ✅ surfaceType drives the exterior:
  terrestrial (Earth), gas-giant bands, ice-giant blue bands, carbon (dark). Each
  preset also has type-appropriate interior materials. See `docs/renders/cutaway-*`.

> P1 also advances **P0/A1** — the cutaway now integrates surface + clouds + rim +
> lighting in one path, the first real piece of the unified `planet-engine`.

### P2 — atmosphere crescents & backgrounds
- **C1 — Textured crescent lit-arc.** Bring surface detail (bands/clouds) into the
  iter01 archetypes so the lit limb shows structure, matching the reference's
  textured arcs. (Falls out of A1 once unified.)
- **C2 — Richer space backgrounds.** Stronger multi-color nebulae, a prominent
  star disk with subtle diffraction/lens flare, denser starfield. `background()` in
  every probe.
- **C3 — Cloud system depth.** Cyclonic cloud structure with self-shadowing and
  day/night terminator shading on the cloud layer.

### P3 — filmic polish
- **D1 — Detail pass.** One more fBm octave on surfaces, subtle normal-mapped
  terrain specular, finer cloud wisps.
- **D2 — Tone & sharpness.** Revisit AgX exposure, add subtle post sharpening +
  very light chromatic aberration on the limb for the filmic HDR feel.
- **D3 — Limb darkening on the star**, and starfield twinkle/color variation.

---

## What's already strong (keep)
- Physically-grounded atmospheric scattering — matches reference glow.
- Gas-giant domain-warped bands + spiral Great Red Spot.
- Terrestrial surface (ocean depth gradient, sun-glint, clouds, ice caps).
- Planckian-locus star color driving everything from one Kelvin value.
- Hybrid cutaway (sliced walls + intact 3D core).
- The token-ready, capture-driven, single-source-of-truth approach.

> Awaiting user feedback on strong/weak parts to merge into this backlog before
> execution.
