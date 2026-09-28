import { ACESFilmicToneMapping, AdditiveBlending } from 'three/src/constants.js';
import { AmbientLight } from 'three/src/lights/AmbientLight.js';
import { Clock } from 'three/src/core/Clock.js';
import { Color } from 'three/src/math/Color.js';
import { DirectionalLight } from 'three/src/lights/DirectionalLight.js';
import { FogExp2 } from 'three/src/scenes/FogExp2.js';
import { Group } from 'three/src/objects/Group.js';
import { MathUtils } from 'three/src/math/MathUtils.js';
import { Mesh } from 'three/src/objects/Mesh.js';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial.js';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js';
import { Scene } from 'three/src/scenes/Scene.js';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial.js';
import { SphereGeometry } from 'three/src/geometries/SphereGeometry.js';
import { TorusGeometry } from 'three/src/geometries/TorusGeometry.js';
import { Vector2 } from 'three/src/math/Vector2.js';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';
import type { Object3D } from 'three/src/core/Object3D.js';
import { gsap } from 'gsap';
import { ERA_PRESETS, type Era } from './era-presets';
import { createEraParticles } from './era-particles';
import { createEraSky } from './era-sky';

export type SceneOptions = Record<string, never>;

export interface SceneAPI {
  setEra(era: Era, duration?: number): void;
  /** Lleva el blob a una esquina, más pequeño, para no competir con tarjetas o listas. */
  setYield(active: boolean, duration?: number): void;
}

// Fracción del ancho donde vive la columna de texto; las estrellas se atenúan ahí.
const textEdgeFor = (width: number) => (width > 900 ? 0.55 : 1.2);

