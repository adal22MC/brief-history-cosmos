import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Era } from '../three/era-presets';
import { sceneBridge } from '../three/scene-bridge';

export function initProgressBar() {
  const progressBar = document.querySelector<HTMLElement>('.scroll-progress span');
  if (!progressBar) return;
  gsap.to(progressBar, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.2 },
  });
}

export function initEraDriver() {
  document.querySelectorAll<HTMLElement>('[data-era]').forEach((section) => {
    const era = section.dataset.era as Era | undefined;
    if (!era) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      end: 'bottom 40%',
      onToggle: (self) => {
        if (self.isActive) sceneBridge.setEra(era);
      },
    });
  });

  // Las tarjetas y listas marcadas con data-scene-yield mandan el blob a una esquina.
  const yielding = new Set<Element>();
  sceneBridge.setYield(false);
  document.querySelectorAll<HTMLElement>('[data-scene-yield]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 80%',
      end: 'bottom 20%',
      onToggle: (self) => {
        if (self.isActive) yielding.add(el);
        else yielding.delete(el);
        sceneBridge.setYield(yielding.size > 0);
      },
    });
  });
}

export function initSectionIndex(isReduced = false) {
  const indexEl = document.querySelector<HTMLElement>('.section-index');
  const numEl = document.querySelector<HTMLElement>('.section-index__num');
  const labelEl = document.querySelector<HTMLElement>('.section-index__label');
  if (!indexEl || !numEl || !labelEl) return () => {};

  // El índice fijo se retira cuando tarjetas o pie de página llegan a su esquina.
  const covering = new Set<Element>();
  indexEl.classList.remove('is-hidden');
  document.querySelectorAll<HTMLElement>('[data-index-hide]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom bottom-=64',
      onToggle: (self) => {
        if (self.isActive) covering.add(el);
        else covering.delete(el);
        indexEl.classList.toggle('is-hidden', covering.size > 0);
      },
    });
  });

  const sections = gsap.utils.toArray<HTMLElement>('[data-section-label]');
  let activeSection: HTMLElement | null = null;

  const getSectionLabel = (section: HTMLElement) => {
    const lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'es';
    return section.dataset[`sectionLabel${lang === 'en' ? 'En' : 'Es'}`] ?? section.dataset.sectionLabel ?? '';
  };

  const updateActiveLabel = () => {
    if (activeSection) labelEl.textContent = getSectionLabel(activeSection);
  };

  document.addEventListener('cosmos:language-change', updateActiveLabel);
  sections.forEach((section, i) => {
    const num = String(i + 1).padStart(2, '0');
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (self.isActive) {
          const era = section.dataset.era as Era | undefined;
          const label = getSectionLabel(section);
          activeSection = section;
          if (!isReduced) gsap.fromTo(
            [numEl, labelEl],
            { yPercent: 30, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05, overwrite: true },
          );
          numEl.textContent = num;
          labelEl.textContent = label;
          document.dispatchEvent(
            new CustomEvent('cosmos:section-change', {
              detail: { index: i, label, num, era, id: section.id },
            }),
          );
        }
      },
    });
  });
  return () => {
    document.removeEventListener('cosmos:language-change', updateActiveLabel);
    gsap.killTweensOf([numEl, labelEl]);
  };
}
