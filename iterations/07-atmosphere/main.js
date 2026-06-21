// Iteration 07 — Atmosphere System.
//
// Focused atmosphere sub-system per board 04: the 6 atmosphere archetypes as tuned
// full-planet limbs, with MULTI-LAYER single scattering (Rayleigh rim + a distinct
// Mie haze band + exosphere fade) — the board's scattering cross-section, made physical.
// Surface + clouds (image), scattering + haze (shader), star color (Planckian algo),
// background (procedural sky engine).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import { makeFilmicPass } from '../shared/post.js';
import { makeSky } from '../shared/sky.js';
import { ATMOSPHERES, MATERIAL_MAPS } from '../../packages/tokens/index.js';

const BASE = '/assets/materials';
const CLOUDS = '/assets/clouds';
const D2R = THREE.MathUtils.degToRad;

// the 6 atmosphere archetypes: atmosphere token + a representative surface + clouds
const SCENES = {
  'Thin atmosphere':  { atmo: 'thin',       surface: 'crust-basaltic',     clouds: { id: 'cloud-broken-deck', amount: 0.7, r: 1.012 }, starTempK: 5400, atmoI: 1.2, veilOp: 0.08 },
  'H2 / He dominant': { atmo: 'h2he',       surface: 'molecular-hydrogen',  tile: { u: 2.5, v: 1 }, clouds: null, starTempK: 6200, atmoI: 1.6, veilOp: 0 },
  'Water vapor rich': { atmo: 'waterVapor', surface: 'ice-shell',           clouds: { id: 'cloud-vapor-deck', amount: 0.92, r: 1.014 }, starTempK: 5800, atmoI: 2.0, veilOp: 0.4 },
  'CO2 dominant':     { atmo: 'co2',        surface: 'crust-basaltic',      clouds: { id: 'cloud-cirrus', amount: 0.22, r: 1.01 }, starTempK: 5200, atmoI: 1.0, veilOp: 0.56, veilColor: '#d98230', haloColor: '#ffae40', surfRough: 0.95 },
  'Methane rich':     { atmo: 'methane',    surface: 'ice-shell',           clouds: null, starTempK: 6400, atmoI: 1.0, veilOp: 0.54, veilColor: '#359699', haloColor: '#52dce6', surfRough: 0.75 },
  'Exotic haze':      { atmo: 'exotic',     surface: 'crust-graphite',      clouds: { id: 'cloud-cirrus', amount: 0.45, r: 1.01 }, starTempK: 4200, atmoI: 3.2, veilOp: 0.62 },
};

const params = {
  scene: 'Thin atmosphere',
  starTempK: 5400, starColorStrength: 2.0, sunAzimuth: -48, sunElevation: 26, autoSpin: false, spinSpeed: 0.06,
  keyLight: 3.4, ambient: 0.16, haloStrength: 1.1,
  rayleigh: 1.0, mie: 1.0, haze: 1.0, atmoIntensity: 1.7, cloudAmount: 1.0,
  nebPalette: 'Deep violet', nebIntensity: 0.6, starDensity: 1.2,
  exposure: 1.0, bloomStrength: 0.3, bloomThreshold: 1.05, contrast: 0.3, saturation: 1.2,
};
let spin = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = params.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(0.0, 0.0, 3.75);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = 1.5; controls.maxDistance = 9;
const HOME = camera.position.clone();
function resetView() { camera.position.copy(HOME); controls.target.set(0, 0, 0); controls.update(); }

const loader = new THREE.TextureLoader();
const sky = makeSky();
scene.add(sky.mesh);

const key = new THREE.DirectionalLight('#ffffff', params.keyLight);
scene.add(key);
const fill = new THREE.HemisphereLight('#2a3d54', '#15171d', params.ambient);
scene.add(fill);

