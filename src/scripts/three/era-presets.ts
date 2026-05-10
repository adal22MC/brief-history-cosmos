export type Era =
  | 'hot'
  | 'cooling'
  | 'stellar'
  | 'galactic'
  | 'planetary'
  | 'biotic'
  | 'now';

interface EraPreset {
  blobA: string;
  blobB: string;
  blobTimeScale: number;
  blobNoiseFreq: number;
  blobIntensity: number;
  auroraA: string;
  auroraB: string;
  auroraIntensity: number;
}

export const ERA_PRESETS: Record<Era, EraPreset> = {
  hot: {
    blobA: '#ffb070',
    blobB: '#d8240a',
    blobTimeScale: 3.2,
    blobNoiseFreq: 1.7,
    blobIntensity: 1.7,
    auroraA: '#48090a',
    auroraB: '#c83a14',
    auroraIntensity: 1.0,
  },
  cooling: {
    blobA: '#f5c890',
    blobB: '#a86028',
    blobTimeScale: 1.4,
    blobNoiseFreq: 1.1,
    blobIntensity: 1.05,
    auroraA: '#1f0c05',
    auroraB: '#5a3a14',
    auroraIntensity: 0.6,
  },
  stellar: {
    blobA: '#a8c2f0',
    blobB: '#2a4a90',
    blobTimeScale: 1.0,
    blobNoiseFreq: 0.9,
    blobIntensity: 0.95,
    auroraA: '#0a1233',
    auroraB: '#1e4a8e',
    auroraIntensity: 0.8,
  },
  galactic: {
    blobA: '#c8a0ff',
    blobB: '#ff7ad0',
    blobTimeScale: 0.6,
    blobNoiseFreq: 0.7,
    blobIntensity: 0.9,
    auroraA: '#240a45',
    auroraB: '#7026a8',
    auroraIntensity: 0.85,
  },
  planetary: {
    blobA: '#f5d27a',
    blobB: '#a0521c',
    blobTimeScale: 0.4,
    blobNoiseFreq: 0.5,
    blobIntensity: 0.7,
    auroraA: '#1a0a04',
    auroraB: '#5a3010',
    auroraIntensity: 0.55,
  },
  biotic: {
    blobA: '#88e0d3',
    blobB: '#3a7ba8',
    blobTimeScale: 0.5,
    blobNoiseFreq: 0.7,
    blobIntensity: 0.7,
    auroraA: '#04141a',
    auroraB: '#0e5a6b',
    auroraIntensity: 0.6,
  },
  now: {
    blobA: '#c2a2ff',
    blobB: '#00e5ff',
    blobTimeScale: 1.0,
    blobNoiseFreq: 0.9,
    blobIntensity: 1.0,
    auroraA: '#2e0a52',
    auroraB: '#005a6b',
    auroraIntensity: 0.7,
  },
};

export const ERA_ACCENTS = Object.fromEntries(
  Object.entries(ERA_PRESETS).map(([era, preset]) => [era, preset.blobA]),
) as Record<Era, string>;
