// Iteration 06 — Planet Studio.
//
// Combines every layer we've built into one configurable real-time scene:
//   • color palette / materials   tokens (image-derived PBR) -> packages/tokens
//   • visual language             shader + filmic grade (contrast/sat/sharpen/grain)
//   • planet anatomy              real wedge geometry + image PBR strata (cutaway toggle)
//   • atmosphere layers           single-scattering shell (shader) + image cloud shell
//   • background & lighting        image equirect skybox (world-locked) + procedural
//                                 parallax star layers + Planckian-locus star color
//
// Per-layer ultra-realism decision: physics/animation in shaders & algorithms,
// static high-frequency pattern (rock, clouds, nebula) from the image API.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import { makeFilmicPass } from '../shared/post.js';
import { makeSky, NEBULA_PALETTES } from './sky.js';
import { COMPOSITIONS, MATERIAL_MAPS, ATMOSPHERES } from '../../packages/tokens/index.js';

const BASE = '/assets/materials';
const CLOUDS = '/assets/clouds';
const D2R = THREE.MathUtils.degToRad;
// viewing-condition presets (sun angle) — full phase / terminator / crescent / backlit
const VIEWS = {
  'Full phase': { az: 30, el: 18 }, 'Terminator': { az: 95, el: 8 }, 'Crescent': { az: 150, el: 6 },
  'Rim-lit / backlit': { az: 196, el: 2 }, 'High noon': { az: 40, el: 62 }, 'Eclipse': { az: 62, el: 20, moon: true },
};

const params = {
  composition: 'Rocky Terrestrial', cutaway: true,
  spinDeg: 192, autoSpin: false, spinSpeed: 0.1,
  starTempK: 5800, starColorStrength: 2.2, sunAzimuth: 42, sunElevation: 24, viewingCondition: 'Full phase',
  keyLight: 2.6, ambient: 0.3, coreLight: 1.0,
  emissiveScale: 1.0, capTiling: 1.7, crustTiling: 6.0, atmoStrength: 1.0, cloudAmount: 1.0,
  showMoon: false, moonAngle: 9, moonDist: 2.8,
  nebPalette: 'Teal / magenta', nebIntensity: 0.9, nebScale: 2.4,
  starDensity: 1.2, starBrightness: 1.3, twinkle: 0.5, starGlowBright: 1.0,
  exposure: 0.95, bloomStrength: 0.22, bloomThreshold: 1.2, contrast: 0.3, saturation: 1.22,
};

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = params.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(1.25, 0.85, 2.85);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.6;
controls.maxDistance = 9;
const HOME = camera.position.clone();
function resetView() { camera.position.copy(HOME); controls.target.set(0, 0, 0); controls.update(); }

const loader = new THREE.TextureLoader();

// procedural space background + star engine (shader; no images)
const sky = makeSky();
scene.add(sky.mesh);

// ---------------------------------------------------------------- lights
const key = new THREE.DirectionalLight('#ffffff', params.keyLight);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 0.5; key.shadow.camera.far = 30;
key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
key.shadow.bias = -0.0006;
scene.add(key, key.target);
const fill = new THREE.HemisphereLight('#2a3d54', '#15171d', params.ambient);
scene.add(fill);
const coreLight = new THREE.PointLight('#ff5a1e', params.coreLight, 3.2, 2.5);
scene.add(coreLight);

// second body (moon) for the eclipse condition — receives the planet's cast shadow
const moonAlb = loader.load(`${BASE}/crust-basaltic/albedo.png`);
moonAlb.colorSpace = THREE.SRGBColorSpace; moonAlb.wrapS = moonAlb.wrapT = THREE.RepeatWrapping; moonAlb.repeat.set(2, 1);
const moonNrm = loader.load(`${BASE}/crust-basaltic/normal.png`);
moonNrm.wrapS = moonNrm.wrapT = THREE.RepeatWrapping; moonNrm.repeat.set(2, 1);
const moon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 48, 32),
  new THREE.MeshStandardMaterial({ map: moonAlb, normalMap: moonNrm, color: 0x9a9a9a, roughness: 1 }));
