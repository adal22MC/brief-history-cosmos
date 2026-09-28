export type Era =
  | 'hot'
  | 'cooling'
  | 'stellar'
  | 'galactic'
  | 'planetary'
  | 'biotic'
  | 'now';

/** Firma del cielo de cada era; cada peso va de 0 a 1 y los que faltan valen 0. */
export type SkyWeight =
  /** 01: velo de plasma opaco que tapa las estrellas. */
  | 'veil'
  /** 02: manchas tenues tipo mapa de Planck. */
  | 'speckle'
  /** 03: las estrellas se encienden una a una y las más masivas ionizan una burbuja azul. */
  | 'ignite'
  /** 04: banda de la Vía Láctea con su franja de polvo. */
  | 'band'
  /** 05: luz zodiacal que sale del blob a lo largo de la eclíptica. */
  | 'glow'
  /** 06: cáusticas de agua. */
  | 'caustics'
  /** 07: borde de la atmósfera y satélites cruzando. */
  | 'horizon'
  /** Corriente direccional del ruido de la aurora. */
  | 'flow';

interface EraPreset {
  blobA: string;
  blobB: string;
  blobTimeScale: number;
  blobNoiseFreq: number;
  blobIntensity: number;
  blobX: number;
  blobY: number;
  blobScale: number;
  blobRotSpeed: number;
  auroraA: string;
  auroraB: string;
  auroraIntensity: number;
  starDensity: number;
  starTwinkle: number;
  starBrightness: number;
  sky: Partial<Record<SkyWeight, number>>;
}

export const ERA_PRESETS: Record<Era, EraPreset> = {
  hot: {
    blobA: '#ffb070',
    blobB: '#d8240a',
    blobTimeScale: 3.2,
    blobNoiseFreq: 1.7,
    blobIntensity: 1.7,
    blobX: 1.5,
    blobY: 0.0,
    blobScale: 1.4,
    blobRotSpeed: 1.4,
    auroraA: '#48090a',
    auroraB: '#c83a14',
    auroraIntensity: 1.0,
    starDensity: 0.0,
    starTwinkle: 1.0,
    starBrightness: 0.0,
    sky: { veil: 1 },
  },
  cooling: {
    blobA: '#ffe2b8',
    blobB: '#d88248',
    blobTimeScale: 1.4,
    blobNoiseFreq: 1.1,
    blobIntensity: 0.55,
    blobX: 2.2,
    blobY: -0.4,
    blobScale: 1.1,
    blobRotSpeed: 1.0,
    auroraA: '#3a1a08',
    auroraB: '#c87a2e',
    auroraIntensity: 1.3,
    starDensity: 0.18,
    starTwinkle: 0.55,
    starBrightness: 0.55,
    sky: { speckle: 1 },
  },
  stellar: {
    blobA: '#a8c2f0',
    blobB: '#2a4a90',
    blobTimeScale: 1.0,
    blobNoiseFreq: 0.9,
    blobIntensity: 0.5,
    blobX: 2.6,
    blobY: 0.7,
    blobScale: 0.5,
    blobRotSpeed: 0.7,
    auroraA: '#0a1233',
    auroraB: '#1e4a8e',
    auroraIntensity: 0.3,
    starDensity: 1.0,
    starTwinkle: 1.9,
    starBrightness: 1.4,
    sky: { ignite: 1 },
  },
  galactic: {
    blobA: '#c8a0ff',
    blobB: '#ff7ad0',
    blobTimeScale: 0.6,
    blobNoiseFreq: 0.7,
    blobIntensity: 0.6,
    blobX: 2.9,
    blobY: 0.2,
    blobScale: 0.42,
    blobRotSpeed: 2.4,
    auroraA: '#240a45',
    auroraB: '#7026a8',
    auroraIntensity: 0.85,
    starDensity: 0.95,
    starTwinkle: 1.0,
    starBrightness: 1.0,
    sky: { band: 1, flow: 0.35 },
  },
  planetary: {
    blobA: '#f5d27a',
    blobB: '#a0521c',
    blobTimeScale: 0.4,
    blobNoiseFreq: 0.5,
    blobIntensity: 0.45,
    blobX: 3.0,
    blobY: -0.8,
    blobScale: 0.5,
    blobRotSpeed: 0.4,
    auroraA: '#1a0a04',
    auroraB: '#5a3010',
    auroraIntensity: 0.55,
    starDensity: 0.7,
    starTwinkle: 0.75,
    starBrightness: 0.9,
    sky: { glow: 1 },
  },
  biotic: {
    blobA: '#88e0d3',
    blobB: '#3a7ba8',
    blobTimeScale: 0.5,
    blobNoiseFreq: 0.7,
    blobIntensity: 0.45,
    blobX: 2.4,
    blobY: 0.4,
    blobScale: 0.7,
    blobRotSpeed: 0.6,
    auroraA: '#08252a',
    auroraB: '#1a8896',
    auroraIntensity: 0.95,
    starDensity: 0.85,
    starTwinkle: 0.9,
    starBrightness: 0.95,
    sky: { caustics: 1, flow: 1 },
  },
  now: {
    blobA: '#c2a2ff',
    blobB: '#00e5ff',
    blobTimeScale: 1.0,
    blobNoiseFreq: 0.9,
    blobIntensity: 0.4,
    blobX: 3.2,
    blobY: -1.2,
    blobScale: 0.78,
    blobRotSpeed: 1.0,
    auroraA: '#2e0a52',
    auroraB: '#005a6b',
    auroraIntensity: 0.7,
    starDensity: 1.0,
    starTwinkle: 1.0,
    starBrightness: 1.0,
    sky: { horizon: 1 },
  },
};

export const ERA_ACCENTS = Object.fromEntries(
  Object.entries(ERA_PRESETS).map(([era, preset]) => [era, preset.blobA]),
) as Record<Era, string>;
