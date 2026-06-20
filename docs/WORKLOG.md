# Exoplanet Visual System — Worklog

Session handoff doc. Read this first to resume. Companion docs:
`docs/ROADMAP.md` (full plan), `docs/PHASE-A-POLISH.md` (ultra-realism backlog).

**Last updated:** end of session 1 (2026-06-20). **Status:** Phase A complete +
polished; material-token layer seeded. Ready to start Phase B or finish polish.

---

## 1. What this is

A **code-only** design system + rendering engine for an **ultra-realistic exoplanet
simulation** web app. Planets are rendered from physics in Three.js + GLSL shaders —
no AI image assets, no painted textures. The 16:9 reference design board
(`/Users/sphome/Downloads/ChatGPT Image Jun 12, 2026, 11_40_33 PM.png`) is the
visual target; it will be a *generated artifact* of the system, not a separate asset.

Three-layer architecture (planned): **design tokens** (incl. scientific material
tokens) → **React UI components** → **Three.js planet-engine**. One source of truth.

Built as a showcase of Anthropic's **Fable 5** model (commits co-authored as such).

---

## 2. Key decisions (locked)

- **Code over AI-image gen** — the board must be an extractable design *system*.
- **Three.js + WebGL2 / raw GLSL** for the probes; **TSL/WebGPU** is the Phase E
  upgrade path (real-time app needs compute shaders). Not migrated yet.
- **Risk-first iterations** — prove the hardest render before building on it.
- **Data source = real NASA Exoplanet Archive** (app layer, Phase E).
- **Material composition model** — planets composed from named materials, not hex.
- Capture via **GPU headless Chrome** (`tools/capture.mjs`); the gstack/bundled
  headless browser has NO working WebGL (SwiftShader fails). `agent-browser` (real
  Chrome) also works for GPU screenshots.

**Open decisions:** typography (deferred design consultation); exact WebGPU/TSL
timing.

---

## 3. Repo & infra

- **Public repo:** https://github.com/tanish2k/exoplanet-system (owner `tanish2k`,
  commits authored as `tanish2k <1164613+tanish2k@users.noreply.github.com>`).
- **Held local (gitignored, NOT public):** `explainer.html`, `vite.config.js` —
  user's WIP, intentionally kept out of the public repo. Don't commit them.
- **Dev server:** `npm run dev` → http://localhost:5174 (vite, strict port 5174).
- **Capture:** `node tools/capture.mjs <url> <out.png> [--preset "name"]
  [--set "k=v,k=v"] [--scale 3] [--width W] [--height H]`. Renders via Chrome for
  Testing / system Chrome with Metal GPU. `--scale 3` on 1280×720 → 3840×2160.
- **GPU screenshot of live page:** `agent-browser` (v0.26) renders WebGL fine;
  useful to drive real interactions (zoom/orbit) and screenshot.

---

## 4. File map

```
index.html                      landing nav (links to iteration probes)
tools/capture.mjs               GPU headless capture pipeline
iterations/
  shared/post.js                filmic post pass (sharpen + chromatic aberration + grain)
  01-atmosphere/                scattering probe (Rayleigh+Mie+absorption), 6 archetypes
  02-surfaces/                  surfaces & weather (gas bands+GRS, terrestrial, ice)
  03-cutaway/                   planet anatomy cutaway + materials.js (material registry)
  04-lighting/                  star types (Planckian locus), terminator/crescent/system
docs/
  ROADMAP.md                    full plan (Phases A–E)
  PHASE-A-POLISH.md             ultra-realism gap analysis + backlog (P0–P3)
  WORKLOG.md                    this file
  renders/                      8K-ish hero PNGs (also the README showcase)
```

Each probe is a self-contained page: `index.html` + `main.js` (Three.js scene,
lil-gui, capture hook `window.__exo`) + `scene.frag.glsl` (the whole scene is
raytraced in one fragment shader on a fullscreen triangle). Post chain:
RenderPass → UnrealBloom → AgX OutputPass → filmic pass.

---

## 5. What's done (Phase A — all 4 render probes ✅)

