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

export function initEraRail({ lenis, isReduced, onCleanup }: RailOpts) {
  const rail = document.querySelector<HTMLElement>('[data-era-rail]');
  const mobile = document.querySelector<HTMLElement>('[data-era-mobile]');
  if (!rail || !mobile || rail.dataset.booted) return;
  rail.dataset.booted = '1';
  onCleanup(() => rail.removeAttribute('data-booted'));

  const sections = gsap.utils.toArray<HTMLElement>('[data-rail-section]');
  const railLinks = gsap.utils.toArray<HTMLAnchorElement>('[data-rail-target]:not([data-rail-mobile-item])');
  const sheetItems = gsap.utils.toArray<HTMLButtonElement>('[data-rail-mobile-item]');
  const links = [...railLinks, ...sheetItems] as Array<HTMLAnchorElement | HTMLButtonElement>;
  const sourceLink = document.querySelector<HTMLAnchorElement>('[data-rail-source]');
  const mobileTrigger = document.querySelector<HTMLButtonElement>('[data-rail-mobile-trigger]');
  const mobileSheet = document.querySelector<HTMLElement>('[data-rail-mobile-sheet]');
  const mobileBackdrop = document.querySelector<HTMLElement>('[data-rail-mobile-backdrop]');
  const mobileClose = document.querySelector<HTMLButtonElement>('[data-rail-mobile-close]');
  const mobileStatus = document.querySelector<HTMLElement>('[data-rail-mobile-status]');
  const mobileLabel = document.querySelector<HTMLElement>('[data-rail-mobile-label]');
  const sheetBilingual = mobile?.querySelectorAll<HTMLElement>('[data-bilingual-es]');
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
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
    const activeId = activeSection?.id;
    const activeEra = activeSection?.dataset.era as Era | undefined;
    const isSourcePage = location.pathname.startsWith('/work');

    links.forEach((link) => {
      const isActive = Boolean(!isSourcePage && activeId && link.dataset.railTarget === activeId);
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'location' : 'false');
    });

    if (sourceLink) {
      sourceLink.classList.toggle('is-active', isSourcePage);
      sourceLink.setAttribute('aria-current', isSourcePage ? 'page' : 'false');
    }

    if (activeEra) {
      document.documentElement.style.setProperty('--era-accent', ERA_ACCENTS[activeEra]);
    }
    if (mobileStatus) {
      mobileStatus.textContent = isSourcePage
        ? '01'
        : sections.length
        ? String(activeIndex + 1).padStart(2, '0')
        : 'SRC';
    }
    if (mobileLabel) {
      mobileLabel.textContent =
        sections.length && activeSection ? getRailSectionLabel(activeSection as HTMLElement) : '';
    }
    sheetItems.forEach((item, idx) => {
      const isActive = !isSourcePage && idx === activeIndex;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-current', isActive ? 'location' : 'false');
    });
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
      const activeItem = location.pathname.startsWith('/work') ? undefined : sheetItems[activeIndex];
      activeItem?.focus({ preventScroll: true });
    } else {
      mobileTrigger.focus({ preventScroll: true });
    }
  };

  const getNearestSectionIndex = () => {
    if (!sections.length) return 0;
    const viewportAnchor = window.innerHeight * 0.5;
    return sections.reduce((nearestIndex, section, index) => {
      const currentDistance = Math.abs(section.getBoundingClientRect().top - viewportAnchor);
      const nearestDistance = Math.abs(sections[nearestIndex].getBoundingClientRect().top - viewportAnchor);
      return currentDistance < nearestDistance ? index : nearestIndex;
    }, 0);
  };

  const syncToViewport = () => {
    const index = getNearestSectionIndex();
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
      const duration = gsap.utils.clamp(0.6, 1.1, 0.55 + distance / window.innerHeight * 0.25);
      lenis.scrollTo(section, { duration });
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

  links.forEach((link, index) => {
    listen<MouseEvent>(link, 'click', (event) => {
      const targetId = link.dataset.railTarget;
      const targetIndex = sections.findIndex((sec) => sec.id === targetId);
      if (targetIndex < 0) return;
      event.preventDefault();
      const wasOpen = sheetOpen;
      scrollToSection(targetIndex);
      if (wasOpen) setSheetOpen(false);
    });
    if (!link.hasAttribute('aria-label')) {
      link.setAttribute('aria-label', `Go to section ${String(index + 1).padStart(2, '0')}`);
    }
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

  listen<CustomEvent<{ id?: string }>>(document, 'cosmos:section-change', (event) => {
    const detail = (event as CustomEvent<{ id?: string }>).detail;
    const index = sections.findIndex((sec) => sec.id === detail.id);
    if (index >= 0) setActive(index);
  });

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

    const digit = parseInt(event.key, 10);
    if (Number.isInteger(digit) && digit >= 1 && digit <= sections.length) {
      event.preventDefault();
      scrollToSection(digit - 1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      scrollToSection(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      scrollToSection(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      scrollToSection(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      scrollToSection(sections.length - 1);
    }
  });

  if (!sections.length && sourceLink) {
    sourceLink.classList.toggle('is-active', location.pathname.startsWith('/work'));
    sourceLink.setAttribute('aria-current', location.pathname.startsWith('/work') ? 'page' : 'false');
  }

  requestAnimationFrame(syncToViewport);
  window.setTimeout(syncToViewport, 120);
}
