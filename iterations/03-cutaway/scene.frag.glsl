// Iteration 03 — planet anatomy cutaway (ultra-realism pass).
// Hybrid cutaway: crust + mantle sliced by a 90 deg wedge into flat
// cross-section walls (now multi-band strata), the metallic core an intact
// glowing 3D sphere. Exterior is a full realistic surface driven by type:
// terrestrial (ocean/cloud/land), gas/ice bands, or carbon. Raytraced here.

uniform vec2  uResolution;
uniform mat4  uCamWorld;
uniform mat4  uProjInv;

uniform vec3  uLightDir;        // FROM planet TO star
uniform vec3  uSunColor;
uniform float uAmbient;
uniform float uNightAmbient;
uniform float uYaw;

uniform float uRAtmo;
uniform float uRSurface;
uniform float uRCrustBase;
uniform float uRMantleBase;     // = core top
uniform float uRInnerCore;

uniform int   uSurfaceType;     // 0 terrestrial, 1 gas, 2 ice, 3 carbon
uniform float uSeaLevel;
uniform float uCloudAmount;

uniform vec3  uCrustA;
uniform vec3  uCrustB;
uniform vec3  uMantleA;
uniform vec3  uMantleB;
uniform vec3  uCoreCol;
uniform vec3  uInnerCoreCol;
uniform vec3  uOuterCoreCol;
uniform vec3  uOceanDeep;
uniform vec3  uOceanShallow;
uniform vec3  uLandLow;
uniform vec3  uLandHigh;
uniform vec3  uIceCol;
uniform vec3  uCloudCol;
uniform vec3  uBandA;
uniform vec3  uBandB;
uniform vec3  uBandC;
uniform vec3  uAtmoCol;

uniform float uCoreEmissive;
uniform float uRimStrength;
uniform float uBoundaryGlow;

const float PI = 3.14159265359;

// ---------- noise ----------
float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  float n000=hash13(i+vec3(0,0,0)),n100=hash13(i+vec3(1,0,0)),n010=hash13(i+vec3(0,1,0)),n110=hash13(i+vec3(1,1,0));
  float n001=hash13(i+vec3(0,0,1)),n101=hash13(i+vec3(1,0,1)),n011=hash13(i+vec3(0,1,1)),n111=hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=0.5,v=0.0; for(int i=0;i<6;i++){ v+=a*vnoise(p); p=p*2.13+vec3(11.7,5.3,2.9); a*=0.5; } return v; }
vec3 fbm3(vec3 p){ return vec3(fbm(p), fbm(p+vec3(19.1,7.7,3.3)), fbm(p+vec3(2.9,23.4,14.1))); }

vec2 raySphere(vec3 ro, vec3 rd, float radius){
  float b=dot(ro,rd); float c=dot(ro,ro)-radius*radius; float disc=b*b-c;
  if(disc<0.0) return vec2(1e9,-1e9); float s=sqrt(disc); return vec2(-b-s,-b+s);
}
vec3 rotY(vec3 p, float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }
bool removed(vec3 p){ return p.x>0.0 && p.z>0.0; }
vec3 camPos(){ return uCamWorld[3].xyz; }
float lineAt(float r, float r0){ return smoothstep(0.008,0.0,abs(r-r0)); }

vec3 background(vec3 rd){
  vec3 col=vec3(0.0);
  vec3 cell=floor(rd*230.0); float star=hash13(cell);
  if(star>0.9974){ float tw=hash13(cell+17.0); col+=mix(vec3(0.7,0.8,1.0),vec3(1.0,0.85,0.7),tw)*pow((star-0.9974)/0.0026,2.0)*2.2; }
  float neb=pow(max(fbm(rd*2.6+vec3(4.2,1.7,8.3))-0.45,0.0)*1.8,2.2);
  col+=mix(vec3(0.16,0.06,0.30),vec3(0.04,0.12,0.28),fbm(rd*1.3+3.0))*neb*0.26;
  col+=uSunColor*pow(max(dot(rd,uLightDir),0.0),5000.0)*55.0*0.02;
  return col;
}

// ---------- exterior surface ----------
float terrHeight(vec3 sp){ return fbm(sp*2.6 + 2.0*fbm(sp*1.3)); }

vec3 giantBands(vec3 sp, float soft){
  vec3 q = sp + (fbm3(sp*1.8)-0.5)*0.42;
  q += (fbm3(q*5.5)-0.5)*0.15;
  float band = sin(q.y*16.0)*0.5+0.5;
  band = mix(band, fbm(vec3(q.y*36.0, q.x*2.0, q.z*2.0)), 0.45);
  band = mix(band, 0.5, soft);
  vec3 col = mix(uBandA, uBandB, smoothstep(0.25,0.75,band));
  col = mix(col, uBandC, smoothstep(0.6,0.95,fbm(q*3.0))*0.45);
  col *= 0.85 + 0.3*fbm(vec3(q.x*12.0,q.y*40.0,q.z*12.0));
  return col;
}

