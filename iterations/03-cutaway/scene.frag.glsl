// Iteration 03 — planet anatomy cutaway fidelity probe.
// Hybrid cutaway: crust + mantle are sliced by a 90 deg wedge (flat
// cross-section walls showing strata), while the metallic core stays an intact
// glowing 3D sphere nestled in the opening. Outer 3/4 of the planet is the
// rocky exterior with an atmospheric rim. Whole thing is raytraced here.

uniform vec2  uResolution;
uniform mat4  uCamWorld;
uniform mat4  uProjInv;

uniform vec3  uLightDir;        // FROM planet TO star
uniform vec3  uSunColor;
uniform float uAmbient;

// layer radii (surface = 1.0)
uniform float uRAtmo;
uniform float uRSurface;
uniform float uRCrustBase;      // crust spans [crustBase, surface]
uniform float uRMantleBase;     // mantle spans [mantleBase, crustBase] ; = core top
uniform float uRInnerCore;      // inner-core radius (core shading only)

// materials
uniform vec3  uCrustA;
uniform vec3  uCrustB;
uniform vec3  uMantleA;
uniform vec3  uMantleB;
uniform vec3  uCoreCol;         // outer core, molten
uniform vec3  uInnerCoreCol;    // inner core, white-hot
uniform vec3  uSurfA;
uniform vec3  uSurfB;
uniform vec3  uAtmoCol;

uniform float uCoreEmissive;
uniform float uRimStrength;
uniform float uBoundaryGlow;
uniform float uNightAmbient;

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
  for (int i = 0; i < 5; i++) { v += a*vnoise(p); p = p*2.13 + vec3(11.7,5.3,2.9); a *= 0.5; }
  return v;
}

vec2 raySphere(vec3 ro, vec3 rd, float radius) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - radius*radius;
  float disc = b*b - c;
  if (disc < 0.0) return vec2(1e9, -1e9);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

// removed wedge: the +x,+z quadrant of the crust+mantle shells is sliced away
bool removed(vec3 p) { return p.x > 0.0 && p.z > 0.0; }

vec3 camPos() { return uCamWorld[3].xyz; }

// ---------- background ----------
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
  vec3 nebCol = mix(vec3(0.16,0.06,0.30), vec3(0.04,0.12,0.28), fbm(rd*1.3 + 3.0));
  col += nebCol * neb * 0.26;
  float mu = max(dot(rd, uLightDir), 0.0);
  col += uSunColor * pow(mu, 5000.0) * 60.0 * 0.02;
  return col;
}

// thin bright interface lines on the cut walls
float lineAt(float r, float r0) { return smoothstep(0.008, 0.0, abs(r - r0)); }

// ---------- cut-wall shading (crust + mantle cross-section) ----------
vec3 shadeWall(vec3 p, vec3 fn) {
  float r = length(p);
  vec3 alb;
  if (r > uRCrustBase) {
    // crust band
    float n = fbm(p * 11.0);
    alb = mix(uCrustA, uCrustB, smoothstep(0.3, 0.8, n));
  } else {
    // mantle band, with faint convective mottling
    float n = fbm(p * 7.0 + 3.0);
    float conv = fbm(p * 16.0);
    alb = mix(uMantleA, uMantleB, smoothstep(0.25, 0.85, n));
    alb *= 0.85 + 0.4 * conv;
  }

  float ndl = max(dot(fn, uLightDir), 0.0);
  vec3 lit = alb * (uAmbient + ndl * 0.85) * uSunColor;

  // warm light bouncing off the molten core onto the inner mantle wall
  float bounce = smoothstep(uRCrustBase, uRMantleBase, r); // ->1 toward core
  lit += vec3(1.0, 0.34, 0.07) * pow(bounce, 3.2) * 0.35;

  // ambient occlusion into the central axis crease
  float ao = smoothstep(0.0, 0.28, min(abs(p.x), abs(p.z)));
  lit *= mix(0.5, 1.0, ao);

  // bright technical interface lines
  float l = lineAt(r, uRSurface) + lineAt(r, uRCrustBase) + lineAt(r, uRMantleBase);
  lit += vec3(0.55, 0.9, 1.0) * l * uBoundaryGlow;

  return lit;
}

// ---------- molten core (intact 3D sphere) ----------
vec3 shadeCore(vec3 p) {
  vec3 n = normalize(p);
  float swirl = fbm(p * 5.0);
  float fine  = fbm(p * 14.0);
  float veins = fbm(p * 9.0 + swirl * 2.0);
  // molten body: deep orange base, sparse white-hot flecks, dark cooling veins
  vec3 body = mix(uCoreCol * 0.65, uCoreCol, smoothstep(0.3, 0.7, swirl));
  body = mix(body, uInnerCoreCol, smoothstep(0.74, 0.96, fine));
  body = mix(body, uCoreCol * 0.28, smoothstep(0.55, 0.85, veins) * 0.5);
  // hot center of the visible disk = inner core glowing through
  float facing = max(dot(n, normalize(camPos() - p)), 0.0);
  body += uInnerCoreCol * pow(facing, 3.0) * 0.45;
  // cooler toward the limb so it reads as a sphere, not a flat disk
  body *= 0.62 + 0.5 * facing;
  return body * uCoreEmissive;
}

