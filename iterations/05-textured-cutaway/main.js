// Iteration 05 — Textured PBR cutaway (composition-driven).
//
// Real Three.js geometry: a wedge-removed planet whose cut faces show photoreal
// strata from authored PBR material sets. Composition-driven — pick an archetype
// and the engine rebuilds the bands / shells / core / atmosphere from data
// (compositions.js). First real piece of `planet-engine`.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import { makeFilmicPass } from '../shared/post.js';
import { makeSky } from '../shared/sky.js';
import { COMPOSITIONS, MATERIAL_MAPS, ATMOSPHERES } from '../../packages/tokens/index.js';

const BASE = '/assets/materials';
const D2R = THREE.MathUtils.degToRad;

const params = {
  composition: 'Rocky Terrestrial',
  sunAzimuth: 40, sunElevation: 26,
  keyLight: 2.8, keyColor: '#ffffff', ambient: 0.42, coreLight: 1.0,
  emissiveScale: 1.0, capTiling: 1.7, crustTiling: 6.0,
  spinDeg: 192, atmoStrength: 1.0,
  exposure: 0.95, bloomStrength: 0.26, bloomRadius: 0.5, bloomThreshold: 1.2,
};

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = params.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04060a');
// subtle env reflections so metals + the diamond layer read (kept low for the dark mood)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(1.25, 0.85, 2.75);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.8;
controls.maxDistance = 9;
const HOME = camera.position.clone();
function resetView() { camera.position.copy(HOME); controls.target.set(0, 0, 0); controls.update(); }

// lights (static; live across rebuilds)
const key = new THREE.DirectionalLight('#ffffff', params.keyLight);
scene.add(key);
const fill = new THREE.HemisphereLight('#2a3d54', '#15171d', params.ambient);
scene.add(fill);
const coreLight = new THREE.PointLight('#ff5a1e', params.coreLight, 3.2, 2.5);
scene.add(coreLight); // at origin -> molten bleed onto cut faces (range kept tight)

// starfield (static)
{
  const N = 1400, pos = new Float32Array(N * 3);
  let seed = 1234.567;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    const r = 30 + rnd() * 30, u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb4cc, size: 0.09, sizeAttenuation: true })));
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.bloomStrength, params.bloomRadius, params.bloomThreshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const filmic = makeFilmicPass({ sharpen: 0.32, aberration: 0.0015, grain: 0.012, contrast: 0.3, saturation: 1.14 });
composer.addPass(filmic);
composer.setPixelRatio(renderer.getPixelRatio());

// ---------------------------------------------------------------- planet build
const planet = new THREE.Group();
scene.add(planet);
const loader = new THREE.TextureLoader();
let B = null; // current build state (rebuilt per archetype)

// procedural space background (shared shader engine; no images)
const CLOUDS = '/assets/clouds';
const sky = makeSky();
scene.add(sky.mesh);

