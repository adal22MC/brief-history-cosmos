import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import type { Era } from '../three/era-presets';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

// Títulos de capítulo: las letras llegan dispersas y borrosas y se condensan en su lugar.
// Tres eras suman un gesto propio: 02 un barrido de luz, 03 cada letra se enciende, 07 la señal se decodifica.
// La entrada se repite cada vez que el título vuelve a la pantalla.

// Sin < ni >: ScrambleText los escribiría como entidades HTML.
const SCRAMBLE_CHARS = '01/·*+#';

function visiblePart(title: HTMLElement) {
  const lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'es';
  return title.querySelector<HTMLElement>(`[data-${lang}]`) ?? title;
}

// Retraso de cada letra en orden aleatorio, para que el mismo orden sirva a varios tweens.
function shuffledDelays(count: number, each: number) {
  const ranks = gsap.utils.shuffle(Array.from({ length: count }, (_, i) => i));
  return ranks.map((rank) => rank * each);
}

function condense(timeline: gsap.core.Timeline, title: HTMLElement, chars: HTMLElement[], era: Era | undefined, accent: string, soft: boolean) {
  const color = getComputedStyle(title).color;
  const [r, g, b] = gsap.utils.splitColor(accent || color) as number[];
  const glowOff = `0 0 0px rgba(${r}, ${g}, ${b}, 0)`;
  const glowOn = `0 0 18px rgba(${r}, ${g}, ${b}, 0.9)`;
  // Cada letra parte más lejos cuanto más lejos está del centro del título: se juntan hacia adentro.
  const box = title.getBoundingClientRect();
  const center = box.left + box.width / 2;
  const spread = chars.map((char) => {
    const rect = char.getBoundingClientRect();
    return (rect.left + rect.width / 2 - center) * 0.18;
  });
  const each = Math.min(0.035, 0.9 / chars.length);
  // En la recombinación la luz avanza de izquierda a derecha; en el resto, en desorden.
  const delays = era === 'cooling' ? chars.map((_, i) => i * each) : shuffledDelays(chars.length, each);

  timeline.fromTo(
    chars,
    {
      opacity: 0,
      x: (i: number) => spread[i],
      y: () => gsap.utils.random(-14, 14),
      color: accent || color,
      textShadow: glowOff,
      ...(soft ? {} : { filter: 'blur(12px)' }),
    },
    {
      opacity: 1,
      x: 0,
      y: 0,
      color,
      textShadow: glowOff,
      ...(soft ? {} : { filter: 'blur(0px)' }),
      duration: 1.4,
      ease: 'power3.out',
      stagger: (i: number) => delays[i],
    },
    0,
  );

  if (era === 'stellar') {
    // 03 · Cada letra se enciende al llegar, como una estrella que prende.
    chars.forEach((char, i) => {
      timeline.to(
        char,
        {
          keyframes: [
            { color: '#ffffff', textShadow: glowOn, duration: 0.14, ease: 'power2.out' },
            { color, textShadow: glowOff, duration: 0.7, ease: 'power2.in' },
          ],
        },
        delays[i] + 0.08,
      );
    });
  } else if (era === 'cooling') {
    // 02 · Un barrido de luz cálida recorre el título, como el destello de la primera luz.
    const warmOn = '0 0 20px rgba(255, 196, 130, 0.85)';
    timeline.to(
      chars,
      {
        keyframes: [
          { color: '#fff3dc', textShadow: warmOn, duration: 0.2, ease: 'sine.out' },
          { color, textShadow: glowOff, duration: 0.6, ease: 'sine.in' },
        ],
        stagger: 0.03,
      },
      0.5,
    );
  }
}

