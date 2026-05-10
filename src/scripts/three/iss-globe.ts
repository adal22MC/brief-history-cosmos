import * as THREE from 'three';

export interface IssGlobeAPI {
  updatePosition(lat: number, lon: number): void;
  destroy(): void;
}

function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
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
    ctx.font = '700 18px Inter, system-ui, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ISS', 64, 25);
  }

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.18, 4.35);

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    const w = Math.max(width, 1);
    const h = Math.max(height, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // Earth procedural — fbm sobre la posición da un patrón continente/océano estilizado.
  const earthGeo = new THREE.SphereGeometry(1, 96, 96);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
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
        float n = fbm(vPos * 2.2);
        vec3 ocean = vec3(0.015, 0.08, 0.18);
        vec3 land  = vec3(0.08, 0.24, 0.17);
        vec3 ice   = vec3(0.76, 0.9, 1.0);
        float landMask = smoothstep(0.48, 0.55, n);
        vec3 col = mix(ocean, land, landMask);
        // Casquetes polares.
        float lat = abs(normalize(vPos).y);
        col = mix(col, ice, smoothstep(0.78, 0.92, lat));

        // Iluminación direccional fija (sol virtual) + atmósfera.
        vec3 lightDir = normalize(vec3(-0.45, 0.35, 1.0));
        float diff = max(dot(vNormal, lightDir), 0.0);
        float night = smoothstep(0.1, -0.25, dot(vNormal, lightDir));
        float cities = smoothstep(0.64, 0.72, fbm(vPos * 10.0 + vec3(2.0))) * landMask * night;
        col *= 0.18 + diff * 1.05;
        col += vec3(1.0, 0.62, 0.25) * cities * 0.28;

        // Rim azul tipo atmósfera.
        float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
        col += vec3(0.28, 0.58, 1.0) * rim * 0.58;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.rotation.z = THREE.MathUtils.degToRad(-23.4);
  scene.add(earth);

  const cloudGeo = new THREE.SphereGeometry(1.018, 64, 64);
  const cloudMat = new THREE.ShaderMaterial({
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
        gl_FragColor = vec4(vec3(0.82, 0.92, 1.0), cloud * rimFade * 0.18);
      }
    `,
  });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  clouds.rotation.z = earth.rotation.z;
  scene.add(clouds);

  // Halo atmosférico exterior.
  const haloGeo = new THREE.SphereGeometry(1.06, 64, 64);
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
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
  const halo = new THREE.Mesh(haloGeo, haloMat);
  scene.add(halo);

  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.set(THREE.MathUtils.degToRad(51.6), 0, THREE.MathUtils.degToRad(-18));
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(1.064, 0.0035, 8, 180),
    new THREE.MeshBasicMaterial({
      color: 0x7fd7ff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  orbit.renderOrder = 2;
  orbitGroup.add(orbit);
  scene.add(orbitGroup);

  // Marcador ISS — pequeña esfera con halo aditivo.
  const issGroup = new THREE.Group();
  const issCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 20, 20),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c2,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const issGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffb45c,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const { sprite: issLabel, texture: issLabelTexture } = createIssLabel();
  issCore.renderOrder = 21;
  issGlow.renderOrder = 20;
  issGroup.renderOrder = 20;
  issGroup.add(issCore, issGlow, issLabel);
  // ISS orbita a ~408 km, radio terrestre 6371 km → escala relativa 1.064.
  issGroup.position.copy(latLonToVec3(0, 0, 1.064));
  scene.add(issGroup);

  // Estela — línea que sigue al marcador últimas N posiciones.
  const trailMax = 80;
  const trailPos = new Float32Array(trailMax * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.LineBasicMaterial({
    color: 0xffb45c,
    transparent: true,
    opacity: 0.22,
    depthTest: false,
    depthWrite: false,
  });
  const trail = new THREE.Line(trailGeo, trailMat);
  trail.renderOrder = 5;
  scene.add(trail);
  let trailCount = 0;

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
  const starsGeo = new THREE.BufferGeometry();
  starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starsMat = new THREE.PointsMaterial({
    color: 0xdfeaff,
    size: 0.014,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.Points(starsGeo, starsMat);
  scene.add(stars);

  resize();
  requestAnimationFrame(resize);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let raf = 0;
  const clock = new THREE.Clock();
  const tick = () => {
    const t = clock.getElapsedTime();
    earthMat.uniforms.uTime.value = t;
    cloudMat.uniforms.uTime.value = t;
    earth.rotation.y = t * 0.05;
    clouds.rotation.y = t * 0.063;
    halo.rotation.y = t * 0.05;
    issGroup.rotation.y = t * 0.05; // mantiene al ISS solidario con la rotación visual.
    trail.rotation.y = t * 0.05;
    orbitGroup.rotation.z = THREE.MathUtils.degToRad(-18) + Math.sin(t * 0.18) * 0.05;
    stars.rotation.y = t * 0.01;
    const pulse = 1 + Math.sin(t * 3.1) * 0.18;
    issGlow.scale.setScalar(pulse);
    issLabel.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  const updatePosition = (lat: number, lon: number) => {
    const v = latLonToVec3(lat, lon, 1.064);
    issGroup.position.copy(v);
    // Empuja la nueva posición a la estela.
    const idx = (trailCount % trailMax) * 3;
    trailPos[idx] = v.x;
    trailPos[idx + 1] = v.y;
    trailPos[idx + 2] = v.z;
    trailCount++;
    const draw = Math.min(trailCount, trailMax);
    trailGeo.setDrawRange(0, draw);
    trailGeo.attributes.position.needsUpdate = true;
  };

  const destroy = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    earthGeo.dispose();
    earthMat.dispose();
    cloudGeo.dispose();
    cloudMat.dispose();
    haloGeo.dispose();
    haloMat.dispose();
    orbit.geometry.dispose();
    (orbit.material as THREE.Material).dispose();
    issCore.geometry.dispose();
    (issCore.material as THREE.Material).dispose();
    issGlow.geometry.dispose();
    (issGlow.material as THREE.Material).dispose();
    issLabelTexture.dispose();
    (issLabel.material as THREE.Material).dispose();
    trailGeo.dispose();
    trailMat.dispose();
    starsGeo.dispose();
    starsMat.dispose();
    renderer.dispose();
  };

  return { updatePosition, destroy };
}
