import { AppSocket } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';

export interface MatchSocketHandlers {
  onNextPhase: () => void | Promise<void>;
  onSearchCards: (playerId: PlayerId, searchStr: string) => void;
  onExchangeCoffer: (playerId: PlayerId, count: number) => void | Promise<void>;
  onSpendVillager: (playerId: PlayerId, count: number) => void | Promise<void>;
  onPayDebt: (playerId: PlayerId, count: number) => void | Promise<void>;
}

// Encapsulates gameplay-phase socket listener registration.
export class MatchSocketBindings {
  public bindGameplaySocketHandlers(socket: AppSocket, handlers: MatchSocketHandlers) {
    socket.on('nextPhase', handlers.onNextPhase);
    socket.on('searchCards', handlers.onSearchCards);
    socket.on('exchangeCoffer', handlers.onExchangeCoffer);
    socket.on('spendVillager', handlers.onSpendVillager);
    socket.on('payDebt', handlers.onPayDebt);
  }

  // Removes gameplay-phase handlers so sockets can safely return to lobby context.
  public unbindGameplaySocketHandlers(socket?: AppSocket) {
    if (!socket) {
      return;
    }

    socket.off('nextPhase');
    socket.off('searchCards');
    socket.off('exchangeCoffer');
    socket.off('spendVillager');
    socket.off('payDebt');
  }
}
