import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ERA_ACCENTS, type Era } from '../three/era-presets';

export type CleanupFn = () => void;

export interface RailOpts {
  lenis: Lenis | null;
  isReduced: boolean;
  onCleanup(cleanup: CleanupFn): void;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function getRailSectionLabel(section: HTMLElement | undefined) {
  if (!section) return '';
  const lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'es';
  return (
    section.dataset[`sectionLabel${lang === 'en' ? 'En' : 'Es'}`] ??
    section.dataset.sectionLabel ??
    ''
  );
}

// En la portada cada capítulo es su propia sección; en Fuentes, el bloque de cada capítulo lo señala con data-rail-id.
const railIdOf = (section: HTMLElement | undefined) => section?.dataset.railId ?? section?.id;

export function initEraRail({ lenis, isReduced, onCleanup }: RailOpts) {
  const rail = document.querySelector<HTMLElement>('[data-era-rail]');
  const mobile = document.querySelector<HTMLElement>('[data-era-mobile]');
  if (!rail || !mobile || rail.dataset.booted) return;
  rail.dataset.booted = '1';
  onCleanup(() => rail.removeAttribute('data-booted'));

  const sections = gsap.utils.toArray<HTMLElement>('[data-rail-section]');
  const railLinks = gsap.utils.toArray<HTMLAnchorElement>('[data-rail-target]:not([data-rail-mobile-item])');
  const chapterLinks = railLinks.filter((link) => !link.hasAttribute('data-rail-source'));
  const sheetItems = gsap.utils.toArray<HTMLAnchorElement>('[data-rail-mobile-item]');
  const links = [...railLinks, ...sheetItems];
  const sourceLink = document.querySelector<HTMLAnchorElement>('[data-rail-source]');
  const isSourcePage = location.pathname.startsWith('/work');
  const chapterSections = sections.filter((section) =>
    chapterLinks.some((link) => link.dataset.railTarget === railIdOf(section)),
  );
  const indexOfTarget = (target: string | undefined) => sections.findIndex((section) => railIdOf(section) === target);
  const mobileTrigger = document.querySelector<HTMLButtonElement>('[data-rail-mobile-trigger]');
  const mobileSheet = document.querySelector<HTMLElement>('[data-rail-mobile-sheet]');
  const mobileBackdrop = document.querySelector<HTMLElement>('[data-rail-mobile-backdrop]');
  const mobileClose = document.querySelector<HTMLButtonElement>('[data-rail-mobile-close]');
  const mobileStatus = document.querySelector<HTMLElement>('[data-rail-mobile-status]');
  const mobileLabel = document.querySelector<HTMLElement>('[data-rail-mobile-label]');
  const sheetBilingual = mobile?.querySelectorAll<HTMLElement>('[data-bilingual-es]');
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const track = rail.querySelector<HTMLElement>('[data-rail-track]');
  const fill = rail.querySelector<HTMLElement>('[data-rail-fill]');
  let activeIndex = 0;
  let sheetOpen = false;
  let sheetHideTimer: number | undefined;

  document.querySelectorAll<HTMLElement>('[data-rail-era]').forEach((el) => {
    const era = el.dataset.railEra as Era | undefined;
    if (era) el.style.setProperty('--rail-color', ERA_ACCENTS[era]);
  });

  const setActive = (index: number) => {
    activeIndex = Math.max(0, Math.min(index, Math.max(sections.length - 1, 0)));
    const activeSection = sections[activeIndex];
    const activeId = railIdOf(activeSection);
    const activeEra = activeSection?.dataset.era as Era | undefined;
    const activeLink = chapterLinks.find((link) => link.dataset.railTarget === activeId);

    links.forEach((link) => {
      const isActive = Boolean(activeId && link.dataset.railTarget === activeId);
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'location' : 'false');
    });
    // En Fuentes, el enlace SRC sigue siendo la página actual aunque se esté leyendo el bloque de un capítulo.
    if (sourceLink && isSourcePage) sourceLink.setAttribute('aria-current', 'page');

    if (activeEra) {
      document.documentElement.style.setProperty('--era-accent', ERA_ACCENTS[activeEra]);
    }
    if (mobileStatus) {
      mobileStatus.textContent = activeLink
        ? activeLink.querySelector('.era-rail__num')?.textContent ?? String(activeIndex + 1).padStart(2, '0')
        : 'SRC';
    }
    if (mobileLabel) {
      mobileLabel.textContent = activeSection ? getRailSectionLabel(activeSection) : '';
    }
  };

