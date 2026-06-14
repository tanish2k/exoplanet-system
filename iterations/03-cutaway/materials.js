// Scientific material registry — the seed of Phase B's design tokens.
//
// One source of truth for planetary materials. Each material carries a `swatch`
// (the legend/UI dot color) AND shader params (`a`/`b` surface colors, `hot` +
// `emissive` for molten layers). A planet is COMPOSED by assigning materials to
// layers (core / outerCore / mantle / crust) instead of hardcoding hex.
//
// The reference board's "CORE MATERIALS" legend maps 1:1 onto the molten/solid
// entries here: Iron, Rock/Silicate, Ice, Carbon, High Pressure Ice, Magma.

export const MATERIALS = {
  // --- molten / core (emissive) ---
  ironCore:   { label: 'Iron',              swatch: '#c8743a', a: '#ff6310', hot: '#ffdf95', emissive: 1.65 },
  rockIron:   { label: 'Rock / Iron',       swatch: '#b8703e', a: '#ff7a2a', hot: '#ffd089', emissive: 1.45 },
  rockIce:    { label: 'Rock / Ice',        swatch: '#c98a4a', a: '#ff8a3a', hot: '#ffe7b0', emissive: 1.60 },
  carbide:    { label: 'Iron Carbide',      swatch: '#a8642e', a: '#ff5a12', hot: '#ffd27a', emissive: 1.85 },
  magma:      { label: 'Magma',             swatch: '#ff5a2a', a: '#ff5418', hot: '#ffe0a0', emissive: 1.90 },

  // --- solid rock / carbon ---
  silicate:   { label: 'Rock / Silicate',   swatch: '#8a7560', a: '#34221c', b: '#6e4530' },
  silicateCrust: { label: 'Silicate Crust', swatch: '#a08a72', a: '#6e5d49', b: '#a08a72' },
  basalt:     { label: 'Basalt',            swatch: '#5a5048', a: '#2a2420', b: '#4e443a' },
  carbon:     { label: 'Carbon',            swatch: '#3a3a40', a: '#141418', b: '#3a3038' },
  graphite:   { label: 'Graphite',          swatch: '#4a4a52', a: '#202024', b: '#46464e' },

  // --- ices ---
  ice:        { label: 'Ice',               swatch: '#bfe3f0', a: '#3a6a86', b: '#7fb0c8' },
  waterIce:   { label: 'Water / Ice',       swatch: '#7fb8d8', a: '#1d3a52', b: '#3f6f9c' },
  hpIce:      { label: 'High Pressure Ice', swatch: '#d8b85a', a: '#4a4030', b: '#8a7850' },

  // --- gas-giant interiors ---
  metallicH:  { label: 'Metallic Hydrogen', swatch: '#9a7088', a: '#4a3550', b: '#9a7088' },
};

// Which materials make sense at each layer (drives the GUI dropdowns + legend).
export const CORE_OPTS      = ['ironCore', 'rockIron', 'rockIce', 'carbide'];
export const OUTERCORE_OPTS = ['magma', 'ironCore', 'metallicH'];
export const MANTLE_OPTS    = ['silicate', 'waterIce', 'carbon', 'metallicH', 'hpIce'];
export const CRUST_OPTS     = ['silicateCrust', 'basalt', 'graphite', 'ice'];

