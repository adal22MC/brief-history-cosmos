import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SceneAPI } from '../three/scene';
import type { Era } from '../three/era-presets';

export function initProgressBar() {
  const progressBar = document.querySelector<HTMLElement>('.scroll-progress span');
  if (!progressBar) return;
  gsap.to(progressBar, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.2 },
  });
}

export function initEraDriver(sceneApi: SceneAPI | null) {
  if (!sceneApi) return;
  document.querySelectorAll<HTMLElement>('[data-era]').forEach((section) => {
    const era = section.dataset.era as Era | undefined;
    if (!era) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      end: 'bottom 40%',
      onToggle: (self) => {
        if (self.isActive) sceneApi.setEra(era);
      },
    });
  });
}

export function initSectionIndex() {
  const numEl = document.querySelector<HTMLElement>('.section-index__num');
  const labelEl = document.querySelector<HTMLElement>('.section-index__label');
  if (!numEl || !labelEl) return;

  const sections = gsap.utils.toArray<HTMLElement>('[data-section-label]');
  let activeSection: HTMLElement | null = null;

  const getSectionLabel = (section: HTMLElement) => {
    const lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'es';
    return section.dataset[`sectionLabel${lang === 'en' ? 'En' : 'Es'}`] ?? section.dataset.sectionLabel ?? '';
  };

  const updateActiveLabel = () => {
    if (activeSection) labelEl.textContent = getSectionLabel(activeSection);
  };

  const previousLabelHandler = window.__cosmosSectionIndexLabelHandler;
  if (previousLabelHandler) {
    document.removeEventListener('cosmos:language-change', previousLabelHandler);
  }
  window.__cosmosSectionIndexLabelHandler = updateActiveLabel;
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
          gsap.fromTo(
            [numEl, labelEl],
            { yPercent: 30, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05 },
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
}
