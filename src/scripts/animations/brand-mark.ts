const ARC_STAGGER_MS = 90;
const ARC_DRAW_MS = 420;
const DOT_DELAY_MS = 7 * ARC_STAGGER_MS + 120;

// El encendido completo solo pasa en la primera carga; navegar entre páginas no lo repite.
let ignitedOnce = false;

function ignite(mark: SVGSVGElement) {
  const arcs = Array.from(mark.querySelectorAll<SVGPathElement>('.brand-mark__arc'));
  const dot = mark.querySelector<SVGCircleElement>('.brand-mark__dot');
  const animations = arcs.map((arc, i) => {
    const length = arc.getTotalLength();
    arc.style.strokeDasharray = `${length}`;
    return arc.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
      duration: ARC_DRAW_MS,
      delay: i * ARC_STAGGER_MS,
      easing: 'cubic-bezier(.3, .7, .2, 1)',
      fill: 'backwards',
    });
  });
  if (dot) {
    animations.push(
      dot.animate(
        [
          { transform: 'scale(0)', opacity: 0 },
          { transform: 'scale(1.5)', opacity: 1, offset: 0.6 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 480, delay: DOT_DELAY_MS, easing: 'ease-out', fill: 'backwards' },
      ),
    );
  }
  return animations;
}

/**
 * Marca animada: se traza al abrir el sitio, repite el trazo al pasar el cursor
 * y resalta el arco del capítulo que se está leyendo.
 */
export function initBrandMark(isReduced: boolean) {
  const marks = Array.from(document.querySelectorAll<SVGSVGElement>('[data-brand-mark]'));
  if (!marks.length) return () => {};
  const cleanups: Array<() => void> = [];
  const running = new Map<SVGSVGElement, Animation[]>();

  const play = (mark: SVGSVGElement) => {
    if (running.get(mark)?.some((animation) => animation.playState === 'running')) return;
    running.set(mark, ignite(mark));
  };

  if (!isReduced) {
    if (!ignitedOnce) {
      ignitedOnce = true;
      marks.forEach(play);
    }
    marks.forEach((mark) => {
      const host = mark.closest('a') ?? mark;
      const onEnter = () => play(mark);
      host.addEventListener('pointerenter', onEnter);
      cleanups.push(() => host.removeEventListener('pointerenter', onEnter));
    });
  }

  // Solo los capítulos de la portada encienden un arco; en otras páginas el anillo queda completo.
  const onSectionChange = (event: Event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    marks.forEach((mark) => {
      const arcs = mark.querySelectorAll<SVGPathElement>('.brand-mark__arc');
      const tracking = Array.from(arcs).some((arc) => arc.dataset.chapter === id);
      mark.classList.toggle('is-tracking', tracking);
      arcs.forEach((arc) => arc.classList.toggle('is-active', tracking && arc.dataset.chapter === id));
    });
  };
  document.addEventListener('cosmos:section-change', onSectionChange);
  cleanups.push(() => document.removeEventListener('cosmos:section-change', onSectionChange));

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    running.forEach((animations) => animations.forEach((animation) => animation.cancel()));
  };
}
