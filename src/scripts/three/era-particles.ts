import { AdditiveBlending } from 'three/src/constants.js';
import { BufferAttribute } from 'three/src/core/BufferAttribute.js';
import { BufferGeometry } from 'three/src/core/BufferGeometry.js';
import { Color } from 'three/src/math/Color.js';
import { Group } from 'three/src/objects/Group.js';
import { Points } from 'three/src/objects/Points.js';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial.js';
import { Vector2 } from 'three/src/math/Vector2.js';
import type { Vector3 } from 'three/src/math/Vector3.js';
import { gsap } from 'gsap';
import { ERA_PRESETS, type Era } from './era-presets';

// Motivo 3D por era: un mismo conjunto de partículas cambia de formación al cambiar de capítulo.
// Las coordenadas son locales al blob (disco en el plano xz) y escalan con él.

type Shape = 'shell' | 'burst' | 'surface' | 'stars' | 'spiral' | 'disk' | 'cells' | 'orbits';

interface FormationSpec {
  shape: Shape;
  /** Opacidad global de las partículas en esa era. */
  alpha: number;
  /** Velocidad de giro; la rotación es diferencial (el centro gira más rápido). */
  spin: number;
  /** Inclinación del plano de la formación respecto a la cámara. */
  tiltX: number;
  tiltZ: number;
  /** 01: las partículas fluyen del centro hacia afuera. */
  stream?: number;
  /** 03: cada partícula se enciende a su turno, con alguna supernova ocasional. */
  ignite?: number;
  /** 06: cada célula se estira, se divide en dos y vuelve a formarse. */
  cells?: number;
  /** 07: resalta los satélites (la ISS) que recorren las órbitas. */
  orbits?: number;
  /** Tamaño relativo de la formación (1 por defecto). */
  scale?: number;
  /** Colores propios; si faltan se usan los del blob de la era. */
  colorA?: string;
  colorB?: string;
}

// Las eras sin motivo propio todavía esconden las partículas pegadas al blob.
const FORMATIONS: Record<Era, FormationSpec> = {
  hot: { shape: 'burst', alpha: 0.95, spin: 0.04, tiltX: 0.4, tiltZ: 0, stream: 1 },
  // Paleta del mapa de Planck: manchas calientes y frías sobre la superficie de última dispersión.
  cooling: { shape: 'surface', alpha: 0.8, spin: 0.06, tiltX: 0.35, tiltZ: 0.1, colorA: '#ff9d5c', colorB: '#3f74d9' },
  stellar: { shape: 'stars', alpha: 1, spin: 0.03, tiltX: 0.5, tiltZ: -0.1, ignite: 1 },
  galactic: { shape: 'spiral', alpha: 0.95, spin: 0.32, tiltX: 1.02, tiltZ: -0.38 },
  planetary: { shape: 'disk', alpha: 0.9, spin: 0.5, tiltX: 0.82, tiltZ: 0.2 },
  biotic: { shape: 'cells', alpha: 0.9, spin: 0.08, tiltX: 0.55, tiltZ: 0.15, cells: 1 },
  // Giro rápido: en la órbita interior la ISS da una vuelta cada ~12 s; el resto de los anillos se ve quieto.
  now: { shape: 'orbits', alpha: 0.6, spin: 0.9, tiltX: 1.18, tiltZ: -0.32, orbits: 1, scale: 1.6 },
};

interface Formation {
  pos: Float32Array;
  tone: Float32Array;
  /** Solo células y órbitas: eje de división × lado (xyz) y fase o marca de satélite (w). */
  cell?: Float32Array;
}

// Generador con semilla: cada formación sale igual en cada visita.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-6))) * Math.cos(2 * Math.PI * rand());
}

// Cáscara pegada a la superficie del blob: punto de partida y de regreso de cada motivo.
function shell(count: number): Formation {
  const rand = rng(11);
  const pos = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = 1.05 + rand() * 0.25;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3);
    tone[i] = rand();
  }
  return { pos, tone };
}

