import { gsap } from 'gsap';

export function initChapterMotion() {
  const hero = document.querySelector<HTMLElement>('.hero');
  if (hero) {
    const titleLines = hero.querySelectorAll<HTMLElement>('.hero__line');
    const title = hero.querySelector<HTMLElement>('h1');
    const headingTargets = titleLines.length ? titleLines : title ? [title] : [];
    const intro = hero.querySelectorAll<HTMLElement>('.chapter__eyebrow, .lede, .chapter__note, .chapter__stats, .chapter__next');
    const timeline = gsap.timeline({ defaults: { duration: 0.9, ease: 'power3.out' } });
    if (headingTargets.length) {
      timeline.from(headingTargets, { y: 48, opacity: 0, stagger: 0.11, clearProps: 'transform,opacity' }, 0.08);
    }
    if (intro.length) {
      timeline.from(intro, { y: 18, opacity: 0, stagger: 0.09, clearProps: 'transform,opacity' }, 0.35);
    }
    const colophon = hero.querySelector('.hero__colophon');
    if (colophon) timeline.from(colophon, { opacity: 0, clearProps: 'opacity' }, 0.85);
  }

  gsap.utils.toArray<HTMLElement>('.chapter:not(.hero)').forEach((chapter) => {
    const targets = chapter.querySelectorAll<HTMLElement>('.chapter__eyebrow, h2, .lede, .chapter__note, .chapter__stats, .chapter__next');
    if (!targets.length) return;
    gsap.from(targets, {
      y: 32,
      opacity: 0,
      duration: 0.85,
      ease: 'power3.out',
      stagger: 0.09,
      clearProps: 'transform,opacity',
      scrollTrigger: { trigger: chapter, start: 'top 72%', once: true },
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

  gsap.utils.toArray<HTMLElement>('.live-card, .sources__item').forEach((card) => {
    gsap.from(card, {
      y: 24,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
      scrollTrigger: { trigger: card, start: 'top 92%', once: true },
    });
  });
}
