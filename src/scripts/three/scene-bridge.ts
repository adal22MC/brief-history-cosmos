import type { SceneAPI } from './scene';
import type { Era } from './era-presets';

let api: SceneAPI | null = null;
let currentEra: Era | null = null;
let yielding = false;

// Guarda lo que pide la interfaz mientras three.js carga y lo aplica al conectar la escena.
export const sceneBridge = {
  attach(next: SceneAPI) {
    api = next;
    if (currentEra) api.setEra(currentEra, 0);
    api.setYield(yielding, 0);
  },
  setEra(era: Era) {
    currentEra = era;
    api?.setEra(era);
  },
  setYield(active: boolean) {
    if (yielding === active) return;
    yielding = active;
    api?.setYield(active);
  },
};