// ---------- outer rocky surface ----------
vec3 shadeSurface(vec3 p) {
  vec3 n = normalize(p);
  vec3 q = p * 4.0;
  float w = fbm(q + 2.0 * fbm(q * 0.5));
  float detail = fbm(q * 6.0);
  vec3 alb = mix(uSurfA, uSurfB, smoothstep(0.35, 0.75, w));
  alb *= 0.75 + 0.5 * detail;
  float e = 0.02;
  float hx = fbm((p+vec3(e,0,0))*6.0) - fbm((p-vec3(e,0,0))*6.0);
  float hy = fbm((p+vec3(0,e,0))*6.0) - fbm((p-vec3(0,e,0))*6.0);
  float hz = fbm((p+vec3(0,0,e))*6.0) - fbm((p-vec3(0,0,e))*6.0);
  n = normalize(n + 1.3 * vec3(hx, hy, hz));

  float ndl = dot(n, uLightDir);
  float day = smoothstep(-0.08, 0.25, ndl) * max(ndl, 0.0);
  vec3 lit = alb * day * uSunColor + alb * uNightAmbient;

  // atmospheric rim (fresnel) on the lit limb
  float fres = pow(1.0 - max(dot(n, normalize(camPos() - p)), 0.0), 3.0);
  float dayMask = smoothstep(-0.3, 0.2, ndl);
  lit += uAtmoCol * fres * uRimStrength * dayMask;
  return lit;
}

void main() {
  vec2 px = gl_FragCoord.xy / uResolution;
  vec3 ro = camPos();
  vec4 pv = uProjInv * vec4(px * 2.0 - 1.0, 0.5, 1.0); pv /= pv.w;
  vec3 rd = normalize((uCamWorld * vec4(pv.xyz, 1.0)).xyz - ro);

  float bestT = 1e9; int hitType = -1; vec3 hitP = vec3(0.0); vec3 hitN = vec3(0.0);

  // A — outer surface (near), valid where not sliced away
  vec2 sS = raySphere(ro, rd, uRSurface);
  if (sS.x > 0.0) { vec3 p = ro + rd * sS.x; if (!removed(p)) { bestT = sS.x; hitType = 0; hitP = p; } }

  // D — molten core sphere (never sliced)
  vec2 sC = raySphere(ro, rd, uRMantleBase);
  if (sC.x > 0.0 && sC.x < bestT) { bestT = sC.x; hitType = 3; hitP = ro + rd * sC.x; }

  // B — wall on x=0 plane (z>0 half), crust+mantle band only
  if (abs(rd.x) > 1e-5) {
    float t = -ro.x / rd.x;
    if (t > 0.0 && t < bestT) {
      vec3 p = ro + rd * t; float r = length(p);
      if (p.z > 0.0 && r < uRSurface && r > uRMantleBase) { bestT = t; hitType = 1; hitP = p; hitN = vec3(1,0,0); }
    }
  }
  // C — wall on z=0 plane (x>0 half)
  if (abs(rd.z) > 1e-5) {
    float t = -ro.z / rd.z;
    if (t > 0.0 && t < bestT) {
      vec3 p = ro + rd * t; float r = length(p);
      if (p.x > 0.0 && r < uRSurface && r > uRMantleBase) { bestT = t; hitType = 2; hitP = p; hitN = vec3(0,0,1); }
    }
  }
  // E — interior back surface seen through the notch (fallback)
  if (hitType == -1 && sS.y > 0.0) { vec3 p = ro + rd * sS.y; if (!removed(p)) { hitType = 4; hitP = p; } }

  vec3 color;
  if (hitType == 0)      color = shadeSurface(hitP);
  else if (hitType == 1) color = shadeWall(hitP, hitN);
  else if (hitType == 2) color = shadeWall(hitP, hitN);
  else if (hitType == 3) color = shadeCore(hitP);
  else if (hitType == 4) color = shadeSurface(hitP) * 0.35; // dim interior backwall
  else                   color = background(rd);

  // atmospheric halo around the silhouette (skip over the notch opening)
  float tca = max(dot(-ro, rd), 0.0);
  vec3 pca = ro + rd * tca;
  float dca = length(pca);
  if (dca > uRSurface * 0.98 && dca < uRAtmo && !removed(pca)) {
    float glow = smoothstep(uRAtmo, uRSurface, dca);
    float lightFace = smoothstep(-0.2, 0.6, dot(normalize(pca), uLightDir));
    color += uAtmoCol * glow * (0.25 + 0.75 * lightFace) * 0.9;
  }

  // dither to kill banding
  color += (hash13(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
