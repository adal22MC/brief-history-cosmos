import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  SRGBColorSpace,
} from 'three/src/constants.js';
import { BufferAttribute } from 'three/src/core/BufferAttribute.js';
import { BufferGeometry } from 'three/src/core/BufferGeometry.js';
import { CanvasTexture } from 'three/src/textures/CanvasTexture.js';
import { Clock } from 'three/src/core/Clock.js';
import { Group } from 'three/src/objects/Group.js';
import { Line } from 'three/src/objects/Line.js';
import { LineBasicMaterial } from 'three/src/materials/LineBasicMaterial.js';
import { LineDashedMaterial } from 'three/src/materials/LineDashedMaterial.js';
import { Mesh } from 'three/src/objects/Mesh.js';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial.js';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js';
import { Points } from 'three/src/objects/Points.js';
import { PointsMaterial } from 'three/src/materials/PointsMaterial.js';
import { Scene } from 'three/src/scenes/Scene.js';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial.js';
import { SphereGeometry } from 'three/src/geometries/SphereGeometry.js';
import { Sprite } from 'three/src/objects/Sprite.js';
import { SpriteMaterial } from 'three/src/materials/SpriteMaterial.js';
import { TextureLoader } from 'three/src/loaders/TextureLoader.js';
import { Vector3 } from 'three/src/math/Vector3.js';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';
import type { Material } from 'three/src/materials/Material.js';
import type { Texture } from 'three/src/textures/Texture.js';

export interface IssTrackPoint {
  lat: number;
  lon: number;
}

export interface IssGlobeAPI {
  updatePosition(lat: number, lon: number): void;
  /** Punto subsolar: define qué hemisferio está de día. */
  setSun(lat: number, lon: number): void;
  /** Traza sobre el suelo: tramo recorrido y tramo por recorrer. */
  setTrack(past: IssTrackPoint[], next: IssTrackPoint[]): void;
  destroy(): void;
}

// ISS orbita a ~420 km; radio terrestre 6371 km → escala relativa 1.064.
const ORBIT_RADIUS = 1.064;
const LAND_TEXTURE_URL = '/textures/earth-land.webp';

// Mismo mapeo que los UV de SphereGeometry, así la textura equirectangular cae en su lugar.
function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function greatCirclePath(points: IssTrackPoint[], radius: number) {
  const out: number[] = [];
  const dirs = points.map(({ lat, lon }) => latLonToVec3(lat, lon, 1));
  dirs.forEach((b, i) => {
    if (i === 0) {
      out.push(b.x * radius, b.y * radius, b.z * radius);
      return;
    }
    const a = dirs[i - 1];
    const angle = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
    const steps = Math.max(1, Math.ceil(angle / 0.03));
    const sin = Math.sin(angle);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const wa = sin > 1e-6 ? Math.sin((1 - t) * angle) / sin : 1 - t;
      const wb = sin > 1e-6 ? Math.sin(t * angle) / sin : t;
      const v = a.clone().multiplyScalar(wa).addScaledVector(b, wb).normalize().multiplyScalar(radius);
      out.push(v.x, v.y, v.z);
    }
  });
  return new Float32Array(out);
}

