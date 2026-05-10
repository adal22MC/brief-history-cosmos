/// <reference types="astro/client" />

import type { SceneAPI } from './scripts/three-scene';

declare global {
  interface Window {
    __sceneApi?: SceneAPI | null;
    __cosmosPageLoadBound?: boolean;
    __cosmosLangSwapBound?: boolean;
    __cosmosAnimationsCleanup?: () => void;
    __cosmosSectionIndexLabelHandler?: () => void;
  }
}

export {};
