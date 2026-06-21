// Per-archetype cutaway compositions (token layer).
// A composition = exterior material + atmosphere + concentric bands (outer->inner)
// + inner-core orb + per-archetype `look` (lighting/post). Bands reference material
// ids from materials.json; the engine loads each material's PBR maps from
// assets/materials/<id>/. This is the single source of truth the engine consumes.
//
// bands: outer->inner. r0/r1 = normalized planet radius (surface = 1.0). emis scales
// the emissive map; rough overrides roughness; metal=1 for metals; tint = emissive
// color (orange-hot vs silver-metal). look = lighting/post drama per archetype.
export const COMPOSITIONS = {
  'Rocky Terrestrial': {
    exterior: 'crust-basaltic', exteriorEmis: 0,
    atmo: { type: 'thin', intensity: 0.8 },
    clouds: { id: 'cloud-broken-deck', amount: 0.9, r: 1.012 },
    bands: [
      { id: 'crust-basaltic',    r0: 0.94, r1: 1.00, emis: 0.0, rough: 1.0 },
      { id: 'mantle-upper',      r0: 0.72, r1: 0.94, emis: 0.9, rough: 0.9 },
      { id: 'mantle-lower',      r0: 0.52, r1: 0.72, emis: 1.7, rough: 0.85 },
      { id: 'core-liquid-metal', r0: 0.37, r1: 0.52, emis: 2.3, rough: 0.5, metal: 1, tint: '#ffb060' },
    ],
    core: { id: 'core-solid-metal', r: 0.40, emis: 2.4, rough: 0.45, metal: 1, tint: '#ffcf92' },
    look: { exposure: 0.92, bloomStrength: 0.18, bloomThreshold: 1.15, keyLight: 2.5, ambient: 0.26, coreLight: 1.1, capTiling: 1.7, crustTiling: 6, atmoStrength: 1.0, sunAzimuth: 42, sunElevation: 24 },
  },
  'Iron-rich Super-Earth': {
    exterior: 'crust-basaltic', exteriorEmis: 0,
    atmo: { type: 'thin', intensity: 0.65 },
    clouds: { id: 'cloud-cirrus', amount: 0.55, r: 1.01 },
    bands: [
      { id: 'crust-basaltic',    r0: 0.90, r1: 1.00, emis: 0.0, rough: 1.0 },
      { id: 'mantle-iron-rich',  r0: 0.58, r1: 0.90, emis: 0.6, rough: 0.6, metal: 0.6 },
      { id: 'core-liquid-metal', r0: 0.50, r1: 0.58, emis: 1.6, rough: 0.45, metal: 1, tint: '#ffd9a8' },
    ],
    // massive, bright silver-metallic core: dim emissive so the metal reads, low roughness
    core: { id: 'core-solid-metal', r: 0.52, emis: 1.0, rough: 0.28, metal: 1, tint: '#fff2e2' },
    look: { exposure: 0.9, bloomStrength: 0.16, bloomThreshold: 1.2, keyLight: 3.0, ambient: 0.34, coreLight: 0.8, capTiling: 1.7, crustTiling: 6, atmoStrength: 1.0, sunAzimuth: 48, sunElevation: 26 },
  },
  'Ocean / Ice World': {
    exterior: 'ice-shell', exteriorEmis: 0,
    atmo: { type: 'waterVapor', intensity: 0.95 },
    clouds: { id: 'cloud-vapor-deck', amount: 0.95, r: 1.014 },
    bands: [
      { id: 'ice-shell',         r0: 0.90, r1: 1.00, emis: 0.0, rough: 0.35 },
      { id: 'subsurface-ocean',  r0: 0.76, r1: 0.90, emis: 0.0, rough: 0.12 },
      { id: 'high-pressure-ice', r0: 0.58, r1: 0.76, emis: 0.0, rough: 0.25 },
      { id: 'mantle-upper',      r0: 0.40, r1: 0.58, emis: 0.55, rough: 0.9 },
      { id: 'core-liquid-metal', r0: 0.30, r1: 0.40, emis: 1.4, rough: 0.5, metal: 1, tint: '#ffc890' },
    ],
    // small, cool/dim core
    core: { id: 'core-solid-metal', r: 0.33, emis: 1.2, rough: 0.45, metal: 1, tint: '#ffce9c' },
    look: { exposure: 0.9, bloomStrength: 0.15, bloomThreshold: 1.22, keyLight: 2.6, ambient: 0.36, coreLight: 0.8, capTiling: 1.5, crustTiling: 5, atmoStrength: 1.0, sunAzimuth: 38, sunElevation: 30 },
  },
  'Carbon Planet': {
    exterior: 'crust-graphite', exteriorEmis: 0,
    atmo: { type: 'thin', intensity: 0.55 },
    clouds: { id: 'cloud-cirrus', amount: 0.3, r: 1.01 },
    bands: [
      { id: 'crust-graphite',    r0: 0.92, r1: 1.00, emis: 0.0, rough: 0.7 },
      { id: 'diamond-layer',     r0: 0.74, r1: 0.92, emis: 0.14, rough: 0.22, tint: '#cfe2ff' },
      { id: 'mantle-carbon',     r0: 0.48, r1: 0.74, emis: 1.0, rough: 0.82 },
      { id: 'core-liquid-metal', r0: 0.34, r1: 0.48, emis: 2.0, rough: 0.5, metal: 1, tint: '#ffb568' },
    ],
    // small bright orange core
    core: { id: 'core-solid-metal', r: 0.37, emis: 2.2, rough: 0.45, metal: 1, tint: '#ffbf72' },
    look: { exposure: 0.86, bloomStrength: 0.19, bloomThreshold: 1.18, keyLight: 2.4, ambient: 0.2, coreLight: 1.0, capTiling: 1.7, crustTiling: 6, atmoStrength: 1.0, sunAzimuth: 44, sunElevation: 22 },
  },
  'Gas Giant Core': {
    exterior: 'molecular-hydrogen', exteriorEmis: 0,
    exteriorTile: { u: 2.5, v: 1 }, // smooth horizontal latitude bands (no vertical tiling)
    atmo: { type: 'h2he', intensity: 0.9 },
    bands: [
      { id: 'molecular-hydrogen', r0: 0.82, r1: 1.00, emis: 0.0, rough: 0.6 },
      { id: 'metallic-hydrogen',  r0: 0.55, r1: 0.82, emis: 0.5, rough: 0.4, metal: 1 },
      { id: 'ice-rock-mantle',    r0: 0.34, r1: 0.55, emis: 0.2, rough: 0.6 },
    ],
    // small dense, barely-glowing core
    core: { id: 'core-solid-metal', r: 0.34, emis: 1.0, rough: 0.5, metal: 1, tint: '#ffd2a6' },
    look: { exposure: 0.95, bloomStrength: 0.14, bloomThreshold: 1.3, keyLight: 2.3, ambient: 0.42, coreLight: 0.7, capTiling: 1.4, crustTiling: 4, atmoStrength: 1.0, sunAzimuth: 40, sunElevation: 32 },
  },
  'Lava World': {
    exterior: 'crust-basalt-lava', exteriorEmis: 1.0,
    atmo: { type: 'co2', intensity: 0.7 },
    bands: [
      { id: 'crust-basalt-lava', r0: 0.93, r1: 1.00, emis: 1.5, rough: 0.85 },
      { id: 'magma-ocean',       r0: 0.64, r1: 0.93, emis: 2.2, rough: 0.6 },
      { id: 'mantle-lower',      r0: 0.44, r1: 0.64, emis: 1.0, rough: 0.85 },
      { id: 'core-liquid-metal', r0: 0.32, r1: 0.44, emis: 2.4, rough: 0.5, metal: 1, tint: '#ffac5a' },
    ],
    core: { id: 'core-solid-metal', r: 0.35, emis: 2.6, rough: 0.45, metal: 1, tint: '#ffb260' },
    look: { exposure: 0.82, bloomStrength: 0.22, bloomThreshold: 1.34, keyLight: 1.9, keyColor: '#ffe6d6', ambient: 0.28, coreLight: 1.3, capTiling: 1.7, crustTiling: 5, atmoStrength: 1.0, sunAzimuth: 40, sunElevation: 26 },
  },
};
