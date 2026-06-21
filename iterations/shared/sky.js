// Procedural space background + star engine (shader, no images). Shared across probes.
// World-locked skybox sphere: multi-layer procedural starfield (density + per-star
// color + twinkle), two-octave fbm nebula (palette-driven, with filament detail), and
// a Planckian star disk + glow in the light direction. All code -> relights with star
// temperature and parallaxes correctly as the camera orbits.
import * as THREE from 'three';

export const NEBULA_PALETTES = {
  'Teal / magenta': ['#13405a', '#5a1356', '#1a4080'],
  'Blue / gold':    ['#13285a', '#5a4013', '#1a2848'],
  'Deep violet':    ['#2a1346', '#13285a', '#3a1340'],
  'Emerald dust':   ['#134030', '#13305a', '#0a3a2a'],
  'Crimson':        ['#4a1320', '#2a1340', '#5a2410'],
  'Near black':     ['#0a0e18', '#10131f', '#0c0a16'],
};

export function makeSky() {
  const C = (h) => new THREE.Color(h);
  const pal = NEBULA_PALETTES['Teal / magenta'];
  const uniforms = {
    uTime: { value: 0 },
    uLightDir: { value: new THREE.Vector3(1, 0, 0) },
    uStarTemp: { value: 5800 },
    uStarSize: { value: 0.016 }, uStarBright: { value: 1.0 },
    uStarDensity: { value: 1.2 }, uStarBrightness: { value: 1.3 }, uTwinkle: { value: 0.5 },
    uNebIntensity: { value: 0.9 }, uNebScale: { value: 2.4 },
    uNebA: { value: C(pal[0]) }, uNebB: { value: C(pal[1]) }, uNebC: { value: C(pal[2]) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float;
      varying vec3 vDir;
      uniform float uTime,uStarTemp,uStarSize,uStarBright,uStarDensity,uStarBrightness,uTwinkle,uNebIntensity,uNebScale;
      uniform vec3 uLightDir,uNebA,uNebB,uNebC;
      float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
      float vnoise(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash13(i),b=hash13(i+vec3(1,0,0)),c=hash13(i+vec3(0,1,0)),d=hash13(i+vec3(1,1,0));
        float e=hash13(i+vec3(0,0,1)),f2=hash13(i+vec3(1,0,1)),g=hash13(i+vec3(0,1,1)),h=hash13(i+vec3(1,1,1));
        return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,f2,f.x),mix(g,h,f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=0.5,v=0.0; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.13+vec3(11.7,5.3,2.9); a*=0.5; } return v; }
      vec3 blackbody(float k){ float t=clamp(k,1000.0,40000.0)/100.0; float r,g,b;
        r=t<=66.0?255.0:329.698727446*pow(t-60.0,-0.1332047592);
        g=t<=66.0?99.4708025861*log(t)-161.1195681661:288.1221695283*pow(t-60.0,-0.0755148492);
        b=t>=66.0?255.0:(t<=19.0?0.0:138.5177312231*log(t-10.0)-305.0447927307);
        return clamp(vec3(r,g,b)/255.0,0.0,1.0); }
      vec3 starLayer(vec3 rd,float scale,float seed){
        vec3 cell=floor(rd*scale+seed); float h=hash13(cell);
        float thr=1.0-uStarDensity*0.0045; if(h<thr) return vec3(0.0);
        float b=pow((h-thr)/max(1.0-thr,1e-4),6.0);
        float ct=hash13(cell+5.0);
        vec3 sc=mix(vec3(0.62,0.72,1.0),vec3(1.0,0.9,0.72),ct);
        float tw=0.7+0.3*sin(uTime*3.0+h*120.0);
        return sc*b*uStarBrightness*mix(1.0,tw,uTwinkle); }
      void main(){
        vec3 rd=normalize(vDir); vec3 col=vec3(0.0);
        float n1=fbm(rd*uNebScale+3.0), n2=fbm(rd*uNebScale*2.1+11.0);
        float neb=pow(max(n1-0.42,0.0)*2.0,2.0);
        float fil=pow(max(fbm(rd*uNebScale*3.3+21.0)-0.5,0.0)*2.0,1.5);
        vec3 nebCol=mix(uNebA,uNebB,n2);
        nebCol=mix(nebCol,uNebC,smoothstep(0.45,0.9,fbm(rd*uNebScale*0.7+7.0)));
        col += nebCol*neb*uNebIntensity*5.5;
        col += nebCol*fil*neb*uNebIntensity*3.0;
        col += starLayer(rd,170.0,0.0)+starLayer(rd,300.0,23.0)+starLayer(rd,520.0,61.0);
        float d=dot(rd,normalize(uLightDir)); float ca=cos(uStarSize); vec3 ssc=blackbody(uStarTemp);
        float disk=smoothstep(ca-0.002,ca+0.0008,d);
        float glow=pow(max(d,0.0),900.0)*0.5+pow(max(d,0.0),60.0)*0.05;
        col += ssc*(disk*uStarBright*18.0+glow*uStarBright);
        gl_FragColor=vec4(col,1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms, material };
}
