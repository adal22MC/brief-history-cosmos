const COPIED_MS = 2200;
const HASH_DEBOUNCE_MS = 300;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }
}

// Enlaces compartibles por capítulo: la URL sigue el capítulo activo y cada capítulo tiene "Copiar enlace".
export function initChapterLinks() {
  const cleanups: Array<() => void> = [];
  const isHome = location.pathname === '/';

  if (isHome) {
    let hashTimer: number | undefined;
    const onSectionChange = (event: Event) => {
      const { id, index } = (event as CustomEvent<{ id?: string; index?: number }>).detail ?? {};
      if (!id) return;
      window.clearTimeout(hashTimer);
      hashTimer = window.setTimeout(() => {
        const next = index === 0 ? location.pathname + location.search : `#${id}`;
        const current = index === 0 ? location.pathname + location.search + location.hash : location.hash;
        if (next !== current) history.replaceState(history.state, '', next);
      }, HASH_DEBOUNCE_MS);
    };
    document.addEventListener('cosmos:section-change', onSectionChange);
    cleanups.push(() => {
      window.clearTimeout(hashTimer);
      document.removeEventListener('cosmos:section-change', onSectionChange);
    });
  }

  document.querySelectorAll<HTMLButtonElement>('[data-chapter-copy]').forEach((button) => {
    let resetTimer: number | undefined;
    const onClick = async () => {
      const url = `${location.origin}/#${button.dataset.chapterCopy}`;
      if (!(await copyText(url))) return;
      button.dataset.copied = '1';
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => button.removeAttribute('data-copied'), COPIED_MS);
    };
    button.addEventListener('click', onClick);
    cleanups.push(() => {
      window.clearTimeout(resetTimer);
      button.removeEventListener('click', onClick);
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}
