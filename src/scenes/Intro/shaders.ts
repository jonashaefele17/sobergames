/** Glut / Goldasche: Position wird komplett im Shader aus Zeit und Zufallswerten berechnet. */
export const EMBER_VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float speed = mix(0.25, 1.0, aSeed.w);
    float life = fract(aSeed.y + uTime * speed * 0.05);
    vec3 p;
    p.x = (aSeed.x - 0.5) * 26.0 + sin(uTime * 0.35 + aSeed.z * 40.0) * 0.7 * (0.3 + life)
        + sin(uTime * 0.9 + aSeed.w * 30.0) * 0.12;
    p.y = mix(-3.4, 8.0, life);
    p.z = (aSeed.z - 0.5) * 14.0 - 0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float flicker = 0.55 + 0.45 * sin(uTime * (2.0 + aSeed.w * 7.0) + aSeed.x * 100.0);
    vAlpha = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life)) * flicker;
    vHeat = 1.0 - life;
    gl_PointSize = (1.5 + pow(aSeed.w, 4.0) * 16.0) * uPixelRatio * (9.0 / -mv.z);
  }
`

export const EMBER_FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.8);
    vec3 color = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.86, 0.5), a * vHeat);
    gl_FragColor = vec4(color * a * vAlpha * 1.6, a * vAlpha);
  }
`

export const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
`

/** Rauchschwaden, vor allem links, rechts und am Boden */
export const SMOKE_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  ${NOISE}

  void main() {
    vec2 p = vUv * vec2(3.2, 1.9);
    float t = uTime * 0.035;
    float n = fbm(p + vec2(t, -t * 1.6) + fbm(p * 1.4 - t) * 0.9);
    float sides = smoothstep(0.12, 0.5, abs(vUv.x - 0.5));
    float low = 1.0 - smoothstep(0.0, 0.75, vUv.y);
    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(1.0, 0.8, vUv.y);
    float a = smoothstep(0.38, 0.85, n) * (sides * 0.75 + low * 0.45) * edge;
    vec3 color = mix(vec3(0.32, 0.2, 0.07), vec3(0.95, 0.68, 0.26), n * n);
    gl_FragColor = vec4(color * a * 0.55, 1.0);
  }
`

/** Lichtkegel von oben */
export const BEAM_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  ${NOISE}

  void main() {
    float x = (vUv.x - 0.5) * 2.0;
    float spread = mix(0.75, 0.16, vUv.y);
    float cone = 1.0 - smoothstep(0.0, spread, abs(x));
    float rays = 0.65 + 0.35 * noise(vec2(x / spread * 5.0, uTime * 0.12));
    float fade = smoothstep(0.0, 0.5, vUv.y);
    float a = cone * cone * rays * fade * (0.9 + 0.1 * sin(uTime * 0.6));
    gl_FragColor = vec4(vec3(1.0, 0.8, 0.42) * a * 0.3, 1.0);
  }
`
