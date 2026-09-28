import {
  AdditiveBlending,
  BackSide,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
} from 'three/src/constants.js';
import { BufferAttribute } from 'three/src/core/BufferAttribute.js';
import { BufferGeometry } from 'three/src/core/BufferGeometry.js';
import { Color } from 'three/src/math/Color.js';
import { Mesh } from 'three/src/objects/Mesh.js';
import { Points } from 'three/src/objects/Points.js';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial.js';
import { SphereGeometry } from 'three/src/geometries/SphereGeometry.js';
import { Vector2 } from 'three/src/math/Vector2.js';
import { Vector3 } from 'three/src/math/Vector3.js';
import type { Camera } from 'three/src/cameras/Camera.js';
import type { Object3D } from 'three/src/core/Object3D.js';
import { gsap } from 'gsap';
import { ERA_PRESETS, type Era, type SkyWeight } from './era-presets';

// Cielo por era: aurora de fondo, estrellas lejanas y la estela que deja cada cambio de capítulo.
// Cada era enciende su firma (velo, banda, cáusticas…) con pesos que se animan al cambiar.

const SKY_WEIGHTS: SkyWeight[] = ['veil', 'speckle', 'ignite', 'band', 'glow', 'caustics', 'horizon', 'flow'];

export interface SkyFrame {
  camera: Camera;
  /** Posición del blob: origen de la estela, del brillo del plasma y de la luz zodiacal. */
  origin: Vector3;
  mouse: Vector2;
  scroll: number;
  /** Velocidad de scroll en pantallas por segundo. */
  velocity: number;
}

export interface EraSky {
  objects: Object3D[];
  /** Destello cálido del desacople; lo anima la escena junto con el del blob. */
  flash: { value: number };
  setEra(era: Era, duration: number, transition: boolean): void;
  update(elapsed: number, delta: number, frame: SkyFrame): void;
  setViewport(resolution: Vector2, textEdge: number, pixelRatio: number): void;
  /** Calidad adaptativa: menos octavas de ruido y sin detalles caros. */
  setDensity(fraction: number): void;
  dispose(): void;
}

// La banda de la galaxia cruza la mitad derecha en diagonal, lejos de la columna de texto.
function bandNormal(aspect: number, target: Vector3) {
  const halfW = Math.tan(Math.PI / 6) * aspect;
  const top = new Vector3(halfW * 0.2, 0.62, -1).normalize();
  const bottom = new Vector3(halfW * 0.85, -0.62, -1).normalize();
  return target.crossVectors(top, bottom).normalize();
}

