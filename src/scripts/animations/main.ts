import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import type { SceneAPI } from '../three/scene';
import { initLanguageToggle } from './language-toggle';
import { initProgressBar, initSectionIndex, initEraDriver } from './progress-era';
import { initEraRail, type CleanupFn } from './era-rail';
import { initLiveData } from './live-data';
import { initChapterMotion } from './chapter-motion';

gsap.registerPlugin(ScrollTrigger);

interface AnimOpts {
  sceneApi?: SceneAPI | null;
}

export function initAnimations(opts: AnimOpts = {}) {
  window.__cosmosAnimationsCleanup?.();
  const cleanupFns: CleanupFn[] = [];
  let disposed = false;
  const mm = gsap.matchMedia();

  window.__cosmosAnimationsCleanup = () => {
    if (disposed) return;
    disposed = true;
    mm.revert();
    cleanupFns.splice(0).forEach((cleanup) => cleanup());
    document.body.removeAttribute('data-anims-init');
  };
  document.body.dataset.animsInit = '1';
  initLanguageToggle();
  cleanupFns.push(initLiveData(opts.sceneApi ?? null));

  const refresh = () => {
    if (!disposed && document.visibilityState === 'visible') ScrollTrigger.refresh();
  };
  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('cosmos:language-change', refresh);
  window.addEventListener('pageshow', refresh);
  void document.fonts.ready.then(refresh);
  cleanupFns.push(() => {
    document.removeEventListener('visibilitychange', refresh);
    document.removeEventListener('cosmos:language-change', refresh);
    window.removeEventListener('pageshow', refresh);
  });

  mm.add(
    {
      isMotion: '(prefers-reduced-motion: no-preference)',
      isReduced: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      const { isReduced } = context.conditions as { isReduced: boolean };
      const motionCleanup: CleanupFn[] = [];
      let lenis: Lenis | null = null;

      if (!isReduced) {
        lenis = new Lenis({
          duration: 0.85,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          smoothWheel: true,
          syncTouch: false,
          wheelMultiplier: 1,
        });
        lenis.on('scroll', ScrollTrigger.update);
        const tickerCb = (time: number) => lenis?.raf(time * 1000);
        gsap.ticker.add(tickerCb);
        motionCleanup.push(() => {
          gsap.ticker.remove(tickerCb);
          lenis?.destroy();
          lenis = null;
        });
        initChapterMotion();
      }

      initProgressBar();
      motionCleanup.push(initSectionIndex(isReduced));
      initEraDriver(opts.sceneApi ?? null);
      initEraRail({ lenis, isReduced, onCleanup: (cleanup) => motionCleanup.push(cleanup) });

      document.querySelectorAll<HTMLAnchorElement>('[data-chapter-target]').forEach((link) => {
        const onClick = (event: MouseEvent) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const target = document.getElementById(link.dataset.chapterTarget ?? '');
          if (!target) return;
          event.preventDefault();
          if (lenis) lenis.scrollTo(target, { duration: 1.1 });
          else target.scrollIntoView({ behavior: 'instant', block: 'start' });
        };
        link.addEventListener('click', onClick);
        motionCleanup.push(() => link.removeEventListener('click', onClick));
      });

      return () => motionCleanup.splice(0).forEach((cleanup) => cleanup());
    },
  );
}