function tex(path, srgb, tilingList) {
  const t = loader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  B.textures.push(t);
  if (tilingList) tilingList.push(t);
  return t;
}
function pbrMat(id, { emis = 0, metal = 0, rough = 1, tint = 0xffffff }, tilingList) {
  const maps = MATERIAL_MAPS[id] || ['albedo'];
  const get = (m, srgb) => (maps.includes(m) ? tex(`${BASE}/${id}/${m}.png`, srgb, tilingList) : null);
  const mat = new THREE.MeshStandardMaterial({
    map: get('albedo', true),
    normalMap: get('normal', false),
    roughnessMap: get('roughness', false),
    metalnessMap: get('metalness', false),
    aoMap: get('ao', false),
    emissiveMap: get('emissive', true),
    emissive: emis > 0 ? new THREE.Color(tint) : new THREE.Color(0x000000),
    emissiveIntensity: emis,
    roughness: rough, metalness: metal,
    side: THREE.DoubleSide,
  });
  mat.userData.baseEmis = emis;
  B.materials.push(mat);
  return mat;
}
function planarRing(r0, r1) {
  const g = new THREE.RingGeometry(r0, r1, 160, 1, Math.PI / 2, Math.PI);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i));
  uv.needsUpdate = true;
  B.geometries.push(g);
  return g;
}
function phiSphere(r, w = 140, h = 100) {
  const g = new THREE.SphereGeometry(r, w, h, 0, Math.PI * 1.5, 0, Math.PI);
  B.geometries.push(g);
  return g;
}
// Lit cloud shell: white-on-black cloud tile -> map (color) + alphaMap (opacity from
// luminance). MeshStandardMaterial so the star lights it (day clouds bright, night dark).
function makeCloudMat(id, amount) {
  const t = tex(`${CLOUDS}/${id}.png`, true, null);
  t.repeat.set(2, 1);
  const m = new THREE.MeshStandardMaterial({
    map: t, alphaMap: t, color: 0xffffff, transparent: true, opacity: amount,
    roughness: 1, metalness: 0, depthWrite: false, side: THREE.FrontSide,
  });
  B.materials.push(m);
  return m;
}
// Single-scattering atmosphere shell (Rayleigh + Mie + absorption), raymarched on a
// back-side sphere. Real view/light-dependent rim, terminator, transmission, per-gas
// color. Coefficients come from the atmosphere token; uSunDir / uIntensity are live.
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function makeAtmoScatter(at) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: new THREE.Color(at.sunColor) },
      uSunIntensity: { value: at.sunIntensity },
      uRPlanet: { value: 1.0 }, uRAtmo: { value: 1.0 + at.height },
      uBetaR: { value: V3(at.betaR) }, uBetaM: { value: V3(at.betaM) }, uBetaA: { value: V3(at.betaA) },
      uMieG: { value: at.mieG }, uHr: { value: at.Hr }, uHm: { value: at.Hm }, uIntensity: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vWP;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uSunDir, uSunColor, uBetaR, uBetaM, uBetaA;
      uniform float uSunIntensity, uRPlanet, uRAtmo, uMieG, uHr, uHm, uIntensity;
      varying vec3 vWP;
      vec2 raySphere(vec3 ro, vec3 rd, float R){ float b=dot(ro,rd); float c=dot(ro,ro)-R*R; float h=b*b-c;
        if(h<0.0) return vec2(1.0,-1.0); h=sqrt(h); return vec2(-b-h,-b+h); }
      float phaseR(float mu){ return 0.0596831*(1.0+mu*mu); }
      float phaseM(float mu,float g){ float g2=g*g; return 0.1193662*((1.0-g2)/(pow(max(1.0+g2-2.0*g*mu,1e-4),1.5)*(2.0+g2))); }
      void main(){
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vWP - cameraPosition);
        vec2 a = raySphere(ro, rd, uRAtmo);
        if(a.y < a.x){ discard; }
        float tStart = max(a.x, 0.0), tEnd = a.y;
        vec2 p2 = raySphere(ro, rd, uRPlanet);
        if(p2.y >= p2.x && p2.x > 0.0) tEnd = min(tEnd, p2.x);
        if(tEnd <= tStart){ discard; }
        const int VS=14; const int LS=6;
        float seg=(tEnd-tStart)/float(VS);
        float mu=dot(rd,uSunDir);
        float pr=phaseR(mu), pm=phaseM(mu,uMieG);
        vec3 sumR=vec3(0.0), sumM=vec3(0.0);
        float odR=0.0, odM=0.0;
        for(int i=0;i<VS;i++){
          vec3 p=ro+rd*(tStart+seg*(float(i)+0.5));
          float h=length(p)-uRPlanet;
          float dR=exp(-h/uHr)*seg, dM=exp(-h/uHm)*seg;
          odR+=dR; odM+=dM;
          vec2 ls=raySphere(p,uSunDir,uRAtmo);
          float lseg=max(ls.y,0.0)/float(LS);
          float lodR=0.0, lodM=0.0;
          for(int j=0;j<LS;j++){ vec3 lp=p+uSunDir*(lseg*(float(j)+0.5)); float lh=length(lp)-uRPlanet;
            lodR+=exp(-lh/uHr)*lseg; lodM+=exp(-lh/uHm)*lseg; }
          vec3 tau = uBetaR*(odR+lodR) + uBetaM*1.1*(odM+lodM) + uBetaA*(odR+lodR);
          vec3 attn = exp(-tau);
          sumR += attn*dR; sumM += attn*dM;
        }
        vec3 col = uSunIntensity*uIntensity*(sumR*uBetaR*pr + sumM*uBetaM*pm)*uSunColor;
        gl_FragColor = vec4(max(col,0.0), 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
  });
  B.materials.push(m);
  return m;
}

