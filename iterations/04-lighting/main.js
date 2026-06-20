import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import fragmentShader from './scene.frag.glsl?raw';
import { makeFilmicPass } from '../shared/post.js';

const vertexShader = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Star-type presets pin a temperature (Kelvin) on the Planckian locus.
// Scenario presets pin the framing (where the star sits relative to camera).
const STAR_TYPES = {
  'M dwarf (3000K)': 3000,
  'K star (4500K)': 4500,
  'G — Sun-like (5800K)': 5800,
  'F star (6800K)': 6800,
  'A star (9500K)': 9500,
};

const PRESETS = {
  'Terminator (Sun-like)': {
    starTemp: 5800, sunAzimuth: 70, sunElevation: 8, showMoon: 0,
    starAngRad: 0.018, starBright: 1.0, starGlow: 900,
    cloudAmount: 0.45, rimStrength: 1.1, camDist: 2.7,
  },
  'Crescent (red dwarf)': {
    starTemp: 3200, sunAzimuth: 104, sunElevation: 12, showMoon: 0,
    starAngRad: 0.034, starBright: 1.0, starGlow: 700,
    cloudAmount: 0.4, rimStrength: 1.0, camDist: 2.7,
  },
  'Full phase (blue-white A)': {
    starTemp: 9500, sunAzimuth: 42, sunElevation: 20, showMoon: 0,
    starAngRad: 0.016, starBright: 1.0, starGlow: 1100,
    cloudAmount: 0.5, rimStrength: 1.3, camDist: 2.7,
  },
  'System context (K star + moon)': {
    starTemp: 4500, sunAzimuth: 36, sunElevation: 22, showMoon: 1,
    starAngRad: 0.04, starBright: 1.1, starGlow: 600,
    cloudAmount: 0.4, rimStrength: 1.2, camDist: 4.0,
  },
};

const params = {
  starType: 'G — Sun-like (5800K)',
  preset: 'Terminator (Sun-like)',
  yaw: 0.4, ambient: 0.16, nightAmbient: 0.012,
  bandFreq: 16, warp: 0.4,
  colA: '#cdbfa6', colB: '#9c8a6e', colC: '#6f5e48',
  cloudCol: '#f2f4f8', atmoCol: '#7fd0ff',
  exposure: 1.0, bloomStrength: 0.5, bloomRadius: 0.7, bloomThreshold: 0.85,
  ...structuredClone(PRESETS['Terminator (Sun-like)']),
};

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = params.exposure;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.3;
controls.maxDistance = 16;