function blackbody(kelvin) {
  const t = kelvin / 100; let r, g, b;
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (x) => Math.max(0, Math.min(255, x)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.bloomStrength, 0.5, params.bloomThreshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const filmic = makeFilmicPass({ sharpen: 0.3, aberration: 0.0015, grain: 0.012, contrast: params.contrast, saturation: params.saturation });
composer.addPass(filmic);
composer.setPixelRatio(renderer.getPixelRatio());

// ---------------------------------------------------------------- planet build
const planet = new THREE.Group();
scene.add(planet);
let B = null;
function tex(path, srgb, list) {
  const t = loader.load(path); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; B.textures.push(t); if (list) list.push(t); return t;
}
function surfaceMat(id, tile, rough) {
  const maps = MATERIAL_MAPS[id] || ['albedo'];
  const get = (m, s) => (maps.includes(m) ? tex(`${BASE}/${id}/${m}.png`, s, B.surfTex) : null);
  // rough override (no roughnessMap) kills specular hotspots on smooth ice/metal surfaces
  const m = new THREE.MeshStandardMaterial({ map: get('albedo', true), normalMap: get('normal', false),
    roughnessMap: rough ? null : get('roughness', false), aoMap: get('ao', false), roughness: rough || 1, metalness: 0 });
  B.tile = tile || null; B.materials.push(m); return m;
}
// colored Fresnel atmosphere halo (glowing limb), sun-aware so the lit limb is brighter
function haloMat(color) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uPow: { value: 3.2 }, uStr: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uColor,uSunDir; uniform float uPow,uStr; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-max(dot(vN,vV),0.0),uPow); float lit=0.3+0.7*max(dot(-vN,uSunDir),0.0); gl_FragColor=vec4(uColor*f*uStr*lit,1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
  });
  B.materials.push(m); B.haloMat = m; return m;
}
function cloudMat(id, amount) {
  const t = tex(`${CLOUDS}/${id}.png`, true, null); t.repeat.set(2, 1);
  const m = new THREE.MeshStandardMaterial({ map: t, alphaMap: t, color: 0xffffff, transparent: true, opacity: amount, roughness: 1, metalness: 0, depthWrite: false });
  m.userData.amt = amount; B.cloudMat = m; B.materials.push(m); return m;
}
function atmoMat(at) {
  const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSunColor: { value: new THREE.Color(at.sunColor) }, uSunIntensity: { value: at.sunIntensity },
      uRPlanet: { value: 1.0 }, uRAtmo: { value: 1.0 + at.height },
      uBetaR: { value: V3(at.betaR) }, uBetaM: { value: V3(at.betaM) }, uBetaA: { value: V3(at.betaA) },
      uMieG: { value: at.mieG }, uHr: { value: at.Hr }, uHm: { value: at.Hm },
      uHazeAmt: { value: at.hazeAmt }, uHazeAlt: { value: at.hazeAlt * at.height }, uHazeWidth: { value: at.hazeWidth * at.height },
      uRayleigh: { value: 1.0 }, uMie: { value: 1.0 }, uIntensity: { value: 1.0 },
    },
    vertexShader: `varying vec3 vWP; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `precision highp float;
      uniform vec3 uSunDir,uSunColor,uBetaR,uBetaM,uBetaA; uniform float uSunIntensity,uRPlanet,uRAtmo,uMieG,uHr,uHm,uHazeAmt,uHazeAlt,uHazeWidth,uRayleigh,uMie,uIntensity; varying vec3 vWP;
      vec2 rs(vec3 ro,vec3 rd,float R){ float b=dot(ro,rd),c=dot(ro,ro)-R*R,h=b*b-c; if(h<0.0)return vec2(1.0,-1.0); h=sqrt(h); return vec2(-b-h,-b+h); }
      float pR(float mu){ return 0.0596831*(1.0+mu*mu); }
      float pM(float mu,float g){ float g2=g*g; return 0.1193662*((1.0-g2)/(pow(max(1.0+g2-2.0*g*mu,1e-4),1.5)*(2.0+g2))); }
      void main(){
        vec3 ro=cameraPosition, rd=normalize(vWP-cameraPosition);
        vec2 a=rs(ro,rd,uRAtmo); if(a.y<a.x) discard;
        float t0=max(a.x,0.0),t1=a.y; vec2 p2=rs(ro,rd,uRPlanet); if(p2.y>=p2.x&&p2.x>0.0)t1=min(t1,p2.x);
        if(t1<=t0) discard; const int VS=16,LS=6; float seg=(t1-t0)/float(VS);
        float mu=dot(rd,uSunDir),pr=pR(mu),pm=pM(mu,uMieG); vec3 sR=vec3(0.0),sM=vec3(0.0); float oR=0.0,oM=0.0;
        for(int i=0;i<VS;i++){
          vec3 p=ro+rd*(t0+seg*(float(i)+0.5)); float h=length(p)-uRPlanet;
          float dR=exp(-h/uHr)*seg;
          float dM=(exp(-h/uHm)+uHazeAmt*exp(-pow((h-uHazeAlt)/max(uHazeWidth,1e-3),2.0)))*seg;
          oR+=dR; oM+=dM;
          vec2 ls=rs(p,uSunDir,uRAtmo); float lseg=max(ls.y,0.0)/float(LS); float lR=0.0,lM=0.0;
          for(int j=0;j<LS;j++){ vec3 lp=p+uSunDir*(lseg*(float(j)+0.5)); float lh=length(lp)-uRPlanet;
            lR+=exp(-lh/uHr)*lseg; lM+=(exp(-lh/uHm)+uHazeAmt*exp(-pow((lh-uHazeAlt)/max(uHazeWidth,1e-3),2.0)))*lseg; }
          vec3 tau=uBetaR*uRayleigh*(oR+lR)+uBetaM*uMie*1.1*(oM+lM)+uBetaA*(oR+lR); vec3 att=exp(-tau);
          sR+=att*dR; sM+=att*dM;
        }
        vec3 col=uSunIntensity*uIntensity*(sR*uBetaR*uRayleigh*pr+sM*uBetaM*uMie*pm)*uSunColor;
        gl_FragColor=vec4(max(col,0.0),1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
  });
  B.atmoMat = m; B.materials.push(m); return m;
}
function mieColor(betaM) { const m = Math.max(...betaM); return new THREE.Color(betaM[0] / m, betaM[1] / m, betaM[2] / m); }
function disposeBuild() {
  if (!B) return;
  for (const o of [...planet.children]) planet.remove(o);
  B.textures.forEach((t) => t.dispose()); B.materials.forEach((m) => m.dispose()); B.geometries.forEach((g) => g.dispose());
}
function buildScene(name) {
  disposeBuild();
  const sc = SCENES[name];
  const at = ATMOSPHERES[sc.atmo];
  B = { textures: [], materials: [], geometries: [], surfTex: [], cloudMat: null, atmoMat: null, veilMat: null, haloMat: null, veilBase: sc.veilOp || 0, tile: null, atmoI: sc.atmoI || 1 };
  const sphere = (r, w = 160, h = 120) => { const g = new THREE.SphereGeometry(r, w, h); B.geometries.push(g); return g; };
  planet.add(new THREE.Mesh(sphere(1.0), surfaceMat(sc.surface, sc.tile, sc.surfRough)));
  // semi-opaque colored haze veil over the surface (lit -> keeps the day/night terminator)
  if (sc.veilOp > 0) {
    const vm = new THREE.MeshStandardMaterial({ color: new THREE.Color(sc.veilColor || mieColor(at.betaM).getStyle()), transparent: true, opacity: sc.veilOp, roughness: 1, metalness: 0, depthWrite: false });
    B.veilMat = vm; B.materials.push(vm);
    planet.add(new THREE.Mesh(sphere(1.004, 96, 64), vm));
  }
  if (sc.clouds) planet.add(new THREE.Mesh(sphere(sc.clouds.r, 120, 90), cloudMat(sc.clouds.id, sc.clouds.amount)));
  planet.add(new THREE.Mesh(sphere(1.0 + at.height, 96, 72), atmoMat(at)));
  // glowing colored limb halo (always-visible)
  planet.add(new THREE.Mesh(sphere(1.0 + at.height, 96, 64), haloMat(sc.haloColor || sc.veilColor || mieColor(at.betaM).getStyle())));
  if (sc.starTempK) params.starTempK = sc.starTempK;
}