function disposeBuild() {
  if (!B) return;
  for (const o of [...planet.children]) planet.remove(o);
  B.textures.forEach((t) => t.dispose());
  B.materials.forEach((m) => m.dispose());
  B.geometries.forEach((g) => g.dispose());
}

function buildPlanet(name) {
  disposeBuild();
  const comp = COMPOSITIONS[name];
  params.keyColor = '#ffffff'; // neutral default; look may override (e.g. lava warm)
  if (comp.look) Object.assign(params, comp.look); // per-archetype lighting/post
  B = { textures: [], materials: [], geometries: [], capMats: [], capTex: [], crustTex: [], coreMat: null, shellMat: null, atmoMat: null, atmoIntensity: comp.atmo.intensity, exteriorTile: comp.exteriorTile || null };

  // two cut faces (90 deg wedge): capA in XY plane, capB rotated -90 about Y.
  const capA = new THREE.Group(), capB = new THREE.Group();
  capB.rotation.y = -Math.PI / 2;
  planet.add(capA, capB);

  comp.bands.forEach((b) => {
    const mat = pbrMat(b.id, { emis: b.emis, metal: b.metal, rough: b.rough, tint: b.tint }, B.capTex);
    B.capMats.push(mat);
    const geo = planarRing(b.r0, b.r1);
    capA.add(new THREE.Mesh(geo, mat));
    capB.add(new THREE.Mesh(geo, mat));
  });

  // nested phi-cut shells (inner bands) -> concentric receding domes in the wedge
  for (let i = 1; i < comp.bands.length; i++) {
    planet.add(new THREE.Mesh(phiSphere(comp.bands[i].r1), B.capMats[i]));
  }

  // interface lines at every boundary on both faces
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x0b0805, side: THREE.DoubleSide });
  B.materials.push(lineMat);
  const radii = [1.0, ...comp.bands.map((b) => b.r0), comp.core.r];
  for (const rr of radii) {
    if (rr <= 0.02) continue;
    for (const cap of [capA, capB]) {
      const g = new THREE.RingGeometry(Math.max(rr - 0.004, 0.001), rr + 0.004, 180, 1, Math.PI / 2, Math.PI);
      B.geometries.push(g);
      const m = new THREE.Mesh(g, lineMat); m.position.z = 0.002; cap.add(m);
    }
  }

  // inner-core orb
  B.coreMat = pbrMat(comp.core.id, { emis: comp.core.emis, metal: comp.core.metal, rough: comp.core.rough, tint: comp.core.tint }, B.capTex);
  const cg = new THREE.SphereGeometry(comp.core.r, 96, 64); B.geometries.push(cg);
  planet.add(new THREE.Mesh(cg, B.coreMat));

  // exterior shell (phi-cut, double-sided for interior wall)
  B.shellMat = pbrMat(comp.exterior, { emis: comp.exteriorEmis || 0, rough: 1.0 }, B.crustTex);
  planet.add(new THREE.Mesh(phiSphere(1.0, 160, 120), B.shellMat));

  // cloud shell (lit-side detail) if the archetype has one
  if (comp.clouds) {
    planet.add(new THREE.Mesh(phiSphere(comp.clouds.r || 1.012, 120, 90), makeCloudMat(comp.clouds.id, comp.clouds.amount)));
  }

  // atmosphere: single-scattering shell (phi-cut, skips the opening)
  const at = ATMOSPHERES[comp.atmo.type];
  B.atmoMat = makeAtmoScatter(at);
  planet.add(new THREE.Mesh(phiSphere(1.0 + at.height, 96, 72), B.atmoMat));

  planet.rotation.y = D2R(params.spinDeg);
}

