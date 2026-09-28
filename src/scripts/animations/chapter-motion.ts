import { gsap } from 'gsap';
import { formatGrouped, toSuperscript } from './number-format';

const countedTexts = new Map<HTMLElement, string>();

// Las cifras con data-count corren desde data-count-from (0 por defecto) hasta su valor.
// El texto del SSR es el estado final, así sin JS o con reduced-motion se ve completo.
function countUp(root: ParentNode) {
  const tweens = gsap.utils.toArray<HTMLElement>(root.querySelectorAll('[data-count]')).map((el) => {
    const finalText = el.textContent ?? '';
    countedTexts.set(el, finalText);
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.countFrom ?? 0);
    const decimals = Number(el.dataset.countDecimals ?? 0);
    const isExp = el.dataset.countFormat === 'exp';
    const render = (value: number) => (isExp ? toSuperscript(value) : formatGrouped(value, decimals));
    const state = { value: from };
    el.textContent = render(from);
    return gsap.to(state, {
      value: to,
      duration: isExp ? 1.1 : 1.4,
      ease: 'power2.out',
      paused: true,
      onUpdate: () => {
        el.textContent = render(state.value);
      },
      onComplete: () => {
        el.textContent = finalText;
      },
    });
  });
  return () => tweens.forEach((tween) => tween.play());
}

function initCosmicCalendar() {
  const calendar = document.querySelector<HTMLElement>('[data-calendar]');
  if (!calendar) return;
  const fill = calendar.querySelector('.cosmic-calendar__fill');
  const marks = calendar.querySelectorAll('.cosmic-calendar__mark');
  const legend = calendar.querySelectorAll('.cosmic-calendar__legend li');
  const timeline = gsap.timeline({
    scrollTrigger: { trigger: calendar, start: 'top 75%', once: true },
  });
  if (fill) timeline.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 1.8, ease: 'power2.inOut' }, 0);
  // Cada marca aparece cuando el relleno llega a su fecha.
  marks.forEach((mark, i) => {
    const pos = parseFloat(getComputedStyle(mark).getPropertyValue('--pos')) / 100 || 0;
    timeline.from(mark, { opacity: 0, y: 8, duration: 0.45, ease: 'power2.out', clearProps: 'opacity,transform' }, pos * 1.6 + i * 0.04);
  });
  if (legend.length) {
    timeline.from(legend, { opacity: 0, y: 12, duration: 0.6, stagger: 0.06, ease: 'power2.out', clearProps: 'opacity,transform' }, 0.4);
  }
}

export function initChapterMotion() {
  countedTexts.clear();
  const hero = document.querySelector<HTMLElement>('.hero');
  if (hero) {
    const titleLines = hero.querySelectorAll<HTMLElement>('.hero__line');
    const title = hero.querySelector<HTMLElement>('h1');
    const headingTargets = titleLines.length ? titleLines : title ? [title] : [];
    const intro = hero.querySelectorAll<HTMLElement>('.chapter__eyebrow, .lede, .chapter__note, .chapter__stats, .chapter__calendar, .chapter__next');
    const playCounts = countUp(hero);
    const timeline = gsap.timeline({ defaults: { duration: 0.9, ease: 'power3.out' } });
    if (headingTargets.length) {
      timeline.from(headingTargets, { y: 48, opacity: 0, stagger: 0.11, clearProps: 'transform,opacity' }, 0.08);
    }
    if (intro.length) {
      timeline.from(intro, { y: 18, opacity: 0, stagger: 0.09, clearProps: 'transform,opacity' }, 0.35);
    }
    timeline.call(playCounts, undefined, 0.6);
    const colophon = hero.querySelector('.hero__colophon');
    if (colophon) timeline.from(colophon, { opacity: 0, clearProps: 'opacity' }, 0.85);
  }

  gsap.utils.toArray<HTMLElement>('.chapter:not(.hero)').forEach((chapter) => {
    const targets = chapter.querySelectorAll<HTMLElement>(
      '.chapter__eyebrow, h2, .lede, .chapter__note, .chapter__stats, .chapter__calendar, .chapter__next',
    );
    if (!targets.length) return;
    const playCounts = countUp(chapter);
    gsap.from(targets, {
      y: 32,
      opacity: 0,
      duration: 0.85,
      ease: 'power3.out',
      stagger: 0.09,
      clearProps: 'transform,opacity',
      scrollTrigger: { trigger: chapter, start: 'top 72%', once: true, onEnter: () => gsap.delayedCall(0.35, playCounts) },
    });
    const watermark = chapter.querySelector('.chapter__watermark');
    if (watermark) {
      gsap.fromTo(watermark, { y: 35 }, {
        y: -35,
        ease: 'none',
        scrollTrigger: { trigger: chapter, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    }
  });

  initCosmicCalendar();

  gsap.utils.toArray<HTMLElement>('.live-card').forEach((card) => {
    gsap.from(card, {
      y: 24,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
      scrollTrigger: { trigger: card, start: 'top 92%', once: true },
    });
  });

  // Si la animación se revierte (p. ej. al activar reduced-motion), las cifras vuelven a su valor final.
  return () => {
    countedTexts.forEach((text, el) => {
      el.textContent = text;
    });
    countedTexts.clear();
  };
}
