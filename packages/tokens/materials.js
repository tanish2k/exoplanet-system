// Canonical scientific-material registry (the token source of truth).
// One material = a label + category + the PBR maps present in assets/materials/<id>/.
// Swatch colors are NOT hand-picked here — they are derived from the actual textures
// by build-swatches.py (-> swatches.json), so the legend can never drift from the
// rendered planet. The engine reads MATERIAL_MAPS to know which maps to load.
import MATERIALS from './materials.json';

export { MATERIALS };

export const MATERIAL_MAPS = Object.fromEntries(
  Object.entries(MATERIALS).map(([id, m]) => [id, m.maps]),
);
