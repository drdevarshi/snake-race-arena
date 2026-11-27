import { Color, ShaderMaterial, UniformsLib, UniformsUtils, Vector2, Vector3 } from "three";
import type { Skin } from "./skins";

/**
 * Dragon scale shader.
 *
 * - Hexagonal scales in UV space; each scale is a dark, slightly domed face with its own subtle
 *   tone, and its edge glows in the skin colour. Bloom picks up only the bright edges, so the scale
 *   detail never washes out (report section 4).
 * - A darker belly with wide transverse plates.
 * - A bright spine line, a highlight-coloured rim, and a slow glow pulse travelling down the body.
 * - Lit by a dim moon and by the dragon's own light near the head (the dragon is the main light).
 *
 * Output is linear HDR; tone mapping happens in the post-processing pass.
 */

const vertex = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  attribute float aAlong;
  varying vec2 vUv;
  varying float vAlong;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vObjNormal;
  void main() {
    vUv = uv;
    #ifdef USE_ALONG
      vAlong = aAlong;
    #else
      vAlong = 0.0;
    #endif
    vObjNormal = normal;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uGlow;
  uniform vec3 uHighlight;
  uniform vec3 uBody;
  uniform vec3 uBelly;
  uniform vec3 uHot;
  uniform float uTime;
  uniform float uGlowStrength;
  uniform vec2 uRepeat;          // scales around, scales per uv.y unit
  uniform float uBellyFromNormal; // 0: belly from uv.x (body), 1: from object-space normal (head)
  uniform vec3 uMoonDir;
  uniform vec3 uDragonLightPos;
  uniform vec3 uDragonLightColor;
  varying vec2 vUv;
  varying float vAlong;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vObjNormal;

  const vec2 HS = vec2(1.0, 1.7320508);
  // Returns (offset from cell centre, cell id).
  vec4 hexGrid(vec2 p) {
    vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / HS.xyxy) + 0.5;
    vec4 h = vec4(p - hc.xy * HS, p - (hc.zw + 0.5) * HS);
    return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + 9.43);
  }
  float hexDist(vec2 p) { p = abs(p); return max(dot(p, HS * 0.5), p.x); } // 0 centre → 0.5 edge
  float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // ---- Belly mask
    float belly;
    if (uBellyFromNormal > 0.5) {
      belly = smoothstep(-0.25, -0.6, normalize(vObjNormal).y);
    } else {
      belly = 1.0 - smoothstep(0.13, 0.21, abs(vUv.x - 0.5));
    }

    // ---- Scales (rows offset so they overlap like real scales)
    vec2 sp = vec2(vUv.x * uRepeat.x, vUv.y * uRepeat.y) * vec2(1.0, 1.15);
    vec4 hx = hexGrid(sp);
    float d = hexDist(hx.xy);                       // 0 centre → 0.5 edge
    float tone = hash12(hx.zw);
    float edge = smoothstep(0.37, 0.5, d);           // glowing seam between scales
    float dome = 1.0 - smoothstep(0.0, 0.5, d);      // brighter centre, like a curved scale
    // Each scale catches light on its tail-ward half.
    float sheen = smoothstep(-0.3, 0.4, hx.y) * dome;

    // ---- Belly plates
    float plate = fract(vUv.y * uRepeat.y * 0.55);
    float plateEdge = smoothstep(0.86, 0.97, plate) + (1.0 - smoothstep(0.0, 0.04, plate));

    // ---- Lighting: dim moon + the dragon's own light
    float moon = max(dot(N, normalize(uMoonDir)), 0.0) * 0.35 + 0.08;
    vec3 Lvec = uDragonLightPos - vWorldPos;
    float Ld = length(Lvec);
    float dragon = max(dot(N, Lvec / Ld), 0.0) / (1.0 + 0.25 * Ld * Ld);
    vec3 light = vec3(moon) + uDragonLightColor * dragon * 1.4;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    // ---- Base colour
    vec3 face = mix(uBody, uGlow * 0.22, 0.35) * (0.7 + 0.6 * tone) * (0.6 + 0.9 * sheen);
    vec3 bellyCol = uBelly * (0.8 + 0.4 * (1.0 - plateEdge));

    // ---- Hot spots: the head's face, and scattered bright scales near the neck
    float hot;
    if (uBellyFromNormal > 0.5) {
      vec3 on = normalize(vObjNormal);
      hot = smoothstep(0.2, 0.8, on.z) * smoothstep(-0.3, 0.3, on.y);
    } else {
      hot = step(0.9, tone) * (1.0 - smoothstep(0.05, 0.45, vAlong)) * (1.0 - belly);
    }
    face = mix(face, uHot * 0.35, hot * 0.6);

    // ---- Flame flicker: moving noise roughens the glow like licking flames
    float flame = vnoise(vec2(vUv.x * 9.0, vUv.y * 1.6 - uTime * 2.2)) * 0.65
                + vnoise(vec2(vUv.x * 21.0, vUv.y * 3.7 - uTime * 3.9)) * 0.35;

    // ---- Emission (HDR, picked up by bloom)
    float pulse = 0.72 + 0.28 * sin(vUv.y * 0.55 - uTime * 2.6);
    float tailFade = 1.0 - 0.45 * smoothstep(0.55, 1.0, vAlong);
    float spine = (1.0 - smoothstep(0.0, 0.035, min(vUv.x, 1.0 - vUv.x))) * (1.0 - belly);
    vec3 emit = uGlow * edge * (1.0 - belly) * (0.45 + 0.55 * tone) * (0.7 + 0.9 * flame) * 1.3;
    emit += uGlow * (1.0 - belly) * (0.12 + 0.4 * flame * flame) * (0.5 + sheen);  // inner fire
    emit += uGlow * plateEdge * belly * 0.25;
    emit += uHighlight * spine * 1.6;
    emit += mix(uGlow, uHighlight, 0.35) * rim * (0.25 + 1.3 * flame) * 1.1;
    emit += uHot * hot * (0.6 + 0.6 * flame) * 1.2;
    vec3 base = mix(face, bellyCol, belly);
    vec3 col = base * light * 2.2;
    col += emit * pulse * tailFade * uGlowStrength;

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