moon.receiveShadow = true; moon.castShadow = true;
scene.add(moon);

// Planckian-locus blackbody (Tanner-Helland) -> star color from temperature.
function blackbody(kelvin) {
  const t = kelvin / 100;
  let r, g, b;
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (x) => Math.max(0, Math.min(255, x)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}

// ---------------------------------------------------------------- post
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.bloomStrength, 0.5, params.bloomThreshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const filmic = makeFilmicPass({ sharpen: 0.32, aberration: 0.0015, grain: 0.012, contrast: params.contrast, saturation: params.saturation });
composer.addPass(filmic);
composer.setPixelRatio(renderer.getPixelRatio());

// ---------------------------------------------------------------- planet build
const planet = new THREE.Group();
scene.add(planet);
let B = null;

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
    map: get('albedo', true), normalMap: get('normal', false), roughnessMap: get('roughness', false),
    metalnessMap: get('metalness', false), aoMap: get('ao', false), emissiveMap: get('emissive', true),
    emissive: emis > 0 ? new THREE.Color(tint) : new THREE.Color(0x000000), emissiveIntensity: emis,
    roughness: rough, metalness: metal, side: THREE.DoubleSide,
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
function ball(r, full, w = 140, h = 100) {
  const g = full ? new THREE.SphereGeometry(r, w, h) : new THREE.SphereGeometry(r, w, h, 0, Math.PI * 1.5, 0, Math.PI);
  B.geometries.push(g);
  return g;
}
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
function makeAtmoScatter(at) {
  const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSunColor: { value: new THREE.Color(at.sunColor) },
      uSunIntensity: { value: at.sunIntensity }, uRPlanet: { value: 1.0 }, uRAtmo: { value: 1.0 + at.height },
      uBetaR: { value: V3(at.betaR) }, uBetaM: { value: V3(at.betaM) }, uBetaA: { value: V3(at.betaA) },
      uMieG: { value: at.mieG }, uHr: { value: at.Hr }, uHm: { value: at.Hm }, uIntensity: { value: 1.0 },
    },
    vertexShader: `varying vec3 vWP; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `precision highp float;
      uniform vec3 uSunDir,uSunColor,uBetaR,uBetaM,uBetaA; uniform float uSunIntensity,uRPlanet,uRAtmo,uMieG,uHr,uHm,uIntensity; varying vec3 vWP;
      vec2 rs(vec3 ro,vec3 rd,float R){ float b=dot(ro,rd),c=dot(ro,ro)-R*R,h=b*b-c; if(h<0.0)return vec2(1.0,-1.0); h=sqrt(h); return vec2(-b-h,-b+h);}
      float pR(float mu){return 0.0596831*(1.0+mu*mu);}
      float pM(float mu,float g){float g2=g*g;return 0.1193662*((1.0-g2)/(pow(max(1.0+g2-2.0*g*mu,1e-4),1.5)*(2.0+g2)));}
      void main(){
        vec3 ro=cameraPosition, rd=normalize(vWP-cameraPosition);
        vec2 a=rs(ro,rd,uRAtmo); if(a.y<a.x) discard;
        float t0=max(a.x,0.0),t1=a.y; vec2 p2=rs(ro,rd,uRPlanet); if(p2.y>=p2.x&&p2.x>0.0)t1=min(t1,p2.x);
        if(t1<=t0) discard; const int VS=14,LS=6; float seg=(t1-t0)/float(VS);
        float mu=dot(rd,uSunDir),pr=pR(mu),pm=pM(mu,uMieG); vec3 sR=vec3(0.0),sM=vec3(0.0); float oR=0.0,oM=0.0;
        for(int i=0;i<VS;i++){ vec3 p=ro+rd*(t0+seg*(float(i)+0.5)); float h=length(p)-uRPlanet;
          float dR=exp(-h/uHr)*seg,dM=exp(-h/uHm)*seg; oR+=dR; oM+=dM;
          vec2 ls=rs(p,uSunDir,uRAtmo); float lseg=max(ls.y,0.0)/float(LS); float lR=0.0,lM=0.0;
          for(int j=0;j<LS;j++){ vec3 lp=p+uSunDir*(lseg*(float(j)+0.5)); float lh=length(lp)-uRPlanet; lR+=exp(-lh/uHr)*lseg; lM+=exp(-lh/uHm)*lseg; }
          vec3 tau=uBetaR*(oR+lR)+uBetaM*1.1*(oM+lM)+uBetaA*(oR+lR); vec3 at=exp(-tau); sR+=at*dR; sM+=at*dM; }
        gl_FragColor=vec4(max(uSunIntensity*uIntensity*(sR*uBetaR*pr+sM*uBetaM*pm)*uSunColor,0.0),1.0);
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
  if (comp.look) Object.assign(params, comp.look);
  params.keyColor = undefined; // studio drives key color from star temperature
  const full = !params.cutaway;
  B = { textures: [], materials: [], geometries: [], capMats: [], capTex: [], crustTex: [], coreMat: null, shellMat: null, atmoMat: null, cloudMat: null, atmoIntensity: comp.atmo.intensity, cloudBase: comp.clouds ? comp.clouds.amount : 0, exteriorTile: comp.exteriorTile || null };

  if (!full) {
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
    for (let i = 1; i < comp.bands.length; i++) planet.add(new THREE.Mesh(ball(comp.bands[i].r1, false), B.capMats[i]));
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x0b0805, side: THREE.DoubleSide });
    B.materials.push(lineMat);
    for (const rr of [1.0, ...comp.bands.map((b) => b.r0), comp.core.r]) {
      if (rr <= 0.02) continue;
      for (const cap of [capA, capB]) {
        const g = new THREE.RingGeometry(Math.max(rr - 0.004, 0.001), rr + 0.004, 180, 1, Math.PI / 2, Math.PI);
        B.geometries.push(g);
        const m = new THREE.Mesh(g, lineMat); m.position.z = 0.002; cap.add(m);
      }
    }
    B.coreMat = pbrMat(comp.core.id, { emis: comp.core.emis, metal: comp.core.metal, rough: comp.core.rough, tint: comp.core.tint }, B.capTex);
    planet.add(new THREE.Mesh(new THREE.SphereGeometry(comp.core.r, 96, 64), B.coreMat));
    B.geometries.push(planet.children[planet.children.length - 1].geometry);
  }

  // exterior shell (full sphere in studio mode, phi-cut in cutaway mode)
  B.shellMat = pbrMat(comp.exterior, { emis: comp.exteriorEmis || 0, rough: 1.0 }, B.crustTex);
  const shellMesh = new THREE.Mesh(ball(1.0, full, 160, 120), B.shellMat);
  shellMesh.castShadow = true;
  planet.add(shellMesh);

  if (comp.clouds) {
    B.cloudMat = makeCloudMat(comp.clouds.id, comp.clouds.amount);
    planet.add(new THREE.Mesh(ball(comp.clouds.r || 1.012, full, 120, 90), B.cloudMat));
  }

  const at = ATMOSPHERES[comp.atmo.type];
  B.atmoMat = makeAtmoScatter(at);
  planet.add(new THREE.Mesh(ball(1.0 + at.height, full, 96, 72), B.atmoMat));

  planet.rotation.y = D2R(params.spinDeg);
}

