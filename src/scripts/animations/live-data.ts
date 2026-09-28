import type { IssGlobeAPI, IssTrackPoint } from '../three/iss-globe';
import { formatGrouped } from './number-format';

const APOD_CACHE_KEY = 'apod-cache-v1';
const APOD_TTL_MS = 1000 * 60 * 60 * 6; // 6h
const NASA_API_KEY = import.meta.env.PUBLIC_NASA_API_KEY || 'DEMO_KEY';

const ISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
const ISS_POLL_MS = 5000;
const ISS_RETRY_MS = 30000;
const ISS_PLACE_MS = 30000;
const ISS_TRACK_MS = 5 * 60 * 1000;
const ISS_TRACK_SPAN_MIN = 45;

interface ApodResponse {
  title: string;
  url: string;
  hdurl?: string;
  media_type: 'image' | 'video' | string;
  explanation: string;
  copyright?: string;
  date: string;
}

interface IssResponse {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: 'daylight' | 'eclipsed' | string;
  solar_lat: number;
  solar_lon: number;
  timestamp: number;
}

interface IssTrackResponse {
  latitude: number;
  longitude: number;
  timestamp: number;
}

type Lang = 'es' | 'en';

const bilingual = (es: string, en: string) => `<span data-es>${es}</span><span data-en>${en}</span>`;

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function formatApodDate(date: string, lang: Lang) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

// La página de cada APOD sigue el patrón apYYMMDD.html.
function apodPageUrl(date: string) {
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return 'https://apod.nasa.gov/apod/astropix.html';
  return `https://apod.nasa.gov/apod/ap${y.slice(2)}${m}${d}.html`;
}

