import type { AppSocket } from '@server-types/index.ts';
import type {
  ExpansionListElement,
  MatchConfiguration,
  Player,
  PlayerId,
} from 'shared/types/index.ts';
import type { MatchController } from './match-controller.ts';
import type { MatchScope } from './match-scope-factory.ts';

// Mutable runtime state for the active game/lobby process.
export interface GameRuntimeState {
  // Stable game identifier used for routing and diagnostics.
  gameId: string;
  // Human-readable game name shown in lobby.
  gameName: string;
  // Socket room name for this game's traffic isolation.
  roomName: string;
  players: Player[];
  owner: Player | undefined;
  matchStarted: boolean;
  // Active per-game match scope sequence id used for per-match persistence.
  matchScopeId: number | undefined;
  socketMap: Map<PlayerId, AppSocket>;
  matchScope: MatchScope | undefined;
  matchController: MatchController | undefined;
  matchConfiguration: MatchConfiguration | undefined;
  availableExpansion: ExpansionListElement[];
}