const uniforms = {
  uResolution: { value: new THREE.Vector2() },
  uCamWorld: { value: new THREE.Matrix4() },
  uProjInv: { value: new THREE.Matrix4() },
  uLightDir: { value: new THREE.Vector3() },
  uStarTemp: { value: 5800 }, uStarBright: { value: 1.0 },
  uStarAngRad: { value: 0.018 }, uStarGlow: { value: 900 },
  uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uColC: { value: new THREE.Color() },
  uCloudCol: { value: new THREE.Color() }, uCloudAmount: { value: 0.45 },
  uAtmoCol: { value: new THREE.Color() }, uRimStrength: { value: 1.1 },
  uBandFreq: { value: 16 }, uWarp: { value: 0.4 },
  uAmbient: { value: 0.16 }, uNightAmbient: { value: 0.012 }, uYaw: { value: 0.4 },
  uShowMoon: { value: 0 }, uMoonPos: { value: new THREE.Vector3(1.15, 0.22, 0.25) }, uMoonRadius: { value: 0.24 },
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
const filmic = makeFilmicPass({ sharpen: 0.32, aberration: 0.0016, grain: 0.012 });
composer.addPass(filmic);
composer.setPixelRatio(renderer.getPixelRatio());

const gui = new GUI({ title: '04 · lighting & star types' });
gui.add(params, 'preset', Object.keys(PRESETS)).name('scenario').onChange((n) => {
  Object.assign(params, structuredClone(PRESETS[n]));
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
gui.add(params, 'starType', Object.keys(STAR_TYPES)).name('star type').onChange((n) => {
  params.starTemp = STAR_TYPES[n];
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
const fStar = gui.addFolder('star');
fStar.add(params, 'starTemp', 2500, 12000, 50).name('temp (K)');
fStar.add(params, 'sunAzimuth', -180, 180);
fStar.add(params, 'sunElevation', -50, 70);
fStar.add(params, 'starAngRad', 0.005, 0.08).name('star size');
fStar.add(params, 'rimStrength', 0, 3).name('atmo rim');
const fScene = gui.addFolder('scene');
fScene.add(params, 'showMoon', 0, 1, 1).name('moon');
fScene.add(params, 'camDist', 1.6, 8).name('camera dist').onChange((d) => {
  const c = camera.position.length();
  if (c > 0.001) camera.position.multiplyScalar(d / c);
});
fScene.add(params, 'cloudAmount', 0, 1).name('clouds');
fScene.add(params, 'yaw', -Math.PI, Math.PI).name('spin');
const fP = gui.addFolder('post');
fP.add(params, 'exposure', 0.2, 3);
fP.add(params, 'bloomStrength', 0, 2);
fP.add(params, 'bloomThreshold', 0, 2);
fP.add(filmic.uniforms.uSharpen, 'value', 0, 1).name('sharpen');
fP.add(filmic.uniforms.uAberration, 'value', 0, 0.006).name('aberration');
fP.add(filmic.uniforms.uGrain, 'value', 0, 0.04).name('grain');

function syncUniforms() {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth);
  const el = THREE.MathUtils.degToRad(params.sunElevation);
  uniforms.uLightDir.value.set(Math.cos(el)*Math.sin(az), Math.sin(el), Math.cos(el)*Math.cos(az)).normalize();
  uniforms.uStarTemp.value = params.starTemp;
  uniforms.uStarBright.value = params.starBright;
  uniforms.uStarAngRad.value = params.starAngRad;
  uniforms.uStarGlow.value = params.starGlow;
  uniforms.uColA.value.set(params.colA); uniforms.uColB.value.set(params.colB); uniforms.uColC.value.set(params.colC);
  uniforms.uCloudCol.value.set(params.cloudCol); uniforms.uCloudAmount.value = params.cloudAmount;
  uniforms.uAtmoCol.value.set(params.atmoCol); uniforms.uRimStrength.value = params.rimStrength;
  uniforms.uBandFreq.value = params.bandFreq; uniforms.uWarp.value = params.warp;
  uniforms.uAmbient.value = params.ambient; uniforms.uNightAmbient.value = params.nightAmbient;
  uniforms.uYaw.value = params.yaw;
  uniforms.uShowMoon.value = params.showMoon;

  renderer.toneMappingExposure = params.exposure;
  bloom.strength = params.bloomStrength; bloom.radius = params.bloomRadius; bloom.threshold = params.bloomThreshold;

  camera.updateMatrixWorld();
  uniforms.uCamWorld.value.copy(camera.matrixWorld);
  uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
  renderer.getDrawingBufferSize(uniforms.uResolution.value);
  filmic.setTexel(uniforms.uResolution.value.x, uniforms.uResolution.value.y);
  filmic.uniforms.uTime.value = performance.now() * 0.001;
}

camera.position.set(0.3, 0.2, params.camDist);

window.__exo = {
  params,
  applyPreset(n) {
    Object.assign(params, structuredClone(PRESETS[n]));
    const c = camera.position.length();
    camera.position.multiplyScalar(params.camDist / c);
    gui.controllersRecursive().forEach((x) => x.updateDisplay());
  },
  presets: Object.keys(PRESETS),
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
  a.download = `lighting-${params.preset.replace(/[^a-z0-9]+/gi,'-')}.png`;
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
