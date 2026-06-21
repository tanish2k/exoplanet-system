// Atmosphere material tokens — per-gas single-scattering coefficients + a distinct
// haze band (multi-layer realism, matches the board's scattering cross-section).
// Ported from the proven iter01 scattering probe (betaR/M/A already × their scales).
//   betaR  Rayleigh scattering (wavelength -> rim color)   betaM  Mie (haze, forward)
//   betaA  absorption (methane absorbs red -> teal; exotic -> violet)
//   mieG   anisotropy   Hr/Hm  scale heights   height  shell thickness
//   haze*  a Gaussian Mie band at hazeAlt*height (the visible haze layer)
//   sunColor / sunIntensity  star light feeding the scattering
export const ATMOSPHERES = {
  thin: {
    betaR: [6.4, 4.16, 2.56], betaM: [2.4, 2.16, 1.8], betaA: [0, 0, 0],
    mieG: 0.70, Hr: 0.012, Hm: 0.010, height: 0.05, sunColor: '#fff3e0', sunIntensity: 14,
    hazeAmt: 0.0, hazeAlt: 0.35, hazeWidth: 0.25,
  },
  h2he: {
    betaR: [3.19, 7.43, 18.21], betaM: [2.0, 2.0, 2.0], betaA: [0, 0, 0],
    mieG: 0.76, Hr: 0.040, Hm: 0.028, height: 0.12, sunColor: '#f4f7ff', sunIntensity: 16,
    hazeAmt: 0.35, hazeAlt: 0.4, hazeWidth: 0.28,
  },
  waterVapor: {
    betaR: [3.15, 8.4, 15.4], betaM: [7.2, 8.1, 8.55], betaA: [0, 0, 0],
    mieG: 0.62, Hr: 0.034, Hm: 0.030, height: 0.10, sunColor: '#fdfdff', sunIntensity: 15,
    hazeAmt: 0.85, hazeAlt: 0.16, hazeWidth: 0.45,
  },
  co2: {
    betaR: [9.9, 7.7, 4.95], betaM: [14.3, 11.7, 8.45], betaA: [0, 0, 0],
    mieG: 0.72, Hr: 0.018, Hm: 0.014, height: 0.07, sunColor: '#ffe9c4', sunIntensity: 15,
    hazeAmt: 1.0, hazeAlt: 0.12, hazeWidth: 0.5,
  },
  methane: {
    betaR: [2.8, 7.6, 7.2], betaM: [1.8, 2.7, 2.7], betaA: [6.4, 1.28, 0.16],
    mieG: 0.70, Hr: 0.038, Hm: 0.030, height: 0.11, sunColor: '#f4f9ff', sunIntensity: 16,
    hazeAmt: 0.35, hazeAlt: 0.42, hazeWidth: 0.3,
  },
  exotic: {
    betaR: [4.9, 1.75, 6.65], betaM: [8.55, 3.15, 9.9], betaA: [0.54, 6.75, 0.36],
    mieG: 0.84, Hr: 0.045, Hm: 0.050, height: 0.13, sunColor: '#ffe2f0', sunIntensity: 17,
    hazeAmt: 1.1, hazeAlt: 0.16, hazeWidth: 0.55,
  },
};

// Atmosphere legend swatches — the rim color each gas scatters, derived from betaR
// (no drift: same coefficients the shader uses). Absorption shifts the hue too.
function rimHex(a) {
  const net = a.betaR.map((x, i) => Math.max(x - a.betaA[i] * 0.5, 0.01));
  const m = Math.max(...net);
  const c = net.map((x) => Math.round(Math.min(1, Math.pow(x / m, 0.8)) * 255));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export const ATMOSPHERE_SWATCHES = Object.fromEntries(
  Object.entries(ATMOSPHERES).map(([k, a]) => [k, rimHex(a)]),
);