export function initThreeScene(canvas: HTMLCanvasElement): SceneAPI {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new Scene();
  scene.fog = new FogExp2(0x05050a, 0.025);

  const camera = new PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(0, 0, 6);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  // En móvil se arranca con menos resolución; la calidad adaptativa baja más si hace falta.
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const maxPixelRatio = Math.min(window.devicePixelRatio, coarse ? 1.5 : 2);
  renderer.setPixelRatio(maxPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const geometry = new SphereGeometry(1.08, 96, 96);
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uColorA: { value: new Color('#c2a2ff') },
      uColorB: { value: new Color('#00e5ff') },
      uTimeScale: { value: 1.0 },
      uNoiseFreq: { value: 0.9 },
      uIntensity: { value: 1.0 },
      uFlash: { value: 0 },
      uCmb: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uScroll;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vDistort;

      // simplex-ish noise
      vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

      float snoise(vec3 v){
        const vec2 C=vec2(1.0/6.0,1.0/3.0);
        const vec4 D=vec4(0.0,0.5,1.0,2.0);
        vec3 i=floor(v+dot(v,C.yyy));
        vec3 x0=v-i+dot(i,C.xxx);
        vec3 g=step(x0.yzx,x0.xyz);
        vec3 l=1.0-g;
        vec3 i1=min(g.xyz,l.zxy);
        vec3 i2=max(g.xyz,l.zxy);
        vec3 x1=x0-i1+C.xxx;
        vec3 x2=x0-i2+C.yyy;
        vec3 x3=x0-D.yyy;
        i=mod289(i);
        vec4 p=permute(permute(permute(
                  i.z+vec4(0.0,i1.z,i2.z,1.0))
                + i.y+vec4(0.0,i1.y,i2.y,1.0))
                + i.x+vec4(0.0,i1.x,i2.x,1.0));
        float n_=0.142857142857;
        vec3 ns=n_*D.wyz-D.xzx;
        vec4 j=p-49.0*floor(p*ns.z*ns.z);
        vec4 x_=floor(j*ns.z);
        vec4 y_=floor(j-7.0*x_);
        vec4 x=x_*ns.x+ns.yyyy;
        vec4 y=y_*ns.x+ns.yyyy;
        vec4 h=1.0-abs(x)-abs(y);
        vec4 b0=vec4(x.xy,y.xy);
        vec4 b1=vec4(x.zw,y.zw);
        vec4 s0=floor(b0)*2.0+1.0;
        vec4 s1=floor(b1)*2.0+1.0;
        vec4 sh=-step(h,vec4(0.0));
        vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
        vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
        vec3 p0=vec3(a0.xy,h.x);
        vec3 p1=vec3(a0.zw,h.y);
        vec3 p2=vec3(a1.xy,h.z);
        vec3 p3=vec3(a1.zw,h.w);
        vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
        vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
        m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }

      // Fractal Brownian Motion — noise apilado en octavas para detalle multi-escala.
      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * snoise(p);
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      uniform float uTimeScale;
      uniform float uNoiseFreq;
      uniform float uIntensity;

      void main() {
        vec3 pos = position;
        float slowTime = uTime * 0.16 * uTimeScale;
        float n = fbm(pos * uNoiseFreq + vec3(slowTime, slowTime * 0.45, 0.0));
        float pulse = 0.5 + 0.5 * sin(uTime * 0.45 * uTimeScale);
        float distort = (n - 0.5) * (0.16 + uScroll * 0.14) * uIntensity;
        distort += pulse * 0.035;
        pos += normal * distort;
        vPosition = pos;
        vNormal = normal;
        vDistort = distort;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vDistort;

      uniform float uFlash;
      uniform float uCmb;

      // Ruido de valor para el mapa del fondo de microondas (02); barato y suficiente a esta escala.
      float cmbHash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float cmbNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(cmbHash(i), cmbHash(i + vec3(1, 0, 0)), f.x),
              mix(cmbHash(i + vec3(0, 1, 0)), cmbHash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(cmbHash(i + vec3(0, 0, 1)), cmbHash(i + vec3(1, 0, 1)), f.x),
              mix(cmbHash(i + vec3(0, 1, 1)), cmbHash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }
      // Paleta tipo mapa de Planck: azul profundo, celeste, crema, naranja y rojo.
      vec3 cmbRamp(float t) {
        vec3 c1 = vec3(0.05, 0.12, 0.45);
        vec3 c2 = vec3(0.25, 0.55, 0.95);
        vec3 c3 = vec3(0.98, 0.93, 0.80);
        vec3 c4 = vec3(1.0, 0.55, 0.18);
        vec3 c5 = vec3(0.75, 0.12, 0.05);
        t = clamp(t, 0.0, 1.0);
        if (t < 0.25) return mix(c1, c2, t / 0.25);
        if (t < 0.5) return mix(c2, c3, (t - 0.25) / 0.25);
        if (t < 0.75) return mix(c3, c4, (t - 0.5) / 0.25);
        return mix(c4, c5, (t - 0.75) / 0.25);
      }

      void main() {
        float shell = smoothstep(-0.18, 0.18, vDistort);
        float radial = smoothstep(1.2, 0.15, length(vPosition.xy));
        vec3 base = mix(uColorB, uColorA, shell) * (0.22 + radial * 0.38);

        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.8);
        vec3 corona = mix(uColorA, vec3(0.75, 0.92, 1.0), radial) * fresnel * 0.55;
        vec3 core = mix(uColorA, vec3(1.0), radial) * radial * 0.25;
        vec3 color = base + corona + core;

        if (uCmb > 0.001) {
          vec3 q = normalize(vPosition) * 3.2;
          float n = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) { n += amp * cmbNoise(q); q *= 2.03; amp *= 0.5; }
          vec3 cmb = cmbRamp(smoothstep(0.28, 0.72, n)) * (0.35 + 0.5 * radial) + corona * 0.6;
          color = mix(color, cmb, uCmb);
        }

        // Photon decoupling flash: el blob también irradia luz cálida en el desacople.
        color += vec3(1.0, 0.9, 0.7) * uFlash * (0.4 + radial * 0.6);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const blob = new Mesh(geometry, material);
  // Pose tweenable por era — el blob se "actúa" como personaje a lo largo del scroll.
  const pose = {
    x: ERA_PRESETS.hot.blobX,
    y: ERA_PRESETS.hot.blobY,
    scale: ERA_PRESETS.hot.blobScale,
    rotSpeed: ERA_PRESETS.hot.blobRotSpeed,
  };
  blob.position.set(pose.x, pose.y, 0);
  blob.scale.setScalar(pose.scale);

  const ringGroup = new Group();
  const ringGeo = new TorusGeometry(1.55, 0.008, 8, 180);
  const ringMat = new MeshBasicMaterial({
    color: '#c2a2ff',
    transparent: true,
    opacity: 0.34,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const ringA = new Mesh(ringGeo, ringMat);
  ringA.rotation.set(1.15, 0.28, 0.45);
  const ringB = new Mesh(ringGeo, ringMat.clone());
  ringB.material.opacity = 0.2;
  ringB.scale.setScalar(1.28);
  ringB.rotation.set(1.55, -0.5, -0.2);
  ringGroup.add(ringA, ringB);
  blob.add(ringGroup);
  scene.add(blob);

  // Shockwave: anillo aditivo que se expande desde el blob al cambiar de era,
  // marcando el "evento" del cambio en vez del crossfade silencioso.
  const shockGeo = new TorusGeometry(1.0, 0.025, 10, 96);
  const shockMat = new MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const shockwave = new Mesh(shockGeo, shockMat);
  shockwave.scale.setScalar(0.001);
  shockwave.visible = false;
  scene.add(shockwave);

  // ───────── Cielo por era: aurora, estrellas y la estela entre capítulos.
  const sky = createEraSky(reducedMotion.matches);
  scene.add(...sky.objects);

  const ambient = new AmbientLight(0xffffff, 0.6);
  const keyLight = new DirectionalLight(0xc2a2ff, 1.2);
  keyLight.position.set(3, 4, 5);
  const rimLight = new DirectionalLight(0x00e5ff, 0.8);
  rimLight.position.set(-3, -2, -4);
  scene.add(ambient, keyLight, rimLight);

  const activeObject: Object3D = blob;

  // ───────── Motivo por era: partículas que cambian de formación (espiral, disco…).
  const eraParticles = createEraParticles(reducedMotion.matches);
  scene.add(eraParticles.object);

  const RING_VISIBILITY: Record<Era, number> = {
    hot: 1,
    cooling: 1,
    stellar: 1,
    galactic: 0,
    planetary: 0,
    biotic: 0,
    now: 0,
  };

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollProgress = 0;

  window.addEventListener('mousemove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? window.scrollY / max : 0;
  });

  const resolution = new Vector2(1, 1);
  const syncViewport = () => {
    renderer.getDrawingBufferSize(resolution);
    const textEdge = textEdgeFor(window.innerWidth);
    sky.setViewport(resolution, textEdge, renderer.getPixelRatio());
    eraParticles.setViewport(resolution, textEdge, renderer.getPixelRatio());
  };
  syncViewport();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    syncViewport();
  });

  // Calidad adaptativa: si el promedio baja de ~45 fps, reduce resolución y luego partículas.
  // Solo baja de nivel; nunca vuelve a subir, para no oscilar.
  const QUALITY = [
    { pixelRatio: 2, particles: 1 },
    { pixelRatio: 1.5, particles: 1 },
    { pixelRatio: 1.25, particles: 0.75 },
    { pixelRatio: 1, particles: 0.55 },
    { pixelRatio: 0.75, particles: 0.4 },
  ];
  let qualityLevel = 0;
  const applyQuality = (level: number) => {
    qualityLevel = level;
    const q = QUALITY[level];
    renderer.setPixelRatio(Math.min(maxPixelRatio, q.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    sky.setDensity(q.particles);
    eraParticles.setDensity(q.particles);
    syncViewport();
  };
  const fps = { frames: 0, time: 0, warmup: 3 };
  const sampleFrame = (frameTime: number) => {
    if (fps.warmup > 0) {
      fps.warmup -= frameTime;
      return;
    }
    fps.frames++;
    fps.time += frameTime;
    // Ventana de 2 s: reacciona igual de rápido en un equipo a 50 fps que en uno a 10.
    if (fps.time < 2) return;
    const avg = fps.time / fps.frames;
    fps.frames = 0;
    fps.time = 0;
    if (avg > 1 / 45 && qualityLevel < QUALITY.length - 1) {
      applyQuality(qualityLevel + 1);
      fps.warmup = 1;
    }
  };
  // Al volver a la pestaña el primer cuadro trae un salto enorme; se descarta.
  document.addEventListener('visibilitychange', () => {
    fps.frames = 0;
    fps.time = 0;
    fps.warmup = 1;
  });

  const yieldState = { k: 0 };
  // Velocidad de scroll (pantallas por segundo) para la estela de las estrellas.
  let lastScrollY = window.scrollY;
  const mouseVec = new Vector2();

  const clock = new Clock();
  let lastTime = 0;
  function tick() {
    const t = clock.getElapsedTime();
    sampleFrame(t - lastTime);
    const delta = Math.min(t - lastTime, 0.1);
    lastTime = t;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const scrollY = window.scrollY;
    const velocity = delta > 0.001 ? (scrollY - lastScrollY) / window.innerHeight / delta : 0;
    lastScrollY = scrollY;

    material.uniforms.uTime.value = t;
    material.uniforms.uScroll.value = scrollProgress;

    activeObject.rotation.y = t * 0.08 * pose.rotSpeed + mouse.x * 0.14;
    activeObject.rotation.x = mouse.y * 0.08;
    // Pose por era + leve parallax del cursor.
    // En portrait/narrow comprimimos x y bajamos un punto la escala para que el blob
    // siga siendo legible sin invadir el texto ni quedarse fuera del viewport.
    const aspect = window.innerWidth / window.innerHeight;
    const xFactor = Math.min(1, aspect / 1.4);
    const scaleFactor = 0.7 + 0.3 * xFactor;
    const camZ = 6 + scrollProgress * 4;
    const halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camZ;
    const halfW = halfH * aspect;
    // En vertical el texto ocupa todo el ancho: el blob sube a la esquina superior derecha.
    const portrait = aspect < 0.85;
    let baseX = portrait ? halfW * 0.62 : pose.x * xFactor;
    let baseY = portrait ? halfH * 0.5 + pose.y * 0.2 : pose.y;
    // En vertical se compensa el alejamiento de la cámara para que el blob ocupe lo mismo en pantalla
    // en todos los capítulos. En escritorio el alejamiento se conserva como parte del relato.
    // En vertical el tamaño por era se topa (Inflación y Recombinación tapaban el título).
    const eraScale = portrait ? Math.min(pose.scale, 0.9) : pose.scale;
    let baseScale = eraScale * scaleFactor * (portrait ? 0.72 * (camZ / 6) : 1);
    const k = yieldState.k;
    if (k > 0) {
      baseX = MathUtils.lerp(baseX, halfW * (portrait ? 0.62 : 0.66), k);
      baseY = MathUtils.lerp(baseY, halfH * (portrait ? 0.6 : 0.5), k);
      baseScale *= 1 - 0.55 * k;
    }
    activeObject.position.x = baseX + mouse.x * 0.16;
    activeObject.position.y = baseY + mouse.y * 0.1;
    activeObject.scale.setScalar(baseScale);

    // Shockwave sigue al blob y mira a la cámara (billboard) — siempre se ve plano.
    if (shockwave.visible) {
      shockwave.position.copy(activeObject.position);
      shockwave.lookAt(camera.position);
    }

    // La formación sigue al blob y escala con el viewport y el ceder el paso, no con el tamaño del blob por era.
    // En vertical la pantalla mide ~3 unidades de ancho: la formación se reduce para caber junto al blob.
    const formationScale = (baseScale / Math.max(eraScale, 0.01)) * (portrait ? 0.55 : 1);
    eraParticles.update(t, delta, activeObject.position, formationScale);

    ringGroup.rotation.z = t * 0.08;
    ringGroup.rotation.y = Math.sin(t * 0.18) * 0.12;

    camera.position.x = mouse.x * 0.08;
    camera.position.y = mouse.y * 0.06;
    camera.position.z = camZ;
    camera.lookAt(0, 0, 0);
    sky.update(t, delta, {
      camera,
      origin: activeObject.position,
      mouse: mouseVec.set(mouse.x, mouse.y),
      scroll: scrollProgress,
      velocity,
    });

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  const tweenColor = (target: Color, hex: string, duration: number) => {
    const next = new Color(hex);
    gsap.to(target, { r: next.r, g: next.g, b: next.b, duration, ease: 'power2.inOut', overwrite: true });
  };
  const tweenValue = (target: object, vars: gsap.TweenVars, duration: number) => {
    gsap.to(target, { ...vars, duration, ease: 'power2.inOut', overwrite: true });
  };

  // setEra: tweenea el blob, el cielo y la formación hacia el preset deseado.
  // overwrite: al pasar varios capítulos seguidos, cada tween reemplaza al anterior en vez de apilarse.
  let lastEra: Era | null = null;
  const setEra = (era: Era, duration = 1.4) => {
    if (reducedMotion.matches) duration = 0;
    const p = ERA_PRESETS[era];
    const isTransition = lastEra !== null && lastEra !== era;
    lastEra = era;
    tweenColor(material.uniforms.uColorA.value, p.blobA, duration);
    tweenColor(material.uniforms.uColorB.value, p.blobB, duration);
    tweenValue(material.uniforms.uTimeScale, { value: p.blobTimeScale }, duration);
    tweenValue(material.uniforms.uNoiseFreq, { value: p.blobNoiseFreq }, duration);
    tweenValue(material.uniforms.uIntensity, { value: p.blobIntensity }, duration);
    tweenValue(material.uniforms.uCmb, { value: era === 'cooling' ? 1 : 0 }, duration);
    tweenColor((ringA.material as MeshBasicMaterial).color, p.blobA, duration);
    tweenColor((ringB.material as MeshBasicMaterial).color, p.blobB, duration);
    // Los anillos decorativos se apagan cuando la formación de la era ya dibuja su propio plano.
    tweenValue(ringMat, { opacity: 0.34 * RING_VISIBILITY[era] }, duration);
    tweenValue(ringB.material as MeshBasicMaterial, { opacity: 0.2 * RING_VISIBILITY[era] }, duration);
    tweenValue(pose, { x: p.blobX, y: p.blobY, scale: p.blobScale, rotSpeed: p.blobRotSpeed }, duration);

    sky.setEra(era, duration, isTransition);
    eraParticles.setEra(era, duration);

    // Shockwave: anillo aditivo que irradia desde el blob, tinted con el color de la era entrante.
    if (isTransition && !reducedMotion.matches) {
      gsap.killTweensOf(shockwave.scale);
      gsap.killTweensOf(shockMat);
      shockMat.color.set(new Color(p.blobA));
      shockwave.scale.setScalar(0.001);
      shockMat.opacity = 0;
      shockwave.visible = true;
      gsap
        .timeline({
          onComplete: () => {
            shockwave.visible = false;
          },
        })
        .to(shockMat, { opacity: 0.3, duration: 0.35, ease: 'power2.out' }, 0)
        .to(shockwave.scale, { x: 7, y: 7, z: 7, duration: 1.2, ease: 'power3.out' }, 0)
        .to(shockMat, { opacity: 0, duration: 1.0, ease: 'power2.in' }, 0.2);
    }

    // Photon decoupling: al entrar a "cooling" disparamos un flash cálido global
    // que afecta tanto al cielo como al blob — narra el momento en que la luz por fin viaja.
    if (era === 'cooling' && isTransition && !reducedMotion.matches) {
      const flashTargets = [sky.flash, material.uniforms.uFlash];
      flashTargets.forEach((u) => {
        gsap.killTweensOf(u);
        u.value = 0;
        const tl = gsap.timeline();
        tl.to(u, { value: 0.16, duration: 0.65, ease: 'sine.inOut' })
          .to(u, { value: 0.08, duration: 0.45, ease: 'sine.inOut' })
          .to(u, { value: 0, duration: 1.4, ease: 'power3.out' });
      });
    }
  };

  const setYield = (active: boolean, duration = 1.1) => {
    gsap.to(yieldState, {
      k: active ? 1 : 0,
      duration: reducedMotion.matches ? 0 : duration,
      ease: 'power3.inOut',
      overwrite: true,
    });
  };

  return { setEra, setYield };
}
