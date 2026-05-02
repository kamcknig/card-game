import { AppSocket } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';

export interface MatchSocketHandlers {
  onNextPhase: () => void | Promise<void>;
  onSearchCards: (playerId: PlayerId, searchStr: string) => void;
  onExchangeCoffer: (playerId: PlayerId, count: number) => void | Promise<void>;
  onSpendVillager: (playerId: PlayerId, count: number) => void | Promise<void>;
  onPayDebt: (playerId: PlayerId, count: number) => void | Promise<void>;
  // Undo flow handlers — all three fire on behalf of the player owning this socket.
  onUndoRequested: () => void | Promise<void>;
  onUndoVote: (allow: boolean) => void | Promise<void>;
  onUndoCancelled: () => void;
}

// Encapsulates gameplay-phase socket listener registration.
export class MatchSocketBindings {
  /**
   * Registers all gameplay-phase socket handlers for one player socket.
   * Call once per socket on match start and again on reconnect so the
   * handler set is always current.
   */
  public bindGameplaySocketHandlers(socket: AppSocket, handlers: MatchSocketHandlers) {
    socket.on('nextPhase', handlers.onNextPhase);
    socket.on('searchCards', handlers.onSearchCards);
    socket.on('exchangeCoffer', handlers.onExchangeCoffer);
    socket.on('spendVillager', handlers.onSpendVillager);
    socket.on('payDebt', handlers.onPayDebt);
    socket.on('undoRequested', handlers.onUndoRequested);
    socket.on('undoVote', handlers.onUndoVote);
    socket.on('undoCancelled', handlers.onUndoCancelled);
  }

  /**
   * Removes gameplay-phase handlers from a socket so it can safely return
   * to lobby context or be garbage-collected.
   */
  public unbindGameplaySocketHandlers(socket?: AppSocket) {
    if (!socket) {
      return;
    }

    socket.off('nextPhase');
    socket.off('searchCards');
    socket.off('exchangeCoffer');
    socket.off('spendVillager');
    socket.off('payDebt');
    socket.off('undoRequested');
    socket.off('undoVote');
    socket.off('undoCancelled');
  }
}
