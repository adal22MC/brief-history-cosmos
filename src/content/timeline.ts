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
  /** Días transcurridos si los 13 800 millones de años fueran un año (0–365). */
  calendarDay: number;
  calendarEs: string;
  calendarEn: string;
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
    calendarDay: 0,
    calendarEs: '1 ene · 00:00',
    calendarEn: 'Jan 1 · 00:00',
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
    calendarDay: 0.01,
    calendarEs: '1 ene · 00:14',
    calendarEn: 'Jan 1 · 00:14',
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
    calendarDay: 5.29,
    calendarEs: '6 ene',
    calendarEn: 'Jan 6',
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
    calendarDay: 26.45,
    calendarEs: '27 ene',
    calendarEn: 'Jan 27',
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
    calendarDay: 243.3,
    calendarEs: '1 sep',
    calendarEn: 'Sep 1',
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
    calendarDay: 267.1,
    calendarEs: '25 sep',
    calendarEn: 'Sep 25',
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
    calendarDay: 365,
    calendarEs: '31 dic · 23:59',
    calendarEn: 'Dec 31 · 23:59',
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