// ---------------------------------------------------------------- GUI
const gui = new GUI({ title: '07 · atmosphere system' });
gui.add(params, 'scene', Object.keys(SCENES)).name('archetype').onChange(rebuild);
gui.add({ resetView }, 'resetView').name('⟲ reset view');
const fA = gui.addFolder('atmosphere layers');
fA.add(params, 'rayleigh', 0, 3).name('Rayleigh rim');
fA.add(params, 'mie', 0, 3).name('Mie haze');
fA.add(params, 'haze', 0, 3).name('haze band');
fA.add(params, 'atmoIntensity', 0, 3).name('intensity');
fA.add(params, 'cloudAmount', 0, 1.5).name('clouds');
const fS = gui.addFolder('star & view');
fS.add(params, 'starTempK', 2600, 11000, 100).name('star temp (K)').listen();
fS.add(params, 'starColorStrength', 0, 3).name('star color');
fS.add(params, 'sunAzimuth', -180, 180).name('sun azimuth');
fS.add(params, 'sunElevation', -40, 80).name('sun elevation');
fS.add(params, 'keyLight', 0, 6).name('key');
fS.add(params, 'ambient', 0, 1).name('fill');
fS.add(params, 'autoSpin').name('auto-spin');
const fB = gui.addFolder('background / grade');
fB.add(params, 'nebPalette', ['Teal / magenta', 'Blue / gold', 'Deep violet', 'Emerald dust', 'Crimson', 'Near black']).name('nebula');
fB.add(params, 'nebIntensity', 0, 2).name('nebula amt');
fB.add(params, 'exposure', 0.2, 2.5);
fB.add(params, 'bloomStrength', 0, 1.5).name('bloom');
fB.add(filmic.uniforms.uContrast, 'value', 0, 0.8).name('contrast');
fB.add(filmic.uniforms.uSaturation, 'value', 0.5, 1.6).name('saturation');