function regionName(code: string, lang: Lang) {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function formatAgo(seconds: number, lang: Lang) {
  if (seconds < 60) return lang === 'es' ? `hace ${seconds} s` : `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  return lang === 'es' ? `hace ${minutes} min` : `${minutes} min ago`;
}

function readApodCache() {
  try {
    const cached = localStorage.getItem(APOD_CACHE_KEY);
    return cached ? (JSON.parse(cached) as { ts: number; data: ApodResponse }) : null;
  } catch {
    return null;
  }
}

export function initLiveData() {
  const nowSection = document.querySelector<HTMLElement>('.chapter--now');
  if (!nowSection) return () => {};

  let disposed = false;
  let globe: IssGlobeAPI | null = null;
  const timers = new Set<number>();
  const cleanups: Array<() => void> = [];

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
  };

  // ───────── APOD
  const apodCard = document.querySelector<HTMLElement>('[data-apod]');

  const renderApod = (card: HTMLElement, data: ApodResponse, stale: boolean) => {
    const titleEl = card.querySelector<HTMLElement>('[data-apod-title]');
    const dateEl = card.querySelector<HTMLElement>('[data-apod-date]');
    const mediaEl = card.querySelector<HTMLElement>('[data-apod-media]');
    const explEl = card.querySelector<HTMLElement>('[data-apod-explanation]');
    const noticeEl = card.querySelector<HTMLElement>('[data-apod-notice]');
    const creditEl = card.querySelector<HTMLElement>('[data-apod-credit]');
    const linkEl = card.querySelector<HTMLAnchorElement>('[data-apod-link]');
    const retryEl = card.querySelector<HTMLElement>('[data-apod-retry]');

    card.classList.remove('is-loading', 'is-error', 'is-media-error');
    card.setAttribute('aria-busy', 'false');
    if (titleEl) {
      titleEl.textContent = data.title;
      titleEl.lang = 'en';
    }
    if (dateEl) dateEl.innerHTML = `· ${bilingual(formatApodDate(data.date, 'es'), formatApodDate(data.date, 'en'))}`;

    if (mediaEl) {
      mediaEl.hidden = false;
      if (data.media_type === 'image') {
        const img = document.createElement('img');
        img.src = data.url;
        img.alt = data.title;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', () => {
          mediaEl.replaceChildren();
          card.classList.add('is-media-error');
        }, { once: true });
        mediaEl.replaceChildren(img);
      } else if (data.media_type === 'video') {
        const iframe = document.createElement('iframe');
        iframe.src = data.url;
        iframe.title = data.title;
        iframe.allow = 'autoplay; encrypted-media';
        iframe.setAttribute('allowfullscreen', '');
        mediaEl.replaceChildren(iframe);
      } else {
        mediaEl.hidden = true;
      }
    }

    if (explEl) {
      explEl.textContent =
        data.explanation.length > 280 ? data.explanation.slice(0, 277).trimEnd() + '…' : data.explanation;
      explEl.lang = 'en';
    }

    if (noticeEl) {
      noticeEl.hidden = !stale;
      if (stale) {
        noticeEl.innerHTML = bilingual(
          'No pudimos conectar con la NASA; esta es la última imagen guardada.',
          "We couldn't reach NASA; this is the last saved picture.",
        );
      }
    }

    if (creditEl) {
      const credit = data.copyright?.trim().replace(/\s+/g, ' ');
      creditEl.innerHTML =
        (credit ? `© ${escapeHtml(credit)}` : bilingual('Dominio público · NASA', 'Public domain · NASA')) +
        '<span data-es> · Texto original en inglés</span>';
    }
    if (linkEl) linkEl.href = apodPageUrl(data.date);
    if (retryEl) retryEl.hidden = true;
  };

  const renderApodError = (card: HTMLElement) => {
    card.classList.remove('is-loading');
    card.classList.add('is-error');
    card.setAttribute('aria-busy', 'false');
    const titleEl = card.querySelector<HTMLElement>('[data-apod-title]');
    const mediaEl = card.querySelector<HTMLElement>('[data-apod-media]');
    const explEl = card.querySelector<HTMLElement>('[data-apod-explanation]');
    const noticeEl = card.querySelector<HTMLElement>('[data-apod-notice]');
    const creditEl = card.querySelector<HTMLElement>('[data-apod-credit]');
    const retryEl = card.querySelector<HTMLElement>('[data-apod-retry]');
    if (titleEl) {
      titleEl.innerHTML = bilingual('No pudimos conectar con la NASA', "We couldn't reach NASA");
      titleEl.removeAttribute('lang');
    }
    if (mediaEl) {
      mediaEl.replaceChildren();
      mediaEl.hidden = false;
    }
    if (explEl) {
      explEl.innerHTML = bilingual(
        'La imagen astronómica del día no está disponible ahora. Reintenta en un momento o ábrela directamente en el sitio de la NASA.',
        "Today's astronomy picture isn't available right now. Try again in a moment or open it on NASA's site.",
      );
      explEl.removeAttribute('lang');
    }
    if (noticeEl) noticeEl.hidden = true;
    if (creditEl) creditEl.textContent = '';
    if (retryEl) retryEl.hidden = false;
  };

  const loadApod = async (force = false) => {
    if (!apodCard) return;
    const cached = readApodCache();
    if (cached && !force && Date.now() - cached.ts < APOD_TTL_MS) {
      renderApod(apodCard, cached.data, false);
      return;
    }
    apodCard.classList.add('is-loading');
    apodCard.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(NASA_API_KEY)}`);
      if (!res.ok) throw new Error(`APOD ${res.status}`);
      const data = (await res.json()) as ApodResponse;
      try {
        localStorage.setItem(APOD_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      } catch {}
      if (!disposed) renderApod(apodCard, data, false);
    } catch (err) {
      console.warn('APOD fetch failed:', err);
      if (disposed) return;
      if (cached) renderApod(apodCard, cached.data, true);
      else renderApodError(apodCard);
    }
  };

  const retryBtn = apodCard?.querySelector<HTMLButtonElement>('[data-apod-retry]');
  if (retryBtn) {
    const onRetry = () => void loadApod(true);
    retryBtn.addEventListener('click', onRetry);
    cleanups.push(() => retryBtn.removeEventListener('click', onRetry));
  }

  // ───────── ISS
  const issCard = document.querySelector<HTMLElement>('[data-iss]');
  let iss: IssResponse | null = null;
  let issAt = 0;
  let issFailed = false;
  let placeCode: string | null = null;
  let placeAt = 0;
  let track: Array<IssTrackPoint & { t: number }> = [];

  const renderContext = () => {
    const el = issCard?.querySelector<HTMLElement>('[data-iss-context]');
    if (!el) return;
    if (!iss) {
      el.innerHTML = issFailed
        ? bilingual('No pudimos conectar con la estación.', "We couldn't reach the station.")
        : bilingual('Buscando la estación…', 'Locating the station…');
      return;
    }
    const where = (lang: Lang) => {
      if (!placeCode) return '';
      if (placeCode === '??') return lang === 'es' ? 'Sobre el océano' : 'Over the ocean';
      return lang === 'es' ? `Sobre ${regionName(placeCode, 'es')}` : `Over ${regionName(placeCode, 'en')}`;
    };
    const light = (lang: Lang) => {
      const lit = iss?.visibility === 'daylight';
      if (lang === 'es') return lit ? 'a la luz del día' : 'en la sombra de la Tierra';
      return lit ? 'in daylight' : "in Earth's shadow";
    };
    const line = (lang: Lang) => {
      const place = where(lang);
      const lightText = light(lang);
      return place ? `${place} · ${lightText}` : lightText.charAt(0).toUpperCase() + lightText.slice(1);
    };
    el.innerHTML = bilingual(line('es'), line('en'));
  };

  const renderUpdated = () => {
    const el = issCard?.querySelector<HTMLElement>('[data-iss-updated]');
    if (!el) return;
    if (!issAt) {
      el.innerHTML = bilingual('Datos: wheretheiss.at', 'Data: wheretheiss.at');
      return;
    }
    const seconds = Math.max(0, Math.round((Date.now() - issAt) / 1000));
    const es = issFailed ? `Sin conexión · última posición ${formatAgo(seconds, 'es')}` : `Actualizado ${formatAgo(seconds, 'es')}`;
    const en = issFailed ? `Offline · last position ${formatAgo(seconds, 'en')}` : `Updated ${formatAgo(seconds, 'en')}`;
    el.innerHTML = `${bilingual(es, en)} · wheretheiss.at`;
  };

  const renderIssData = () => {
    if (!issCard || !iss) return;
    const set = (sel: string, text: string) => {
      const el = issCard.querySelector<HTMLElement>(sel);
      if (el) el.textContent = text;
    };
    set('[data-iss-lat]', `${iss.latitude.toFixed(3)}°`);
    set('[data-iss-lon]', `${iss.longitude.toFixed(3)}°`);
    set('[data-iss-alt]', `${iss.altitude.toFixed(1)} km`);
    set('[data-iss-vel]', `${formatGrouped(iss.velocity, 0)} km/h`);
  };

  const pushTrack = () => {
    if (!globe || !track.length) return;
    const nowS = iss?.timestamp ?? Date.now() / 1000;
    const past: IssTrackPoint[] = track.filter((p) => p.t < nowS);
    const next: IssTrackPoint[] = track.filter((p) => p.t > nowS);
    if (iss) {
      const current = { lat: iss.latitude, lon: iss.longitude };
      past.push(current);
      next.unshift(current);
    }
    globe.setTrack(past, next);
  };

  const updatePlace = async () => {
    if (!iss || Date.now() - placeAt < ISS_PLACE_MS) return;
    placeAt = Date.now();
    try {
      const res = await fetch(
        `https://api.wheretheiss.at/v1/coordinates/${iss.latitude.toFixed(3)},${iss.longitude.toFixed(3)}`,
      );
      if (!res.ok) throw new Error(`ISS place ${res.status}`);
      const data = (await res.json()) as { country_code?: string };
      if (disposed) return;
      placeCode = data.country_code || null;
      renderContext();
    } catch (err) {
      console.warn('ISS place lookup failed:', err);
    }
  };

  const pollIss = async () => {
    if (document.hidden) {
      later(pollIss, ISS_POLL_MS);
      return;
    }
    try {
      const res = await fetch(ISS_URL);
      if (!res.ok) throw new Error(`ISS ${res.status}`);
      const data = (await res.json()) as IssResponse;
      if (disposed) return;
      iss = data;
      issAt = Date.now();
      issFailed = false;
      renderIssData();
      globe?.updatePosition(data.latitude, data.longitude);
      globe?.setSun(data.solar_lat, data.solar_lon);
      pushTrack();
      renderContext();
      renderUpdated();
      void updatePlace();
      later(pollIss, ISS_POLL_MS);
    } catch (err) {
      console.warn('ISS fetch failed:', err);
      if (disposed) return;
      issFailed = true;
      renderContext();
      renderUpdated();
      later(pollIss, ISS_RETRY_MS);
    }
  };

  const refreshTrack = async () => {
    const now = Math.floor(Date.now() / 1000);
    const step = (ISS_TRACK_SPAN_MIN * 2 * 60) / 9;
    const stamps = Array.from({ length: 10 }, (_, i) => Math.round(now - ISS_TRACK_SPAN_MIN * 60 + i * step));
    try {
      const res = await fetch(`${ISS_URL}/positions?timestamps=${stamps.join(',')}&units=kilometers`);
      if (!res.ok) throw new Error(`ISS track ${res.status}`);
      const data = (await res.json()) as IssTrackResponse[];
      if (disposed) return;
      track = data
        .map((p) => ({ lat: p.latitude, lon: p.longitude, t: p.timestamp }))
        .sort((a, b) => a.t - b.t);
      pushTrack();
    } catch (err) {
      console.warn('ISS track fetch failed:', err);
    }
    later(refreshTrack, ISS_TRACK_MS);
  };

  const startIss = async () => {
    if (!issCard) return;
    const canvas = issCard.querySelector<HTMLCanvasElement>('[data-iss-canvas]');
    if (canvas) {
      try {
        const { initIssGlobe } = await import('../three/iss-globe');
        if (disposed || !canvas.isConnected) return;
        globe = initIssGlobe(canvas);
      } catch (err) {
        console.warn('ISS globe failed to load:', err);
      }
    }
    renderUpdated();
    void pollIss();
    void refreshTrack();
    const clock = window.setInterval(renderUpdated, 1000);
    cleanups.push(() => window.clearInterval(clock));
  };

  let booted = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (booted || !entries.some((entry) => entry.isIntersecting)) return;
      booted = true;
      observer.disconnect();
      void loadApod();
      void startIss();
    },
    { rootMargin: '200px' },
  );
  observer.observe(nowSection);

  return () => {
    disposed = true;
    observer.disconnect();
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
    cleanups.splice(0).forEach((cleanup) => cleanup());
    globe?.destroy();
    globe = null;
  };
}