// ---------------------------------------------------------------- GUI
const gui = new GUI({ title: '06 · planet studio' });
gui.add(params, 'composition', Object.keys(COMPOSITIONS)).name('archetype').onChange(rebuild);
gui.add(params, 'cutaway').name('cutaway').onChange(rebuild);
gui.add({ resetView }, 'resetView').name('⟲ reset view');
const fScene = gui.addFolder('motion');
fScene.add(params, 'spinDeg', 0, 360).name('reveal / spin').listen();
fScene.add(params, 'autoSpin').name('auto-spin');
fScene.add(params, 'spinSpeed', 0, 1).name('spin speed');
const fStar = gui.addFolder('star & light');
fStar.add(params, 'starTempK', 2600, 11000, 100).name('star temp (K)');
fStar.add(params, 'starColorStrength', 0, 3).name('star color');
fStar.add(params, 'viewingCondition', Object.keys(VIEWS)).name('viewing').onChange(applyView);
fStar.add(params, 'sunAzimuth', -180, 180).name('sun azimuth').listen();
fStar.add(params, 'sunElevation', -40, 80).name('sun elevation').listen();
fStar.add(params, 'keyLight', 0, 6).name('key');
fStar.add(params, 'ambient', 0, 1).name('fill');
fStar.add(params, 'showMoon').name('moon (eclipse)').listen();
fStar.add(params, 'moonAngle', -40, 40).name('moon angle');
fStar.add(params, 'moonDist', 1.8, 5).name('moon dist');
const fAtmo = gui.addFolder('atmosphere & clouds');
fAtmo.add(params, 'atmoStrength', 0, 3).name('atmosphere');
fAtmo.add(params, 'cloudAmount', 0, 1.5).name('clouds');
fAtmo.add(params, 'emissiveScale', 0, 3).name('molten glow');
fAtmo.add(params, 'coreLight', 0, 8).name('core bleed');
const fSky = gui.addFolder('space background');
fSky.add(params, 'nebPalette', Object.keys(NEBULA_PALETTES)).name('nebula palette');
fSky.add(params, 'nebIntensity', 0, 2).name('nebula');
fSky.add(params, 'nebScale', 0.8, 5).name('nebula scale');
fSky.add(params, 'starDensity', 0, 3).name('star density');
fSky.add(params, 'starBrightness', 0, 3).name('star brightness');
fSky.add(params, 'twinkle', 0, 1).name('twinkle');
fSky.add(params, 'starGlowBright', 0, 3).name('star disk');
const fGrade = gui.addFolder('grade');
fGrade.add(params, 'exposure', 0.2, 2.5);
fGrade.add(params, 'bloomStrength', 0, 1.5).name('bloom');
fGrade.add(params, 'bloomThreshold', 0, 2).name('bloom thresh');
fGrade.add(filmic.uniforms.uContrast, 'value', 0, 0.8).name('contrast');
fGrade.add(filmic.uniforms.uSaturation, 'value', 0.5, 1.6).name('saturation');
fGrade.add(filmic.uniforms.uSharpen, 'value', 0, 1).name('sharpen');
fGrade.add(filmic.uniforms.uGrain, 'value', 0, 0.04).name('grain');