  const syncSheetBilingual = () => {
    if (!sheetBilingual) return;
    const lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'es';
    sheetBilingual.forEach((el) => {
      const text = lang === 'en' ? el.dataset.bilingualEn : el.dataset.bilingualEs;
      if (text) el.textContent = text;
    });
  };

  const setSheetOpen = (open: boolean) => {
    if (!mobileSheet || !mobileTrigger) return;
    sheetOpen = open;
    window.clearTimeout(sheetHideTimer);
    if (open) {
      mobileSheet.removeAttribute('hidden');
      requestAnimationFrame(() => mobileSheet.classList.add('is-open'));
    } else {
      mobileSheet.classList.remove('is-open');
      sheetHideTimer = window.setTimeout(() => {
        if (!sheetOpen) mobileSheet.setAttribute('hidden', '');
      }, 280);
    }
    mobileTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('era-sheet-locked', open);
    if (open) {
      syncSheetBilingual();
      const activeItem = sheetItems.find((item) => item.classList.contains('is-active'));
      activeItem?.focus({ preventScroll: true });
    } else {
      mobileTrigger.focus({ preventScroll: true });
    }
  };

  // La sección activa es la última que ya cruzó el centro de la pantalla; al final de la página, la última.
  const getActiveSectionIndex = () => {
    if (!sections.length) return 0;
    const root = document.documentElement;
    if (window.scrollY + window.innerHeight >= root.scrollHeight - 2) return sections.length - 1;
    const anchor = window.innerHeight * 0.5;
    let index = 0;
    sections.forEach((section, i) => {
      if (section.getBoundingClientRect().top <= anchor) index = i;
    });
    return index;
  };

  const syncToViewport = () => {
    const index = getActiveSectionIndex();
    const section = sections[index];
    if (!section) return;
    setActive(index);
    document.dispatchEvent(
      new CustomEvent('cosmos:section-change', {
        detail: {
          index,
          label: section.dataset.sectionLabel ?? '',
          num: String(index + 1).padStart(2, '0'),
          era: section.dataset.era as Era | undefined,
          id: section.id,
        },
      }),
    );
  };

  const scrollToSection = (index: number) => {
    const section = sections[index];
    if (!section) return;
    const shouldReduce = isReduced || reduceMotionQuery.matches;
    if (lenis && !shouldReduce) {
      const distance = Math.abs(section.getBoundingClientRect().top);
      const duration = gsap.utils.clamp(0.5, 0.85, 0.45 + distance / window.innerHeight * 0.18);
      // Lenis ignora scroll-margin; los bloques de Fuentes lo usan para no quedar bajo el menú.
      const offset = -(parseFloat(getComputedStyle(section).scrollMarginTop) || 0);
      lenis.scrollTo(section, { duration, offset });
    } else {
      section.scrollIntoView({ behavior: shouldReduce ? 'auto' : 'smooth', block: 'start' });
    }
    setActive(index);
  };

  const listen = <T extends Event>(
    target: EventTarget,
    type: string,
    handler: (event: T) => void,
  ) => {
    target.addEventListener(type, handler as EventListener);
    onCleanup(() => target.removeEventListener(type, handler as EventListener));
  };

  links.forEach((link) => {
    listen<MouseEvent>(link, 'click', (event) => {
      const targetIndex = indexOfTarget(link.dataset.railTarget);
      if (targetIndex < 0) return;
      event.preventDefault();
      const wasOpen = sheetOpen;
      scrollToSection(targetIndex);
      if (wasOpen) setSheetOpen(false);
    });
  });

  if (mobileTrigger) {
    listen<MouseEvent>(mobileTrigger, 'click', () => setSheetOpen(!sheetOpen));
  }
  if (mobileBackdrop) {
    listen<MouseEvent>(mobileBackdrop, 'click', () => setSheetOpen(false));
  }
  if (mobileClose) {
    listen<MouseEvent>(mobileClose, 'click', () => setSheetOpen(false));
  }

