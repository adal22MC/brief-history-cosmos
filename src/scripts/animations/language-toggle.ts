export function initLanguageToggle() {
  const btn = document.querySelector<HTMLButtonElement>('[data-lang-toggle]');
  if (!btn || btn.dataset.langInit) return;
  btn.dataset.langInit = '1';
  btn.addEventListener('click', () => {
    const current = document.documentElement.dataset.lang === 'en' ? 'en' : 'es';
    const next = current === 'es' ? 'en' : 'es';
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('data-lang', next);
    try {
      localStorage.setItem('lang', next);
    } catch {}
    document.dispatchEvent(new CustomEvent('cosmos:language-change', { detail: { lang: next } }));
  });
}