vec3 exteriorAlbedo(vec3 sp, inout vec3 n, out float water, out float cloud){
  water = 0.0; cloud = 0.0;
  if (uSurfaceType == 0) {
    float h = terrHeight(sp);
    float landAmt = max(h - uSeaLevel, 0.0);
    vec3 col;
    if (h < uSeaLevel) {
      col = mix(uOceanShallow, uOceanDeep, smoothstep(0.0,0.16,uSeaLevel-h));
      col *= 0.94 + 0.10 * fbm(sp * 18.0);          // subtle ocean variation
      water = 1.0;
    } else {
      col = mix(uLandLow, uLandHigh, smoothstep(0.02,0.18,landAmt));
      col *= 0.84 + 0.30 * fbm(sp * 26.0);          // fine terrain detail (holds up close)
    }
    float ice = smoothstep(0.64,0.82, abs(sp.y) + fbm(sp*5.0)*0.12 - landAmt*0.5);
    col = mix(col, uIceCol, clamp(ice,0.0,1.0));
    if (water < 0.5) {
      float e=0.012, h0=terrHeight(sp);
      vec3 g = vec3(terrHeight(sp+vec3(e,0,0))-h0, terrHeight(sp+vec3(0,e,0))-h0, terrHeight(sp+vec3(0,0,e))-h0);
      g -= n*dot(g,n);
      n = normalize(n - g*1.3);
    }
    float cl = smoothstep(0.55, 1.0, fbm(sp*3.2 + 1.6*fbm(sp*1.6)));
    cl *= 0.6 + 0.55 * fbm(sp * 9.0);               // break cloud edges into wisps
    cloud = clamp(cl, 0.0, 1.0) * uCloudAmount;
    return col;
  } else if (uSurfaceType == 1) {
    return giantBands(sp, 0.0);
  } else if (uSurfaceType == 2) {
    return giantBands(sp, 0.45);
  } else {
    float w = fbm(sp*4.0 + 2.0*fbm(sp*2.0));
    vec3 col = mix(uCrustA*0.5, uCrustB*0.6, smoothstep(0.4,0.7,w));
    return col;
  }
}

vec3 shadeSurface(vec3 p){
  vec3 n = normalize(p);
  vec3 sp = rotY(n, uYaw);
  vec3 viewDir = normalize(camPos()-p);
  float water, cloud;
  vec3 albedo = exteriorAlbedo(sp, n, water, cloud);

  float ndl = dot(n, uLightDir);
  float day = smoothstep(-0.10, 0.24, ndl) * max(ndl,0.0);
  vec3 lit = albedo*day*uSunColor + albedo*uNightAmbient;
  lit += albedo*uAmbient*max(ndl,0.0)*0.2;

  vec3 hf = normalize(uLightDir + viewDir);
  if (water > 0.5) {
    lit += uSunColor * pow(max(dot(n,hf),0.0), 80.0) * 0.9 * day;   // ocean sun-glint
  } else {
    lit += uSunColor * pow(max(dot(n,hf),0.0), 16.0) * 0.05 * day;  // faint land sheen
  }
  if (cloud > 0.001) {
    lit = mix(lit, uCloudCol*(day + uNightAmbient*2.0)*uSunColor, cloud);
  }
  float fres = pow(1.0 - max(dot(n,viewDir),0.0), 3.0);
  lit += uAtmoCol * fres * uRimStrength * smoothstep(-0.25,0.4,ndl);
  return lit;
}

