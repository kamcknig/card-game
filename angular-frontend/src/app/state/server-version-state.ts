import { atom } from 'nanostores';

// Server version string received via the `serverHello` socket event.
// Undefined until the first authenticated socket connection completes.
// Reset to undefined on disconnect so a stale value never paints over a
// reconnect that targets a different server revision.
export const serverVersionStore = atom<string | undefined>(undefined);

(globalThis as any).serverVersionStore = serverVersionStore;
