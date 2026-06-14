import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import fragmentShader from './scene.frag.glsl?raw';
import {
  COMPOSITIONS, MATERIALS, EXTERIORS, resolveMaterials,
  CORE_OPTS, OUTERCORE_OPTS, MANTLE_OPTS, CRUST_OPTS,
} from './materials.js';

const vertexShader = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// labels for the GUI dropdowns: { 'Iron': 'ironCore', ... }
const optMap = (ids) => Object.fromEntries(ids.map((id) => [MATERIALS[id].label, id]));

const params = {
  composition: 'Terrestrial (rocky)',
  // live material selections (the "inputs" — pick a core/mantle/crust material)
  core: 'ironCore', outerCore: 'magma', mantle: 'silicate', crust: 'silicateCrust',
  exterior: 'earth',
  // geometry + atmosphere (from composition)
  rAtmo: 1.05, rSurface: 1.0, rCrustBase: 0.93, rMantleBase: 0.47, rInnerCore: 0.24,
  atmoCol: '#6fd8ff', rimStrength: 1.1,
  // global
  sunAzimuth: 28, sunElevation: 30, ambient: 0.17, nightAmbient: 0.012, boundaryGlow: 0.5, yaw: 0.5,
  exposure: 1.0, bloomStrength: 0.34, bloomRadius: 0.6, bloomThreshold: 1.05,
  // resolved material colors (filled by resolveInto)
  crustA: '#000', crustB: '#000', mantleA: '#000', mantleB: '#000',
  coreCol: '#000', innerCoreCol: '#000', outerCoreCol: '#000', coreEmissive: 1.65,
  surfaceType: 0, seaLevel: 0.52, cloudAmount: 0.5,
  oceanDeep: '#000', oceanShallow: '#000', landLow: '#000', landHigh: '#000',
  iceCol: '#000', cloudCol: '#000', bandA: '#000', bandB: '#000', bandC: '#000',
};

// resolve current material selections into the flat color params the uniforms read
function resolveInto() {
  Object.assign(params, resolveMaterials(params));
}
// apply a full composition (materials + exterior + geometry + atmosphere)
function applyComposition(name) {
  const c = COMPOSITIONS[name];
  params.core = c.core; params.outerCore = c.outerCore; params.mantle = c.mantle; params.crust = c.crust;
  params.exterior = c.exterior; params.atmoCol = c.atmoCol; params.rimStrength = c.rimStrength;
  Object.assign(params, c.geom);
  resolveInto();
}
applyComposition('Terrestrial (rocky)');

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = params.exposure;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0.85, 1.05, 3.0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.6;
controls.maxDistance = 12;

const C = () => new THREE.Color();
const uniforms = {
  uResolution: { value: new THREE.Vector2() },
  uCamWorld: { value: new THREE.Matrix4() },
  uProjInv: { value: new THREE.Matrix4() },
  uLightDir: { value: new THREE.Vector3() },
  uSunColor: { value: new THREE.Color('#fff2dc') },
  uAmbient: { value: 0.17 }, uNightAmbient: { value: 0.012 }, uYaw: { value: 0.5 },
  uRAtmo: { value: 1.05 }, uRSurface: { value: 1.0 },
  uRCrustBase: { value: 0.93 }, uRMantleBase: { value: 0.47 }, uRInnerCore: { value: 0.24 },
  uSurfaceType: { value: 0 }, uSeaLevel: { value: 0.52 }, uCloudAmount: { value: 0.5 },
  uCrustA: { value: C() }, uCrustB: { value: C() }, uMantleA: { value: C() }, uMantleB: { value: C() },
  uCoreCol: { value: C() }, uInnerCoreCol: { value: C() }, uOuterCoreCol: { value: C() },
  uOceanDeep: { value: C() }, uOceanShallow: { value: C() }, uLandLow: { value: C() }, uLandHigh: { value: C() },
  uIceCol: { value: C() }, uCloudCol: { value: C() },
  uBandA: { value: C() }, uBandB: { value: C() }, uBandC: { value: C() }, uAtmoCol: { value: C() },
  uCoreEmissive: { value: 1.65 }, uRimStrength: { value: 1.1 }, uBoundaryGlow: { value: 0.5 },
};

const scene = new THREE.Scene();
const tri = new THREE.BufferGeometry();
tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1,-1,0, 3,-1,0, -1,3,0]), 3));
const quad = new THREE.Mesh(tri, new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms }));
quad.frustumCulled = false;
scene.add(quad);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.bloomStrength, params.bloomRadius, params.bloomThreshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.setPixelRatio(renderer.getPixelRatio());

