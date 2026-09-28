const EDGE = 12;
const HEADER_CLEARANCE = 96;

// Mantiene el globo dentro de la ventana: lo desplaza en x y lo pasa abajo si choca con la cabecera.
function placeTip(term: HTMLElement) {
  const tip = term.querySelector<HTMLElement>('.term__tip');
  if (!tip) return;
  term.style.removeProperty('--tip-shift');
  term.removeAttribute('data-place');
  const rect = tip.getBoundingClientRect();
  let shift = 0;
  if (rect.right > window.innerWidth - EDGE) shift = window.innerWidth - EDGE - rect.right;
  if (rect.left + shift < EDGE) shift = EDGE - rect.left;
  if (shift) term.style.setProperty('--tip-shift', `${Math.round(shift)}px`);
  if (rect.top < HEADER_CLEARANCE) term.setAttribute('data-place', 'below');
}

export function initGlossary() {
  const terms = Array.from(document.querySelectorAll<HTMLElement>('[data-term]'));
  if (!terms.length) return () => {};

  const closeAll = (except?: HTMLElement) => {
    terms.forEach((term) => {
      if (term !== except) term.removeAttribute('data-open');
    });
  };

  const cleanups = terms.flatMap((term) => {
    const trigger = term.querySelector<HTMLButtonElement>('.term__trigger');
    if (!trigger) return [];
    const onEnter = () => placeTip(term);
    // En touch no hay hover: el toque abre y cierra el globo.
    const onClick = (event: MouseEvent) => {
      event.stopPropagation();
      const open = !term.hasAttribute('data-open');
      closeAll(term);
      term.toggleAttribute('data-open', open);
      if (open) placeTip(term);
    };
    term.addEventListener('pointerenter', onEnter);
    trigger.addEventListener('focus', onEnter);
    trigger.addEventListener('click', onClick);
    return [
      () => {
        term.removeEventListener('pointerenter', onEnter);
        trigger.removeEventListener('focus', onEnter);
        trigger.removeEventListener('click', onClick);
      },
    ];
  });

  const onDocClick = () => closeAll();
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeAll();
  };
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
  };
}
