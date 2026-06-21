# Progress Log — Exoplanet Visual System

Running log of build sessions. Read this to resume. Companion docs:
`docs/ROADMAP.md` (plan), `docs/WORKLOG.md` (session 1 detail), `docs/GAPS.md` (accepted
gaps per subsystem). Milestone/comparison images live in `docs/progress/`.

---

## Session 2 — 2026-06-21

Huge session: went from "Phase A shader probes" to a multi-subsystem real-time engine
+ a gpt-image asset pipeline + a token layer + a gen-vs-model verification loop.

### 1. Image-generation pipeline (gpt-image-2)
- **Key:** read from `~/.openclaw/openclaw.json` → `openai-image-gen` entry (never printed).
- **Tools:** `tools/gen-image.mjs` (generate + `--ref` edits), `tools/gen-batch.mjs`
  (parallel jobs from a JSON array), `tools/gen-from-manifest.mjs` (PBR material sets),
  `tools/derive_maps.py` (normal/roughness/height/ao/metalness from an albedo).
- **Design-system boards:** generated all 6 → `design-system/renders/01-06-*.png`
  (visual-system, anatomy, core-composition, atmosphere, data/UI, backgrounds-lighting).
  Prompts in `design-system/prompts/`. These are the moodboard targets we build toward.

### 2. Iteration 05 — Textured PBR cutaway  (`iterations/05-textured-cutaway`)
- Real wedge geometry (phi-cut shells + planar-UV strata caps + glowing core orb),
  **hybrid**: procedural exterior/atmosphere + **authored PBR material tiles** on the
  cut faces. First real piece of `planet-engine`.
- **17 material PBR sets** in `assets/materials/<id>/` — Rocky Terrestrial generated +
  derived (`tools/gen-rocky-textures.sh`), then 12 more for the other archetypes
  (`design-system/textures-manifest.json`). Albedo+emissive from gpt-image, data maps derived.
- See `docs/progress/01-rocky-pbr-set.png`, `02-archetype-materials.png`.

### 3. Token layer  (`packages/tokens`)  ← single source of truth
- `materials.json` (17 materials: label/category/maps), `compositions.js` (6 archetypes),
  `atmospheres.js` (6 gas scattering tokens + haze + derived swatches), `swatches.json`
  (legend colors **derived from the actual textures** — no drift, `build-swatches.py`),
  `index.js`. The engine imports `COMPOSITIONS / MATERIAL_MAPS / ATMOSPHERES` from here.
- See `docs/progress/03-material-token-legend.png`.

### 4. Per-archetype compositions + polish
- All 6 archetypes (Rocky, Iron-rich, Ocean/Ice, Carbon, Gas Giant, Lava) render from
  data with cutaway toggle. Polished: contrast S-curve + saturation in `shared/post.js`;
  per-archetype lighting/post `look`; **differentiated inner cores** (size/tint/temp);
  neutralized warm cast; diamond layer + horizontal gas bands; reduced key/bloom; thin atmosphere.
- See `docs/progress/04-cutaway-archetypes.png`. Hero stills: `docs/renders/archetype-*.png`.

### 5. Iteration 06 — Planet Studio  (`iterations/06-studio`)
- Combines every layer into one configurable scene: archetype · cutaway⇄full-planet ·
  auto-spin · star temp · atmosphere/clouds · grade. See `docs/progress/05-studio-all-layers.png`.

### 6. Background & lighting engine  (`iterations/shared/sky.js`)  — code, not images
- Replaced the image skybox with a **procedural** world-locked sky: multi-layer starfield
  (density/color/twinkle) + fbm nebula (6 palettes) + Planckian star disk. Star types
  (M→A relight), viewing conditions (full/terminator/crescent/rim-lit/eclipse + shadow moon).
  Used by iterations 05/06/07/08. See `docs/progress/06-08-bg-lighting-*.png`.

### 7. Iteration 07 — Atmosphere System  (`iterations/07-atmosphere`)
- 6 atmosphere archetypes as tuned full-planet limbs. **Multi-layer single scattering**
  (Rayleigh rim + Mie haze band + exosphere) + a **semi-opaque colored haze veil** for
  thick gases (CO2 amber, methane teal, exotic violet) + colored Fresnel halo.
  Atmosphere swatches auto-derived. See `docs/progress/09-10-atmosphere-*.png`.

### 8. Iteration 08 — Scattering cross-section  (`iterations/08-cross-section`)
- Board §2: annotated limb close-up — 5 altitude layers (surface→troposphere→haze→
  scattering rim→exosphere) with leader lines + pressure ranges, + Rayleigh/Mie/transmission
  light interaction. Every layer + scattering term is a knob. **Always-visible sun-aware
  Fresnel halo** (fixed the "atmosphere only glows when backlit" bug). See `docs/progress/11-12-*`.

### 9. Verification loop (gen-vs-model)  — CO2 + methane
- gpt-image reference targets (`design-system/refs/target-{co2,methane}.png`) vs our engine,
  iterated to a match in **3 rounds**: flat blobs → glowing colored limb + terminator +
  surface-through-haze. Fixes: colored Fresnel halo, lit haze veil (keeps terminator),
  saturated veil/halo colors, surface-roughness override (killed methane specular), framing.
  Matched configs live in `SCENES` (iteration 07). See `docs/progress/13-verify-*`.
  Reusable: `design-system/atmosphere-targets.json` + `tools/gen-batch.mjs`.

### Conventions
- Commits co-authored as Claude Fable 5 (NOT the default trailer). Never commit
  `explainer.html` / `vite.config.js` / `node_modules` / `captures/`. Dev: `npm run dev`
  (strict :5174). Capture: `node tools/capture.mjs <url> <out> [--set k=v] [--scale 3]`.
  Render probes/archetypes via `?c=<name>` (05/06) or `?s=<scene>` (07).

---

## Next up (queue for the next session)
1. **Tighten CO2/methane deltas** — ours skews orange (vs amber-gold) / methane a touch
   cloudy (vs grey-teal). Veil/color nudges or a sharper reference prompt.
2. **Extend the gen-vs-model verification** to the other atmospheres + the cutaway archetypes.
3. **Atmosphere board §3 (rim-thickness comparison)** and **§5 (cloud & weather library)**.
4. **Lift atmosphere into full token wiring** (atmosphere materials + per-archetype tuning as data).
5. **Phase C UI layer** — the annotated diagrams (lighting diagram, legends, callouts) are
   UI/annotation work, not engine (see GAPS.md).
6. Address tracked gaps in `docs/GAPS.md`.