const gui = new GUI({ title: '03 · anatomy cutaway' });
gui.add(params, 'composition', Object.keys(COMPOSITIONS)).name('preset').onChange((n) => {
  applyComposition(n);
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
// the material input system — pick a material per layer, live
const fM = gui.addFolder('materials');
fM.add(params, 'core', optMap(CORE_OPTS)).name('core').onChange(resolveInto);
fM.add(params, 'outerCore', optMap(OUTERCORE_OPTS)).name('outer core').onChange(resolveInto);
fM.add(params, 'mantle', optMap(MANTLE_OPTS)).name('mantle').onChange(resolveInto);
fM.add(params, 'crust', optMap(CRUST_OPTS)).name('crust').onChange(resolveInto);
fM.add(params, 'exterior', Object.keys(EXTERIORS)).name('exterior').onChange(resolveInto);
const fL = gui.addFolder('layers');
fL.add(params, 'rCrustBase', 0.6, 0.99).name('crust base');
fL.add(params, 'rMantleBase', 0.2, 0.7).name('mantle base / core top');
fL.add(params, 'boundaryGlow', 0, 2).name('interface lines');
const fE = gui.addFolder('exterior detail');
fE.add(params, 'yaw', -Math.PI, Math.PI).name('spin');
fE.add(params, 'cloudAmount', 0, 1).name('clouds');
const fS = gui.addFolder('star');
fS.add(params, 'sunAzimuth', -180, 180);
fS.add(params, 'sunElevation', -60, 80);
fS.add(params, 'ambient', 0, 0.4);
fS.add(params, 'rimStrength', 0, 3).name('atmo rim');
const fP = gui.addFolder('post');
fP.add(params, 'exposure', 0.2, 3);
fP.add(params, 'bloomStrength', 0, 2);
fP.add(params, 'bloomThreshold', 0, 2);

function syncUniforms() {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth);
  const el = THREE.MathUtils.degToRad(params.sunElevation);
  uniforms.uLightDir.value.set(Math.cos(el)*Math.sin(az), Math.sin(el), Math.cos(el)*Math.cos(az)).normalize();
  uniforms.uAmbient.value = params.ambient;
  uniforms.uNightAmbient.value = params.nightAmbient;
  uniforms.uYaw.value = params.yaw;
  uniforms.uBoundaryGlow.value = params.boundaryGlow;
  uniforms.uRAtmo.value = params.rAtmo;
  uniforms.uRSurface.value = params.rSurface;
  uniforms.uRCrustBase.value = params.rCrustBase;
  uniforms.uRMantleBase.value = params.rMantleBase;
  uniforms.uRInnerCore.value = params.rInnerCore;
  uniforms.uSurfaceType.value = params.surfaceType;
  uniforms.uSeaLevel.value = params.seaLevel;
  uniforms.uCloudAmount.value = params.cloudAmount;
  uniforms.uCrustA.value.set(params.crustA); uniforms.uCrustB.value.set(params.crustB);
  uniforms.uMantleA.value.set(params.mantleA); uniforms.uMantleB.value.set(params.mantleB);
  uniforms.uCoreCol.value.set(params.coreCol); uniforms.uInnerCoreCol.value.set(params.innerCoreCol);
  uniforms.uOuterCoreCol.value.set(params.outerCoreCol);
  uniforms.uOceanDeep.value.set(params.oceanDeep); uniforms.uOceanShallow.value.set(params.oceanShallow);
  uniforms.uLandLow.value.set(params.landLow); uniforms.uLandHigh.value.set(params.landHigh);
  uniforms.uIceCol.value.set(params.iceCol); uniforms.uCloudCol.value.set(params.cloudCol);
  uniforms.uBandA.value.set(params.bandA); uniforms.uBandB.value.set(params.bandB); uniforms.uBandC.value.set(params.bandC);
  uniforms.uAtmoCol.value.set(params.atmoCol);
  uniforms.uCoreEmissive.value = params.coreEmissive;
  uniforms.uRimStrength.value = params.rimStrength;

  renderer.toneMappingExposure = params.exposure;
  bloom.strength = params.bloomStrength; bloom.radius = params.bloomRadius; bloom.threshold = params.bloomThreshold;

  camera.updateMatrixWorld();
  uniforms.uCamWorld.value.copy(camera.matrixWorld);
  uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
  renderer.getDrawingBufferSize(uniforms.uResolution.value);
}

window.__exo = {
  params,
  applyPreset(n) { applyComposition(n); gui.controllersRecursive().forEach((c) => c.updateDisplay()); },
  resolve() { resolveInto(); gui.controllersRecursive().forEach((c) => c.updateDisplay()); },
  presets: Object.keys(COMPOSITIONS),
  setQuality(_vs, _ls, pixelRatio) {
    renderer.setPixelRatio(pixelRatio); composer.setPixelRatio(pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
  },
  renderOnce() { syncUniforms(); composer.render(); },
};

window.addEventListener('keydown', (e) => {
  if (e.key !== 'c') return;
  renderer.setPixelRatio(3); composer.setPixelRatio(3); composer.setSize(window.innerWidth, window.innerHeight);
  syncUniforms(); composer.render();
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `cutaway-${params.composition.replace(/[^a-z0-9]+/gi,'-')}.png`;
  a.click();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => { controls.update(); syncUniforms(); composer.render(); });
