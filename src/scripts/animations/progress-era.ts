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

// Sigue la sección activa: la anuncia con cosmos:section-change y la muestra en el header.
export function initSectionIndex(isReduced = false) {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  // El capítulo aparece dos veces: al centro en escritorio y en el botón de capítulos en pantallas táctiles.
  const fields = {
    num: gsap.utils.toArray<HTMLElement>('[data-header-num]'),
    label: gsap.utils.toArray<HTMLElement>('[data-header-label]'),
    tick: gsap.utils.toArray<HTMLElement>('[data-header-tick]'),
  };
  const fieldEls = [...fields.num, ...fields.label, ...fields.tick];
  const sections = gsap.utils.toArray<HTMLElement>('[data-section-label]');
  let activeSection: HTMLElement | null = null;

  const localized = (section: HTMLElement, key: 'sectionLabel' | 'sectionTick') => {
    const suffix = document.documentElement.dataset.lang === 'en' ? 'En' : 'Es';
    return section.dataset[`${key}${suffix}`] ?? section.dataset[key] ?? '';
  };

  const render = () => {
    if (!activeSection) return;
    const section = activeSection;
    fields.num.forEach((el) => (el.textContent = section.dataset.sectionNum ?? ''));
    fields.label.forEach((el) => (el.textContent = localized(section, 'sectionLabel')));
    fields.tick.forEach((el) => (el.textContent = localized(section, 'sectionTick')));
    header?.classList.toggle('has-context', Boolean(activeSection.dataset.sectionNum));
  };

  document.addEventListener('cosmos:language-change', render);
  sections.forEach((section, i) => {
    const num = String(i + 1).padStart(2, '0');
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (!self.isActive) return;
        activeSection = section;
        if (!isReduced && fieldEls.length) {
          gsap.fromTo(
            fieldEls,
            { yPercent: 40, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05, overwrite: true },
          );
        }
        render();
        document.dispatchEvent(
          new CustomEvent('cosmos:section-change', {
            detail: { index: i, label: localized(section, 'sectionLabel'), num, era: section.dataset.era as Era | undefined, id: section.id },
          }),
        );
      },
    });
  });
  return () => {
    document.removeEventListener('cosmos:language-change', render);
    gsap.killTweensOf(fieldEls);
  };
}
