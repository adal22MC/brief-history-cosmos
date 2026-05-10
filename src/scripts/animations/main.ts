import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import type { SceneAPI } from '../three-scene';
import { initLanguageToggle } from './language-toggle';
import { initProgressBar, initSectionIndex, initEraDriver } from './progress-era';
import { initEraRail, type CleanupFn } from './era-rail';
import { initLiveData } from './live-data';

gsap.registerPlugin(ScrollTrigger);

interface AnimOpts {
  sceneApi?: SceneAPI | null;
}

export function initAnimations(opts: AnimOpts = {}) {
  window.__cosmosAnimationsCleanup?.();

  const cleanupFns: CleanupFn[] = [];
  window.__cosmosAnimationsCleanup = () => {
    cleanupFns.splice(0).forEach((cleanup) => cleanup());
    document.querySelector<HTMLElement>('[data-era-rail]')?.removeAttribute('data-booted');
    document.body.removeAttribute('data-anims-init');
  };
  document.body.dataset.animsInit = '1';

  initLanguageToggle();

  const mm = gsap.matchMedia();
  cleanupFns.push(() => {
    mm.revert();
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  });
  const refreshOnVisible = () => {
    if (document.visibilityState === 'visible') {
      ScrollTrigger.refresh();
    }
  };
  document.addEventListener('visibilitychange', refreshOnVisible);
  window.addEventListener('pageshow', refreshOnVisible);
  cleanupFns.push(() => {
    document.removeEventListener('visibilitychange', refreshOnVisible);
    window.removeEventListener('pageshow', refreshOnVisible);
  });

  mm.add(
    {
      isMotion: '(prefers-reduced-motion: no-preference)',
      isReduced: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      const { isReduced } = context.conditions as {
        isMotion: boolean;
        isReduced: boolean;
      };

      if (isReduced) {
        gsap.set('.hero h1, .hero .tag, .hero .lede, .hero .chapter__note, .reveal', { opacity: 1, y: 0 });
        gsap.set('.hero .chapter__stats', { opacity: 1, y: 0 });
        initProgressBar();
        initSectionIndex();
        initEraDriver(opts.sceneApi ?? null);
        initEraRail({ lenis: null, isReduced: true, onCleanup: (cleanup) => cleanupFns.push(cleanup) });
        cleanupFns.push(initLiveData(opts.sceneApi ?? null));
        return;
      }

      const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenis.on('scroll', ScrollTrigger.update);
      const tickerCb = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tickerCb);
      gsap.ticker.lagSmoothing(0);
      cleanupFns.push(() => {
        gsap.ticker.remove(tickerCb);
        lenis.destroy();
      });

      const hero = document.querySelector<HTMLElement>('.hero');
      if (hero) {
        const tl = gsap.timeline({ delay: 0.2 });
        const heroTitle = hero.querySelector<HTMLElement>('h1');
        const heroTag = hero.querySelector<HTMLElement>('.tag');
        const heroLede = hero.querySelector<HTMLElement>('.lede');
        const heroNote = hero.querySelector<HTMLElement>('.chapter__note');
        const heroStats = hero.querySelector<HTMLElement>('.chapter__stats');

        if (heroTitle) {
          tl.fromTo(
            heroTitle,
            { y: 60, opacity: 0 },
            { y: 0, opacity: 1, duration: 1.1, ease: 'power4.out' },
          );
        }
        if (heroTag) tl.to(heroTag, { opacity: 1, duration: 0.6 }, '-=0.8');
        if (heroLede) tl.to(heroLede, { opacity: 1, duration: 0.8 }, '-=0.6');
        if (heroNote) tl.to(heroNote, { opacity: 0.78, y: 0, duration: 0.8 }, '-=0.55');
        if (heroStats) tl.to(heroStats, { opacity: 1, y: 0, duration: 0.8 }, '-=0.5');
      }

      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      gsap.utils.toArray<HTMLElement>('.chapter:not(.hero)').forEach((chapter) => {
        const targets = chapter.querySelectorAll<HTMLElement>(
          '.chapter__num, .tag, h2, .lede, .chapter__stats > div',
        );
        if (!targets.length) return;
        gsap.fromTo(
          targets,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: {
              trigger: chapter,
              start: 'top 70%',
              toggleActions: 'play none none reverse',
            },
          },
        );
      });

      initProgressBar();
      initSectionIndex();
      initEraDriver(opts.sceneApi ?? null);
      initEraRail({ lenis, isReduced: false, onCleanup: (cleanup) => cleanupFns.push(cleanup) });
      cleanupFns.push(initLiveData(opts.sceneApi ?? null));

      return () => {};
    },
  );
}
