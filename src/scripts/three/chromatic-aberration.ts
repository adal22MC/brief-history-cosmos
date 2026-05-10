import type { Texture } from 'three';

export const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null as Texture | null },
    uOffset: { value: 0.0008 },
    uScroll: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    uniform float uScroll;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      // Falloff radial: cero en el centro, sutil en los bordes.
      float strength = uOffset * (1.0 + uScroll * 1.2) * smoothstep(0.15, 0.7, dist);
      vec2 offset = normalize(dir) * strength;

      float r = texture2D(tDiffuse, vUv - offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + offset).b;
      float a = texture2D(tDiffuse, vUv).a;

      float vignette = smoothstep(1.0, 0.4, dist);
      gl_FragColor = vec4(vec3(r, g, b) * vignette, a);
    }
  `,
};