// 07 · Ahora: cada letra pasa por caracteres al azar hasta fijarse, como una señal que llega en vivo.
function decode(timeline: gsap.core.Timeline, title: HTMLElement, chars: HTMLElement[], accent: string) {
  const color = getComputedStyle(title).color;
  const each = Math.min(0.03, 1.2 / chars.length);
  // Ancho fijo por letra: los caracteres de relleno no mueven el renglón.
  const widths = chars.map((char) => char.getBoundingClientRect().width);
  chars.forEach((char, i) => {
    const text = char.textContent ?? '';
    char.style.width = `${widths[i]}px`;
    char.style.textAlign = 'center';
    // Recorta de lado a lado (no arriba ni abajo) para que un relleno ancho no pise a sus vecinas.
    char.style.clipPath = 'inset(-0.5em 0)';
    const at = i * each;
    timeline.fromTo(char, { opacity: 0, color: accent || color }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, at);
    timeline.to(char, { duration: 0.45 + Math.random() * 0.5, scrambleText: { text, chars: SCRAMBLE_CHARS, speed: 0.8 }, ease: 'none' }, at);
    timeline.to(char, { color, duration: 0.5, ease: 'power2.out' }, at + 0.55);
  });
}

export function initTitleMotion() {
  const soft = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  const cleanups: Array<() => void> = [];

  gsap.utils.toArray<HTMLElement>('[data-title-motion]').forEach((title) => {
    const section = title.closest<HTMLElement>('[data-era]');
    const era = section?.dataset.era as Era | undefined;
    const accent = section ? getComputedStyle(section).getPropertyValue('--chapter-accent').trim() : '';
    const found = Array.from(title.querySelectorAll<HTMLElement>(':scope > [data-es], :scope > [data-en]'));
    const parts = found.length ? found : [title];
    let active: { timeline: gsap.core.Timeline; splits: SplitText[] } | null = null;
    let played = false;

    // Mientras está partido en letras, el lector de pantalla lee el título entero desde aria-label.
    const syncLabel = () => {
      if (active) title.setAttribute('aria-label', visiblePart(title).textContent?.trim() ?? '');
    };
    document.addEventListener('cosmos:language-change', syncLabel);

    // Deshace la división: vuelve el texto original con su interletrado.
    const release = () => {
      if (!active) return;
      active.timeline.kill();
      active.splits.forEach((split) => split.revert());
      active = null;
      if (parts[0] !== title) parts.forEach((part) => part.removeAttribute('aria-hidden'));
      title.removeAttribute('aria-label');
    };

    const play = () => {
      release();
      if (parts[0] !== title) parts.forEach((part) => part.setAttribute('aria-hidden', 'true'));
      const splits = parts.map((part) => new SplitText(part, { type: 'words,chars', aria: 'none' }));
      // Solo se anima el idioma visible; el otro queda completo por si se cambia a mitad.
      const shown = splits[parts.indexOf(visiblePart(title))] ?? splits[0];
      const chars = shown.chars as HTMLElement[];
      gsap.set(title, { opacity: 1 });
      gsap.set(chars, { opacity: 0 });
      // La primera entrada dura unos 2 s; al volver a un capítulo ya visto va más rápido.
      const timeline = gsap.timeline({ delay: 0.1, onComplete: release }).timeScale(played ? 1.5 : 1);
      played = true;
      active = { timeline, splits };
      syncLabel();
      if (era === 'now') decode(timeline, title, chars, accent);
      else condense(timeline, title, chars, era, accent, soft);
    };

    const hide = () => {
      release();
      gsap.set(title, { opacity: 0 });
    };

    // Se anima cada vez que el título entra, bajando o subiendo; se esconde de nuevo solo cuando
    // sale por completo de la pantalla, para que nunca desaparezca a la vista.
    gsap.set(title, { opacity: 0 });
    ScrollTrigger.create({ trigger: title, start: 'top 82%', end: 'bottom 12%', onEnter: play, onEnterBack: play });
    ScrollTrigger.create({ trigger: title, start: 'top bottom', end: 'bottom top', onLeave: hide, onLeaveBack: hide });

    cleanups.push(() => {
      release();
      gsap.set(title, { clearProps: 'opacity' });
      document.removeEventListener('cosmos:language-change', syncLabel);
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}
