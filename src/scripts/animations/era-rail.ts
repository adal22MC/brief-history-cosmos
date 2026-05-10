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
  const links = gsap.utils.toArray<HTMLAnchorElement>('[data-rail-target]');
  const sourceLink = document.querySelector<HTMLAnchorElement>('[data-rail-source]');
  const prevBtn = document.querySelector<HTMLButtonElement>('[data-rail-prev]');
  const nextBtn = document.querySelector<HTMLButtonElement>('[data-rail-next]');
  const mobileStatus = document.querySelector<HTMLElement>('[data-rail-mobile-status]');
  const mobileLabel = document.querySelector<HTMLElement>('[data-rail-mobile-label]');
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeIndex = 0;

  document.querySelectorAll<HTMLElement>('[data-rail-era]').forEach((el) => {
    const era = el.dataset.railEra as Era | undefined;
    if (era) el.style.setProperty('--rail-color', ERA_ACCENTS[era]);
  });

  const setActive = (index: number) => {
    activeIndex = Math.max(0, Math.min(index, Math.max(sections.length - 1, 0)));
    const activeSection = sections[activeIndex];
    const activeId = activeSection?.id;
    const activeEra = activeSection?.dataset.era as Era | undefined;

    links.forEach((link) => {
      const isActive = Boolean(activeId && link.dataset.railTarget === activeId);
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'location' : 'false');
    });

    if (sourceLink) {
      const isSourcePage = location.pathname.startsWith('/work');
      sourceLink.classList.toggle('is-active', isSourcePage);
      sourceLink.setAttribute('aria-current', isSourcePage ? 'page' : 'false');
    }

    if (activeEra) {
      document.documentElement.style.setProperty('--era-accent', ERA_ACCENTS[activeEra]);
    }
    if (mobileStatus) {
      mobileStatus.textContent = sections.length
        ? `${String(activeIndex + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}`
        : 'SRC';
    }
    if (mobileLabel) {
      mobileLabel.textContent =
        sections.length && activeSection ? getRailSectionLabel(activeSection as HTMLElement) : '';
    }
    if (prevBtn) prevBtn.disabled = !sections.length || activeIndex === 0;
    if (nextBtn) nextBtn.disabled = !sections.length || activeIndex === sections.length - 1;
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
      lenis.scrollTo(section, { duration: 1.2 });
    } else {
      section.scrollIntoView({ behavior: 'auto', block: 'start' });
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
      scrollToSection(targetIndex);
    });
    link.setAttribute('aria-label', `Go to section ${String(index + 1).padStart(2, '0')}`);
  });

  if (prevBtn) listen<MouseEvent>(prevBtn, 'click', () => scrollToSection(activeIndex - 1));
  if (nextBtn) listen<MouseEvent>(nextBtn, 'click', () => scrollToSection(activeIndex + 1));

  listen<CustomEvent<{ id?: string }>>(document, 'cosmos:section-change', (event) => {
    const detail = (event as CustomEvent<{ id?: string }>).detail;
    const index = sections.findIndex((sec) => sec.id === detail.id);
    if (index >= 0) setActive(index);
  });

  listen(document, 'cosmos:language-change', () => setActive(activeIndex));
  listen<KeyboardEvent>(document, 'keydown', (event) => {
    if (!sections.length) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isEditableTarget(event.target)) return;

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
