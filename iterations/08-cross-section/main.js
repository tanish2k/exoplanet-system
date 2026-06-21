// Iteration 08 — Scattering Cross-Section (board 04 §2).
//
// A limb close-up showing the atmosphere's distinct altitude layers — surface,
// troposphere/cloud deck, haze layer, scattering rim, exosphere fade — annotated with
// leader lines + pressure ranges, plus the incoming-starlight interaction (Rayleigh
// blue / Mie white / rim transmission amber). Every layer and scattering term is a knob.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import { makeFilmicPass } from '../shared/post.js';
import { makeSky } from '../shared/sky.js';
import { MATERIAL_MAPS } from '../../packages/tokens/index.js';

const BASE = '/assets/materials';
const D2R = THREE.MathUtils.degToRad;

// base (Earth-like) atmosphere — exaggerated thickness so the layers read in cross-section
const atmo = {
  betaR: [5.5, 13.0, 22.4], betaM: [4, 4, 4], betaA: [0.3, 0.7, 1.4],
  mieG: 0.76, Hr: 0.06, Hm: 0.05, height: 0.2,
};
// altitude layers (rAlt = fraction of atmosphere height; pressure ranges from the board)
const LAYERS = [
  { id: 'exosphere', name: 'EXOSPHERE FADE', sub: '~10⁻⁶–10⁻⁸ BAR', rAlt: 1.0, col: '#9fc0e0' },
  { id: 'rim',       name: 'SCATTERING RIM', sub: '~10⁻⁴–10⁻² BAR', rAlt: 0.62, col: '#7fb4ff' },
  { id: 'haze',      name: 'HAZE LAYER', sub: '~10⁻²–10⁻¹ BAR', rAlt: 0.36, col: '#cdd8e6' },
  { id: 'tropo',     name: 'TROPOSPHERE / CLOUD DECK', sub: '~10⁻¹–1 BAR', rAlt: 0.16, col: '#dfe9f2' },
  { id: 'surface',   name: 'SURFACE', sub: '', rAlt: 0.0, col: '#b7a489' },
];
// incoming-starlight interaction labels (arrow tints)
const SCATTER = [
  { id: 'rayleigh', name: 'RAYLEIGH SCATTERING', sub: 'short λ scattered (blue)', col: '#5aa0ff' },
  { id: 'mie',      name: 'MIE SCATTERING (HAZE)', sub: 'larger particles (white)', col: '#dfe6ee' },
  { id: 'trans',    name: 'RIM TRANSMISSION', sub: 'transmitted through limb (amber)', col: '#ffae4a' },
];

const params = {
  sunAzimuth: 132, sunElevation: 26,
  rayleigh: 1.0, mie: 1.0, hazeAmt: 0.5, hazeAlt: 0.35, hazeWidth: 0.22,
  rimHeight: 1.0, exoScale: 1.0, transmission: 1.0, rimGlow: 0.6, haloStrength: 0.8,
  cloudOpacity: 0.8, cloudAlt: 0.06, atmoIntensity: 2.8,
  keyLight: 2.6, ambient: 0.14, annotations: 'layers',
  exposure: 1.0, bloomStrength: 0.55, bloomThreshold: 0.85,
};

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = params.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(0.5, 0.4, 2.95);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = 1.4; controls.maxDistance = 8;
controls.target.set(0.5, 0.4, 0);
controls.update();
const HOME = { p: camera.position.clone(), t: controls.target.clone() };
function resetView() { camera.position.copy(HOME.p); controls.target.copy(HOME.t); controls.update(); }

const loader = new THREE.TextureLoader();
const sky = makeSky();
sky.uniforms.uNebIntensity.value = 0.35; sky.uniforms.uStarDensity.value = 1.0;
scene.add(sky.mesh);

const key = new THREE.DirectionalLight('#fff4e6', params.keyLight);
scene.add(key);
const fill = new THREE.HemisphereLight('#22344a', '#14171d', params.ambient);
scene.add(fill);

// ---- planet: surface + cloud deck + multi-layer atmosphere ----
const tex = (path, srgb, list) => { const t = loader.load(path); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; if (list) list.push(t); return t; };
const surfTex = [];
const sMaps = MATERIAL_MAPS['crust-basaltic'];
const surfMat = new THREE.MeshStandardMaterial({
  map: tex(`${BASE}/crust-basaltic/albedo.png`, true, surfTex),
  normalMap: sMaps.includes('normal') ? tex(`${BASE}/crust-basaltic/normal.png`, false, surfTex) : null,
  roughnessMap: sMaps.includes('roughness') ? tex(`${BASE}/crust-basaltic/roughness.png`, false, surfTex) : null,
  roughness: 1, metalness: 0,
});
surfTex.forEach((t) => t.repeat.set(3, 2));
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 200, 140), surfMat));

