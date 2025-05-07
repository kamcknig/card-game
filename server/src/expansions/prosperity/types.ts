import { PlayerId } from 'shared/shared-types.ts';

declare module '../../types' {
  interface GameActionDefinitionMap {
    gainVictoryToken: (args: { playerId: PlayerId, count: number; }) => Promise<void>;
  }
}