// 01 · Inflación: volumen esférico; el shader hace fluir cada partícula del centro hacia afuera.
function burst(count: number): Formation {
  const rand = rng(101);
  const pos = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const r = 3.1 * Math.cbrt(0.08 + rand() * 0.92);
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
    tone[i] = 0.4 + rand() * 0.6;
  }
  return { pos, tone };
}

// Campo suave sobre la esfera: suma de ondas con semilla, para las manchas calientes y frías.
function sphereField(rand: () => number, waves = 14) {
  const list = Array.from({ length: waves }, () => {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return { x: s * Math.cos(th), y: u, z: s * Math.sin(th), f: 2 + rand() * 5, ph: rand() * Math.PI * 2 };
  });
  return (x: number, y: number, z: number) => {
    let v = 0;
    for (const w of list) v += Math.sin((x * w.x + y * w.y + z * w.z) * w.f + w.ph);
    return 0.5 + v / (2 * Math.sqrt(waves));
  };
}

// 02 · Recombinación: cáscara delgada alrededor del blob, la superficie de última dispersión.
function surface(count: number): Formation {
  const rand = rng(202);
  const field = sphereField(rng(203));
  const pos = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const x = s * Math.cos(th);
    const z = s * Math.sin(th);
    const r = 1.8 + gauss(rand) * 0.025;
    pos.set([x * r, u * r, z * r], i * 3);
    tone[i] = Math.min(1, Math.max(0, (field(x, u, z) - 0.5) * 1.8 + 0.5));
  }
  return { pos, tone };
}

// 03 · Primeras estrellas: campo disperso; unas pocas masivas (tono alto) brillan más y son más grandes.
function stars(count: number): Formation {
  const rand = rng(303);
  const pos = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    let z: number;
    do {
      x = (rand() * 2 - 1) * 3;
      y = (rand() * 2 - 1) * 2.1;
      z = (rand() * 2 - 1) * 3;
    } while (x * x + (y * y) / 0.5 + z * z > 9 || x * x + y * y + z * z < 1.4);
    pos.set([x, y, z], i * 3);
    tone[i] = rand() < 0.12 ? 0.9 + rand() * 0.1 : 0.25 + rand() * 0.35;
  }
  return { pos, tone };
}

// 06 · Vida: células con membrana y núcleo; el shader separa cada mitad a lo largo de su eje.
function cells(count: number): Formation {
  const rand = rng(606);
  const pos = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  const cell = new Float32Array(count * 4);
  const cellCount = 16;
  const list = Array.from({ length: cellCount }, () => {
    const r = 1.55 + rand() * 1.3;
    const th = rand() * Math.PI * 2;
    const u = rand() * 2 - 1;
    const ax = rand() * 2 - 1;
    const ay = (rand() * 2 - 1) * 0.4;
    const az = rand() * 2 - 1;
    const len = Math.hypot(ax, ay, az) || 1;
    return {
      x: Math.cos(th) * r,
      y: u * 0.9,
      z: Math.sin(th) * r,
      size: 0.2 + rand() * 0.12,
      axis: [ax / len, ay / len, az / len],
      phase: rand(),
    };
  });
  for (let i = 0; i < count; i++) {
    const c = list[i % cellCount];
    const nucleus = rand() < 0.2;
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const sq = Math.sqrt(1 - u * u);
    const r = nucleus ? c.size * 0.3 * Math.cbrt(rand()) : c.size * (0.92 + rand() * 0.12);
    const ox = sq * Math.cos(th) * r;
    const oy = u * r;
    const oz = sq * Math.sin(th) * r;
    pos.set([c.x + ox, c.y + oy, c.z + oz], i * 3);
    tone[i] = nucleus ? 1 : 0.45 + rand() * 0.15;
    // El lado depende de en qué mitad de la célula cae la partícula; el núcleo también se reparte.
    const side = ox * c.axis[0] + oy * c.axis[1] + oz * c.axis[2] >= 0 ? 1 : -1;
    cell.set([c.axis[0] * side, c.axis[1] * side, c.axis[2] * side, c.phase], i * 4);
  }
  return { pos, tone, cell };
}