// Exterior surface palettes (the observable layer). surfaceType: 0 earth, 1 gas, 2 ice, 3 carbon.
export const EXTERIORS = {
  earth:  { surfaceType: 0, seaLevel: 0.52, cloudAmount: 0.5,
            oceanDeep: '#0a2540', oceanShallow: '#1d5f86', landLow: '#3c6a2e', landHigh: '#8a6f3c',
            iceCol: '#e6ecf2', cloudCol: '#f3f8ff', bandA: '#caa978', bandB: '#9a6b44', bandC: '#6f4a32' },
  gas:    { surfaceType: 1, seaLevel: 0.5, cloudAmount: 0.0,
            oceanDeep: '#0a2540', oceanShallow: '#1d5f86', landLow: '#3c6a2e', landHigh: '#8a6f3c',
            iceCol: '#f0e8d0', cloudCol: '#f0e8d0', bandA: '#caa978', bandB: '#9a6b44', bandC: '#6f4a32' },
  ice:    { surfaceType: 2, seaLevel: 0.5, cloudAmount: 0.0,
            oceanDeep: '#0a2540', oceanShallow: '#1d5f86', landLow: '#3c6a2e', landHigh: '#8a6f3c',
            iceCol: '#dff0ff', cloudCol: '#dfeefc', bandA: '#2f6fc0', bandB: '#1b3f86', bandC: '#5fa0d8' },
  carbon: { surfaceType: 3, seaLevel: 0.5, cloudAmount: 0.0,
            oceanDeep: '#0a2540', oceanShallow: '#1d5f86', landLow: '#3c6a2e', landHigh: '#8a6f3c',
            iceCol: '#cfcfd6', cloudCol: '#cfcfd6', bandA: '#2a2a2e', bandB: '#52525a', bandC: '#3a3038' },
};

// A planet = layer materials + exterior + geometry + atmosphere. The 4 presets
// from the reference board's "Core Composition Examples", composed from materials.
export const COMPOSITIONS = {
  'Terrestrial (rocky)': {
    core: 'ironCore', outerCore: 'magma', mantle: 'silicate', crust: 'silicateCrust',
    exterior: 'earth', atmoCol: '#6fd8ff', rimStrength: 1.1,
    geom: { rAtmo: 1.05, rCrustBase: 0.93, rMantleBase: 0.47, rInnerCore: 0.24 },
  },
  'Ice giant (water-rich)': {
    core: 'rockIron', outerCore: 'magma', mantle: 'waterIce', crust: 'ice',
    exterior: 'ice', atmoCol: '#74e0ff', rimStrength: 1.4,
    geom: { rAtmo: 1.10, rCrustBase: 0.96, rMantleBase: 0.42, rInnerCore: 0.22 },
  },
  'Gas giant (H/He)': {
    core: 'rockIce', outerCore: 'magma', mantle: 'metallicH', crust: 'metallicH',
    exterior: 'gas', atmoCol: '#9ec8ff', rimStrength: 1.5,
    geom: { rAtmo: 1.13, rCrustBase: 0.97, rMantleBase: 0.30, rInnerCore: 0.16 },
  },
  'Carbon planet': {
    core: 'carbide', outerCore: 'magma', mantle: 'carbon', crust: 'graphite',
    exterior: 'carbon', atmoCol: '#7fb0d8', rimStrength: 0.9,
    geom: { rAtmo: 1.04, rCrustBase: 0.92, rMantleBase: 0.48, rInnerCore: 0.26 },
  },
};

// Resolve a layer-material selection + exterior into the flat color/param set the
// shader uniforms expect. This is the "tokens -> uniforms" build step in miniature.
export function resolveMaterials(sel) {
  const core = MATERIALS[sel.core], oc = MATERIALS[sel.outerCore],
        mantle = MATERIALS[sel.mantle], crust = MATERIALS[sel.crust];
  const ext = EXTERIORS[sel.exterior];
  return {
    crustA: crust.a, crustB: crust.b ?? crust.a,
    mantleA: mantle.a, mantleB: mantle.b ?? mantle.a,
    coreCol: core.a, innerCoreCol: core.hot ?? core.a, coreEmissive: core.emissive ?? 1.6,
    outerCoreCol: oc.a,
    surfaceType: ext.surfaceType, seaLevel: ext.seaLevel, cloudAmount: ext.cloudAmount,
    oceanDeep: ext.oceanDeep, oceanShallow: ext.oceanShallow, landLow: ext.landLow, landHigh: ext.landHigh,
    iceCol: ext.iceCol, cloudCol: ext.cloudCol, bandA: ext.bandA, bandB: ext.bandB, bandC: ext.bandC,
  };
}