export function createEraSky(reducedMotion: boolean): EraSky {
  const weights = Object.fromEntries(SKY_WEIGHTS.map((key) => [key, { value: 0 }])) as Record<SkyWeight, { value: number }>;
  const flash = { value: 0 };
  const shared = {
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uTextEdge: { value: 0.55 },
    uBandNormal: { value: bandNormal(window.innerWidth / window.innerHeight, new Vector3()) },
    uLite: { value: 0 },
  };

  // ───────── Aurora: esfera que envuelve la cámara con un campo de color animado.
  const skyUniforms = {
    ...shared,
    uTintA: { value: new Color(ERA_PRESETS.hot.auroraA) },
    uTintB: { value: new Color(ERA_PRESETS.hot.auroraB) },
    uPrevA: { value: new Color(ERA_PRESETS.hot.auroraA) },
    uPrevB: { value: new Color(ERA_PRESETS.hot.auroraB) },
    uFront: { value: new Color(ERA_PRESETS.hot.blobA) },
    uWipe: { value: 1 },
    uOrigin: { value: new Vector3(0, 0, -1) },
    uEcliptic: { value: new Vector3(-0.6, 0.8, 0).normalize() },
    uIntensity: { value: ERA_PRESETS.hot.auroraIntensity },
    uOctaves: { value: 5 },
    uFlash: flash,
    uFlow: weights.flow,
    uVeil: weights.veil,
    uSpeckle: weights.speckle,
    uBand: weights.band,
    uGlow: weights.glow,
    uCaustics: weights.caustics,
    uHorizon: weights.horizon,
  };

  const skyVertex = /* glsl */ `
    varying vec3 vPos;
    varying vec3 vWorld;
    void main() {
      vPos = position;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `;

  // Lo que comparten la aurora y las capas: ruido, dirección y los tintes que va dejando la estela.
  const skyCommon = /* glsl */ `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uTextEdge;
    uniform float uLite;
    uniform float uOctaves;
    uniform vec3 uTintA;
    uniform vec3 uTintB;
    uniform vec3 uPrevA;
    uniform vec3 uPrevB;
    uniform vec3 uFront;
    uniform float uWipe;
    uniform vec3 uOrigin;
    uniform vec3 uBandNormal;
    uniform vec3 uEcliptic;
    uniform float uIntensity;
    uniform float uFlash;
    uniform float uFlow;
    uniform float uVeil;
    uniform float uSpeckle;
    uniform float uBand;
    uniform float uGlow;
    uniform float uCaustics;
    uniform float uHorizon;
    varying vec3 vPos;
    varying vec3 vWorld;

    // Hash + noise 3D ligero para no replicar el del blob.
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z
      );
    }
    float fbm(vec3 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) {
        if (float(i) >= uOctaves) break;
        v += a * noise(p); p *= 2.1; a *= 0.5;
      }
      return v;
    }

    // dir gira con el cielo (ruido); view queda fijo a la cámara (efectos anclados al blob o a la pantalla).
    vec3 dir;
    vec3 view;
    float lat;
    float ang;
    float calm;
    float front;
    vec3 flowOffset;
    vec3 tintA;
    vec3 tintB;

    void setupSky() {
      dir = normalize(vPos);
      view = normalize(vWorld - cameraPosition);
      lat = dir.y;
      ang = acos(clamp(dot(view, uOrigin), -1.0, 1.0));
      // Sobre la columna de texto las firmas se atenúan.
      float inText = 1.0 - smoothstep(uTextEdge - 0.1, uTextEdge + 0.05, gl_FragCoord.x / uResolution.x);
      calm = 1.0 - 0.5 * inText;
      // uFlow desplaza el ruido en una dirección preferente (corriente).
      flowOffset = vec3(uTime * (0.04 + uFlow * 0.12), uFlow * uTime * 0.08, uTime * 0.02);
      // Estela: los tintes de la era nueva inundan el cielo desde el blob hacia afuera.
      front = uWipe * 2.0;
      float fresh = 1.0 - smoothstep(front - 0.45, front, ang);
      tintA = mix(uPrevA, uTintA, fresh);
      tintB = mix(uPrevB, uTintB, fresh);
    }
  `;

  const auroraGeo = new SphereGeometry(60, 32, 32);
  const auroraMat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: skyVertex,
    fragmentShader: /* glsl */ `
      ${skyCommon}
      void main() {
        setupSky();
        float bands = fbm(dir * 1.5 + flowOffset);
        float curtain = smoothstep(0.35, 0.85, bands - lat * 0.4);
        // Cada zona del cielo toma uno u otro tinte, así la era muestra sus dos colores.
        float split = smoothstep(0.3, 0.75, noise(dir * 2.3 + flowOffset * 0.7 + 7.0));
        vec3 hue = mix(tintA, tintB, split);
        vec3 deep = vec3(0.015, 0.018, 0.045);
        vec3 color = mix(deep, hue, curtain * uIntensity);
        color *= smoothstep(-0.9, 0.4, lat + 0.3);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const aurora = new Mesh(auroraGeo, auroraMat);

  // Cada firma es una capa propia que solo se dibuja mientras su peso es mayor que cero:
  // un if sobre un uniform no siempre se salta en la GPU, y así cada era paga solo lo que muestra.
  // Salida premultiplicada: rgb se suma y alpha oscurece lo de abajo (alpha 1 reemplaza, como el velo).
  const layer = (weight: { value: number }, body: string, order: number) => {
    const material = new ShaderMaterial({
      side: BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      uniforms: skyUniforms,
      vertexShader: skyVertex,
      fragmentShader: /* glsl */ `
        ${skyCommon}
        void main() {
          setupSky();
          vec3 add = vec3(0.0);
          float darken = 0.0;
          ${body}
          gl_FragColor = vec4(add, darken);
        }
      `,
    });
    const mesh = new Mesh(auroraGeo, material);
    // Antes que las estrellas y las partículas (renderOrder 0), en el orden de las eras.
    mesh.renderOrder = order - 10;
    mesh.visible = false;
    aurora.add(mesh);
    return { mesh, material, weight };
  };

  const layers = [
    // 01 · Inflación: plasma opaco que ondula por el calor y brilla más cerca del blob.
    layer(weights.veil, /* glsl */ `
      vec3 q = dir * 2.2 + vec3(uTime * 0.05, -uTime * 0.03, 0.0);
      vec3 shimmer = vec3(0.0);
      if (uLite < 0.5) shimmer = vec3(noise(q + 3.1), noise(q + 8.7), noise(q + 1.3)) - 0.5;
      float n = fbm(q + shimmer * 1.6 + vec3(0.0, uTime * 0.12, 0.0));
      float heat = exp(-ang * 1.6);
      vec3 plasma = mix(tintA, tintB, smoothstep(0.3, 0.8, n)) * (0.3 + 0.8 * heat) + tintB * heat * heat * 0.3;
      add = plasma * calm * uVeil;
      darken = uVeil;
    `, 1),
    // 02 · Recombinación: manchas tenues calientes y frías, como el mapa de Planck.
    layer(weights.speckle, /* glsl */ `
      vec3 q = dir * 5.0;
      float n = 0.5 * noise(q) + 0.25 * noise(q * 2.03) + 0.125 * noise(q * 4.1);
      vec3 cmb = mix(vec3(0.12, 0.28, 0.75), vec3(1.0, 0.55, 0.2), smoothstep(0.25, 0.62, n / 0.875));
      add = cmb * 0.09 * uSpeckle * calm;
      darken = 0.35 * uSpeckle;
    `, 2),
    // 04 · Galaxia: banda luminosa con grano de estrellas y una franja de polvo que la parte.
    layer(weights.band, /* glsl */ `
      float b = dot(view, uBandNormal);
      // Fuera de la franja la banda ya no aporta: se salta el ruido.
      if (abs(b) < 0.35) {
        float wide = exp(-b * b / 0.022);
        float core = exp(-b * b / 0.004);
        vec3 axis = normalize(cross(uBandNormal, vec3(0.0, 0.0, 1.0)));
        float along = dot(view, axis);
        vec3 q = dir * 4.0 + 11.0;
        float dust = smoothstep(0.32, 0.58, 0.5 * noise(q) + 0.25 * noise(q * 2.1) + 0.125 * noise(q * 4.4));
        float lane = exp(-pow((b + 0.012 * sin(along * 9.0)) / 0.03, 2.0)) * dust;
        float grain = 0.7 + 0.6 * noise(dir * 38.0);
        vec3 bandCol = mix(tintB, vec3(0.95, 0.88, 1.0), 0.35 + core * 0.4);
        add = bandCol * (wide * 0.2 + core * 0.16) * grain * (1.0 - lane * 0.85) * uBand * calm;
      }
    `, 3),
    // 05 · Planetario: luz zodiacal; un cono de polvo que nace en el blob y se afina a lo largo de la eclíptica.
    layer(weights.glow, /* glsl */ `
      // Lejos del blob el cono ya se apagó.
      if (ang < 1.8) {
        vec3 e = normalize(uEcliptic - uOrigin * dot(uEcliptic, uOrigin));
        float perp = dot(view, cross(uOrigin, e));
        float width = 0.05 + 0.3 * exp(-ang * 1.2);
        float cone = exp(-pow(perp / width, 2.0)) * exp(-ang * 1.5);
        float glare = exp(-ang * 7.0) * 0.25;
        float grain = 0.8 + 0.4 * noise(dir * 30.0);
        vec3 dustCol = mix(tintB, vec3(1.0, 0.84, 0.6), 0.55);
        add = dustCol * (cone * 0.3 * grain + glare) * uGlow * calm;
      }
    `, 4),
    // 06 · Vida: cáusticas, como la luz que atraviesa agua en movimiento.
    layer(weights.caustics, /* glsl */ `
      vec3 q = dir * 4.5 + vec3(uTime * 0.03, uTime * 0.02, 0.0);
      float c = pow(1.0 - abs(noise(q + vec3(0.0, uTime * 0.05, 0.0)) - noise(q * 1.3 + vec3(5.2, -uTime * 0.04, 1.7))), 14.0);
      float fine = 0.0;
      if (uLite < 0.5) {
        fine = pow(1.0 - abs(noise(q * 2.1 + 9.0) - noise(q * 2.4 + vec3(3.0, uTime * 0.06, 0.0))), 18.0);
      }
      vec3 causticCol = mix(tintB, vec3(0.6, 1.0, 0.95), 0.35);
      add = causticCol * (c * 0.16 + fine * 0.08) * uCaustics * calm * smoothstep(-0.6, 0.5, lat + 0.2);
    `, 5),
    // 07 · Ahora: borde de la atmósfera abajo y satélites cruzando el cielo (en pantalla).
    layer(weights.horizon, /* glsl */ `
      float aspect = uResolution.x / uResolution.y;
      vec2 uv = gl_FragCoord.xy / uResolution.y;
      // La cima del arco queda a la derecha, fuera de las tarjetas del capítulo.
      float dd = length(uv - vec2(aspect * 0.92, -2.6)) - 2.72;
      float air = exp(-abs(dd) * 90.0) * 0.6 + exp(-max(dd, 0.0) * 14.0) * 0.25 * step(0.0, dd);
      darken = 0.65 * smoothstep(0.0, -0.01, dd) * uHorizon;
      add = mix(tintB * 1.8, vec3(0.35, 0.7, 1.0), 0.6) * air * uHorizon;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float ph = fract(uTime / (26.0 + fi * 9.0) + fi * 0.37);
        vec2 p = mix(vec2(aspect * (0.55 + 0.12 * fi), 1.05), vec2(aspect * (1.05 - 0.07 * fi), 0.25 + 0.2 * fi), ph);
        float px = length(uv - p) * uResolution.y;
        float sat = exp(-px * px * 0.35) * smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.85, 1.0, ph));
        add += vec3(0.9, 0.95, 1.0) * sat * 0.8 * uHorizon * step(0.0, dd);
      }
    `, 6),
  ];

  // Encima de todas las firmas: el frente de la estela y el destello del desacople, que el velo no debe tapar.
  const overlay = layer(flash, /* glsl */ `
    add = uFront * exp(-pow((ang - front) / 0.09, 2.0)) * (1.0 - uWipe) * step(0.001, uWipe) * 0.12;
    add += vec3(1.0, 0.88, 0.62) * uFlash;
  `, 7);

  // ───────── Estrellas: cada una tiene tamaño, fase de parpadeo y turno de encendido propios.
  const starCount = 1400;
  const positions = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const phases = new Float32Array(starCount);
  const births = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    // Distribución en cáscara esférica para evitar acumulación cerca de la cámara.
    const r = 18 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 0.5 + Math.random() * 2.5;
    phases[i] = Math.random();
    births[i] = Math.random();
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new BufferAttribute(positions, 3));
  starGeo.setAttribute('aSize', new BufferAttribute(sizes, 1));
  starGeo.setAttribute('aPhase', new BufferAttribute(phases, 1));
  starGeo.setAttribute('aBirth', new BufferAttribute(births, 1));
  const starMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    uniforms: {
      ...shared,
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      // Inicia en estado "hot" (Big Bang): sin estrellas — el plasma aún no es transparente.
      uDensity: { value: ERA_PRESETS.hot.starDensity },
      uTwinkle: { value: ERA_PRESETS.hot.starTwinkle },
      uBrightness: { value: ERA_PRESETS.hot.starBrightness },
      uWarp: { value: 0 },
      uWarpTint: { value: new Color(ERA_PRESETS.hot.blobA) },
      uIgnite: { value: 1.1 },
      uIgniteMode: weights.ignite,
      uBand: weights.band,
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute float aBirth;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uTwinkle;
      uniform float uWarp;
      uniform float uIgnite;
      uniform float uIgniteMode;
      uniform float uBand;
      uniform vec3 uBandNormal;
      varying float vTwinkle;
      varying float vLit;
      varying float vHalo;
      varying float vScale;
      varying float vStretch;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 mvPos = viewMatrix * world;
        vTwinkle = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 1.6 * uTwinkle + aPhase * 6.28318));
        // 04 · Galaxia: las estrellas se juntan en la banda y se ralean fuera de ella.
        float b = dot(normalize(world.xyz - cameraPosition), uBandNormal);
        float inBand = exp(-b * b / 0.03);
        // 03 · Primeras estrellas: se encienden en orden de nacimiento, con un destello al prender.
        float lit = mix(1.0, smoothstep(aBirth - 0.03, aBirth + 0.03, uIgnite), uIgniteMode);
        float flare = uIgniteMode * exp(-pow((uIgnite - aBirth) * 25.0, 2.0)) * 2.0;
        vLit = lit * (1.0 + flare) * mix(1.0, 0.3 + 1.7 * inBand, uBand);
        // Las primeras en nacer son las más masivas: ionizan una burbuja azul a su alrededor.
        vHalo = uIgniteMode * lit * step(aBirth, 0.05);
        // Tope de tamaño: las estrellas cercanas se volvían discos tipo bokeh sobre el texto.
        float base = min(aSize * uPixelRatio * (180.0 / -mvPos.z), 8.0 * uPixelRatio) * vTwinkle * (1.0 + flare * 0.6);
        // Estela: con scroll rápido las estrellas se estiran en vertical; las cercanas, más.
        vStretch = uWarp * (28.0 / -mvPos.z);
        float size = max(base * (1.0 + vStretch), 44.0 * uPixelRatio * vHalo);
        vScale = size / max(base, 0.001);
        gl_PointSize = size;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDensity;
      uniform float uBrightness;
      uniform vec2 uResolution;
      uniform float uTextEdge;
      uniform vec3 uWarpTint;
      varying float vTwinkle;
      varying float vLit;
      varying float vHalo;
      varying float vScale;
      varying float vStretch;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        // El núcleo ocupa 1/vScale del sprite; en vertical se alarga con la estela.
        float d = length(vec2(c.x * vScale, c.y * vScale / (1.0 + vStretch)));
        // Núcleo brillante + halo suave.
        float core = smoothstep(0.5, 0.0, d);
        float halo = smoothstep(0.5, 0.15, d) * 0.4;
        float streak = 1.0 / (1.0 + vStretch * 0.6);
        float bubble = vHalo * exp(-dot(c, c) * 16.0) * 0.35 * streak;
        float inText = 1.0 - smoothstep(uTextEdge - 0.1, uTextEdge + 0.05, gl_FragCoord.x / uResolution.x);
        float fade = uDensity * (1.0 - 0.55 * inText);
        vec3 col = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.95, 0.85), vTwinkle);
        col = mix(col, uWarpTint, min(vStretch * 0.25, 0.6)) * uBrightness;
        float a = (core + halo) * vTwinkle * vLit * streak;
        gl_FragColor = vec4((col * a + vec3(0.35, 0.55, 1.0) * bubble) * fade, 1.0);
      }
    `,
  });
  const stars = new Points(starGeo, starMat);

  const direction = new Vector3();
  let warp = 0;

  const tweenColor = (target: Color, hex: string, duration: number) => {
    const next = new Color(hex);
    gsap.to(target, { r: next.r, g: next.g, b: next.b, duration, ease: 'power2.inOut', overwrite: true });
  };

  const setEra = (era: Era, duration: number, transition: boolean) => {
    const preset = ERA_PRESETS[era];
    const d = reducedMotion ? 0 : duration;
    const u = auroraMat.uniforms;
    const wipe = u.uWipe;

    gsap.killTweensOf(wipe);
    if (transition && d) {
      // Lo que la estela anterior ya había cubierto pasa a ser el origen, para que un cambio interrumpido no salte.
      (u.uPrevA.value as Color).lerp(u.uTintA.value, wipe.value);
      (u.uPrevB.value as Color).lerp(u.uTintB.value, wipe.value);
      wipe.value = 0;
      gsap.to(wipe, { value: 1, duration: d * 1.3, ease: 'sine.out' });
    } else {
      wipe.value = 1;
    }
    (u.uTintA.value as Color).set(preset.auroraA);
    (u.uTintB.value as Color).set(preset.auroraB);
    if (wipe.value === 1) {
      (u.uPrevA.value as Color).set(preset.auroraA);
      (u.uPrevB.value as Color).set(preset.auroraB);
    }
    (u.uFront.value as Color).set(preset.blobA);
    gsap.to(u.uIntensity, { value: preset.auroraIntensity, duration: d, ease: 'power2.inOut', overwrite: true });

    // Al dejar el plasma, el velo se disuelve despacio tras el destello y recién entonces aparecen las estrellas.
    const revealing = (preset.sky.veil ?? 0) < weights.veil.value - 0.5;
    for (const key of SKY_WEIGHTS) {
      const value = preset.sky[key] ?? 0;
      if (key === 'ignite') {
        gsap.to(weights.ignite, { value, duration: d * 0.5, ease: 'power2.out', overwrite: true });
      } else if (key === 'veil' && revealing) {
        gsap.to(weights.veil, { value, duration: d * 2.2, delay: d * 0.3, ease: 'power2.inOut', overwrite: true });
      } else {
        gsap.to(weights[key], { value, duration: d, ease: 'power2.inOut', overwrite: true });
      }
    }

    // Cada vez que se entra a las primeras estrellas, el cielo se vuelve a encender estrella por estrella.
    const s = starMat.uniforms;
    if (preset.sky.ignite && d) {
      gsap.fromTo(s.uIgnite, { value: 0 }, { value: 1.1, duration: 5, delay: d * 0.6, ease: 'power1.inOut', overwrite: true });
    } else if (!preset.sky.ignite) {
      gsap.killTweensOf(s.uIgnite);
      s.uIgnite.value = 1.1;
    }

    const starDuration = revealing ? d * 1.6 : d;
    const starDelay = revealing ? d * 0.8 : 0;
    for (const [name, value] of [
      ['uDensity', preset.starDensity],
      ['uTwinkle', preset.starTwinkle],
      ['uBrightness', preset.starBrightness],
    ] as const) {
      gsap.to(s[name], { value, duration: starDuration, delay: starDelay, ease: 'power2.inOut', overwrite: true });
    }
    tweenColor(s.uWarpTint.value, preset.blobA, d);
  };

  const update = (elapsed: number, delta: number, frame: SkyFrame) => {
    shared.uTime.value = elapsed;
    direction.copy(frame.origin).sub(frame.camera.position).normalize();
    skyUniforms.uOrigin.value.copy(direction);
    for (const { mesh, weight } of layers) mesh.visible = weight.value > 0.001;
    overlay.mesh.visible = flash.value > 0.001 || skyUniforms.uWipe.value < 1;

    // La estela sigue a la velocidad suavizada; bajo ~0.3 pantallas/s no se nota.
    const target = reducedMotion ? 0 : Math.min(5, Math.max(0, Math.abs(frame.velocity) - 0.3) * 1.6);
    warp += (target - warp) * Math.min(1, delta * 6);
    starMat.uniforms.uWarp.value = warp;

    // Parallax del starfield + giro lento de la aurora.
    stars.rotation.y = elapsed * 0.015 + frame.mouse.x * 0.025;
    stars.rotation.x = frame.scroll * 0.4 + frame.mouse.y * 0.02;
    aurora.rotation.y = elapsed * 0.01;
  };

  const setViewport = (resolution: Vector2, textEdge: number, pixelRatio: number) => {
    shared.uResolution.value.copy(resolution);
    shared.uTextEdge.value = textEdge;
    bandNormal(resolution.x / Math.max(resolution.y, 1), shared.uBandNormal.value);
    starMat.uniforms.uPixelRatio.value = pixelRatio;
  };

  const setDensity = (fraction: number) => {
    starGeo.setDrawRange(0, Math.floor(starCount * fraction));
    auroraMat.uniforms.uOctaves.value = fraction >= 1 ? 5 : fraction >= 0.75 ? 4 : 3;
    shared.uLite.value = fraction < 0.6 ? 1 : 0;
  };

  const dispose = () => {
    auroraGeo.dispose();
    auroraMat.dispose();
    for (const { material } of [...layers, overlay]) material.dispose();
    starGeo.dispose();
    starMat.dispose();
  };

  return { objects: [aurora, stars], flash, setEra, update, setViewport, setDensity, dispose };
}
