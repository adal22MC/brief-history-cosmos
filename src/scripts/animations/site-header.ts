// Header: se compacta al dejar el inicio de la página y se esconde mientras se lee hacia abajo.
// Reaparece apenas se sube; escondido deja a la vista solo su filo, la línea de progreso.
const COMPACT_AT = 80;
const HIDE_AFTER = 240;
const SCROLL_DELTA = 6;

export function initSiteHeader() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return () => {};

  let lastY = window.scrollY;
  let frame = 0;

  const update = () => {
    frame = 0;
    const y = Math.max(0, window.scrollY);
    header.classList.toggle('is-compact', y > COMPACT_AT);
    // Con la hoja de capítulos abierta el scroll está bloqueado: no se toca el header.
    if (document.body.classList.contains('era-sheet-locked')) return;
    const dy = y - lastY;
    if (y < HIDE_AFTER) {
      header.classList.remove('is-hidden');
      lastY = y;
    } else if (Math.abs(dy) > SCROLL_DELTA) {
      header.classList.toggle('is-hidden', dy > 0);
      lastY = y;
    }
  };

  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(frame);
    header.classList.remove('is-hidden');
  };
}
