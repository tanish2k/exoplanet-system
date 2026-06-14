// Iteration 01 — atmosphere & rim scattering fidelity probe.
// Whole scene is raytraced in this fragment shader: planet sphere,
// single-scattering atmosphere (Rayleigh + Mie + absorption), star,
// starfield and nebula background. HDR linear output; AgX + bloom
// happen in the post chain.

uniform vec2  uResolution;
uniform mat4  uCamWorld;
uniform mat4  uProjInv;

uniform vec3  uLightDir;       // FROM planet TO star (normalized)
uniform vec3  uSunColor;
uniform float uSunIntensity;

uniform float uAtmoHeight;     // atmosphere shell thickness, planet radius = 1
uniform float uHr;             // Rayleigh scale height
uniform float uHm;             // Mie scale height
uniform vec3  uBetaR;          // Rayleigh scattering coefficients
uniform vec3  uBetaM;          // Mie scattering coefficients (tintable for exotic haze)
uniform vec3  uBetaA;          // absorption coefficients (e.g. methane eats red)
uniform float uMieG;           // Henyey-Greenstein anisotropy

uniform int   uViewSteps;
uniform int   uLightSteps;

uniform int   uSurfaceMode;    // 0 rocky, 1 banded gas, 2 smooth
uniform vec3  uSurfColA;
uniform vec3  uSurfColB;
uniform float uNightAmbient;

const float R_PLANET = 1.0;
const float PI = 3.14159265359;

// ---------- noise ----------
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0,0,0));
  float n100 = hash13(i + vec3(1,0,0));
  float n010 = hash13(i + vec3(0,1,0));
  float n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1));
  float n101 = hash13(i + vec3(1,0,1));
  float n011 = hash13(i + vec3(0,1,1));
  float n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

float fbm(vec3 p) {
  float a = 0.5;
  float v = 0.0;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.13 + vec3(11.7, 5.3, 2.9);
    a *= 0.5;
  }
  return v;
}

// ---------- intersection ----------
// returns (tNear, tFar); misses give tNear > tFar
vec2 raySphere(vec3 ro, vec3 rd, float radius) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - radius * radius;
  float disc = b * b - c;
  if (disc < 0.0) return vec2(1e9, -1e9);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

// ---------- phase functions ----------
float phaseRayleigh(float mu) {
  return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
}
float phaseHG(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
}

// optical depth from p toward the star, through the shell
vec2 lightOpticalDepth(vec3 p) {
  float rAtmo = R_PLANET + uAtmoHeight;
  vec2 hit = raySphere(p, uLightDir, rAtmo);
  float pathLen = max(hit.y, 0.0);
  float dt = pathLen / float(uLightSteps);
  float odR = 0.0;
  float odM = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= uLightSteps) break;
    vec3 q = p + uLightDir * ((float(i) + 0.5) * dt);
    float h = max(length(q) - R_PLANET, 0.0);
    odR += exp(-h / uHr) * dt;
    odM += exp(-h / uHm) * dt;
  }
  return vec2(odR, odM);
}

// ---------- surface ----------
vec3 shadeSurface(vec3 p, vec3 rd) {
  vec3 n = normalize(p);
  vec3 albedo;

  if (uSurfaceMode == 0) {
    // rocky: domain-warped fbm continents + craters feel
    vec3 q = p * 4.0;
    float w = fbm(q + 2.0 * fbm(q * 0.5));
    float detail = fbm(q * 6.0);
    albedo = mix(uSurfColA, uSurfColB, smoothstep(0.35, 0.75, w));
    albedo *= 0.75 + 0.5 * detail;
    // cheap normal perturbation for terrain feel
    float e = 0.02;
    float hx = fbm((p + vec3(e,0,0)) * 6.0) - fbm((p - vec3(e,0,0)) * 6.0);
    float hy = fbm((p + vec3(0,e,0)) * 6.0) - fbm((p - vec3(0,e,0)) * 6.0);
    float hz = fbm((p + vec3(0,0,e)) * 6.0) - fbm((p - vec3(0,0,e)) * 6.0);
    n = normalize(n + 1.4 * vec3(hx, hy, hz));
  } else if (uSurfaceMode == 1) {
    // banded gas: latitude stripes warped by flow noise
    float lat = asin(clamp(p.y / length(p), -1.0, 1.0));
    float warp = fbm(p * 3.0) * 0.35 + fbm(p * 9.0) * 0.12;
    float bands = sin(lat * 18.0 + warp * 14.0) * 0.5 + 0.5;
    bands = smoothstep(0.15, 0.85, bands);
    albedo = mix(uSurfColA, uSurfColB, bands);
    float storm = smoothstep(0.62, 0.78, fbm(p * 5.0 + vec3(7.1)));
    albedo = mix(albedo, uSurfColB * 1.25, storm * 0.35);
  } else {
    // smooth haze ball: barely-there texture, atmosphere does the talking
    float w = fbm(p * 3.0);
    albedo = mix(uSurfColA, uSurfColB, w * 0.4);
  }

  float ndl = dot(n, uLightDir);
  float day = smoothstep(-0.08, 0.25, ndl) * max(ndl, 0.0);
  vec3 lit = albedo * day * uSunColor;

  // faint night side so the dark limb never goes to pure black
  lit += albedo * uNightAmbient;
  return lit;
}

