import { atom } from 'nanostores';
import { DebugRuntimeContext } from 'shared/types';

// Server-provided debug identity for the currently joined game runtime.
export const debugRuntimeContextStore = atom<DebugRuntimeContext | undefined>(undefined);
// Controls whether the HUD debug overlay is visible. Always starts hidden — not persisted across sessions.
export const debugOverlayVisibleStore = atom<boolean>(false);

(globalThis as any).debugRuntimeContextStore = debugRuntimeContextStore;
(globalThis as any).debugOverlayVisibleStore = debugOverlayVisibleStore;
