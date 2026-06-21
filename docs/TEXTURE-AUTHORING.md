# Texture Authoring Spec — PBR material tiles for the cutaway

How to author the texture artifacts that drive the textured PBR cutaway (Iteration 05)
and the board's material legend. **One tile = one material token = one legend swatch.**
We build one composition set at a time. **Set 1: Rocky Terrestrial.**

> We generate the color (albedo) and the
> glow, *and* the data maps (normal / roughness / metalness / height / AO) — all straight
> from the image model. The one trick that makes this work is **reference-chaining**:
> generate the albedo first, then feed that exact image back into the model to produce
> each data map, so every map is **pixel-aligned** to the albedo. Don't generate maps
> independently — they won't line up and the result looks wrong.

---

## The workflow (per material)

1. **Generate the albedo** (for molten materials, generate the glowing "hero" first — see
   below). This is the anchor image.
2. **For every other map, attach the albedo as input** and prompt:
   *"Using the attached texture as the exact input, generate its **\<map\>** map …"* plus
   the encoding spec for that map. Same resolution, pixel-aligned, seamless.
3. Drop the files into `assets/materials/<id>/` (naming below). Done — they wire straight
   into the material tokens.

I can tile-check any tile for seams and preview it on the cutaway as soon as it lands —
just say so.

---

## Global rules — apply to EVERY image

1. **Seamless / tileable**, square, **2048×2048**.
2. **Flat, even lighting** on color/albedo. No cast shadows, no single-light highlights,
   no vignette, no studio lighting. (For molten materials the lava glow is the only light,
   and it lives in the *emissive* map, not the albedo.)
3. **Top-down, orthographic, flat lay.** No perspective, no curvature, no horizon.
4. **Fills the frame edge to edge.** No border, no rounded corners, no frame, no label,
   no text, no watermark, no UI.
5. Photoreal, high micro-detail (it tiles small on a strata band, so detail density
   matters); pure material, no recognizable objects/logos.

---

## What each map must be (encoding spec)

