// Iteration 04 — lighting & star types fidelity probe.
// A star's temperature (Kelvin) drives its color via the Planckian locus
// (blackbody radiation). That one color lights the planet, tints the
// atmospheric rim, and colors the visible star disk. Scenarios: terminator,
// crescent, full phase, and star-system context with a moon. Raytraced here.

uniform vec2  uResolution;
uniform mat4  uCamWorld;
uniform mat4  uProjInv;

uniform vec3  uLightDir;       // FROM planet TO star (also the star's screen direction)
uniform float uStarTemp;       // Kelvin
uniform float uStarBright;
uniform float uStarAngRad;     // angular radius of the star disk
uniform float uStarGlow;

uniform vec3  uColA;           // planet band palette (kept neutral so star color reads)
uniform vec3  uColB;
uniform vec3  uColC;
uniform vec3  uCloudCol;
uniform float uCloudAmount;
uniform vec3  uAtmoCol;
uniform float uRimStrength;
uniform float uBandFreq;
uniform float uWarp;
uniform float uAmbient;
uniform float uNightAmbient;
uniform float uYaw;

uniform int   uShowMoon;
uniform vec3  uMoonPos;
uniform float uMoonRadius;

const float PI = 3.14159265359;

// ---------- noise ----------
float hash13(vec3 p) { p = fract(p*0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  float n000=hash13(i+vec3(0,0,0)),n100=hash13(i+vec3(1,0,0)),n010=hash13(i+vec3(0,1,0)),n110=hash13(i+vec3(1,1,0));
  float n001=hash13(i+vec3(0,0,1)),n101=hash13(i+vec3(1,0,1)),n011=hash13(i+vec3(0,1,1)),n111=hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=0.5,v=0.0; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.13+vec3(11.7,5.3,2.9); a*=0.5; } return v; }
vec3 fbm3(vec3 p){ return vec3(fbm(p), fbm(p+vec3(19.1,7.7,3.3)), fbm(p+vec3(2.9,23.4,14.1))); }

vec2 raySphere(vec3 ro, vec3 rd, vec3 ce, float radius) {
  vec3 oc = ro - ce;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - radius*radius;
  float disc = b*b - c;
  if (disc < 0.0) return vec2(1e9, -1e9);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}
vec3 rotY(vec3 p, float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }
vec3 camPos(){ return uCamWorld[3].xyz; }

// ---------- Planckian locus: blackbody temperature -> RGB ----------
// Tanner Helland approximation, good from ~1000K to ~40000K.
vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  float r, g, b;
  if (t <= 66.0) r = 255.0;
  else r = 329.698727446 * pow(t - 60.0, -0.1332047592);
  if (t <= 66.0) g = 99.4708025861 * log(t) - 161.1195681661;
  else g = 288.1221695283 * pow(t - 60.0, -0.0755148492);
  if (t >= 66.0) b = 255.0;
  else if (t <= 19.0) b = 0.0;
  else b = 138.5177312231 * log(t - 10.0) - 305.0447927307;
  return clamp(vec3(r, g, b) / 255.0, 0.0, 1.0);
}

vec3 starColor() { return blackbody(uStarTemp); }

vec3 background(vec3 rd) {
  vec3 col = vec3(0.0);
  vec3 cell = floor(rd * 240.0);
  float s = hash13(cell);
  if (s > 0.9976) {
    float tw = hash13(cell + 17.0);
    col += mix(vec3(0.7,0.8,1.0), vec3(1.0,0.85,0.7), tw) * pow((s-0.9976)/0.0024, 2.0) * 2.0;
  }
  float neb = pow(max(fbm(rd*2.6 + vec3(4.2,1.7,8.3)) - 0.46, 0.0) * 1.8, 2.2);
  col += mix(vec3(0.12,0.05,0.26), vec3(0.04,0.10,0.24), fbm(rd*1.3+3.0)) * neb * 0.22;
  return col;
}

// visible star disk + glow in the star direction
vec3 starGlow(vec3 rd) {
  float d = dot(rd, uLightDir);
  float ca = cos(uStarAngRad);
  vec3 sc = starColor();
  float disk = smoothstep(ca - 0.0015, ca + 0.0008, d);
  float glow = pow(max(d, 0.0), uStarGlow) * 0.6 + pow(max(d, 0.0), 2200.0) * 6.0;
  return sc * (disk * uStarBright * 14.0 + glow * uStarBright);
}

