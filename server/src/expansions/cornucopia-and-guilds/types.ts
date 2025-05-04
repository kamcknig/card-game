import { PlayerId } from 'shared/shared-types.ts';

declare module '../../types' {
  interface GameActionDefinitionMap {
    gainCoffer: (args: { playerId: PlayerId, count: number; }) => Promise<void>;
  }
}

declare module 'shared/shared-types.ts' {
  interface Match {
    coffers?: Record<PlayerId, number>;
  }
  
  interface ServerListenEvents {
    spendCoffer: (playerId: PlayerId, count: number) => void;
  }
}