Paste the matching line into the derivative-map prompt so the model outputs *data*, not a
pretty picture. (Color space is handled in-engine on load — you don't need to tag profiles.)

| Map | What it must look like |
|---|---|
| **albedo** | Pure surface base color. **No lighting, no shadows, no glow, no reflections** baked in — just the material's color as if evenly lit. |
| **normal** | Tangent-space **OpenGL (+Y up)** normal map. Predominantly blue/purple; flat areas = RGB (128,128,255); bumps/cracks encoded as red/green deviation. Represents the surface relief of the albedo. **Not** a colored or shaded image. |
| **roughness** | Grayscale. **Black = mirror-smooth, white = fully rough/matte.** Rough rock ≈ light grey; molten/glassy/polished metal ≈ darker grey. |
| **metalness** | Grayscale. **Black = non-metal (dielectric), white = pure metal.** Usually a near-flat fill: white for metallic cores, black for rock. |
| **height** | Grayscale displacement. **Black = lowest (deep cracks/pits), white = highest (raised rock).** Smooth gradients, follows the albedo's structure. |
| **ao** | Grayscale ambient occlusion. **White = fully exposed, dark grey = occluded crevices/contact shadows.** Soft, no hard edges. |
| **emissive** | The glow only. **Pure black (#000) everywhere that does not glow**, colored (orange→yellow) exactly where the molten lava/heat is. No rock detail, no lighting — just the light-emitting regions, pixel-aligned to the albedo's cracks. |

---

## Set 1 — Rocky Terrestrial: the 5 interior bands

| ID | Band | Maps to generate |
|---|---|---|
| `crust-basaltic` | Crust | albedo, normal, roughness, height, ao |
| `mantle-upper` | Upper Mantle (cooler molten) | hero→albedo, **emissive**, normal, roughness, height |
| `mantle-lower` | Lower Mantle (hotter molten) | hero→albedo, **emissive**, normal, roughness, height |
| `core-liquid-metal` | Outer Core (molten metal) | hero→albedo, **emissive**, roughness, **metalness**, normal |
| `core-solid-metal` | Inner Core (white-hot metal) | hero→albedo, **emissive**, roughness, **metalness**, normal |

### 1. `crust-basaltic` — Crust (solid rock)

**Albedo:**
> Seamless tileable PBR base color texture of dark volcanic basaltic rock: fractured
> angular aggregate with fine vesicular pores, charcoal-grey to near-black with subtle
> iron-oxide brown mineral flecks, dry and matte. Top-down orthographic flat lay, even
> flat diffuse lighting, no cast shadows, no highlights, no glow. Fills frame edge to edge,
> seamless tileable, photorealistic 4K, no border, no text.

**Then, attaching that albedo, generate each:** `normal`, `roughness`, `height`, `ao` —
each with its encoding-spec line from the table above, prompted as *"Using the attached
basaltic rock texture as the exact input, generate its \<map\> map: \<spec\>. Pixel-aligned
to the input, same resolution, seamless, no text, no border."*

### 2. `mantle-upper` — Upper Mantle (cooler molten rock)

**Step 1 — hero (the anchor):**
> Seamless tileable texture of cracked dark silicate rock with a network of glowing molten
> lava in the fissures: deep orange-red incandescent cracks, mostly dark cooled rock with
> thin glowing veins (more rock than glow), cellular voronoi crack pattern. Top-down
> orthographic flat lay, no external shadows. Fills frame edge to edge, seamless tileable,
> photorealistic 4K, no border, no text.

**Step 2 — albedo (attach hero):**
> Using the attached molten-rock texture as the exact input, generate its **albedo**: the
> identical rock and crack pattern but **fully cooled with no glow or incandescence** — the
> lava cracks become dark cooled rock. Even flat lighting, no shadows. Pixel-aligned, same
> resolution, seamless, no text, no border.

**Step 3 — emissive (attach hero):**
> Using the attached molten-rock texture as the exact input, generate its **emissive** map:
> **pure black everywhere except the glowing lava cracks**, which keep their orange-to-red
> color and brightness. No rock detail, no lighting. Pixel-aligned to the cracks, same
> resolution, seamless, no text, no border.

**Then (attach albedo):** `normal`, `roughness`, `height` — encoding-spec lines from the table.

### 3. `mantle-lower` — Lower Mantle (hotter molten rock)

**Step 1 — hero:**
> Seamless tileable texture of intensely glowing molten rock: dense network of bright
> orange-to-yellow lava cracks through a thin dark rock crust, hotter and brighter than
> upper mantle, more glowing area than dark rock. Top-down orthographic flat lay, no
> external shadows. Fills frame edge to edge, seamless tileable, photorealistic 4K, no
> border, no text.

**Step 2 — albedo / Step 3 — emissive / then normal, roughness, height** — same pattern as
`mantle-upper` (emissive keeps the brighter orange-yellow).

### 4. `core-liquid-metal` — Outer Core (molten liquid metal)

**Step 1 — hero:**
> Seamless tileable texture of molten liquid iron-nickel metal: bright incandescent
> orange-white flowing surface with swirling convective cells and hot metallic sheen, very
> bright and self-luminous. Top-down orthographic flat lay, no external shadows. Fills frame
> edge to edge, seamless tileable, photorealistic 4K, no border, no text.

**Step 2 — albedo (attach hero):**
> Using the attached molten-metal texture as the exact input, generate its **albedo**: the
> same swirling metal surface as **cooled non-glowing metal** (neutral grey-orange metallic
> base color), no incandescence, even flat lighting, no shadows. Pixel-aligned, seamless,
> no text, no border.

**Step 3 — emissive (attach hero):**
> Using the attached molten-metal texture as the exact input, generate its **emissive** map:
> the self-luminous heat only — bright orange-white where hottest, fading to dark, **black
> where coolest**. No external lighting. Pixel-aligned, seamless, no text, no border.

**Step 4 — metalness:** flat near-white grayscale (this is metal). **Then** `roughness`
(mid-dark — liquid metal is fairly smooth), `normal` (subtle flow ripples).

### 5. `core-solid-metal` — Inner Core (white-hot solid metal)

**Step 1 — hero:**
> Seamless tileable texture of white-hot incandescent solid iron-nickel metal: blinding
> yellow-white heat with faint crystalline metallic grain, near-uniform glow. Top-down
> orthographic flat lay, no external shadows. Fills frame edge to edge, seamless tileable,
> photorealistic 4K, no border, no text.

**Step 2 — albedo:** cooled solid metal, faint crystalline grain, neutral metallic grey,
no glow. **Step 3 — emissive:** near-uniform bright yellow-white glow following the grain.
**Step 4 — metalness:** flat near-white. **Then** `roughness` (low-mid), `normal` (faint grain).

---

## Delivery

One folder per material, lowercase map names exactly as below:

```
assets/materials/
  crust-basaltic/      albedo.png  normal.png  roughness.png  height.png  ao.png
  mantle-upper/        albedo.png  emissive.png  normal.png  roughness.png  height.png
  mantle-lower/        albedo.png  emissive.png  normal.png  roughness.png  height.png
  core-liquid-metal/   albedo.png  emissive.png  roughness.png  metalness.png  normal.png
  core-solid-metal/    albedo.png  emissive.png  roughness.png  metalness.png  normal.png
```

PNG, 2048² (1024² acceptable). Color space is set in the engine's loader — you don't need
to manage profiles; just keep lighting/glow **out** of the data maps. Drop them in and they
wire straight into the material tokens — no code changes needed.

**Minimum viable** if a full set per tile is too much: `albedo` (+ `emissive` for the four
molten/metal materials) is enough to render — I generate stand-in normal/roughness/height
procedurally and you upgrade them later.

---

## Next sets (after Rocky Terrestrial passes the gate)
Ice giant (water-rich) → Gas giant (H/He) → Carbon planet. Same workflow; molten layers
shift hue/intensity, mantle materials change (water-ice, metallic-H, carbon). The 4
SURFACE/CRUST legend tiles (basaltic / cracked / sedimentary / highland) are a secondary
batch for the surface legend — not needed for the cutaway strata.
