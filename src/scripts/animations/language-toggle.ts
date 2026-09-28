let syncBound = false;

const currentLang = () => (document.documentElement.dataset.lang === 'en' ? 'en' : 'es');

// El botón del idioma activo queda marcado con aria-pressed; el estilo sale de html[data-lang].
function syncPressed() {
  document.querySelectorAll<HTMLButtonElement>('[data-lang-set]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.langSet === currentLang()));
  });
}

// Selector ES | EN: cada botón fija su idioma.
export function initLanguageToggle() {
  document.querySelectorAll<HTMLButtonElement>('[data-lang-set]').forEach((button) => {
    if (button.dataset.langInit) return;
    button.dataset.langInit = '1';
    button.addEventListener('click', () => {
      const next = button.dataset.langSet === 'en' ? 'en' : 'es';
      if (next === currentLang()) return;
      document.documentElement.setAttribute('lang', next);
      document.documentElement.setAttribute('data-lang', next);
      try {
        localStorage.setItem('lang', next);
      } catch {}
      document.dispatchEvent(new CustomEvent('cosmos:language-change', { detail: { lang: next } }));
    });
  });
  syncPressed();
  if (!syncBound) {
    syncBound = true;
    document.addEventListener('cosmos:language-change', syncPressed);
  }
}
