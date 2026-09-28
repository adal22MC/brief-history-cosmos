/// <reference types="astro/client" />

declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_SITE_URL?: string;
    readonly PUBLIC_NASA_API_KEY?: string;
  }

  interface Window {
    __cosmosPageLoadBound?: boolean;
    __cosmosLangSwapBound?: boolean;
    __cosmosAnimationsCleanup?: () => void;
  }
}

export {};
