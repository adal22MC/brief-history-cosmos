export interface Reference {
  /** Autores o institución, como se citaría. */
  author: string;
  /** Año de publicación; las páginas web sin fecha fija lo omiten y se citan como consultadas. */
  year?: string;
  title: string;
  /** Revista, editorial o sitio. */
  publisher: string;
  url: string;
}

export const REFERENCES = {
  guth1981: {
    author: 'Guth, A. H.',
    year: '1981',
    title: 'Inflationary universe: A possible solution to the horizon and flatness problems',
    publisher: 'Physical Review D 23, 347',
    url: 'https://doi.org/10.1103/PhysRevD.23.347',
  },
  wikiInflation: {
    author: 'Wikipedia',
    title: 'Cosmic inflation',
    publisher: 'en.wikipedia.org',
    url: 'https://en.wikipedia.org/wiki/Cosmic_inflation',
  },
  esaCmb: {
    author: 'ESA',
    title: 'Planck and the cosmic microwave background',
    publisher: 'esa.int',
    url: 'https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_and_the_cosmic_microwave_background',
  },
  planck2018: {
    author: 'Planck Collaboration',
    year: '2020',
    title: 'Planck 2018 results. VI. Cosmological parameters',
    publisher: 'Astronomy & Astrophysics 641, A6',
    url: 'https://doi.org/10.1051/0004-6361/201833910',
  },
  nasaEarly: {
    author: 'NASA',
    title: 'Webb: Early Universe',
    publisher: 'science.nasa.gov',
    url: 'https://science.nasa.gov/mission/webb/early-universe/',
  },
  xiao2025: {
    author: 'Xiao, M. et al.',
    year: '2025',
    title: 'PANORAMIC: Discovery of an ultra-massive grand-design spiral galaxy at z ∼ 5.2',
    publisher: 'Astronomy & Astrophysics 696, A156',
    url: 'https://doi.org/10.1051/0004-6361/202453487',
  },
  nasaMilkyWay: {
    author: 'NASA',
    title: 'The Milky Way Galaxy',
    publisher: 'Imagine the Universe!',
    url: 'https://imagine.gsfc.nasa.gov/science/objects/milkyway1.html',
  },
  connelly2012: {
    author: 'Connelly, J. N. et al.',
    year: '2012',
    title: 'The absolute chronology and thermal processing of solids in the solar protoplanetary disk',
    publisher: 'Science 338, 651',
    url: 'https://doi.org/10.1126/science.1226919',
  },
  iau2006: {
    author: 'IAU',
    year: '2006',
    title: 'IAU 2006 General Assembly: Result of the IAU Resolution votes',
    publisher: 'iau.org',
    url: 'https://www.iau.org/IAU/Iau/News/PR2006/iau-2006-general-assembly-resolution-votes.aspx',
  },
  nutman2016: {
    author: 'Nutman, A. P. et al.',
    year: '2016',
    title: 'Rapid emergence of life shown by discovery of 3,700-million-year-old microbial structures',
    publisher: 'Nature 537, 535',
    url: 'https://doi.org/10.1038/nature19355',
  },
  allwood2018: {
    author: 'Allwood, A. C. et al.',
    year: '2018',
    title: 'Reassessing evidence of life in 3,700-million-year-old rocks of Greenland',
    publisher: 'Nature 563, 241',
    url: 'https://doi.org/10.1038/s41586-018-0610-4',
  },
  mora2011: {
    author: 'Mora, C. et al.',
    year: '2011',
    title: 'How many species are there on Earth and in the ocean?',
    publisher: 'PLoS Biology 9, e1001127',
    url: 'https://doi.org/10.1371/journal.pbio.1001127',
  },
  nasaIss: {
    author: 'NASA',
    title: 'International Space Station Facts and Figures',
    publisher: 'nasa.gov',
    url: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/',
  },
  nasaWebb: {
    author: 'NASA',
    title: 'James Webb Space Telescope',
    publisher: 'science.nasa.gov',
    url: 'https://science.nasa.gov/mission/webb/',
  },
  sagan1977: {
    author: 'Sagan, C.',
    year: '1977',
    title: 'The Dragons of Eden',
    publisher: 'Random House',
    url: 'https://en.wikipedia.org/wiki/Cosmic_Calendar',
  },
  hublin2017: {
    author: 'Hublin, J.-J. et al.',
    year: '2017',
    title: 'New fossils from Jebel Irhoud, Morocco and the pan-African origin of Homo sapiens',
    publisher: 'Nature 546, 289',
    url: 'https://doi.org/10.1038/nature22336',
  },
} satisfies Record<string, Reference>;

