// Iteration 02 — surface detail & weather fidelity probe.
// Full-sphere planet raytraced in a fragment shader. Three surface algorithms:
//   0 terrestrial — fBm continents, oceans w/ specular, cloud shell, ice caps
//   1 gas giant   — domain-warped turbulent bands + a Great-Red-Spot vortex
//   2 ice giant   — softer banding, high-altitude haze
// Atmospheric rim + silhouette halo, AgX + bloom in the post chain.

uniform vec2  uResolution;
uniform mat4  uCamWorld;
uniform mat4  uProjInv;

uniform vec3  uLightDir;     // FROM planet TO star
uniform vec3  uSunColor;
uniform float uAmbient;
uniform float uNightAmbient;

uniform int   uSurfaceType;
uniform float uYaw;          // spin the planet body
uniform float uCloudYaw;     // spin clouds independently

uniform vec3  uColA;
uniform vec3  uColB;
uniform vec3  uColC;
uniform vec3  uColD;
uniform vec3  uColE;
uniform vec3  uCloudCol;
uniform vec3  uAtmoCol;

uniform float uSeaLevel;
uniform float uCloudAmount;
uniform float uCloudSharp;
uniform float uBandFreq;
uniform float uWarp;
uniform float uStorm;
uniform float uBumpStrength;
uniform float uRimStrength;
uniform float uRAtmo;

const float PI = 3.14159265359;

// ---------- noise ----------
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000=hash13(i+vec3(0,0,0)), n100=hash13(i+vec3(1,0,0));
  float n010=hash13(i+vec3(0,1,0)), n110=hash13(i+vec3(1,1,0));
  float n001=hash13(i+vec3(0,0,1)), n101=hash13(i+vec3(1,0,1));
  float n011=hash13(i+vec3(0,1,1)), n111=hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
             mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
}
float fbm(vec3 p) {
  float a = 0.5, v = 0.0;
  for (int i = 0; i < 6; i++) { v += a*vnoise(p); p = p*2.13 + vec3(11.7,5.3,2.9); a *= 0.5; }
  return v;
}
vec3 fbm3(vec3 p) {
  return vec3(fbm(p), fbm(p + vec3(19.1, 7.7, 3.3)), fbm(p + vec3(2.9, 23.4, 14.1)));
}

vec2 raySphere(vec3 ro, vec3 rd, float radius) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - radius*radius;
  float disc = b*b - c;
  if (disc < 0.0) return vec2(1e9, -1e9);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}
