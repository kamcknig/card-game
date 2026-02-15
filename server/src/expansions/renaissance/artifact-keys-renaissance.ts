// Canonical artifact card keys used by Renaissance effects/configuration.
export const renaissanceArtifactKeys = {
  flag: 'flag',
  horn: 'horn',
  key: 'key',
  lantern: 'lantern',
  treasureChest: 'treasure-chest',
} as const;

export type RenaissanceArtifactKey = typeof renaissanceArtifactKeys[keyof typeof renaissanceArtifactKeys];