// ---------- cut walls (multi-band strata) ----------
vec3 shadeWall(vec3 p, vec3 fn){
  float r = length(p);
  float midMantle = mix(uRMantleBase, uRCrustBase, 0.5);
  vec3 alb;
  if (r > uRCrustBase) {
    alb = mix(uCrustA, uCrustB, smoothstep(0.3,0.8, fbm(p*11.0)));            // crust
  } else if (r > midMantle) {
    alb = mix(uMantleA, uMantleB, smoothstep(0.25,0.85, fbm(p*7.0+3.0)));     // upper mantle
    alb *= 0.92 + 0.3*fbm(p*16.0);
  } else {
    vec3 lm = mix(uMantleA*0.78, uMantleB, smoothstep(0.25,0.85, fbm(p*6.0+7.0)));
    float warm = smoothstep(midMantle, uRMantleBase, r);
    alb = mix(lm, vec3(0.55,0.24,0.10), warm*0.45);                          // lower mantle, warming
  }
  alb *= 0.9 + 0.18 * fbm(p * 28.0);                                         // fine mineral grain (holds up close)

  float ndl = max(dot(fn, uLightDir), 0.0);
  vec3 lit = alb * (uAmbient + ndl*0.85) * uSunColor;

  // outer-core hot ring at the mantle/core boundary (material-driven)
  float ocRing = smoothstep(uRMantleBase + 0.06, uRMantleBase, r);
  lit += uOuterCoreCol * pow(ocRing, 2.0) * 1.0;
  // volumetric warm bleed from the core up into the mantle
  float bleed = smoothstep(uRCrustBase, uRMantleBase, r);
  lit += uOuterCoreCol * 0.85 * pow(bleed, 2.4) * 0.55;
  // AO into the central axis crease
  float ao = smoothstep(0.0, 0.28, min(abs(p.x), abs(p.z)));
  lit *= mix(0.5, 1.0, ao);
  // technical interface lines
  float l = lineAt(r, uRSurface) + lineAt(r, uRCrustBase) + lineAt(r, midMantle)*0.55 + lineAt(r, uRMantleBase);
  lit += vec3(0.55, 0.9, 1.0) * l * uBoundaryGlow;
  return lit;
}

// ---------- molten core (intact 3D sphere) ----------
vec3 shadeCore(vec3 p){
  vec3 n = normalize(p);
  float swirl = fbm(p*5.0);
  float fine  = fbm(p*14.0);
  float veins = fbm(p*9.0 + swirl*2.0);
  vec3 body = mix(uCoreCol*0.62, uCoreCol, smoothstep(0.3,0.7,swirl));
  body = mix(body, uInnerCoreCol, smoothstep(0.72,0.95,fine));
  body = mix(body, uCoreCol*0.28, smoothstep(0.55,0.85,veins)*0.5);
  float facing = max(dot(n, normalize(camPos()-p)), 0.0);
  // white-hot inner core showing through the centre (kept tight so molten orange dominates)
  body += uInnerCoreCol * pow(facing, 4.0) * 0.42;
  body *= 0.58 + 0.5*facing;
  return body * uCoreEmissive;
}

void main(){
  vec2 px = gl_FragCoord.xy / uResolution;
  vec3 ro = camPos();
  vec4 pv = uProjInv * vec4(px*2.0-1.0, 0.5, 1.0); pv/=pv.w;
  vec3 rd = normalize((uCamWorld*vec4(pv.xyz,1.0)).xyz - ro);

  float bestT=1e9; int hit=-1; vec3 hp=vec3(0.0), hn=vec3(0.0);
  vec2 sS = raySphere(ro, rd, uRSurface);
  if(sS.x>0.0){ vec3 p=ro+rd*sS.x; if(!removed(p)){ bestT=sS.x; hit=0; hp=p; } }
  vec2 sC = raySphere(ro, rd, uRMantleBase);
  if(sC.x>0.0 && sC.x<bestT){ bestT=sC.x; hit=3; hp=ro+rd*sC.x; }
  if(abs(rd.x)>1e-5){ float t=-ro.x/rd.x; if(t>0.0&&t<bestT){ vec3 p=ro+rd*t; float r=length(p);
    if(p.z>0.0 && r<uRSurface && r>uRMantleBase){ bestT=t; hit=1; hp=p; hn=vec3(1,0,0);} } }
  if(abs(rd.z)>1e-5){ float t=-ro.z/rd.z; if(t>0.0&&t<bestT){ vec3 p=ro+rd*t; float r=length(p);
    if(p.x>0.0 && r<uRSurface && r>uRMantleBase){ bestT=t; hit=2; hp=p; hn=vec3(0,0,1);} } }
  if(hit==-1 && sS.y>0.0){ vec3 p=ro+rd*sS.y; if(!removed(p)){ hit=4; hp=p; } }

  vec3 color;
  if(hit==0)      color = shadeSurface(hp);
  else if(hit==1) color = shadeWall(hp, hn);
  else if(hit==2) color = shadeWall(hp, hn);
  else if(hit==3) color = shadeCore(hp);
  else if(hit==4) color = shadeSurface(hp) * 0.35;
  else            color = background(rd);

  // atmospheric halo around the silhouette (skip the notch opening)
  float tca = max(dot(-ro, rd), 0.0);
  vec3 pca = ro + rd*tca; float dca = length(pca);
  if(dca > uRSurface*0.98 && dca < uRAtmo && !removed(pca)){
    float glow = smoothstep(uRAtmo, uRSurface, dca);
    float lf = smoothstep(-0.2, 0.6, dot(normalize(pca), uLightDir));
    color += uAtmoCol * glow * (0.25 + 0.75*lf) * 0.9;
  }

  color += (hash13(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
