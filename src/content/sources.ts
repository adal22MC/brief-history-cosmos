export interface Source {
  title: { es: string; en: string };
  detail: { es: string; en: string };
  url: string;
  org: string;
}

export const SOURCES: Source[] = [
  {
    title: { es: 'NASA APOD', en: 'NASA APOD' },
    detail: {
      es: 'Astronomy Picture of the Day. Imagen y texto del capítulo 07.',
      en: 'Astronomy Picture of the Day. Image and text in chapter 07.',
    },
    url: 'https://apod.nasa.gov/apod/astropix.html',
    org: 'NASA · Goddard Space Flight Center',
  },
  {
    title: { es: 'Where the ISS at?', en: 'Where the ISS at?' },
    detail: {
      es: 'Posición en tiempo real de la Estación Espacial Internacional.',
      en: 'Real-time position of the International Space Station.',
    },
    url: 'https://wheretheiss.at/',
    org: 'Bill Shupp',
  },
  {
    title: { es: 'Cronología cosmológica', en: 'Cosmological timeline' },
    detail: {
      es: 'Edades, temperaturas y escalas verificadas en el consenso ΛCDM (Planck 2018).',
      en: 'Ages, temperatures and scales verified against the ΛCDM consensus (Planck 2018).',
    },
    url: 'https://www.cosmos.esa.int/web/planck',
    org: 'ESA · Planck Collaboration',
  },
  {
    title: { es: 'JWST Science', en: 'JWST Science' },
    detail: {
      es: 'Observaciones recientes del telescopio espacial James Webb.',
      en: 'Recent observations from the James Webb Space Telescope.',
    },
    url: 'https://webbtelescope.org/',
    org: 'STScI · NASA · ESA · CSA',
  },
];