// ---------------------------------------------------------------- GUI
const gui = new GUI({ title: '05 · textured PBR cutaway' });
gui.add(params, 'composition', Object.keys(COMPOSITIONS)).name('archetype').onChange(applyComposition);
gui.add({ resetView }, 'resetView').name('⟲ reset view');
const fG = gui.addFolder('geometry');
fG.add(params, 'spinDeg', 0, 360).name('reveal angle');
fG.add(params, 'capTiling', 0.5, 6).name('strata tiling');
fG.add(params, 'crustTiling', 1, 12).name('crust tiling');
const fM = gui.addFolder('material glow');
fM.add(params, 'emissiveScale', 0, 3).name('molten intensity');
fM.add(params, 'coreLight', 0, 8).name('core bleed');
fM.add(params, 'atmoStrength', 0, 3).name('atmo rim');
const fS = gui.addFolder('star / light');
fS.add(params, 'sunAzimuth', -180, 180);
fS.add(params, 'sunElevation', -40, 80);
fS.add(params, 'keyLight', 0, 6).name('key');
fS.add(params, 'ambient', 0, 1).name('fill');
const fP = gui.addFolder('post');
fP.add(params, 'exposure', 0.2, 2.5);
fP.add(params, 'bloomStrength', 0, 2);
fP.add(params, 'bloomThreshold', 0, 2);
fP.add(filmic.uniforms.uContrast, 'value', 0, 0.8).name('contrast');
fP.add(filmic.uniforms.uSaturation, 'value', 0.5, 1.6).name('saturation');
fP.add(filmic.uniforms.uSharpen, 'value', 0, 1).name('sharpen');
fP.add(filmic.uniforms.uGrain, 'value', 0, 0.04).name('grain');

function applyComposition(name) {
  buildPlanet(name);
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}

// ---------------------------------------------------------------- sync + loop
const filmicSize = new THREE.Vector2();
const SUNDIR = new THREE.Vector3();
function sync() {
  const az = D2R(params.sunAzimuth), el = D2R(params.sunElevation);
  SUNDIR.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  key.position.copy(SUNDIR).multiplyScalar(6);
  key.intensity = params.keyLight;
  key.color.set(params.keyColor);
  sky.uniforms.uTime.value = performance.now() * 0.001;
  sky.uniforms.uLightDir.value.copy(SUNDIR);
  fill.intensity = params.ambient;
  coreLight.intensity = params.coreLight;
  planet.rotation.y = D2R(params.spinDeg);

  if (B) {
    for (const m of B.capMats) m.emissiveIntensity = m.userData.baseEmis * params.emissiveScale;
    B.coreMat.emissiveIntensity = B.coreMat.userData.baseEmis * params.emissiveScale;
    if (B.shellMat.userData.baseEmis > 0) B.shellMat.emissiveIntensity = B.shellMat.userData.baseEmis * params.emissiveScale;
    for (const t of B.capTex) t.repeat.set(params.capTiling, params.capTiling);
    const eu = B.exteriorTile ? B.exteriorTile.u : params.crustTiling;
    const ev = B.exteriorTile ? B.exteriorTile.v : params.crustTiling * 0.5;
    for (const t of B.crustTex) t.repeat.set(eu, ev);
    B.atmoMat.uniforms.uSunDir.value.copy(SUNDIR);
    B.atmoMat.uniforms.uIntensity.value = B.atmoIntensity * params.atmoStrength;
  }

  renderer.toneMappingExposure = params.exposure;
  bloom.strength = params.bloomStrength; bloom.radius = params.bloomRadius; bloom.threshold = params.bloomThreshold;
  renderer.getDrawingBufferSize(filmicSize);
  filmic.setTexel(filmicSize.x, filmicSize.y);
  filmic.uniforms.uTime.value = performance.now() * 0.001;
}

// ---------------------------------------------------------------- capture contract
window.__exo = {
  params,
  applyPreset(n) { if (COMPOSITIONS[n]) { params.composition = n; applyComposition(n); } },
  presets: Object.keys(COMPOSITIONS),
  setQuality(_vs, _ls, pixelRatio) {
    renderer.setPixelRatio(pixelRatio);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
  },
  renderOnce() { sync(); composer.render(); },
};

window.addEventListener('keydown', (e) => {
  if (e.key !== 'c') return;
  renderer.setPixelRatio(3); composer.setPixelRatio(3); composer.setSize(window.innerWidth, window.innerHeight);
  sync(); composer.render();
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `cutaway-${params.composition.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  a.click();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// initial archetype can be set via ?c=<name> (so captures load textures up front)
const urlC = new URLSearchParams(location.search).get('c');
if (urlC && COMPOSITIONS[urlC]) params.composition = urlC;

buildPlanet(params.composition);
gui.controllersRecursive().forEach((c) => c.updateDisplay());
renderer.setAnimationLoop(() => { controls.update(); sync(); composer.render(); });