function rebuild() { buildScene(params.scene); gui.controllersRecursive().forEach((c) => c.updateDisplay()); }

// ---------------------------------------------------------------- sync + loop
const SUNDIR = new THREE.Vector3();
const fsz = new THREE.Vector2();
const NEB = { 'Teal / magenta': ['#13405a', '#5a1356', '#1a4080'], 'Blue / gold': ['#13285a', '#5a4013', '#1a2848'], 'Deep violet': ['#2a1346', '#13285a', '#3a1340'], 'Emerald dust': ['#134030', '#13305a', '#0a3a2a'], 'Crimson': ['#4a1320', '#2a1340', '#5a2410'], 'Near black': ['#0a0e18', '#10131f', '#0c0a16'] };
function sync(now) {
  if (params.autoSpin) spin = (spin + params.spinSpeed) % 360;
  planet.rotation.y = D2R(spin);
  const az = D2R(params.sunAzimuth), el = D2R(params.sunElevation);
  SUNDIR.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  const starCol = blackbody(params.starTempK);
  const keyCol = starCol.clone(); { const h = {}; keyCol.getHSL(h); keyCol.setHSL(h.h, Math.min(1, h.s * params.starColorStrength), Math.min(1, h.l * 1.05)); }
  key.position.copy(SUNDIR).multiplyScalar(6); key.intensity = params.keyLight; key.color.copy(keyCol);
  fill.intensity = params.ambient; fill.color.copy(keyCol).multiplyScalar(0.6);

  const su = sky.uniforms; su.uTime.value = now * 0.001; su.uLightDir.value.copy(SUNDIR); su.uStarTemp.value = params.starTempK;
  su.uNebIntensity.value = params.nebIntensity; su.uStarDensity.value = params.starDensity;
  const pal = NEB[params.nebPalette]; su.uNebA.value.set(pal[0]); su.uNebB.value.set(pal[1]); su.uNebC.value.set(pal[2]);

  if (B) {
    if (B.tile) for (const t of B.surfTex) t.repeat.set(B.tile.u, B.tile.v);
    if (B.cloudMat) B.cloudMat.opacity = B.cloudMat.userData.amt * params.cloudAmount;
    if (B.veilMat) B.veilMat.opacity = Math.min(1, B.veilBase * params.haze);
    const u = B.atmoMat.uniforms;
    u.uSunDir.value.copy(SUNDIR); u.uSunColor.value.copy(starCol);
    u.uRayleigh.value = params.rayleigh; u.uMie.value = params.mie; u.uIntensity.value = params.atmoIntensity * B.atmoI;
    u.uHazeAmt.value = ATMOSPHERES[SCENES[params.scene].atmo].hazeAmt * params.haze;
    if (B.haloMat) { B.haloMat.uniforms.uSunDir.value.copy(SUNDIR); B.haloMat.uniforms.uStr.value = params.haloStrength; }
  }
  renderer.toneMappingExposure = params.exposure;
  bloom.strength = params.bloomStrength; bloom.threshold = params.bloomThreshold;
  renderer.getDrawingBufferSize(fsz); filmic.setTexel(fsz.x, fsz.y); filmic.uniforms.uTime.value = now * 0.001;
}

window.__exo = {
  params, presets: Object.keys(SCENES),
  applyPreset(n) { if (SCENES[n]) { params.scene = n; rebuild(); } },
  setQuality(_v, _l, pr) { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(window.innerWidth, window.innerHeight); },
  renderOnce() { sync(performance.now()); composer.render(); },
};
window.addEventListener('keydown', (e) => {
  if (e.key !== 'c') return;
  renderer.setPixelRatio(3); composer.setPixelRatio(3); composer.setSize(window.innerWidth, window.innerHeight);
  sync(performance.now()); composer.render();
  const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png');
  a.download = `atmosphere-${params.scene.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`; a.click();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});
const urlS = new URLSearchParams(location.search).get('s');
if (urlS && SCENES[urlS]) params.scene = urlS;
buildScene(params.scene);
gui.controllersRecursive().forEach((c) => c.updateDisplay());
renderer.setAnimationLoop((now) => { controls.update(); sync(now); composer.render(); });
