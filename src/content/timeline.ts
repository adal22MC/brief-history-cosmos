import type { Era } from '@/scripts/three/era-presets';

export interface ChapterMeta {
  id: string;
  railNum: string;
  era: Era;
  sectionLabelEn: string;
  sectionLabelEs: string;
  railLabelEn: string;
  railLabelEs: string;
  railTickEn: string;
  railTickEs: string;
}

export const CHAPTERS: ChapterMeta[] = [
  {
    id: 'inflation',
    railNum: '01',
    era: 'hot',
    sectionLabelEn: 'Inflation',
    sectionLabelEs: 'Inflación',
    railLabelEn: 'Inflation',
    railLabelEs: 'Inflación',
    railTickEn: 'Hot era',
    railTickEs: 'Era caliente',
  },
  {
    id: 'recombination',
    railNum: '02',
    era: 'cooling',
    sectionLabelEn: 'Recombination',
    sectionLabelEs: 'Recombinación',
    railLabelEn: 'Recombination',
    railLabelEs: 'Recombinación',
    railTickEn: 'Cooling',
    railTickEs: 'Enfriamiento',
  },
  {
    id: 'cosmic-dawn',
    railNum: '03',
    era: 'stellar',
    sectionLabelEn: 'Cosmic dawn',
    sectionLabelEs: 'Amanecer cósmico',
    railLabelEn: 'Cosmic dawn',
    railLabelEs: 'Amanecer cósmico',
    railTickEn: 'Stellar ignition',
    railTickEs: 'Ignición estelar',
  },
  {
    id: 'galaxies',
    railNum: '04',
    era: 'galactic',
    sectionLabelEn: 'Galaxies',
    sectionLabelEs: 'Galaxias',
    railLabelEn: 'Galaxies',
    railLabelEs: 'Galaxias',
    railTickEn: 'Galactic era',
    railTickEs: 'Era galáctica',
  },
  {
    id: 'solar-system',
    railNum: '05',
    era: 'planetary',
    sectionLabelEn: 'Solar System',
    sectionLabelEs: 'Sistema Solar',
    railLabelEn: 'Solar System',
    railLabelEs: 'Sistema Solar',
    railTickEn: 'Planetary disk',
    railTickEs: 'Disco planetario',
  },
  {
    id: 'life',
    railNum: '06',
    era: 'biotic',
    sectionLabelEn: 'Life',
    sectionLabelEs: 'Vida',
    railLabelEn: 'Life',
    railLabelEs: 'Vida',
    railTickEn: 'Biotic era',
    railTickEs: 'Era biótica',
  },
  {
    id: 'now',
    railNum: '07',
    era: 'now',
    sectionLabelEn: 'Now',
    sectionLabelEs: 'Ahora',
    railLabelEn: 'Now',
    railLabelEs: 'Ahora',
    railTickEn: 'Live sky',
    railTickEs: 'Cielo vivo',
  },
];

export interface RailSourceMeta {
  href: string;
  railNum: string;
  era: Era;
  labelEn: string;
  labelEs: string;
  tickEn: string;
  tickEs: string;
}

export const RAIL_SOURCES: RailSourceMeta = {
  href: '/work',
  railNum: 'SRC',
  era: 'now',
  labelEn: 'Sources',
  labelEs: 'Fuentes',
  tickEn: 'Credits',
  tickEs: 'Créditos',
};

export const CHAPTER_COUNT = CHAPTERS.length;