export type ReferenceId = keyof typeof REFERENCES;

export interface Claim {
  value: string;
  valueEn?: string;
  labelEs: string;
  labelEn: string;
  noteEs?: string;
  noteEn?: string;
  refs: ReferenceId[];
}

/** Cada cifra que aparece en un capítulo, con el trabajo que la respalda. */
export const CHAPTER_CLAIMS: Record<string, Claim[]> = {
  inflation: [
    {
      value: '10⁻³² s',
      labelEs: 'Final de la inflación',
      labelEn: 'End of inflation',
      noteEs: 'Orden de magnitud habitual; la duración exacta depende del modelo.',
      noteEn: 'Typical order of magnitude; the exact duration depends on the model.',
      refs: ['guth1981', 'wikiInflation'],
    },
    {
      value: '×10²⁶',
      labelEs: 'Factor de expansión, como mínimo',
      labelEn: 'Expansion factor, at least',
      refs: ['wikiInflation'],
    },
  ],
  recombination: [
    {
      value: '380 000 años',
      valueEn: '380,000 years',
      labelEs: 'Se libera la luz del fondo cósmico',
      labelEn: 'The cosmic background light is released',
      refs: ['esaCmb', 'planck2018'],
    },
    {
      value: '3 000 K',
      labelEs: 'Temperatura del universo en ese momento',
      labelEn: 'Temperature of the universe at that moment',
      refs: ['esaCmb'],
    },
  ],
  'cosmic-dawn': [
    {
      value: '~200 Ma',
      labelEs: 'Se encienden las primeras estrellas',
      labelEn: 'The first stars ignite',
      noteEs: 'NASA las ubica entre la recombinación y los 300 Ma, cuando ya existen las galaxias más antiguas conocidas.',
      noteEn: 'NASA places them between recombination and 300 Myr, when the oldest known galaxies already exist.',
      refs: ['nasaEarly'],
    },
    {
      value: 'III',
      labelEs: 'Población III: estrellas de 30 a 300 masas solares que vivían pocos millones de años',
      labelEn: 'Population III: stars of 30 to 300 solar masses that lived a few million years',
      refs: ['nasaEarly'],
    },
  ],
  galaxies: [
    {
      value: '1 Ga',
      labelEs: 'Ya existen espirales como la Vía Láctea',
      labelEn: 'Spirals like the Milky Way already exist',
      noteEs: 'Zhúlóng, la espiral de gran diseño más lejana conocida, se ve a ~1 Ga del Big Bang.',
      noteEn: 'Zhúlóng, the most distant known grand-design spiral, is seen ~1 Gyr after the Big Bang.',
      refs: ['xiao2025'],
    },
    {
      value: '~10¹¹ ★',
      labelEs: 'Estrellas en la Vía Láctea',
      labelEn: 'Stars in the Milky Way',
      refs: ['nasaMilkyWay'],
    },
  ],
  'solar-system': [
    {
      value: '4.6 Ga',
      labelEs: 'Edad del Sistema Solar: 4 567 millones de años',
      labelEn: 'Age of the Solar System: 4,567 million years',
      refs: ['connelly2012'],
    },
    {
      value: '8',
      labelEs: 'Planetas según la definición de la IAU',
      labelEn: 'Planets under the IAU definition',
      refs: ['iau2006'],
    },
  ],
  life: [
    {
      value: '3.7 Ga',
      labelEs: 'Posibles estructuras microbianas más antiguas',
      labelEn: 'Oldest proposed microbial structures',
      noteEs: 'Hallazgo en Groenlandia; su origen biológico se cuestionó en 2018 y sigue en debate.',
      noteEn: 'Found in Greenland; their biological origin was questioned in 2018 and is still debated.',
      refs: ['nutman2016', 'allwood2018'],
    },
    {
      value: '~10⁷',
      labelEs: 'Especies eucariotas estimadas: 8.7 millones',
      labelEn: 'Estimated eukaryotic species: 8.7 million',
      refs: ['mora2011'],
    },
  ],
  now: [
    {
      value: '13.8 Ga',
      labelEs: 'Edad del universo: 13 787 millones de años',
      labelEn: 'Age of the universe: 13,787 million years',
      refs: ['planck2018'],
    },
    {
      value: '90 min',
      labelEs: 'Lo que tarda la ISS en dar una vuelta a la Tierra',
      labelEn: 'How long the ISS takes to circle Earth',
      refs: ['nasaIss'],
    },
    {
      value: '23:48',
      labelEs: 'Homo sapiens en el calendario cósmico (hace ~300 000 años)',
      labelEn: 'Homo sapiens on the cosmic calendar (~300,000 years ago)',
      refs: ['hublin2017', 'sagan1977'],
    },
  ],
};

