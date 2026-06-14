import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import fragmentShader from './scene.frag.glsl?raw';

const vertexShader = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---------- atmosphere archetype presets ----------
// betaR/betaM/betaA are scattering/absorption coefficients in 1/planet-radius
// units. Tuned for the look of the reference board, not strict Earth values.
const PRESETS = {
  'Thin (barely there)': {
    atmoHeight: 0.035, Hr: 0.012, Hm: 0.010,
    betaR: [4.0, 2.6, 1.6], betaRScale: 1.6,
    betaM: [2.0, 1.8, 1.5], betaMScale: 1.2, mieG: 0.70,
    betaA: [0, 0, 0], betaAScale: 0,
    surfaceMode: 0, surfColA: '#4a3a2e', surfColB: '#8a7460',
    sunColor: '#fff3e0', sunIntensity: 14, nightAmbient: 0.004,
  },
  'H2/He (gas giant)': {
    atmoHeight: 0.12, Hr: 0.040, Hm: 0.028,
    betaR: [5.8, 13.5, 33.1], betaRScale: 0.55,
    betaM: [4.0, 4.0, 4.0], betaMScale: 0.5, mieG: 0.76,
    betaA: [0, 0, 0], betaAScale: 0,
    surfaceMode: 1, surfColA: '#27405e', surfColB: '#b8cbe0',
    sunColor: '#f4f7ff', sunIntensity: 16, nightAmbient: 0.003,
  },
  'Water vapor (sub-Neptune)': {
    atmoHeight: 0.10, Hr: 0.034, Hm: 0.030,
    betaR: [4.5, 12.0, 22.0], betaRScale: 0.7,
    betaM: [8.0, 9.0, 9.5], betaMScale: 0.9, mieG: 0.62,
    betaA: [0, 0, 0], betaAScale: 0,
    surfaceMode: 2, surfColA: '#2c4a5e', surfColB: '#5a7d92',
    sunColor: '#fdfdff', sunIntensity: 15, nightAmbient: 0.004,
  },
  'CO2 (terrestrial)': {
    atmoHeight: 0.055, Hr: 0.018, Hm: 0.014,
    betaR: [9.0, 7.0, 4.5], betaRScale: 1.1,
    betaM: [11.0, 9.0, 6.5], betaMScale: 1.3, mieG: 0.72,
    betaA: [0, 0, 0], betaAScale: 0,
    surfaceMode: 0, surfColA: '#3d3026', surfColB: '#94704c',
    sunColor: '#ffe9c4', sunIntensity: 15, nightAmbient: 0.004,
  },
  'Methane (ice giant)': {
    atmoHeight: 0.11, Hr: 0.038, Hm: 0.030,
    betaR: [3.5, 9.5, 9.0], betaRScale: 0.8,
    betaM: [3.0, 4.5, 4.5], betaMScale: 0.6, mieG: 0.70,
    betaA: [8.0, 1.6, 0.2], betaAScale: 0.8,
    surfaceMode: 2, surfColA: '#173a45', surfColB: '#2e6e78',
    sunColor: '#f4f9ff', sunIntensity: 16, nightAmbient: 0.003,
  },
  'Exotic haze (photochemical)': {
    atmoHeight: 0.13, Hr: 0.045, Hm: 0.050,
    betaR: [7.0, 2.5, 9.5], betaRScale: 0.7,
    betaM: [9.5, 3.5, 11.0], betaMScale: 0.9, mieG: 0.84,
    betaA: [1.0, 3.2, 0.6], betaAScale: 0.6,
    surfaceMode: 2, surfColA: '#241a30', surfColB: '#4a3358',
    sunColor: '#ffe2f0', sunIntensity: 17, nightAmbient: 0.003,
  },
};

const params = {
  preset: 'H2/He (gas giant)',
  sunAzimuth: 110,      // degrees; rim-lit crescent like the reference board
  sunElevation: 6,
  exposure: 1.0,
  bloomStrength: 0.55,
  bloomRadius: 0.65,
  bloomThreshold: 1.0,
  viewSteps: 64,
  lightSteps: 8,
  ...structuredClone(PRESETS['H2/He (gas giant)']),
};

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = params.exposure;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  38, window.innerWidth / window.innerHeight, 0.1, 100,
);
camera.position.set(-0.4, 0.35, 3.1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.15;
controls.maxDistance = 12;

const uniforms = {
  uResolution: { value: new THREE.Vector2() },
  uCamWorld: { value: new THREE.Matrix4() },
  uProjInv: { value: new THREE.Matrix4() },
  uLightDir: { value: new THREE.Vector3(1, 0, 0) },
  uSunColor: { value: new THREE.Color() },
  uSunIntensity: { value: 15 },
  uAtmoHeight: { value: 0.1 },
  uHr: { value: 0.03 },
  uHm: { value: 0.02 },
  uBetaR: { value: new THREE.Vector3() },
  uBetaM: { value: new THREE.Vector3() },
  uBetaA: { value: new THREE.Vector3() },
  uMieG: { value: 0.76 },
  uViewSteps: { value: 64 },
  uLightSteps: { value: 8 },
  uSurfaceMode: { value: 1 },
  uSurfColA: { value: new THREE.Color() },
  uSurfColB: { value: new THREE.Color() },
  uNightAmbient: { value: 0.004 },
};

const scene = new THREE.Scene();
const triangle = new THREE.BufferGeometry();
triangle.setAttribute('position', new THREE.BufferAttribute(
  new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3,
));
const quad = new THREE.Mesh(
  triangle,
  new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms }),
);
quad.frustumCulled = false;
scene.add(quad);

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.bloomStrength, params.bloomRadius, params.bloomThreshold,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.setPixelRatio(renderer.getPixelRatio());

