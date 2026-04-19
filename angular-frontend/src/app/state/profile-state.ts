import { atom } from 'nanostores';

/** The tab that is active when the profile scene opens. */
export type ProfileTab = 'security' | 'settings';

// Persists the desired initial tab across scene transitions.
// Set this store before navigating to 'profile' to control which tab is initially active.
export const profileTabStore = atom<ProfileTab>('security');

(globalThis as any).profileTabStore = profileTabStore;