// ---------- planet (neutral banded body so star color tints it) ----------
vec3 planetAlbedo(vec3 sp) {
  vec3 q = sp + (fbm3(sp*1.8) - 0.5) * uWarp;
  q += (fbm3(q*5.5) - 0.5) * uWarp * 0.35;
  float band = sin(q.y * uBandFreq) * 0.5 + 0.5;
  band = mix(band, fbm(vec3(q.y*uBandFreq*2.2, q.x*2.0, q.z*2.0)), 0.45);
  vec3 col = mix(uColA, uColB, smoothstep(0.25, 0.75, band));
  col = mix(col, uColC, smoothstep(0.6, 0.95, fbm(q*3.0)) * 0.4);
  col *= 0.85 + 0.3 * fbm(vec3(q.x*12.0, q.y*40.0, q.z*12.0));
  return col;
}

vec3 shadePlanet(vec3 p) {
  vec3 n = normalize(p);
  vec3 sp = rotY(n, uYaw);
  vec3 viewDir = normalize(camPos() - p);
  vec3 sc = starColor();

  vec3 albedo = planetAlbedo(sp);
  float ndl = dot(n, uLightDir);
  float day = smoothstep(-0.12, 0.22, ndl) * max(ndl, 0.0);
  // limb darkening on the lit hemisphere
  float limb = 0.4 + 0.6 * max(dot(n, viewDir), 0.0);
  vec3 lit = albedo * day * sc * limb + albedo * uNightAmbient;
  lit += albedo * uAmbient * max(ndl, 0.0) * 0.2;

  // clouds
  if (uCloudAmount > 0.001) {
    float c = smoothstep(0.55, 1.0, fbm(sp*3.2 + 1.6*fbm(sp*1.6))) * uCloudAmount;
    lit = mix(lit, uCloudCol * (day + uNightAmbient*2.0) * sc, c);
  }

  // atmospheric rim, tinted partway toward the star color
  vec3 rimCol = mix(uAtmoCol, sc, 0.58);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  lit += rimCol * fres * uRimStrength * smoothstep(-0.25, 0.4, ndl);
  return lit;
}

// ---------- moon (rocky, can fall in the planet's shadow = eclipse) ----------
vec3 shadeMoon(vec3 p) {
  vec3 c = uMoonPos;
  vec3 n = normalize(p - c);
  vec3 sc = starColor();
  float craters = fbm((p - c) * 14.0);
  vec3 albedo = mix(vec3(0.32,0.30,0.28), vec3(0.55,0.52,0.48), craters);
  float ndl = max(dot(n, uLightDir), 0.0);
  // planet shadow test: is the path from this point toward the star blocked?
  vec2 sh = raySphere(p, uLightDir, vec3(0.0), 1.0);
  float shadow = (sh.x > 0.0 && sh.x < sh.y) ? 0.06 : 1.0;
  vec3 lit = albedo * ndl * sc * shadow + albedo * uNightAmbient * 0.5;
  return lit;
}

void main() {
  vec2 px = gl_FragCoord.xy / uResolution;
  vec3 ro = camPos();
  vec4 pv = uProjInv * vec4(px*2.0 - 1.0, 0.5, 1.0); pv /= pv.w;
  vec3 rd = normalize((uCamWorld * vec4(pv.xyz, 1.0)).xyz - ro);

  vec2 hP = raySphere(ro, rd, vec3(0.0), 1.0);
  float bestT = 1e9; int hit = -1; vec3 hp = vec3(0.0);
  if (hP.x > 0.0 && hP.x < hP.y) { bestT = hP.x; hit = 0; hp = ro + rd*hP.x; }
  if (uShowMoon == 1) {
    vec2 hM = raySphere(ro, rd, uMoonPos, uMoonRadius);
    if (hM.x > 0.0 && hM.x < bestT) { bestT = hM.x; hit = 1; hp = ro + rd*hM.x; }
  }

  vec3 color;
  if (hit == 0)      color = shadePlanet(hp);
  else if (hit == 1) color = shadeMoon(hp);
  else {
    color = background(rd) + starGlow(rd);
    // planet silhouette halo, tinted toward the star
    float tca = max(dot(-ro, rd), 0.0);
    vec3 pca = ro + rd*tca; float dca = length(pca);
    if (dca > 0.98 && dca < 1.08) {
      float glow = smoothstep(1.08, 0.99, dca);
      float lf = smoothstep(-0.2, 0.6, dot(normalize(pca), uLightDir));
      color += mix(uAtmoCol, starColor(), 0.55) * glow * (0.2 + 0.8*lf) * 0.9;
    }
  }

  color += (hash13(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