| # | Probe | Highlights |
|---|---|---|
| 01 | Atmosphere | Raymarched single-scattering (Rayleigh+Mie+wavelength absorption). 6 archetypes: thin, H₂/He, water-vapor, CO₂, methane (teal from red absorption), exotic haze (violet). Matches reference glow. |
| 02 | Surfaces & weather | Gas giant: domain-warped turbulent bands + Great-Red-Spot spiral vortex. Terrestrial: ocean depth gradient + sun-glint, continents, cloud shell, ice caps. Ice giant: soft Neptune banding + storm. Storm tint palette-driven. |
| 03 | Cutaway (hero) | Hybrid: crust+mantle sliced into flat strata walls, molten core an intact 3D orb. Earth-like exterior (B1), legible strata + outer-core ring (B2), volumetric core bleed (B3), type-matched exteriors (B4). **Material registry** (see §6). Zoom clamped (minDistance 2.2) + reset-view button. |
| 04 | Lighting & star types | Planckian-locus blackbody (Tanner-Helland): one Kelvin drives star disk + planet light + rim tint. Scenarios: terminator, red-dwarf crescent, full phase (A star), star-system context with a cratered moon catching the planet's eclipse shadow. |

**Polish done:** P1 cutaway realism (B1–B4) ✅; P3-D1 detail pass ✅ (fine terrain/
ocean/cloud/wall detail so close-ups hold); P3-D2 filmic post ✅ (shared sharpen +
chromatic aberration + grain across all 4 probes, live GUI controls).

**Fidelity verdict:** no single technique missing vs. the reference. Earlier gap
was *integration* (probes were isolated) — the cutaway now combines surface + clouds
+ rim + lighting in one path, the first piece of the unified engine.

---

## 6. Material registry (Phase B token layer — SEEDED)

`iterations/03-cutaway/materials.js` is the first scientific-material-token layer.

- **`MATERIALS`** — named registry. Each entry: `label` (legend text), `swatch`
  (UI/legend dot color), shader params `a`/`b` (surface colors), `hot` + `emissive`
  (molten layers). Covers the reference's CORE MATERIALS legend: iron, rock/silicate,
  ice, carbon, high-pressure ice, magma, + metallic-H, basalt, graphite, waterIce, etc.
- **Composition model** — a planet = materials assigned to layers
  `{ core, outerCore, mantle, crust }` + an `exterior` + geometry + atmosphere.
  `resolveMaterials()` resolves selections → flat uniform colors (the "tokens →
  uniforms" build step in miniature).
- **4 reference compositions** (terrestrial / ice giant / gas giant / carbon) are now
  material compositions. The cutaway GUI exposes **live per-layer material dropdowns**
  — the working "input system" (pick iron core / silicate mantle / graphite crust…).
- Same `swatch` values will later drive the board's legend swatches (no drift).

**Next for tokens:** lift to `packages/tokens`, add **atmosphere materials**
(H₂/He, water vapor, CO₂, methane, ammonia, hazes — reuse iter01 scattering coeffs),
emit W3C-token JSON, generate legend swatches.

---

## 7. Remaining work (priority order)

**Finish Phase A polish (optional, small):**
- **P2** — textured atmosphere crescents (bring surface detail into iter01 lit arc);
  richer multi-color nebula backgrounds + prominent star disk; cloud depth/self-shadow.
- **P3-D3** — star limb darkening; starfield twinkle/color variation.

**Phase B — codify the system (the big next step):**
- Monorepo (pnpm + TS): `packages/{tokens, planet-engine, ui, board}` + `apps/simulator`.
- **P0/A1 — unified `planetSurface()` shader module** consumed by every probe (the
  cutaway already proves the pattern). This + the material registry = `planet-engine`.
- Lift `materials.js` → `packages/tokens`; add atmosphere materials; Style Dictionary
  → CSS vars + TS constants + shader uniforms + W3C JSON.

**Phase C** — UI components (typography decision, 16 monoline icons, planet cards,
annotation/callout system). **Phase D** — assemble the 16:9 board (all 9 sections,
8K capture, golden-image regression). **Phase E** — the NASA-data app (TSL/WebGPU
migration, real-time + still quality tiers).

---

## 8. How to resume (next session)

1. `cd ~/exoplanet-system && npm run dev` → open http://localhost:5174.
2. Browse probes; tweak via lil-gui; press `C` in-page for a 3× still.
3. Capture for review: `node tools/capture.mjs <url> /tmp/x.png --preset "..." --scale 2`
   then Read the PNG. (Headless gstack browser can't do WebGL — use this or agent-browser.)
4. Pick up from §7. Recommended next: either finish **P2/D3** polish, or start
   **Phase B** (monorepo + lift materials.js to packages/tokens + unified shader).
5. Conventions: commit messages end with `Co-Authored-By: Claude Fable 5
   <noreply@anthropic.com>`; never commit `explainer.html` / `vite.config.js` /
   `node_modules` / `captures/`; re-capture affected heroes into `docs/renders/`.
