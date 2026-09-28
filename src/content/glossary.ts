export interface GlossaryEntry {
  termEs: string;
  termEn: string;
  defEs: string;
  defEn: string;
}

export const GLOSSARY = {
  inflation: {
    termEs: 'Inflación cósmica',
    termEn: 'Cosmic inflation',
    defEs:
      'Expansión exponencial del espacio en la primera fracción de segundo (~10⁻³² s). Multiplicó el tamaño del universo por ~10²⁶ y alisó sus irregularidades.',
    defEn:
      'An exponential expansion of space in the first sliver of a second (~10⁻³² s). It stretched the universe by ~10²⁶ and smoothed out its irregularities.',
  },
  cmb: {
    termEs: 'Fondo cósmico de microondas',
    termEn: 'Cosmic microwave background',
    defEs:
      'La luz liberada en la recombinación, hoy enfriada a 2.7 K. Llega de todas direcciones y es la imagen más antigua del universo.',
    defEn:
      'The light released at recombination, now cooled to 2.7 K. It arrives from every direction and is the oldest image of the universe.',
  },
  pop3: {
    termEs: 'Población III',
    termEn: 'Population III',
    defEs:
      'Primera generación de estrellas, hechas casi solo de hidrógeno y helio. Eran muy masivas y de vida corta; todavía no se han observado directamente.',
    defEn:
      'The first generation of stars, made almost entirely of hydrogen and helium. Massive and short-lived; none has been observed directly yet.',
  },
  ma: {
    termEs: 'Ma · megaaño',
    termEn: 'Ma · mega-annum',
    defEs: 'Un millón de años. 200 Ma equivalen a 200 millones de años.',
    defEn: 'One million years. 200 Ma means 200 million years.',
  },
  ga: {
    termEs: 'Ga · gigaaño',
    termEn: 'Ga · giga-annum',
    defEs: 'Mil millones de años. El universo tiene 13.8 Ga.',
    defEn: 'One billion years. The universe is 13.8 Ga old.',
  },
  halo: {
    termEs: 'Halo de materia oscura',
    termEn: 'Dark matter halo',
    defEs:
      'Nube invisible y aproximadamente esférica de materia oscura que envuelve a cada galaxia. Su gravedad reunió el gas que formó las estrellas.',
    defEn:
      'An invisible, roughly spherical cloud of dark matter around each galaxy. Its gravity gathered the gas that became stars.',
  },
  replication: {
    termEs: 'Autorreplicación',
    termEn: 'Self-replication',
    defEs:
      'Moléculas capaces de hacer copias de sí mismas, como el ARN. Es el paso que separa la química de la biología.',
    defEn:
      'Molecules able to make copies of themselves, such as RNA. It is the step that separates chemistry from biology.',
  },
  cosmicCalendar: {
    termEs: 'Calendario cósmico',
    termEn: 'Cosmic calendar',
    defEs:
      'Idea popularizada por Carl Sagan: si los 13 800 millones de años cupieran en un año, cada día valdría ~38 millones de años y cada segundo, ~440 años.',
    defEn:
      'An idea popularized by Carl Sagan: if 13.8 billion years fit into one year, each day would be ~38 million years and each second ~440 years.',
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryId = keyof typeof GLOSSARY;