// ---------- gui ----------
const gui = new GUI({ title: '01 · atmosphere' });
gui.add(params, 'preset', Object.keys(PRESETS)).onChange(applyPreset);

const fAtmo = gui.addFolder('atmosphere');
fAtmo.add(params, 'atmoHeight', 0.005, 0.25);
fAtmo.add(params, 'Hr', 0.002, 0.12).name('rayleigh scale H');
fAtmo.add(params, 'Hm', 0.002, 0.12).name('mie scale H');
fAtmo.add(params, 'betaRScale', 0, 4).name('rayleigh strength');
fAtmo.add(params, 'betaMScale', 0, 4).name('mie strength');
fAtmo.add(params, 'betaAScale', 0, 4).name('absorption');
fAtmo.add(params, 'mieG', 0, 0.95).name('mie anisotropy');

const fLight = gui.addFolder('star');
fLight.add(params, 'sunAzimuth', -180, 180);
fLight.add(params, 'sunElevation', -60, 60);
fLight.addColor(params, 'sunColor');
fLight.add(params, 'sunIntensity', 1, 60);

const fPost = gui.addFolder('post');
fPost.add(params, 'exposure', 0.2, 3);
fPost.add(params, 'bloomStrength', 0, 2);
fPost.add(params, 'bloomRadius', 0, 1.5);
fPost.add(params, 'bloomThreshold', 0, 2);

const fQuality = gui.addFolder('quality');
fQuality.add(params, 'viewSteps', 16, 256, 1);
fQuality.add(params, 'lightSteps', 2, 64, 1);

function applyPreset(name) {
  Object.assign(params, structuredClone(PRESETS[name]));
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}

// ---------- sync ----------
function syncUniforms() {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth);
  const el = THREE.MathUtils.degToRad(params.sunElevation);
  uniforms.uLightDir.value.set(
    Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az),
  ).normalize();

  uniforms.uSunColor.value.set(params.sunColor);
  uniforms.uSunIntensity.value = params.sunIntensity;
  uniforms.uAtmoHeight.value = params.atmoHeight;
  uniforms.uHr.value = params.Hr;
  uniforms.uHm.value = params.Hm;
  uniforms.uBetaR.value.fromArray(params.betaR).multiplyScalar(params.betaRScale);
  uniforms.uBetaM.value.fromArray(params.betaM).multiplyScalar(params.betaMScale);
  uniforms.uBetaA.value.fromArray(params.betaA).multiplyScalar(params.betaAScale);
  uniforms.uMieG.value = params.mieG;
  uniforms.uViewSteps.value = Math.round(params.viewSteps);
  uniforms.uLightSteps.value = Math.round(params.lightSteps);
  uniforms.uSurfaceMode.value = params.surfaceMode;
  uniforms.uSurfColA.value.set(params.surfColA);
  uniforms.uSurfColB.value.set(params.surfColB);
  uniforms.uNightAmbient.value = params.nightAmbient;

  renderer.toneMappingExposure = params.exposure;
  bloom.strength = params.bloomStrength;
  bloom.radius = params.bloomRadius;
  bloom.threshold = params.bloomThreshold;

  camera.updateMatrixWorld();
  uniforms.uCamWorld.value.copy(camera.matrixWorld);
  uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
  renderer.getDrawingBufferSize(uniforms.uResolution.value);
}

// ---------- capture: press "c" for a 3x supersampled PNG ----------
window.addEventListener('keydown', (e) => {
  if (e.key !== 'c') return;
  const prevRatio = renderer.getPixelRatio();
  const prevSteps = params.viewSteps;
  const prevLight = params.lightSteps;
  params.viewSteps = 192;
  params.lightSteps = 24;
  renderer.setPixelRatio(3);
  composer.setPixelRatio(3);
  composer.setSize(window.innerWidth, window.innerHeight);
  syncUniforms();
  composer.render();
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `atmosphere-${params.preset.replace(/[^a-z0-9]+/gi, '-')}.png`;
  a.click();
  params.viewSteps = prevSteps;
  params.lightSteps = prevLight;
  renderer.setPixelRatio(prevRatio);
  composer.setPixelRatio(prevRatio);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// hook for the headless capture pipeline (tools/capture.mjs)
window.__exo = {
  params,
  applyPreset,
  presets: Object.keys(PRESETS),
  setQuality(viewSteps, lightSteps, pixelRatio) {
    params.viewSteps = viewSteps;
    params.lightSteps = lightSteps;
    renderer.setPixelRatio(pixelRatio);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
  },
  renderOnce() {
    syncUniforms();
    composer.render();
  },
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  syncUniforms();
  composer.render();
});
