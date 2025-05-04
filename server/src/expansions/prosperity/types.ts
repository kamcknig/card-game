import { PlayerId } from 'shared/shared-types.ts';

declare module '../../types' {
  interface GameActionDefinitionMap {
    gainVictoryToken: (args: { playerId: PlayerId, count: number; }) => Promise<void>;
  }
}

declare module 'shared/shared-types.ts' {
  interface Match {
    playerVictoryTokens?: Record<PlayerId, number>;
  }
}