function shortestAngle(delta: number) {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

function createIssLabel() {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128;
  labelCanvas.height = 48;
  const ctx = labelCanvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    ctx.fillStyle = 'rgba(6, 10, 22, 0.72)';
    ctx.strokeStyle = 'rgba(255, 180, 92, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(18, 10, 92, 28, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff2c2';
    ctx.font = '700 18px Manrope, system-ui, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ISS', 64, 25);
  }

  const texture = new CanvasTexture(labelCanvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(
    new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.scale.set(0.52, 0.2, 1);
  sprite.position.set(0.24, 0.13, 0);
  sprite.renderOrder = 20;
  return { sprite, texture };
}

export function initIssGlobe(canvas: HTMLCanvasElement): IssGlobeAPI {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.18, 4.35);
  camera.lookAt(0, 0, 0);

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    const w = Math.max(width, 1);
    const h = Math.max(height, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // Todo lo que está fijo a la Tierra (continentes, nubes, traza) gira junto.
  const globe = new Group();
  scene.add(globe);

  const earthGeo = new SphereGeometry(1, 96, 96);
  const earthMat = new ShaderMaterial({
    uniforms: {
      uLand: { value: null as Texture | null },
      uHasLand: { value: 0 },
      uSun: { value: latLonToVec3(0, 0, 1) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLand;
      uniform float uHasLand;
      uniform vec3 uSun;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
              mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
              mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
          f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }
      void main() {
        // Máscara de tierra real (Natural Earth); el ruido solo aporta textura.
        float landMask = texture2D(uLand, vUv).r * uHasLand;
        float detail = fbm(vPos * 6.0);
        vec3 ocean = vec3(0.012, 0.07, 0.17) * (0.94 + 0.12 * detail);
        vec3 land = mix(vec3(0.1, 0.27, 0.17), vec3(0.2, 0.33, 0.19), detail);
        vec3 ice = vec3(0.6, 0.72, 0.8);
        vec3 col = mix(ocean, land, landMask);
        float lat = abs(normalize(vPos).y);
        col = mix(col, ice, smoothstep(0.93, 0.99, lat) * 0.7);
        // Costa: el borde de la máscara se ilumina para que los continentes se lean de lejos.
        float coast = clamp(length(vec2(dFdx(landMask), dFdy(landMask))) * 5.0, 0.0, 1.0);

        // Luz del Sol real: el terminador separa día y noche según el punto subsolar.
        float sunDot = dot(normalize(vPos), uSun);
        float day = smoothstep(-0.12, 0.25, sunDot);
        col *= 0.12 + day * 1.05;
        col += vec3(0.45, 0.75, 0.6) * coast * (0.12 + day * 0.3);
        float night = 1.0 - smoothstep(-0.25, 0.05, sunDot);
        float cities = smoothstep(0.62, 0.72, fbm(vPos * 14.0 + vec3(2.0))) * landMask * night;
        col += vec3(1.0, 0.62, 0.25) * cities * 0.35;

        // Rim azul tipo atmósfera.
        float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
        col += vec3(0.28, 0.58, 1.0) * rim * 0.5;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const earth = new Mesh(earthGeo, earthMat);
  globe.add(earth);

  let landTexture: Texture | null = null;
  new TextureLoader().load(
    LAND_TEXTURE_URL,
    (texture) => {
      landTexture = texture;
      earthMat.uniforms.uLand.value = texture;
      earthMat.uniforms.uHasLand.value = 1;
    },
    undefined,
    (err) => console.warn('ISS land texture failed to load:', err),
  );

  const cloudGeo = new SphereGeometry(1.018, 64, 64);
  const cloudMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormal;
      void main() {
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormal;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
              mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
              mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
          f.z);
      }
      void main() {
        float n = noise(vPos * 8.0 + vec3(uTime * 0.035, 0.0, uTime * 0.02));
        float cloud = smoothstep(0.48, 0.7, n);
        float rimFade = smoothstep(0.05, 0.8, abs(dot(vNormal, vec3(0.0, 0.0, 1.0))));
        gl_FragColor = vec4(vec3(0.82, 0.92, 1.0), cloud * rimFade * 0.07);
      }
    `,
  });
  const clouds = new Mesh(cloudGeo, cloudMat);
  globe.add(clouds);

  // Halo atmosférico exterior (simétrico, no necesita girar).
  const haloGeo = new SphereGeometry(1.06, 64, 64);
  const haloMat = new ShaderMaterial({
    transparent: true,
    side: BackSide,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.7 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
        gl_FragColor = vec4(0.22, 0.62, 1.0, intensity * 0.6);
      }
    `,
  });
  const halo = new Mesh(haloGeo, haloMat);
  scene.add(halo);

  // Traza: tramo recorrido sólido y tramo por recorrer punteado. La Tierra oculta el lado lejano.
  const pastMat = new LineBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0.8 });
  const nextMat = new LineDashedMaterial({
    color: 0x7fd7ff,
    transparent: true,
    opacity: 0.55,
    dashSize: 0.035,
    gapSize: 0.03,
  });
  const pastLine = new Line(new BufferGeometry(), pastMat);
  const nextLine = new Line(new BufferGeometry(), nextMat);
  globe.add(pastLine, nextLine);

  // Marcador ISS: vive fuera del globo para que la etiqueta no gire con la Tierra.
  const issGroup = new Group();
  const issCore = new Mesh(
    new SphereGeometry(0.04, 20, 20),
    new MeshBasicMaterial({ color: 0xfff2c2, depthTest: false, depthWrite: false }),
  );
  const issGlow = new Mesh(
    new SphereGeometry(0.13, 24, 24),
    new MeshBasicMaterial({
      color: 0xffb45c,
      transparent: true,
      opacity: 0.36,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const { sprite: issLabel, texture: issLabelTexture } = createIssLabel();
  issCore.renderOrder = 21;
  issGlow.renderOrder = 20;
  issGroup.add(issCore, issGlow, issLabel);
  issGroup.visible = false;
  scene.add(issGroup);
  const issLocal = new Vector3();

  const starCount = 90;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 4.6 + Math.random() * 2.4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
  }
  const starsGeo = new BufferGeometry();
  starsGeo.setAttribute('position', new BufferAttribute(starPositions, 3));
  const starsMat = new PointsMaterial({
    color: 0xdfeaff,
    size: 0.014,
    transparent: true,
    opacity: 0.32,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const stars = new Points(starsGeo, starsMat);
  scene.add(stars);

  resize();
  requestAnimationFrame(resize);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // La cámara "persigue" a la ISS: el globo gira hasta dejarla de frente.
  const target = { x: 0.2, y: 0 };
  let hasPosition = false;

  let raf = 0;
  let running = false;
  const clock = new Clock();
  const tick = () => {
    if (!running) return;
    const t = clock.getElapsedTime();
    cloudMat.uniforms.uTime.value = t;
    if (hasPosition) {
      globe.rotation.y += shortestAngle(target.y - globe.rotation.y) * 0.04;
      globe.rotation.x += (target.x - globe.rotation.x) * 0.04;
      issGroup.position.copy(issLocal).applyEuler(globe.rotation);
    } else {
      globe.rotation.y = t * 0.08;
      globe.rotation.x = target.x;
    }
    clouds.rotation.y = t * 0.012;
    stars.rotation.y = t * 0.01;
    issGlow.scale.setScalar(1 + Math.sin(t * 3.1) * 0.18);
    issLabel.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  // Solo dibuja mientras el globo está en pantalla y la pestaña visible.
  let onScreen = false;
  const syncRunning = () => {
    const shouldRun = onScreen && !document.hidden;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) raf = requestAnimationFrame(tick);
    else cancelAnimationFrame(raf);
  };
  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    syncRunning();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', syncRunning);

  const updatePosition = (lat: number, lon: number) => {
    issLocal.copy(latLonToVec3(lat, lon, ORBIT_RADIUS));
    target.y = -Math.atan2(issLocal.x, issLocal.z);
    target.x = Math.atan2(issLocal.y, Math.hypot(issLocal.x, issLocal.z)) * 0.6;
    if (!hasPosition) {
      hasPosition = true;
      globe.rotation.set(target.x, target.y, 0);
      issGroup.visible = true;
    }
  };

  const setSun = (lat: number, lon: number) => {
    earthMat.uniforms.uSun.value.copy(latLonToVec3(lat, lon, 1));
  };

  const setLine = (line: Line, points: IssTrackPoint[]) => {
    line.geometry.dispose();
    const geo = new BufferGeometry();
    if (points.length > 1) geo.setAttribute('position', new BufferAttribute(greatCirclePath(points, ORBIT_RADIUS), 3));
    line.geometry = geo;
    if (points.length > 1 && line.material instanceof LineDashedMaterial) line.computeLineDistances();
  };

  const setTrack = (past: IssTrackPoint[], next: IssTrackPoint[]) => {
    setLine(pastLine, past);
    setLine(nextLine, next);
  };

  const destroy = () => {
    running = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    document.removeEventListener('visibilitychange', syncRunning);
    ro.disconnect();
    earthGeo.dispose();
    earthMat.dispose();
    landTexture?.dispose();
    cloudGeo.dispose();
    cloudMat.dispose();
    haloGeo.dispose();
    haloMat.dispose();
    pastLine.geometry.dispose();
    nextLine.geometry.dispose();
    pastMat.dispose();
    nextMat.dispose();
    issCore.geometry.dispose();
    (issCore.material as Material).dispose();
    issGlow.geometry.dispose();
    (issGlow.material as Material).dispose();
    issLabelTexture.dispose();
    (issLabel.material as Material).dispose();
    starsGeo.dispose();
    starsMat.dispose();
    renderer.dispose();
  };

  return { updatePosition, setSun, setTrack, destroy };
}