// 07 · Ahora: órbitas finas en un mismo plano y pequeños grupos brillantes que las recorren (la ISS, la interior).
const ORBIT_RADII = [1.5, 1.95, 2.45];

function orbits(count: number): Formation {
  const rand = rng(707);
  const pos = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  const cell = new Float32Array(count * 4);
  const satellites = [
    { ring: 0, angle: 0.4, share: 0.018 },
    { ring: 1, angle: 2.6, share: 0.008 },
    { ring: 2, angle: 4.4, share: 0.008 },
  ];
  for (let i = 0; i < count; i++) {
    const pick = rand();
    let acc = 0;
    const sat = satellites.find((candidate) => (acc += candidate.share) > pick);
    if (sat) {
      const r = ORBIT_RADII[sat.ring] + gauss(rand) * 0.012;
      const th = sat.angle + gauss(rand) * 0.025;
      pos.set([Math.cos(th) * r, gauss(rand) * 0.012, Math.sin(th) * r], i * 3);
      tone[i] = 1;
      cell[i * 4 + 3] = 2;
    } else if (rand() < 0.75) {
      const ring = Math.floor(rand() * ORBIT_RADII.length);
      const r = ORBIT_RADII[ring] + gauss(rand) * 0.014;
      const th = rand() * Math.PI * 2;
      pos.set([Math.cos(th) * r, gauss(rand) * 0.01, Math.sin(th) * r], i * 3);
      tone[i] = 0.25 + rand() * 0.15;
    } else {
      // Polvo tenue entre órbitas.
      const r = 1.3 + rand() * 1.5;
      const th = rand() * Math.PI * 2;
      pos.set([Math.cos(th) * r, gauss(rand) * 0.05, Math.sin(th) * r], i * 3);
      tone[i] = 0.15;
    }
  }
  return { pos, tone, cell };
}

// 04 · Galaxia: bulbo central, dos brazos logarítmicos y un disco tenue entre brazos.
function spiral(count: number): Formation {
  const rand = rng(404);
  const pos = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const kind = rand();
    let x: number;
    let y: number;
    let z: number;
    let t: number;
    if (kind < 0.18) {
      // Bulbo
      const r = Math.abs(gauss(rand)) * 0.45;
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      x = r * s * Math.cos(th);
      y = r * u * 0.6;
      z = r * s * Math.sin(th);
      t = 0.95;
    } else if (kind < 0.82) {
      // Brazos
      const arm = rand() < 0.5 ? 0 : Math.PI;
      const r = 0.45 + Math.pow(rand(), 0.85) * 2.25;
      const spread = gauss(rand) * (0.16 + r * 0.07);
      const th = arm + 2.3 * Math.log(1 + r * 1.4) + spread;
      x = Math.cos(th) * r;
      z = Math.sin(th) * r;
      y = gauss(rand) * 0.05;
      t = 0.55 + 0.45 * Math.exp(-Math.abs(spread) * 4);
    } else {
      // Disco entre brazos
      const r = 0.5 + rand() * 2.4;
      const th = rand() * Math.PI * 2;
      x = Math.cos(th) * r;
      z = Math.sin(th) * r;
      y = gauss(rand) * 0.07;
      t = 0.2;
    }
    pos.set([x, y, z], i * 3);
    tone[i] = t;
  }
  return { pos, tone };
}

// 05 · Disco protoplanetario: anillos con huecos (como HL Tau) y grumos que forman planetas.
const DISK_GAPS = [
  { r: 1.18, w: 0.08 },
  { r: 1.72, w: 0.09 },
  { r: 2.28, w: 0.07 },
];

