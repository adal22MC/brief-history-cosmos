import * as THREE from 'three';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ChromaticAberrationShader } from './chromatic-aberration';
import { ERA_PRESETS, type Era } from './era-presets';

export interface SceneOptions {
  modelUrl?: string;
  modelScale?: number;
}

export interface SceneAPI {
  setEra(era: Era, duration?: number): void;
}

export function initThreeScene(
  canvas: HTMLCanvasElement,
  opts: SceneOptions = {},
): SceneAPI {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05050a, 0.025);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  composer.addPass(renderPass);

  // Bloom contenido: solo los highlights brillan, no toda la imagen.
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.28, // strength
    0.45, // radius
    0.7,  // threshold — sólo los píxeles más brillantes hacen bloom
  );
  composer.addPass(bloomPass);

  const chromaticPass = new ShaderPass(ChromaticAberrationShader);
  composer.addPass(chromaticPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const geometry = new THREE.SphereGeometry(1.08, 96, 96);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uColorA: { value: new THREE.Color('#c2a2ff') },
      uColorB: { value: new THREE.Color('#00e5ff') },
      uTimeScale: { value: 1.0 },
      uNoiseFreq: { value: 0.9 },
      uIntensity: { value: 1.0 },
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

      void main() {
        float shell = smoothstep(-0.18, 0.18, vDistort);
        float radial = smoothstep(1.2, 0.15, length(vPosition.xy));
        vec3 base = mix(uColorB, uColorA, shell) * (0.22 + radial * 0.38);

        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.8);
        vec3 corona = mix(uColorA, vec3(0.75, 0.92, 1.0), radial) * fresnel * 0.55;
        vec3 core = mix(uColorA, vec3(1.0), radial) * radial * 0.25;
        vec3 color = base + corona + core;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const blob = new THREE.Mesh(geometry, material);
  blob.position.set(2.2, -0.6, 0); // off-center, abajo a la derecha

  const ringGroup = new THREE.Group();
  const ringGeo = new THREE.TorusGeometry(1.55, 0.008, 8, 180);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#c2a2ff',
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringA = new THREE.Mesh(ringGeo, ringMat);
  ringA.rotation.set(1.15, 0.28, 0.45);
  const ringB = new THREE.Mesh(ringGeo, ringMat.clone());
  ringB.material.opacity = 0.2;
  ringB.scale.setScalar(1.28);
  ringB.rotation.set(1.55, -0.5, -0.2);
  ringGroup.add(ringA, ringB);
  blob.add(ringGroup);
  scene.add(blob);

  // ───────── Aurora skybox: envuelve la cámara con un campo de color animado.
  const auroraGeo = new THREE.SphereGeometry(60, 32, 32);
  const auroraMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uTintA: { value: new THREE.Color(0x2e0a52) },
      uTintB: { value: new THREE.Color(0x005a6b) },
      uIntensity: { value: 0.7 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uScroll;
      varying vec3 vPos;

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
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      uniform vec3 uTintA;
      uniform vec3 uTintB;
      uniform float uIntensity;

      void main() {
        vec3 dir = normalize(vPos);
        float lat = dir.y;
        float bands = fbm(dir * 1.5 + vec3(uTime * 0.04, 0.0, uTime * 0.02));
        float curtain = smoothstep(0.35, 0.85, bands - lat * 0.4);

        vec3 deep = vec3(0.015, 0.018, 0.045);
        vec3 hue = mix(uTintA, uTintB, smoothstep(0.0, 1.0, uScroll));
        vec3 color = mix(deep, hue, curtain * uIntensity);

        color *= smoothstep(-0.9, 0.4, lat + 0.3);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const aurora = new THREE.Mesh(auroraGeo, auroraMat);
  scene.add(aurora);

  renderPass.scene = scene;
  renderPass.camera = camera;

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const keyLight = new THREE.DirectionalLight(0xc2a2ff, 1.2);
  keyLight.position.set(3, 4, 5);
  const rimLight = new THREE.DirectionalLight(0x00e5ff, 0.8);
  rimLight.position.set(-3, -2, -4);
  scene.add(ambient, keyLight, rimLight);

  let activeObject: THREE.Object3D = blob;

  if (opts.modelUrl) {
    const loader = new GLTFLoader();
    loader.load(
      opts.modelUrl,
      (gltf) => {
        const model = gltf.scene;
        const scale = opts.modelScale ?? 1.6;
        model.scale.setScalar(scale);
        scene.remove(blob);
        scene.add(model);
        activeObject = model;
      },
      undefined,
      (err) => console.error('GLTF load error:', err),
    );
  }

  // ───────── Starfield: cada estrella tiene tamaño y fase de parpadeo propios.
  const particleCount = 1400;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const phases = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    // Distribución en cáscara esférica para evitar acumulación cerca de la cámara.
    const r = 18 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 0.5 + Math.random() * 2.5;
    phases[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vTwinkle = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 1.6 + aPhase * 6.28318));
        gl_PointSize = aSize * uPixelRatio * (180.0 / -mvPos.z) * vTwinkle;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTwinkle;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        // Núcleo brillante + halo suave.
        float core = smoothstep(0.5, 0.0, d);
        float halo = smoothstep(0.5, 0.15, d) * 0.4;
        float a = (core + halo) * vTwinkle;
        vec3 col = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.95, 0.85), vTwinkle);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

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

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
    pMat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  });

  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    material.uniforms.uTime.value = t;
    material.uniforms.uScroll.value = scrollProgress;

    auroraMat.uniforms.uTime.value = t;
    auroraMat.uniforms.uScroll.value = scrollProgress;
    pMat.uniforms.uTime.value = t;

    activeObject.rotation.y = t * 0.08 + mouse.x * 0.14;
    activeObject.rotation.x = mouse.y * 0.08;
    // Posición base off-center + leve parallax del cursor.
    activeObject.position.x = 2.2 + mouse.x * 0.16;
    activeObject.position.y = -0.6 + mouse.y * 0.1;
    const baseScale = activeObject === blob ? 1 : (opts.modelScale ?? 1.6);
    activeObject.scale.setScalar(baseScale * (1 - scrollProgress * 0.08));

    // Parallax del starfield + giro lento de la aurora.
    points.rotation.y = t * 0.015 + mouse.x * 0.025;
    points.rotation.x = scrollProgress * 0.4 + mouse.y * 0.02;
    aurora.rotation.y = t * 0.01;
    ringGroup.rotation.z = t * 0.08;
    ringGroup.rotation.y = Math.sin(t * 0.18) * 0.12;

    camera.position.x = mouse.x * 0.08;
    camera.position.y = mouse.y * 0.06;
    camera.position.z = 6 + scrollProgress * 4;
    camera.lookAt(0, 0, 0);

    chromaticPass.uniforms.uScroll.value = scrollProgress;
    // Bloom mucho más comedido — sólo realza highlights.
    bloomPass.strength = 0.28 + scrollProgress * 0.18;

    composer.render();
    requestAnimationFrame(tick);
  }
  tick();

  // setEra: tweenea uniforms del blob y de la aurora hacia el preset deseado.
  const setEra = (era: Era, duration = 1.4) => {
    const p = ERA_PRESETS[era];
    gsap.to(material.uniforms.uColorA.value, {
      r: new THREE.Color(p.blobA).r,
      g: new THREE.Color(p.blobA).g,
      b: new THREE.Color(p.blobA).b,
      duration, ease: 'power2.inOut',
    });
    gsap.to(material.uniforms.uColorB.value, {
      r: new THREE.Color(p.blobB).r,
      g: new THREE.Color(p.blobB).g,
      b: new THREE.Color(p.blobB).b,
      duration, ease: 'power2.inOut',
    });
    gsap.to(material.uniforms.uTimeScale, { value: p.blobTimeScale, duration, ease: 'power2.inOut' });
    gsap.to(material.uniforms.uNoiseFreq, { value: p.blobNoiseFreq, duration, ease: 'power2.inOut' });
    gsap.to(material.uniforms.uIntensity, { value: p.blobIntensity, duration, ease: 'power2.inOut' });
    gsap.to((ringA.material as THREE.MeshBasicMaterial).color, {
      r: new THREE.Color(p.blobA).r,
      g: new THREE.Color(p.blobA).g,
      b: new THREE.Color(p.blobA).b,
      duration, ease: 'power2.inOut',
    });
    gsap.to((ringB.material as THREE.MeshBasicMaterial).color, {
      r: new THREE.Color(p.blobB).r,
      g: new THREE.Color(p.blobB).g,
      b: new THREE.Color(p.blobB).b,
      duration, ease: 'power2.inOut',
    });

    gsap.to(auroraMat.uniforms.uTintA.value, {
      r: new THREE.Color(p.auroraA).r,
      g: new THREE.Color(p.auroraA).g,
      b: new THREE.Color(p.auroraA).b,
      duration, ease: 'power2.inOut',
    });
    gsap.to(auroraMat.uniforms.uTintB.value, {
      r: new THREE.Color(p.auroraB).r,
      g: new THREE.Color(p.auroraB).g,
      b: new THREE.Color(p.auroraB).b,
      duration, ease: 'power2.inOut',
    });
    gsap.to(auroraMat.uniforms.uIntensity, { value: p.auroraIntensity, duration, ease: 'power2.inOut' });
  };

  return { setEra };
}
