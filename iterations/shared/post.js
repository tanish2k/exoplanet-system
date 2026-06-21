// Shared filmic post pass (P3 / D2) — reusable across probes, engine-bound.
// Runs after tone mapping. Two cheap lens effects that read as "filmic/HDR":
//   - unsharp-mask sharpening (crisps fine surface detail)
//   - radial chromatic aberration (subtle RGB split toward the frame edge / limb)
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function makeFilmicPass({ sharpen = 0.35, aberration = 0.0016, grain = 0.012, contrast = 0.0, saturation = 1.0 } = {}) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
      uSharpen: { value: sharpen },
      uAberration: { value: aberration },
      uGrain: { value: grain },
      uContrast: { value: contrast },
      uSaturation: { value: saturation },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 uTexel;
      uniform float uSharpen;
      uniform float uAberration;
      uniform float uGrain;
      uniform float uContrast;
      uniform float uSaturation;
      uniform float uTime;
      varying vec2 vUv;

      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

      void main() {
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        // radial chromatic aberration — grows toward the edge/limb, ~0 at center
        vec2 off = c * uAberration * (0.4 + 3.0 * r2);
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + off).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - off).b;

        // unsharp mask: sharpen against a 4-tap box blur
        vec3 blur = (
          texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb +
          texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb +
          texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb +
          texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb) * 0.25;
        col += (col - blur) * uSharpen;

        // contrast S-curve around mid grey (deepens shadows, lifts highlights)
        vec3 cc = clamp(col, 0.0, 1.0);
        col = mix(col, cc * cc * (3.0 - 2.0 * cc), uContrast);
        // saturation (AgX desaturates; nudge back toward the board's punch)
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(luma), col, uSaturation);

        // faint film grain
        float g = (hash(vUv * 1024.0 + uTime) - 0.5) * uGrain;
        col += g;

        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }
    `,
  });
  // keep uTexel in sync with the drawing-buffer size
  pass.setTexel = (w, h) => pass.uniforms.uTexel.value.set(1 / w, 1 / h);
  return pass;
}