function disk(count: number): Formation {
  const rand = rng(505);
  const pos = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  const clumpAngles = [0.6, 2.9, 4.7];
  for (let i = 0; i < count; i++) {
    let r: number;
    let th: number;
    let t: number;
    if (rand() < 0.07) {
      // Planetesimales: cúmulos dentro de cada hueco
      const g = Math.floor(rand() * DISK_GAPS.length);
      r = DISK_GAPS[g].r + gauss(rand) * 0.035;
      th = clumpAngles[g] + gauss(rand) * 0.06;
      t = 1;
    } else {
      do {
        r = 0.62 + Math.pow(rand(), 0.9) * 2.25;
      } while (DISK_GAPS.some((gap) => Math.abs(r - gap.r) < gap.w));
      th = rand() * Math.PI * 2;
      t = 0.35 + 0.35 * (0.5 + 0.5 * Math.cos(r * 9)) + (r < 0.9 ? 0.3 : 0);
    }
    const flare = 0.018 + r * 0.012;
    pos.set([Math.cos(th) * r, gauss(rand) * flare, Math.sin(th) * r], i * 3);
    tone[i] = Math.min(1, t);
  }
  return { pos, tone };
}

const BUILDERS: Record<Shape, (count: number) => Formation> = { shell, burst, surface, stars, spiral, disk, cells, orbits };

export interface EraParticles {
  object: Group;
  setEra(era: Era, duration: number): void;
  update(elapsed: number, delta: number, anchor: Vector3, scale: number): void;
  setViewport(resolution: Vector2, textEdge: number, pixelRatio: number): void;
  /** Fracción de partículas que se dibujan (calidad adaptativa). */
  setDensity(fraction: number): void;
  dispose(): void;
}