vec3 rotY(vec3 p, float a) { float c=cos(a), s=sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
vec3 camPos() { return uCamWorld[3].xyz; }

vec3 background(vec3 rd) {
  vec3 col = vec3(0.0);
  vec3 cell = floor(rd * 220.0);
  float star = hash13(cell);
  if (star > 0.9975) {
    float tw = hash13(cell + 17.0);
    float mag = pow((star - 0.9975) / 0.0025, 2.0);
    col += mix(vec3(0.7,0.8,1.0), vec3(1.0,0.85,0.7), tw) * mag * 2.0;
  }
  float neb = fbm(rd * 2.6 + vec3(4.2,1.7,8.3));
  neb = pow(max(neb - 0.45, 0.0) * 1.8, 2.2);
  col += mix(vec3(0.14,0.05,0.28), vec3(0.04,0.11,0.26), fbm(rd*1.3+3.0)) * neb * 0.24;
  col += uSunColor * pow(max(dot(rd, uLightDir),0.0), 5000.0) * 60.0 * 0.02;
  return col;
}

// ---------- terrestrial ----------
float terrHeight(vec3 sp) { return fbm(sp * 2.6 + 2.0 * fbm(sp * 1.3)); }

vec3 terrestrial(vec3 sp, inout vec3 n, out float water) {
  float h = terrHeight(sp);
  float detail = fbm(sp * 11.0);
  float landAmt = max(h - uSeaLevel, 0.0);
  water = 0.0;
  vec3 col;
  if (h < uSeaLevel) {
    float depth = uSeaLevel - h;
    col = mix(uColB, uColA, smoothstep(0.0, 0.16, depth)); // shallow -> deep
    water = 1.0;
  } else {
    col = mix(uColC * (0.85 + 0.3*detail), uColD, smoothstep(0.02, 0.16, landAmt)); // green -> arid highland
    col = mix(col, uColE * 0.7, smoothstep(0.20, 0.30, landAmt)); // bare rock peaks
  }
  // polar ice caps (land ices over slightly less readily than open sea)
  float ice = smoothstep(0.64, 0.82, abs(sp.y) + fbm(sp * 5.0) * 0.12 - landAmt * 0.5);
  col = mix(col, uColE, clamp(ice, 0.0, 1.0));
  // perturb normal over land only (oceans stay smooth for specular)
  if (water < 0.5) {
    float e = 0.012, h0 = terrHeight(sp);
    vec3 g = vec3(terrHeight(sp+vec3(e,0,0))-h0, terrHeight(sp+vec3(0,e,0))-h0, terrHeight(sp+vec3(0,0,e))-h0);
    g -= n * dot(g, n);
    n = normalize(n - g * uBumpStrength);
  }
  return col;
}

float clouds(vec3 sp) {
  vec3 q = rotY(sp, uCloudYaw);
  float c = fbm(q * 3.2 + 1.7 * fbm(q * 1.6));
  return smoothstep(uCloudSharp, 1.0, c) * uCloudAmount;
}

// ---------- gas / ice giant bands ----------
vec3 giantBands(vec3 sp, float softness) {
  // domain warp: turn flat latitude bands into turbulent flowing ones
  vec3 w1 = fbm3(sp * 1.8) - 0.5;
  vec3 q = sp + w1 * uWarp;
  vec3 w2 = fbm3(q * 5.5) - 0.5;
  q += w2 * uWarp * 0.35;

  float lat = q.y;
  // layered band signal
  float band = sin(lat * uBandFreq) * 0.5 + 0.5;
  band = mix(band, fbm(vec3(lat * uBandFreq * 2.2, q.x * 2.0, q.z * 2.0)), 0.45);
  band = mix(band, 0.5, softness); // ice giants are softer

  vec3 col = mix(uColA, uColB, smoothstep(0.25, 0.75, band));
  col = mix(col, uColC, smoothstep(0.55, 0.95, fbm(q * 3.0)) * 0.5);
  col = mix(col, uColD, smoothstep(0.7, 0.95, band) * 0.4); // bright zones

  // fine streaky turbulence along longitude
  float streak = fbm(vec3(q.x * 14.0, lat * 50.0, q.z * 14.0));
  col *= 0.82 + 0.36 * streak;

  // Great Red Spot — a placed vortex in the southern bands.
  // Build the oval in a local tangent frame so it stays a clean ellipse.
  vec3 spotDir = normalize(vec3(cos(1.1), -0.34, sin(1.1)));
  vec3 t1 = normalize(cross(spotDir, vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(spotDir, t1);
  vec2 lp = vec2(dot(sp, t1), dot(sp, t2));
  float dist = length(lp / vec2(0.30, 0.18));
  float spot = smoothstep(1.0, 0.55, dist) * uStorm;
  // spiral swirl inside the vortex — strong noise variation gives the banded eye
  float spin = atan(lp.y, lp.x) + dist * 5.0;
  float sw = fbm(vec3(cos(spin), sin(spin), dist * 3.5) * 3.2 + spotDir * 5.0);
  // storm tint comes from the palette (uColE): red-orange for gas, white for ice
  vec3 sDeep   = uColE * 0.60;
  vec3 sBright = mix(uColE, vec3(1.0), 0.25);
  vec3 spotCol = mix(sDeep, sBright, sw);
  spotCol = mix(spotCol, sDeep * 0.7, smoothstep(0.5, 1.0, dist)); // darker outer ring
  col = mix(col, spotCol, spot);

  return col;
}

// ---------- assemble surface ----------
vec3 shadeSurface(vec3 p) {
  vec3 n = normalize(p);
  vec3 viewDir = normalize(camPos() - p);
  vec3 sp = rotY(n, uYaw);

  vec3 albedo; float water = 0.0;
  if (uSurfaceType == 0)      albedo = terrestrial(sp, n, water);
  else if (uSurfaceType == 1) albedo = giantBands(sp, 0.0);
  else                        albedo = giantBands(sp, 0.45);

  float ndl = dot(n, uLightDir);
  float day = smoothstep(-0.10, 0.25, ndl) * max(ndl, 0.0);
  vec3 lit = albedo * day * uSunColor + albedo * uNightAmbient;
  lit += albedo * uAmbient * max(ndl, 0.0) * 0.2;

  // specular sun-glint on oceans
  if (water > 0.5) {
    vec3 h = normalize(uLightDir + viewDir);
    float s = pow(max(dot(n, h), 0.0), 80.0);
    lit += uSunColor * s * 0.9 * day;
  }

  // cloud shell (terrestrial)
  if (uSurfaceType == 0) {
    float c = clouds(sp);
    vec3 cloudLit = uCloudCol * (day + uNightAmbient * 2.0) * uSunColor;
    lit = mix(lit, cloudLit, c);
  }

  // atmospheric rim on the lit limb
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  lit += uAtmoCol * fres * uRimStrength * smoothstep(-0.25, 0.35, ndl);
  return lit;
}

void main() {
  vec2 px = gl_FragCoord.xy / uResolution;
  vec3 ro = camPos();
  vec4 pv = uProjInv * vec4(px * 2.0 - 1.0, 0.5, 1.0); pv /= pv.w;
  vec3 rd = normalize((uCamWorld * vec4(pv.xyz, 1.0)).xyz - ro);

  vec2 hit = raySphere(ro, rd, 1.0);
  vec3 color;
  if (hit.x > 0.0 && hit.x < hit.y) {
    color = shadeSurface(ro + rd * hit.x);
  } else {
    color = background(rd);
    // silhouette halo
    float tca = max(dot(-ro, rd), 0.0);
    vec3 pca = ro + rd * tca;
    float dca = length(pca);
    if (dca > 0.98 && dca < uRAtmo) {
      float glow = smoothstep(uRAtmo, 0.99, dca);
      float lf = smoothstep(-0.2, 0.6, dot(normalize(pca), uLightDir));
      color += uAtmoCol * glow * (0.2 + 0.8 * lf) * 0.9;
    }
  }

  color += (hash13(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