export interface Resource {
  title: string;
  detailEs: string;
  detailEn: string;
  org: string;
  url: string;
  /** Capítulos donde se usa (id de CHAPTERS). */
  usedIn?: string[];
}

export const LIVE_SOURCES: Resource[] = [
  {
    title: 'NASA APOD',
    detailEs: 'Imagen astronómica del día, con su texto original.',
    detailEn: 'Astronomy Picture of the Day, with its original text.',
    org: 'NASA · Goddard Space Flight Center',
    url: 'https://apod.nasa.gov/apod/astropix.html',
    usedIn: ['now'],
  },
  {
    title: 'Where the ISS at?',
    detailEs: 'Posición, trayectoria y punto subsolar de la Estación Espacial Internacional.',
    detailEn: 'Position, ground track and subsolar point of the International Space Station.',
    org: 'Bill Shupp',
    url: 'https://wheretheiss.at/',
    usedIn: ['now'],
  },
  {
    title: 'James Webb Space Telescope',
    detailEs: 'El telescopio que “mira más lejos que nunca” en el capítulo 07.',
    detailEn: 'The telescope that “sees farther than ever” in chapter 07.',
    org: 'NASA · ESA · CSA',
    url: 'https://science.nasa.gov/mission/webb/',
    usedIn: ['now'],
  },
];

export const RESOURCES: Resource[] = [
  {
    title: 'Natural Earth',
    detailEs: 'Contornos de continentes del globo de la ISS. Dominio público.',
    detailEn: 'Continent outlines on the ISS globe. Public domain.',
    org: 'naturalearthdata.com',
    url: 'https://www.naturalearthdata.com/',
  },
  {
    title: 'Calendario cósmico',
    detailEs: 'La idea de comprimir 13 800 millones de años en un año, de Carl Sagan (1977).',
    detailEn: 'The idea of compressing 13.8 billion years into one year, by Carl Sagan (1977).',
    org: 'Carl Sagan · The Dragons of Eden',
    url: 'https://en.wikipedia.org/wiki/Cosmic_Calendar',
  },
  {
    title: 'Manrope',
    detailEs: 'Tipografía de texto y titulares. Licencia SIL Open Font.',
    detailEn: 'Text and headline typeface. SIL Open Font License.',
    org: 'Mikhail Sharanda · Google Fonts',
    url: 'https://fonts.google.com/specimen/Manrope',
  },
  {
    title: 'Cormorant Garamond',
    detailEs: 'Tipografía editorial de capítulos y cierres. Licencia SIL Open Font.',
    detailEn: 'Editorial typeface for chapters and closings. SIL Open Font License.',
    org: 'Christian Thalmann · Google Fonts',
    url: 'https://fonts.google.com/specimen/Cormorant+Garamond',
  },
];

/** Mes en que se revisaron las páginas web citadas. */
export const ACCESSED = { es: 'sep 2026', en: 'Sep 2026' };

export const REFERENCE_COUNT = Object.keys(REFERENCES).length;
