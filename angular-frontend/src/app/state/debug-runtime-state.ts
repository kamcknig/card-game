import { atom } from 'nanostores';
import { DebugRuntimeContext } from 'shared/types';

const DEBUG_OVERLAY_KEY = 'debugOverlayVisible';
const storedToggle = localStorage.getItem(DEBUG_OVERLAY_KEY);
const initialOverlayVisible = storedToggle === 'true';

// Server-provided debug identity for the currently joined game runtime.
export const debugRuntimeContextStore = atom<DebugRuntimeContext | undefined>(undefined);
// Controls whether the HUD debug overlay is visible.
export const debugOverlayVisibleStore = atom<boolean>(initialOverlayVisible);

// Persist toggle preference between reloads for debugging convenience.
debugOverlayVisibleStore.subscribe((visible) => {
  localStorage.setItem(DEBUG_OVERLAY_KEY, visible ? 'true' : 'false');
});

(globalThis as any).debugRuntimeContextStore = debugRuntimeContextStore;
(globalThis as any).debugOverlayVisibleStore = debugOverlayVisibleStore;