const cloudT = tex('/assets/clouds/cloud-broken-deck.png', true, []); cloudT.repeat.set(2, 1);
const cloudMat = new THREE.MeshStandardMaterial({ map: cloudT, alphaMap: cloudT, color: 0xffffff, transparent: true, opacity: params.cloudOpacity, roughness: 1, metalness: 0, depthWrite: false });
const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 140, 100), cloudMat);
scene.add(cloudMesh);

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const atmoMat = new THREE.ShaderMaterial({
  uniforms: {
    uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSunColor: { value: new THREE.Color('#fff4e6') }, uSunIntensity: { value: 16 },
    uRPlanet: { value: 1.0 }, uRAtmo: { value: 1.0 + atmo.height },
    uBetaR: { value: V3(atmo.betaR) }, uBetaM: { value: V3(atmo.betaM) }, uBetaA: { value: V3(atmo.betaA) },
    uMieG: { value: atmo.mieG }, uHr: { value: atmo.Hr }, uHm: { value: atmo.Hm },
    uHazeAmt: { value: atmo.hazeAmt * atmo.height }, uHazeAlt: { value: 0 }, uHazeWidth: { value: 0 },
    uRayleigh: { value: 1 }, uMie: { value: 1 }, uTrans: { value: 1 }, uIntensity: { value: 1.4 }, uRimGlow: { value: 0.9 },
  },
  vertexShader: `varying vec3 vWP; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `precision highp float;
    uniform vec3 uSunDir,uSunColor,uBetaR,uBetaM,uBetaA; uniform float uSunIntensity,uRPlanet,uRAtmo,uMieG,uHr,uHm,uHazeAmt,uHazeAlt,uHazeWidth,uRayleigh,uMie,uTrans,uIntensity,uRimGlow; varying vec3 vWP;
    vec2 rs(vec3 ro,vec3 rd,float R){ float b=dot(ro,rd),c=dot(ro,ro)-R*R,h=b*b-c; if(h<0.0)return vec2(1.0,-1.0); h=sqrt(h); return vec2(-b-h,-b+h); }
    float pR(float mu){ return 0.0596831*(1.0+mu*mu); }
    float pM(float mu,float g){ float g2=g*g; return 0.1193662*((1.0-g2)/(pow(max(1.0+g2-2.0*g*mu,1e-4),1.5)*(2.0+g2))); }
    void main(){
      vec3 ro=cameraPosition, rd=normalize(vWP-cameraPosition);
      vec2 a=rs(ro,rd,uRAtmo); if(a.y<a.x) discard;
      float t0=max(a.x,0.0),t1=a.y; vec2 p2=rs(ro,rd,uRPlanet); if(p2.y>=p2.x&&p2.x>0.0)t1=min(t1,p2.x);
      if(t1<=t0) discard; const int VS=20,LS=8; float seg=(t1-t0)/float(VS);
      float mu=dot(rd,uSunDir),pr=pR(mu),pm=pM(mu,uMieG); vec3 sR=vec3(0.0),sM=vec3(0.0); float oR=0.0,oM=0.0;
      for(int i=0;i<VS;i++){
        vec3 p=ro+rd*(t0+seg*(float(i)+0.5)); float h=length(p)-uRPlanet;
        float dR=exp(-h/uHr)*seg;
        float dM=(exp(-h/uHm)+uHazeAmt*exp(-pow((h-uHazeAlt)/max(uHazeWidth,1e-3),2.0)))*seg;
        oR+=dR; oM+=dM;
        vec2 ls=rs(p,uSunDir,uRAtmo); float lseg=max(ls.y,0.0)/float(LS); float lR=0.0,lM=0.0;
        for(int j=0;j<LS;j++){ vec3 lp=p+uSunDir*(lseg*(float(j)+0.5)); float lh=length(lp)-uRPlanet;
          lR+=exp(-lh/uHr)*lseg; lM+=(exp(-lh/uHm)+uHazeAmt*exp(-pow((lh-uHazeAlt)/max(uHazeWidth,1e-3),2.0)))*lseg; }
        vec3 tau=uBetaR*uRayleigh*(oR+lR)+uBetaM*uMie*1.1*(oM+lM)+uBetaA*uTrans*(oR+lR); vec3 att=exp(-tau);
        sR+=att*dR; sM+=att*dM;
      }
      vec3 col=uSunIntensity*uIntensity*(sR*uBetaR*uRayleigh*pr+sM*uBetaM*uMie*pm)*uSunColor;
      // always-visible limb glow: scales with the atmosphere chord (max at the limb),
      // tinted by the Rayleigh color, so the atmosphere reads from any view angle.
      float chord = clamp((t1 - t0) / (2.0 * (uRAtmo - uRPlanet)), 0.0, 1.0);
      vec3 rimN = uBetaR / max(uBetaR.r, max(uBetaR.g, uBetaR.b));
      col += rimN * pow(chord, 2.0) * uRimGlow;
      gl_FragColor=vec4(max(col,0.0),1.0);
    }`,
  transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
});
const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0 + atmo.height, 120, 90), atmoMat);
scene.add(atmoMesh);

// always-visible Fresnel limb halo (reads from any angle; the scattering shell above
// adds the sun-dependent forward-scatter realism on top)
const haloMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color('#7cb0ff') }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uPow: { value: 4.3 }, uStr: { value: 0.9 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `uniform vec3 uColor,uSunDir; uniform float uPow,uStr; varying vec3 vN; varying vec3 vV;
    void main(){ float f=pow(1.0-max(dot(vN,vV),0.0),uPow); float lit=0.32+0.68*max(dot(-vN,uSunDir),0.0); gl_FragColor=vec4(uColor*f*uStr*lit,1.0); }`,
  transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
});
const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0 + atmo.height, 96, 64), haloMat);
scene.add(haloMesh);

// ---- post ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.bloomStrength, 0.55, params.bloomThreshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const filmic = makeFilmicPass({ sharpen: 0.3, aberration: 0.0014, grain: 0.012, contrast: 0.28, saturation: 1.18 });
composer.addPass(filmic);
composer.setPixelRatio(renderer.getPixelRatio());

// ---- annotation overlay ----
const svg = document.getElementById('leaders');
const labelsEl = document.getElementById('labels');
const ANCHOR = new THREE.Vector3(0.42, 0.86, 0.30).normalize();   // along the visible limb (layers)
const SUN_ANCHOR = new THREE.Vector3(0.58, 0.72, 0.34).normalize(); // glowing-rim point for light interaction
const ui = {};
function mkLabel(item, side) {
  const el = document.createElement('div'); el.className = `lbl ${side}`;
  el.innerHTML = `<div class="name">${item.name}</div>${item.sub ? `<div class="sub">${item.sub}</div>` : ''}`;
  labelsEl.appendChild(el);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); line.setAttribute('fill', 'none'); line.setAttribute('stroke', item.col); line.setAttribute('stroke-width', '1'); line.setAttribute('opacity', '0.8'); svg.appendChild(line);
  const dot = document.createElement('div'); dot.className = 'dot'; dot.style.background = item.col; labelsEl.appendChild(dot);
  ui[item.id] = { el, line, dot };
}
LAYERS.forEach((l) => mkLabel(l, 'r'));
SCATTER.forEach((s) => mkLabel(s, 'r'));
const toScreen = (wp) => { const v = wp.clone().project(camera); return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, vis: v.z < 1 }; };

function updateAnnotations() {
  const showL = params.annotations === 'layers' || params.annotations === 'both';
  const showS = params.annotations === 'light' || params.annotations === 'both';
  const H = atmo.height * params.exoScale;
  const W = window.innerWidth, Hh = window.innerHeight;
  // layer labels: stacked on the right, leader lines to altitude anchors
  LAYERS.forEach((L, i) => {
    const u = ui[L.id]; const on = showL;
    u.el.style.display = u.dot.style.display = u.line.style.display = on ? '' : 'none';
    if (!on) return;
    const r = 1.0 + L.rAlt * H;
    const s = toScreen(planetRot(ANCHOR).multiplyScalar(r));
    const lx = W * 0.58, ly = Hh * (0.13 + i * 0.135);
    u.el.style.left = (lx + 14) + 'px'; u.el.style.top = (ly - 10) + 'px';
    u.dot.style.left = s.x + 'px'; u.dot.style.top = s.y + 'px';
    u.line.setAttribute('points', `${s.x},${s.y} ${lx},${ly} ${lx + 10},${ly}`);
  });
  // scattering interaction: arrows from a limb point outward, labels on the right
  SCATTER.forEach((S, i) => {
    const u = ui[S.id]; const on = showS;
    u.el.style.display = u.dot.style.display = u.line.style.display = on ? '' : 'none';
    if (!on) return;
    const base = toScreen(planetRot(SUN_ANCHOR).multiplyScalar(1.0 + 0.5 * H));
    const lx = W * 0.58, ly = Hh * (0.66 + i * 0.11);
    u.el.style.left = (lx + 14) + 'px'; u.el.style.top = (ly - 10) + 'px';
    u.dot.style.left = base.x + 'px'; u.dot.style.top = base.y + 'px';
    u.line.setAttribute('points', `${base.x},${base.y} ${lx},${ly} ${lx + 10},${ly}`);
  });
}
function planetRot(v) { return v.clone(); }

// ---- GUI ----
const gui = new GUI({ title: '08 · scattering cross-section' });
gui.add({ resetView }, 'resetView').name('⟲ reset view');
gui.add(params, 'annotations', ['layers', 'light', 'both', 'none']).name('annotations');
const fL = gui.addFolder('atmosphere layers');
fL.add(params, 'cloudOpacity', 0, 1).name('troposphere / cloud');
fL.add(params, 'hazeAmt', 0, 2).name('haze amount');
fL.add(params, 'hazeAlt', 0, 1).name('haze altitude');
fL.add(params, 'rimHeight', 0.3, 2).name('scattering rim');
fL.add(params, 'exoScale', 0.5, 2).name('exosphere extent');
const fS = gui.addFolder('light scattering');
fS.add(params, 'rayleigh', 0, 3).name('Rayleigh (blue)');
fS.add(params, 'mie', 0, 3).name('Mie haze (white)');
fS.add(params, 'transmission', 0, 3).name('rim transmission (amber)');
fS.add(params, 'rimGlow', 0, 2).name('scatter limb glow');
fS.add(params, 'haloStrength', 0, 3).name('atmosphere halo');
fS.add(params, 'atmoIntensity', 0, 3).name('intensity');
const fG = gui.addFolder('star & grade');
fG.add(params, 'sunAzimuth', -180, 180).name('sun azimuth');
fG.add(params, 'sunElevation', -40, 80).name('sun elevation');
fG.add(params, 'keyLight', 0, 6).name('key');
fG.add(params, 'exposure', 0.2, 2.5);
fG.add(params, 'bloomStrength', 0, 1.5).name('bloom');

// ---- sync + loop ----
const SUNDIR = new THREE.Vector3();
const fsz = new THREE.Vector2();
let lastRAtmo = 1.0 + atmo.height;
function sync(now) {
  const az = D2R(params.sunAzimuth), el = D2R(params.sunElevation);
  SUNDIR.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  key.position.copy(SUNDIR).multiplyScalar(6); key.intensity = params.keyLight; fill.intensity = params.ambient;
  cloudMat.opacity = params.cloudOpacity;

  const u = atmoMat.uniforms;
  u.uSunDir.value.copy(SUNDIR);
  u.uRAtmo.value = 1.0 + atmo.height * params.exoScale;
  u.uHr.value = atmo.Hr * params.rimHeight;
  u.uHazeAmt.value = atmo.hazeAmt * params.hazeAmt;
  u.uHazeAlt.value = params.hazeAlt * atmo.height * params.exoScale;
  u.uHazeWidth.value = atmo.hazeWidth * atmo.height;
  u.uRayleigh.value = params.rayleigh; u.uMie.value = params.mie; u.uTrans.value = params.transmission; u.uIntensity.value = params.atmoIntensity; u.uRimGlow.value = params.rimGlow;
  if (Math.abs(u.uRAtmo.value - lastRAtmo) > 1e-4) { // keep mesh radii in sync with exosphere extent
    atmoMesh.geometry.dispose(); atmoMesh.geometry = new THREE.SphereGeometry(u.uRAtmo.value, 120, 90);
    haloMesh.geometry.dispose(); haloMesh.geometry = new THREE.SphereGeometry(u.uRAtmo.value, 96, 64);
    lastRAtmo = u.uRAtmo.value;
  }
  haloMat.uniforms.uStr.value = params.haloStrength;
  haloMat.uniforms.uSunDir.value.copy(SUNDIR);

  sky.uniforms.uTime.value = now * 0.001; sky.uniforms.uLightDir.value.copy(SUNDIR);
  renderer.toneMappingExposure = params.exposure;
  bloom.strength = params.bloomStrength; bloom.threshold = params.bloomThreshold;
  renderer.getDrawingBufferSize(fsz); filmic.setTexel(fsz.x, fsz.y); filmic.uniforms.uTime.value = now * 0.001;
  updateAnnotations();
}

window.__exo = {
  params, presets: ['cross-section'], applyPreset() {},
  setQuality(_v, _l, pr) { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(window.innerWidth, window.innerHeight); },
  renderOnce() { sync(performance.now()); composer.render(); updateAnnotations(); },
};
window.addEventListener('keydown', (e) => { if (e.key !== 'c') return;
  renderer.setPixelRatio(3); composer.setPixelRatio(3); composer.setSize(window.innerWidth, window.innerHeight);
  sync(performance.now()); composer.render();
  const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = 'cross-section.png'; a.click();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight); });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); });

renderer.setAnimationLoop((now) => { controls.update(); sync(now); composer.render(); });
