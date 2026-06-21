# Known gaps (per sub-system)

Running log of accepted gaps between our real-time engine and the moodboard boards.
Each is deliberate (physically grounded, or deferred), not a bug.

## Background & Lighting (iteration 06 studio + shared/sky.js)
- **Star tint less saturated than the board.** AgX tone mapping caps color punch, and
  the strip uses one grey rocky planet for every cell; the board varies the planet and
  exaggerates star color for design impact. Ours is physically grounded — pushed via
  `starColorStrength` as far as reads natural. Lever: per-cell planet variety + a
  punchier grade if we ever want the board's exact saturation.
- **Rim-lit / backlit halo is subtle on thin atmospheres.** Strong on gas/ocean
  (thick), weak on rocky/carbon (thin) — correct, but less dramatic than the board's
  uniformly bright halos.
- **Eclipse second-body framing is a starting preset.** The moon + cast shadow work,
  but the hero framing needs an orbit/zoom; shadow-on-moon is partial, not a crisp arc.
- **Procedural nebula vs. painted nebula.** Our fbm nebula is rich and world-locked but
  not as art-directed as the board's painted clouds (sharper filaments, named color
  zones). Lever: more octaves / curl noise / a hand-tuned palette per scene.
- **No annotated lighting diagram.** The board's labeled day/night/rim diagram is a
  UI/annotation layer (leader lines + text), not engine — belongs in the Phase C UI work.
- **Bright stars have no diffraction spikes** (only the central star disk glows). Minor.

## Atmosphere (iteration 07 + tokens/atmospheres.js)
- **Thick-atmosphere disk wash uses a semi-opaque haze veil** (a colored lit shell over
  the surface), not pure scattering. Physically the additive single-scatter over a short
  disk path can't overpower a dark surface; the board's "low surface visibility" gases
  (CO2/exotic) need the veil. Tasteful approximation, tunable via the `haze` knob.
- **Scattering cross-section (board §2)** and **rim-thickness comparison (§3)** aren't
  built as panels yet — the multi-layer scattering (Rayleigh rim + Mie haze band +
  exosphere) is in the engine, but the labeled diagram / sliver comparison are UI/compose
  work.
- **Cloud & weather library (§5)**: have 5 tiles (banding/cyclonic/broken/cirrus/vapor);
  "terminator-on-clouds" is a lighting state, not a tile.