function rebuild() { buildPlanet(params.composition); gui.controllersRecursive().forEach((c) => c.updateDisplay()); }
function applyView(n) {
  const v = VIEWS[n];
  params.sunAzimuth = v.az; params.sunElevation = v.el; params.showMoon = !!v.moon;
  if (v.moon && params.cutaway) { params.cutaway = false; buildPlanet(params.composition); }
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}

// ---------------------------------------------------------------- sync + loop
const SUNDIR = new THREE.Vector3();
const filmicSize = new THREE.Vector2();
let last = 0;
function sync(now) {
  const dt = Math.min((now - last) / 1000 || 0, 0.1); last = now;
  if (params.autoSpin) params.spinDeg = (params.spinDeg + params.spinSpeed * 60 * dt) % 360;

  const az = D2R(params.sunAzimuth), el = D2R(params.sunElevation);
  SUNDIR.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  const starCol = blackbody(params.starTempK);
  const keyCol = starCol.clone();
  { const h = {}; keyCol.getHSL(h); keyCol.setHSL(h.h, Math.min(1, h.s * params.starColorStrength), Math.min(1, h.l * 1.05)); }
  key.position.copy(SUNDIR).multiplyScalar(6);
  key.target.position.set(0, 0, 0);
  key.intensity = params.keyLight; key.color.copy(keyCol);
  fill.intensity = params.ambient; fill.color.copy(keyCol).multiplyScalar(0.7);
  coreLight.intensity = params.coreLight;
  moon.visible = params.showMoon;
  if (params.showMoon) {
    const dir = new THREE.Vector3(-1.25, -0.42, 0.18).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), D2R(params.moonAngle));
    moon.position.copy(dir).multiplyScalar(params.moonDist);
    moon.scale.setScalar(1.4);
  }

  // procedural sky engine
  const su = sky.uniforms;
  su.uTime.value = now * 0.001;
  su.uLightDir.value.copy(SUNDIR);
  su.uStarTemp.value = params.starTempK;
  su.uStarBright.value = params.starGlowBright;
  su.uStarDensity.value = params.starDensity;
  su.uStarBrightness.value = params.starBrightness;
  su.uTwinkle.value = params.twinkle;
  su.uNebIntensity.value = params.nebIntensity;
  su.uNebScale.value = params.nebScale;
  const pal = NEBULA_PALETTES[params.nebPalette];
  su.uNebA.value.set(pal[0]); su.uNebB.value.set(pal[1]); su.uNebC.value.set(pal[2]);

  planet.rotation.y = D2R(params.spinDeg);

  if (B) {
    for (const m of B.capMats) m.emissiveIntensity = m.userData.baseEmis * params.emissiveScale;
    if (B.coreMat) B.coreMat.emissiveIntensity = B.coreMat.userData.baseEmis * params.emissiveScale;
    if (B.shellMat.userData.baseEmis > 0) B.shellMat.emissiveIntensity = B.shellMat.userData.baseEmis * params.emissiveScale;
    if (B.cloudMat) B.cloudMat.opacity = B.cloudBase * params.cloudAmount;
    for (const t of B.capTex) t.repeat.set(params.capTiling, params.capTiling);
    const eu = B.exteriorTile ? B.exteriorTile.u : params.crustTiling;
    const ev = B.exteriorTile ? B.exteriorTile.v : params.crustTiling * 0.5;
    for (const t of B.crustTex) t.repeat.set(eu, ev);
    B.atmoMat.uniforms.uSunDir.value.copy(SUNDIR);
    B.atmoMat.uniforms.uSunColor.value.copy(starCol);
    B.atmoMat.uniforms.uIntensity.value = B.atmoIntensity * params.atmoStrength;
  }

  renderer.toneMappingExposure = params.exposure;
  bloom.strength = params.bloomStrength; bloom.threshold = params.bloomThreshold;
  renderer.getDrawingBufferSize(filmicSize);
  filmic.setTexel(filmicSize.x, filmicSize.y);
  filmic.uniforms.uTime.value = now * 0.001;
}

window.__exo = {
  params,
  applyPreset(n) { if (COMPOSITIONS[n]) { params.composition = n; rebuild(); } },
  presets: Object.keys(COMPOSITIONS),
  setQuality(_vs, _ls, pr) { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(window.innerWidth, window.innerHeight); },
  renderOnce() { sync(performance.now()); composer.render(); },
};

window.addEventListener('keydown', (e) => {
  if (e.key !== 'c') return;
  renderer.setPixelRatio(3); composer.setPixelRatio(3); composer.setSize(window.innerWidth, window.innerHeight);
  sync(performance.now()); composer.render();
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `studio-${params.composition.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  a.click();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});

const urlC = new URLSearchParams(location.search).get('c');
if (urlC && COMPOSITIONS[urlC]) params.composition = urlC;
if (new URLSearchParams(location.search).get('full') === '1') params.cutaway = false;
buildPlanet(params.composition);
gui.controllersRecursive().forEach((c) => c.updateDisplay());
renderer.setAnimationLoop((now) => { controls.update(); sync(now); composer.render(); });