  const forceCloseSheet = () => {
    window.clearTimeout(sheetHideTimer);
    sheetOpen = false;
    mobileSheet?.setAttribute('hidden', '');
    mobileSheet?.classList.remove('is-open');
    mobileTrigger?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('era-sheet-locked');
  };
  listen(document, 'astro:before-swap', forceCloseSheet);
  onCleanup(forceCloseSheet);

  // El rail sigue al scroll por su cuenta: en Fuentes los bloques no coinciden con las secciones del índice.
  let scrollFrame = 0;
  listen(window, 'scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const index = getActiveSectionIndex();
      if (index !== activeIndex) setActive(index);
      updateFill();
    });
  });
  onCleanup(() => cancelAnimationFrame(scrollFrame));

  listen(document, 'cosmos:language-change', () => {
    syncSheetBilingual();
    setActive(activeIndex);
  });
  listen<KeyboardEvent>(document, 'keydown', (event) => {
    if (event.key === 'Escape' && sheetOpen) {
      event.preventDefault();
      setSheetOpen(false);
      return;
    }
    if (!sections.length) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isEditableTarget(event.target)) return;
    if (sheetOpen) return;

    // Los números llevan al capítulo: su sección en la portada o su bloque en Fuentes.
    const digit = parseInt(event.key, 10);
    const digitIndex = digit >= 1 ? indexOfTarget(chapterLinks[digit - 1]?.dataset.railTarget) : -1;
    if (digitIndex >= 0) {
      event.preventDefault();
      scrollToSection(digitIndex);
      return;
    }

    // Las flechas conservan el scroll nativo para poder leer secciones largas; J/K saltan de capítulo.
    const key = event.key.toLowerCase();
    if (key === 'j' && activeIndex < sections.length - 1) {
      event.preventDefault();
      scrollToSection(activeIndex + 1);
    } else if (key === 'k' && activeIndex > 0) {
      event.preventDefault();
      scrollToSection(activeIndex - 1);
    }
  });

  if (!sections.length && sourceLink) {
    sourceLink.classList.toggle('is-active', isSourcePage);
    sourceLink.setAttribute('aria-current', isSourcePage ? 'page' : 'false');
  }

  // Línea de progreso: va del primer al último punto de capítulo y se llena con el scroll.
  const measureTrack = () => {
    if (!track) return;
    const dots = chapterLinks.map((link) => link.querySelector<HTMLElement>('.era-rail__dot')).filter(Boolean) as HTMLElement[];
    if (chapterSections.length < 2 || dots.length < 2) {
      track.hidden = true;
      return;
    }
    track.hidden = false;
    const railTop = rail.getBoundingClientRect().top;
    const center = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height / 2 - railTop;
    };
    const top = center(dots[0]);
    rail.style.setProperty('--track-top', `${top}px`);
    rail.style.setProperty('--track-height', `${center(dots[dots.length - 1]) - top}px`);
  };
  measureTrack();
  listen(window, 'resize', measureTrack);
  // La línea avanza por tramos: llega a cada punto justo cuando su capítulo cruza el centro de la pantalla,
  // aunque los bloques midan distinto (en Fuentes cada capítulo tiene más o menos referencias).
  const setFill = fill && !isReduced ? gsap.quickTo(fill, 'scaleY', { duration: 0.4, ease: 'power3' }) : null;
  const updateFill = () => {
    if (!fill || chapterSections.length < 2) return;
    const anchor = window.innerHeight * 0.5;
    const tops = chapterSections.map((section) => section.getBoundingClientRect().top - anchor);
    let progress = 0;
    for (let i = 0; i < tops.length - 1; i++) {
      if (tops[i] <= 0) progress = i + Math.min(1, -tops[i] / Math.max(tops[i + 1] - tops[i], 1));
    }
    const scale = progress / (tops.length - 1);
    if (setFill) setFill(scale);
    else gsap.set(fill, { scaleY: scale });
  };
  if (fill) gsap.set(fill, { scaleY: 0 });
  updateFill();
  listen(window, 'resize', updateFill);
  onCleanup(() => {
    if (fill) gsap.killTweensOf(fill);
  });

  const syncFrame = requestAnimationFrame(syncToViewport);
  const syncTimer = window.setTimeout(syncToViewport, 120);
  onCleanup(() => {
    cancelAnimationFrame(syncFrame);
    window.clearTimeout(syncTimer);
  });
}