export type ScaleMaterialOptions = {
  skin: Skin;
  /** Scales around the body, and per uv.y unit along it. */
  repeat: [number, number];
  /** Head geometry uses its object-space normal for the belly; the body uses uv.x. */
  bellyFromNormal?: boolean;
  /** Body geometry carries the aAlong attribute (0 neck → 1 tail). */
  useAlong?: boolean;
};

export function createScaleMaterial({ skin, repeat, bellyFromNormal = false, useAlong = false }: ScaleMaterialOptions): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uGlow: { value: new Color(skin.glow) },
        uHighlight: { value: new Color(skin.highlight) },
        uBody: { value: new Color(skin.body) },
        uBelly: { value: new Color(skin.belly) },
        uHot: { value: new Color(skin.hot) },
        uTime: { value: 0 },
        uGlowStrength: { value: 1 },
        uRepeat: { value: new Vector2(repeat[0], repeat[1]) },
        uBellyFromNormal: { value: bellyFromNormal ? 1 : 0 },
        uMoonDir: { value: new Vector3(-0.4, 1, 0.3).normalize() },
        uDragonLightPos: { value: new Vector3() },
        uDragonLightColor: { value: new Color(skin.glow) },
      },
    ]),
    vertexShader: vertex,
    fragmentShader: fragment,
    fog: true,
    defines: useAlong ? { USE_ALONG: "" } : {},
  });
  m.name = "DragonScaleMaterial";
  return m;
}

/** Applies a skin to an existing scale material (no shader recompile). */
export function applySkin(m: ShaderMaterial, skin: Skin): void {
  m.uniforms.uGlow.value.set(skin.glow);
  m.uniforms.uHighlight.value.set(skin.highlight);
  m.uniforms.uBody.value.set(skin.body);
  m.uniforms.uBelly.value.set(skin.belly);
  m.uniforms.uHot.value.set(skin.hot);
  m.uniforms.uDragonLightColor.value.set(skin.glow);
}