export function createEraParticles(reducedMotion: boolean): EraParticles {
  const lowPower = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  const count = lowPower ? 1200 : 2500;
  const cache = new Map<Shape, Formation>();
  const formation = (shape: Shape) => {
    let f = cache.get(shape);
    if (!f) {
      f = BUILDERS[shape](count);
      cache.set(shape, f);
    }
    return f;
  };

  const start = formation('shell');
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seedRand = rng(7);
  for (let i = 0; i < count; i++) {
    seeds[i] = seedRand();
    sizes[i] = 0.6 + Math.pow(seedRand(), 2.2) * 1.8;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(start.pos.slice(), 3));
  geometry.setAttribute('aTarget', new BufferAttribute(start.pos.slice(), 3));
  geometry.setAttribute('aTone', new BufferAttribute(start.tone.slice(), 1));
  geometry.setAttribute('aToneTarget', new BufferAttribute(start.tone.slice(), 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aCell', new BufferAttribute(new Float32Array(count * 4), 4));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uMix: { value: 1 },
      uPhase: { value: 0 },
      uAlpha: { value: 0 },
      uStream: { value: 0 },
      uStarMode: { value: 0 },
      uIgnite: { value: 1.1 },
      uCellMode: { value: 0 },
      uOrbitMode: { value: 0 },
      uMotion: { value: reducedMotion ? 0 : 1 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uColorA: { value: new Color(ERA_PRESETS.hot.blobA) },
      uColorB: { value: new Color(ERA_PRESETS.hot.blobB) },
      uResolution: { value: new Vector2(1, 1) },
      uTextEdge: { value: 0.55 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aTarget;
      attribute float aTone;
      attribute float aToneTarget;
      attribute float aSeed;
      attribute float aSize;
      attribute vec4 aCell;
      uniform float uTime;
      uniform float uMix;
      uniform float uPhase;
      uniform float uMotion;
      uniform float uPixelRatio;
      uniform float uStream;
      uniform float uStarMode;
      uniform float uIgnite;
      uniform float uCellMode;
      uniform float uOrbitMode;
      varying float vTone;
      varying float vTwinkle;
      varying float vBright;

      void main() {
        // Llegada escalonada: cada partícula sale con un pequeño retraso según su semilla.
        float m = clamp(uMix * 1.4 - aSeed * 0.4, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        vec3 p = mix(position, aTarget, m);
        // Arco durante el viaje, para que el cambio se lea como un remolino y no como un fundido.
        vec3 drift = normalize(vec3(aSeed - 0.5, fract(aSeed * 7.31) - 0.5, fract(aSeed * 13.17) - 0.5) + 1e-4);
        p += drift * sin(m * 3.14159) * 0.45;
        // 01 · Inflación: flujo radial continuo; cada partícula nace cerca del centro y se aleja.
        float streamFade = 1.0;
        if (uStream > 0.001) {
          float len = length(p);
          float f = fract(uTime * 0.07 * uMotion + aSeed);
          p = mix(p, p / max(len, 1e-4) * len * (0.12 + f * 1.15), uStream);
          streamFade = mix(1.0, sin(f * 3.14159), uStream);
        }
        // 06 · Vida: cada célula aparece, se estira, se parte en dos y se desvanece para volver a formarse.
        float cellFade = 1.0;
        if (uCellMode > 0.001) {
          float ph = fract(uTime * 0.045 * uMotion + aCell.w);
          p += aCell.xyz * smoothstep(0.25, 0.7, ph) * 0.3 * uCellMode;
          cellFade = mix(1.0, smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.82, 0.97, ph)), uCellMode);
        }
        // Rotación diferencial alrededor del eje del disco: el centro gira más rápido.
        float r = length(p.xz);
        float ang = uPhase * (0.25 + 0.9 / pow(0.45 + r, 1.5));
        float c = cos(ang);
        float s = sin(ang);
        p.xz = mat2(c, -s, s, c) * p.xz;

        vTone = mix(aTone, aToneTarget, m);
        vTwinkle = mix(1.0, 0.65 + 0.35 * sin(uTime * (0.8 + aSeed * 1.7) + aSeed * 40.0), uMotion);
        // 03 · Ignición: se encienden en orden de semilla con un destello; ~1.5 % estalla de vez en cuando.
        float lit = mix(1.0, smoothstep(aSeed - 0.02, aSeed + 0.02, uIgnite), uStarMode);
        float flare = uStarMode * exp(-pow((uIgnite - aSeed) * 25.0, 2.0)) * 2.5;
        float nova = uStarMode * uMotion * step(0.985, aSeed) * pow(max(0.0, sin(uTime * 0.7 + aSeed * 50.0)), 60.0) * 3.0;
        // 07 · Ahora: los satélites (marcados con aCell.w = 2) brillan y se ven más grandes.
        float satellite = uOrbitMode * step(1.5, aCell.w);
        vBright = lit * (1.0 + flare + nova + satellite * 1.2) * streamFade * cellFade;
        float sizeBoost = mix(1.0, 0.7 + 1.5 * vTone, uStarMode) * (1.0 + (flare + nova) * 0.6) * (1.0 + satellite * 1.4);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(aSize * sizeBoost * uPixelRatio * (160.0 / -mv.z), 7.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uAlpha;
      uniform vec2 uResolution;
      uniform float uTextEdge;
      varying float vTone;
      varying float vTwinkle;
      varying float vBright;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= a;
        // Igual que las estrellas: más tenues sobre la columna de texto.
        float inText = 1.0 - smoothstep(uTextEdge - 0.1, uTextEdge + 0.05, gl_FragCoord.x / uResolution.x);
        vec3 col = mix(uColorB, uColorA, vTone) * (0.6 + vTone * 0.8) * min(vBright, 1.6);
        gl_FragColor = vec4(col, a * uAlpha * vTwinkle * min(vBright, 1.0) * (0.35 + 0.65 * vTone) * (1.0 - 0.6 * inText));
      }
    `,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  const group = new Group();
  group.add(points);
  group.rotation.set(FORMATIONS.hot.tiltX, 0, FORMATIONS.hot.tiltZ);

  const spinState = { value: 0 };
  const scaleState = { value: 1 };
  let currentShape: Shape = 'shell';

  // Fija como origen la posición mezclada actual, para que una transición interrumpida no salte.
  const bakeCurrent = () => {
    const from = geometry.attributes.position.array as Float32Array;
    const to = geometry.attributes.aTarget.array as Float32Array;
    const toneFrom = geometry.attributes.aTone.array as Float32Array;
    const toneTo = geometry.attributes.aToneTarget.array as Float32Array;
    const mix = material.uniforms.uMix.value as number;
    for (let i = 0; i < count; i++) {
      let m = Math.min(1, Math.max(0, mix * 1.4 - seeds[i] * 0.4));
      m = m * m * (3 - 2 * m);
      for (let k = 0; k < 3; k++) from[i * 3 + k] += (to[i * 3 + k] - from[i * 3 + k]) * m;
      toneFrom[i] += (toneTo[i] - toneFrom[i]) * m;
    }
  };

  const setEra = (era: Era, duration: number) => {
    const spec = FORMATIONS[era];
    const preset = ERA_PRESETS[era];
    const d = reducedMotion ? 0 : duration;

    if (spec.shape !== currentShape) {
      currentShape = spec.shape;
      bakeCurrent();
      const next = formation(spec.shape);
      (geometry.attributes.aTarget.array as Float32Array).set(next.pos);
      (geometry.attributes.aToneTarget.array as Float32Array).set(next.tone);
      if (next.cell) {
        (geometry.attributes.aCell.array as Float32Array).set(next.cell);
        geometry.attributes.aCell.needsUpdate = true;
      }
      for (const name of ['position', 'aTarget', 'aTone', 'aToneTarget']) geometry.attributes[name].needsUpdate = true;
      gsap.killTweensOf(material.uniforms.uMix);
      material.uniforms.uMix.value = d ? 0 : 1;
      if (d) gsap.to(material.uniforms.uMix, { value: 1, duration: d * 1.15, ease: 'power2.inOut' });
    }

    gsap.to(material.uniforms.uAlpha, { value: spec.alpha, duration: d, ease: 'power2.inOut', overwrite: true });
    gsap.to(material.uniforms.uStream, { value: spec.stream ?? 0, duration: d, ease: 'power2.inOut', overwrite: true });
    gsap.to(material.uniforms.uStarMode, { value: spec.ignite ?? 0, duration: d * 0.5, ease: 'power2.out', overwrite: true });
    gsap.to(material.uniforms.uCellMode, { value: spec.cells ?? 0, duration: d, ease: 'power2.inOut', overwrite: true });
    gsap.to(material.uniforms.uOrbitMode, { value: spec.orbits ?? 0, duration: d, ease: 'power2.inOut', overwrite: true });
    // Cada vez que se entra a las primeras estrellas, se vuelven a encender una a una.
    if (spec.ignite && d) {
      gsap.fromTo(material.uniforms.uIgnite, { value: 0 }, { value: 1.1, duration: 5, delay: d * 0.6, ease: 'power1.inOut', overwrite: true });
    } else if (!spec.ignite) {
      gsap.killTweensOf(material.uniforms.uIgnite);
      material.uniforms.uIgnite.value = 1.1;
    }
    gsap.to(spinState, { value: reducedMotion ? 0 : spec.spin, duration: d, ease: 'power2.inOut', overwrite: true });
    gsap.to(scaleState, { value: spec.scale ?? 1, duration: d, ease: 'power2.inOut', overwrite: true });
    gsap.to(group.rotation, { x: spec.tiltX, z: spec.tiltZ, duration: d, ease: 'power2.inOut', overwrite: true });
    const a = new Color(spec.colorA ?? preset.blobA);
    const b = new Color(spec.colorB ?? preset.blobB);
    gsap.to(material.uniforms.uColorA.value, { r: a.r, g: a.g, b: a.b, duration: d, overwrite: true });
    gsap.to(material.uniforms.uColorB.value, { r: b.r, g: b.g, b: b.b, duration: d, overwrite: true });
  };

  const update = (elapsed: number, delta: number, anchor: Vector3, scale: number) => {
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uPhase.value += delta * spinState.value;
    group.position.copy(anchor);
    group.scale.setScalar(scale * scaleState.value);
    group.visible = material.uniforms.uAlpha.value > 0.001;
  };

  const setViewport = (resolution: Vector2, textEdge: number, pixelRatio: number) => {
    material.uniforms.uResolution.value.copy(resolution);
    material.uniforms.uTextEdge.value = textEdge;
    material.uniforms.uPixelRatio.value = pixelRatio;
  };

  // Las formaciones reparten sus partes a lo largo del índice, así que un prefijo conserva la forma.
  const setDensity = (fraction: number) => {
    geometry.setDrawRange(0, Math.max(1, Math.floor(count * fraction)));
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { object: group, setEra, update, setViewport, setDensity, dispose };
}