// ---------- background ----------
vec3 background(vec3 rd) {
  // starfield: hashed cells on the direction vector
  vec3 col = vec3(0.0);
  vec3 cell = floor(rd * 220.0);
  float star = hash13(cell);
  if (star > 0.9975) {
    float tw = hash13(cell + 17.0);
    float mag = pow((star - 0.9975) / 0.0025, 2.0);
    vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), tw);
    col += tint * mag * 2.2;
  }
  // faint nebula
  float neb = fbm(rd * 2.6 + vec3(4.2, 1.7, 8.3));
  neb = pow(max(neb - 0.45, 0.0) * 1.8, 2.2);
  vec3 nebCol = mix(vec3(0.18, 0.07, 0.32), vec3(0.05, 0.14, 0.30),
                    fbm(rd * 1.3 + 3.0));
  col += nebCol * neb * 0.30;

  // the star itself + halo (bloom finishes the job)
  float mu = max(dot(rd, uLightDir), 0.0);
  col += uSunColor * (pow(mu, 6000.0) * 80.0 + pow(mu, 220.0) * 1.2) * uSunIntensity * 0.02;
  return col;
}

void main() {
  vec2 ndc = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;

  // unproject to build the view ray
  vec3 ro = uCamWorld[3].xyz;
  vec4 pv = uProjInv * vec4(ndc, 0.5, 1.0);
  pv /= pv.w;
  vec3 pw = (uCamWorld * vec4(pv.xyz, 1.0)).xyz;
  vec3 rd = normalize(pw - ro);

  float rAtmo = R_PLANET + uAtmoHeight;
  vec2 hitP = raySphere(ro, rd, R_PLANET);
  vec2 hitA = raySphere(ro, rd, rAtmo);

  bool surfaceHit = hitP.x > 0.0 && hitP.x < hitP.y;

  vec3 base;
  if (surfaceHit) {
    base = shadeSurface(ro + rd * hitP.x, rd);
  } else {
    base = background(rd);
  }

  vec3 color = base;

  // atmosphere march
  float t0 = max(hitA.x, 0.0);
  float t1 = surfaceHit ? hitP.x : hitA.y;
  if (hitA.x < hitA.y && t1 > t0) {
    float dt = (t1 - t0) / float(uViewSteps);
    float mu = dot(rd, uLightDir);
    float phR = phaseRayleigh(mu);
    float phM = phaseHG(mu, uMieG);

    float odR = 0.0;
    float odM = 0.0;
    vec3 sumR = vec3(0.0);
    vec3 sumM = vec3(0.0);

    for (int i = 0; i < 256; i++) {
      if (i >= uViewSteps) break;
      vec3 p = ro + rd * (t0 + (float(i) + 0.5) * dt);
      float h = max(length(p) - R_PLANET, 0.0);
      float dR = exp(-h / uHr) * dt;
      float dM = exp(-h / uHm) * dt;
      odR += dR;
      odM += dM;
      vec2 lod = lightOpticalDepth(p);
      vec3 tau = uBetaR * (odR + lod.x)
               + uBetaM * 1.1 * (odM + lod.y)
               + uBetaA * (odR + lod.x);
      vec3 attn = exp(-tau);
      sumR += attn * dR;
      sumM += attn * dM;
    }

    vec3 inscatter = uSunIntensity * uSunColor *
                     (phR * uBetaR * sumR + phM * uBetaM * sumM);
    vec3 transmittance = exp(-(uBetaR * odR + uBetaM * 1.1 * odM + uBetaA * odR));
    color = base * transmittance + inscatter;
  }

  // tiny dither to kill banding in the dark gradients
  float dn = hash13(vec3(gl_FragCoord.xy, 1.0)) - 0.5;
  color += dn / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
