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

// surfaceType: 0 terrestrial, 1 gas giant, 2 ice giant
const PRESETS = {
  'Terrestrial (Earth-like)': {
    surfaceType: 0, yaw: 0.6, cloudYaw: 1.2,
    colA: '#0a2540', colB: '#1d5f86', colC: '#3c6a2e', colD: '#8a6f3c', colE: '#e6ecf2',
    cloudCol: '#f3f8ff', atmoCol: '#7fd4ff',
    seaLevel: 0.52, cloudAmount: 0.55, cloudSharp: 0.52,
    bandFreq: 18, warp: 0.4, storm: 0.0, bumpStrength: 1.3, rimStrength: 1.0,
    sunAzimuth: 52, sunElevation: 12, bloomStrength: 0.32, bloomThreshold: 1.0,
  },
  'Gas giant (Jupiter-like)': {
    surfaceType: 1, yaw: 0.0, cloudYaw: 0.0,
    colA: '#caa978', colB: '#9a6b44', colC: '#6f4a32', colD: '#f0e3c4', colE: '#d8431f',
    cloudCol: '#f0e8d0', atmoCol: '#a9c8ff',
    seaLevel: 0.5, cloudAmount: 0.0, cloudSharp: 0.5,
    bandFreq: 19, warp: 0.46, storm: 1.0, bumpStrength: 0.0, rimStrength: 1.3,
    sunAzimuth: 58, sunElevation: 8, bloomStrength: 0.36, bloomThreshold: 0.95,
  },
  'Ice giant (Neptune-like)': {
    surfaceType: 2, yaw: 0.0, cloudYaw: 0.0,
    colA: '#1b3f86', colB: '#2f6fc0', colC: '#5fa0d8', colD: '#cfe6f6', colE: '#ffffff',
    cloudCol: '#dfeefc', atmoCol: '#8fe0ff',
    seaLevel: 0.5, cloudAmount: 0.0, cloudSharp: 0.5,
    bandFreq: 11, warp: 0.28, storm: 0.5, bumpStrength: 0.0, rimStrength: 1.6,
    sunAzimuth: 50, sunElevation: 14, bloomStrength: 0.34, bloomThreshold: 1.0,
  },
};

const params = {
  preset: 'Gas giant (Jupiter-like)',
  ambient: 0.18, nightAmbient: 0.012, rAtmo: 1.06,
  exposure: 1.0, bloomRadius: 0.6,
  ...structuredClone(PRESETS['Gas giant (Jupiter-like)']),
};

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = params.exposure;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.15, 2.7);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.25;
controls.maxDistance = 12;

const uniforms = {
  uResolution: { value: new THREE.Vector2() },
  uCamWorld: { value: new THREE.Matrix4() },
  uProjInv: { value: new THREE.Matrix4() },
  uLightDir: { value: new THREE.Vector3() },
  uSunColor: { value: new THREE.Color('#fff4e2') },
  uAmbient: { value: 0.18 }, uNightAmbient: { value: 0.012 },
  uSurfaceType: { value: 1 }, uYaw: { value: 0 }, uCloudYaw: { value: 0 },
  uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() },
  uColC: { value: new THREE.Color() }, uColD: { value: new THREE.Color() }, uColE: { value: new THREE.Color() },
  uCloudCol: { value: new THREE.Color() }, uAtmoCol: { value: new THREE.Color() },
  uSeaLevel: { value: 0.5 }, uCloudAmount: { value: 0 }, uCloudSharp: { value: 0.5 },
  uBandFreq: { value: 19 }, uWarp: { value: 0.46 }, uStorm: { value: 1.0 },
  uBumpStrength: { value: 0 }, uRimStrength: { value: 1.3 }, uRAtmo: { value: 1.06 },
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
const filmic = makeFilmicPass({ sharpen: 0.35, aberration: 0.0016, grain: 0.012 });
composer.addPass(filmic);
composer.setPixelRatio(renderer.getPixelRatio());

const gui = new GUI({ title: '02 · surfaces & weather' });
gui.add(params, 'preset', Object.keys(PRESETS)).onChange((n) => {
  Object.assign(params, structuredClone(PRESETS[n]));
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
const fS = gui.addFolder('surface');
fS.add(params, 'yaw', -Math.PI, Math.PI).name('spin');
fS.add(params, 'bandFreq', 4, 40).name('band freq');
fS.add(params, 'warp', 0, 0.8).name('turbulence');
fS.add(params, 'storm', 0, 1.5).name('storm');
fS.add(params, 'seaLevel', 0.3, 0.7).name('sea level');
fS.add(params, 'cloudAmount', 0, 1).name('clouds');
fS.add(params, 'bumpStrength', 0, 3).name('terrain bump');
const fL = gui.addFolder('star');
fL.add(params, 'sunAzimuth', -180, 180);
fL.add(params, 'sunElevation', -60, 70);
fL.add(params, 'ambient', 0, 0.4);
fL.add(params, 'rimStrength', 0, 3).name('atmo rim');
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
  uniforms.uAmbient.value = params.ambient;
  uniforms.uNightAmbient.value = params.nightAmbient;
  uniforms.uSurfaceType.value = params.surfaceType;
  uniforms.uYaw.value = params.yaw;
  uniforms.uCloudYaw.value = params.cloudYaw;
  uniforms.uColA.value.set(params.colA); uniforms.uColB.value.set(params.colB);
  uniforms.uColC.value.set(params.colC); uniforms.uColD.value.set(params.colD);
  uniforms.uColE.value.set(params.colE);
  uniforms.uCloudCol.value.set(params.cloudCol); uniforms.uAtmoCol.value.set(params.atmoCol);
  uniforms.uSeaLevel.value = params.seaLevel;
  uniforms.uCloudAmount.value = params.cloudAmount;
  uniforms.uCloudSharp.value = params.cloudSharp;
  uniforms.uBandFreq.value = params.bandFreq;
  uniforms.uWarp.value = params.warp;
  uniforms.uStorm.value = params.storm;
  uniforms.uBumpStrength.value = params.bumpStrength;
  uniforms.uRimStrength.value = params.rimStrength;
  uniforms.uRAtmo.value = params.rAtmo;

  renderer.toneMappingExposure = params.exposure;
  bloom.strength = params.bloomStrength;
  bloom.radius = params.bloomRadius;
  bloom.threshold = params.bloomThreshold;

  camera.updateMatrixWorld();
  uniforms.uCamWorld.value.copy(camera.matrixWorld);
  uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
  renderer.getDrawingBufferSize(uniforms.uResolution.value);
  filmic.setTexel(uniforms.uResolution.value.x, uniforms.uResolution.value.y);
  filmic.uniforms.uTime.value = performance.now() * 0.001;
}

window.__exo = {
  params,
  applyPreset(n) { Object.assign(params, structuredClone(PRESETS[n])); gui.controllersRecursive().forEach((c) => c.updateDisplay()); },
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
  a.download = `surface-${params.preset.replace(/[^a-z0-9]+/gi,'-')}.png`;
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
