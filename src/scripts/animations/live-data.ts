import type { SceneAPI } from '../three-scene';
import { initIssGlobe } from '../three-scene';

const APOD_CACHE_KEY = 'apod-cache-v1';
const APOD_TTL_MS = 1000 * 60 * 60 * 6; // 6h

interface ApodResponse {
  title: string;
  url: string;
  hdurl?: string;
  media_type: 'image' | 'video';
  explanation: string;
  copyright?: string;
  date: string;
}

interface IssResponse {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
}

let issGlobeApi: ReturnType<typeof initIssGlobe> | null = null;
let issTimer: number | null = null;
let issCanvas: HTMLCanvasElement | null = null;

export function initLiveData(_sceneApi: SceneAPI | null) {
  const nowSection = document.querySelector<HTMLElement>('.chapter--now');
  if (!nowSection) return () => {};

  let booted = false;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !booted) {
          booted = true;
          observer.disconnect();
          loadApod();
          loadIssLoop();
        }
      });
    },
    { rootMargin: '200px' },
  );
  observer.observe(nowSection);

  return () => {
    observer.disconnect();
    if (issTimer) {
      clearInterval(issTimer);
      issTimer = null;
    }
    if (issGlobeApi) {
      issGlobeApi.destroy();
      issGlobeApi = null;
    }
    issCanvas = null;
  };
}

async function loadApod() {
  const titleEl = document.querySelector<HTMLElement>('[data-apod-title]');
  const mediaEl = document.querySelector<HTMLElement>('[data-apod-media]');
  const explEl = document.querySelector<HTMLElement>('[data-apod-explanation]');
  const creditEl = document.querySelector<HTMLElement>('[data-apod-credit]');
  if (!titleEl || !mediaEl || !explEl || !creditEl) return;

  let data: ApodResponse | null = null;

  try {
    const cached = localStorage.getItem(APOD_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { ts: number; data: ApodResponse };
      if (Date.now() - parsed.ts < APOD_TTL_MS) data = parsed.data;
    }
  } catch {}

  if (!data) {
    try {
      const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
      if (!res.ok) throw new Error(`APOD ${res.status}`);
      data = (await res.json()) as ApodResponse;
      try {
        localStorage.setItem(APOD_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      } catch {}
    } catch (err) {
      console.warn('APOD fetch failed:', err);
      titleEl.innerHTML =
        '<span data-es>No se pudo cargar APOD</span><span data-en>APOD failed to load</span>';
      return;
    }
  }

  titleEl.textContent = data.title;
  if (data.media_type === 'image') {
    const img = document.createElement('img');
    img.src = data.url;
    img.alt = data.title;
    img.loading = 'lazy';
    mediaEl.replaceChildren(img);
  } else {
    const iframe = document.createElement('iframe');
    iframe.src = data.url;
    iframe.title = data.title;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.setAttribute('allowfullscreen', '');
    mediaEl.replaceChildren(iframe);
  }

  const trimmed =
    data.explanation.length > 280
      ? data.explanation.slice(0, 277).trimEnd() + '…'
      : data.explanation;
  explEl.textContent = trimmed;

  const credit = data.copyright?.trim();
  creditEl.textContent = credit
    ? `© ${credit.replace(/\s+/g, ' ')} · ${data.date}`
    : `Public domain · NASA · ${data.date}`;
}

function loadIssLoop() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-iss-canvas]');
  if (canvas && canvas !== issCanvas) {
    if (issGlobeApi) issGlobeApi.destroy();
    issCanvas = canvas;
    issGlobeApi = initIssGlobe(canvas);
  }
  if (issTimer) {
    clearInterval(issTimer);
    issTimer = null;
  }
  fetchIssOnce();
  issTimer = window.setInterval(fetchIssOnce, 5000);
}

async function fetchIssOnce() {
  try {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    if (!res.ok) throw new Error(`ISS ${res.status}`);
    const data = (await res.json()) as IssResponse;
    renderIss(data);
  } catch (err) {
    console.warn('ISS fetch failed:', err);
    if (issTimer) {
      clearInterval(issTimer);
      issTimer = null;
    }
  }
}

function renderIss(d: IssResponse) {
  const fmt = (n: number, frac = 2) => n.toFixed(frac);
  const latEl = document.querySelector<HTMLElement>('[data-iss-lat]');
  const lonEl = document.querySelector<HTMLElement>('[data-iss-lon]');
  const altEl = document.querySelector<HTMLElement>('[data-iss-alt]');
  const velEl = document.querySelector<HTMLElement>('[data-iss-vel]');
  if (latEl) latEl.textContent = `${fmt(d.latitude, 3)}°`;
  if (lonEl) lonEl.textContent = `${fmt(d.longitude, 3)}°`;
  if (altEl) altEl.textContent = `${fmt(d.altitude, 1)} km`;
  if (velEl) velEl.textContent = `${fmt(d.velocity, 0)} km/h`;
  if (issGlobeApi) issGlobeApi.updatePosition(d.latitude, d.longitude);
}
