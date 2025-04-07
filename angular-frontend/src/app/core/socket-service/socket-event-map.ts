import { ClientListenEventNames, ClientListenEvents, LogEntry } from 'shared/shared-types';
import { InjectionToken } from '@angular/core';
import { playerIdStore, playerStore, selfPlayerIdStore } from '../../state/player-state';
import { lobbyMatchConfigurationStore, matchStartedStore } from '../../state/match-state';
import { gameOwnerIdStore, gamePausedStore, sceneStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardOverrideStore, cardStore } from '../../state/card-state';
import { Assets } from 'pixi.js';
import { gameEvents } from '../event/events';
import { type SocketService } from './socket.service';
import { matchStore } from '../../state/match';
import { applyPatch, compare, Operation } from 'fast-json-patch';
import { clientSelectableCardsOverrideStore, selectedCardStore } from '../../state/interactive-state';

export const SOCKET_EVENT_MAP = new InjectionToken('socketEventMap');

export type SocketEventMap = { [p in ClientListenEventNames]: ClientListenEvents[p] };

export const socketToGameEventMap = (socketService: SocketService): SocketEventMap => {
  const map: SocketEventMap = {
    addLogEntry: (logEntry: LogEntry) => {
      /*logManager.addLogEntry(logEntry);*/
    },
    matchConfigurationUpdated: config => {
      lobbyMatchConfigurationStore.set(config.expansions);
    },
    cardEffectsComplete: () => {
      gameEvents.emit('cardEffectsComplete');
    },
    doneWaitingForPlayer: playerId => {
      gameEvents.emit('doneWaitingForPlayer', playerId);
    },
    expansionList: val => {
      expansionListStore.set(val);
    },
    gameOver: async summary => {
      try {
        const s = new Audio('./assets/sounds/game-over.mp3');
        await s?.play();
      } catch (error) {
        console.error('error playing game over sound');
        console.error(error);
      }

      /*void displayScene('gameOver', summary);*/
    },
    gameOwnerUpdated: playerId => {
      gameOwnerIdStore.set(playerId);
    },
    setCardLibrary: cards => {
      cardStore.set(cards);
    },
    setCardDataOverrides: overrides => {
      cardOverrideStore.set(overrides ?? {});
    },
    matchReady: async match => {
      matchStore.set(match);

      if (!cardStore.get()) throw new Error('missing card library');
      const cardsById = cardStore.get();
      Assets.addBundle('cardLibrary', Object.values(cardsById).reduce((prev, c) => {
        prev[`${c.cardKey}-detail`] ??= c.detailImagePath;
        prev[`${c.cardKey}-full`] ??= c.fullImagePath;
        prev[`${c.cardKey}-half`] ??= c.halfImagePath;
        return prev;
      }, {
        'card-back-full': `/assets/card-images/base-supply/full-size/card-back.jpg`,
        'card-back-detail': `/assets/card-images/base-supply/detail/card-back.jpg`,
        'card-back-half': `/assets/card-images/base-supply/half-size/card-back.jpg`,
        'treasure-bg': '/assets/ui-icons/treasure-bg.png',
      } as Record<string, string>));

      sceneStore.set('match');
    },
    matchStarted: () => {
      matchStartedStore.set(true);
    },
    matchPatch: (patch: Operation[]) => {
      const current = structuredClone(matchStore.get());
      if (!current) return;

      const blah = matchStore.get()!;
      if (patch.some(p => p.path.includes('selectableCards'))) {
        console.log('current selectable cards: ', blah.selectableCards);
      }
      if (patch.some(p => p.path.includes('playerHands'))) {
        console.log('current player hand: ', blah.playerHands[selfPlayerIdStore.get()!]);
      }
      if (patch.some(p => p.path.includes('playerDecks'))) {
        console.log('current player deck: ', blah.playerDecks[selfPlayerIdStore.get()!]);
      }
      if (patch.some(p => p.path.includes('playerDiscards'))) {
        console.log('current player discard: ', blah.playerDiscards[selfPlayerIdStore.get()!]);
      }
      if (patch.some(p => p.path.includes('playArea'))) {
        console.log('current playerArea: ', blah.playArea);
      }
      applyPatch(current, patch);
      if (patch.some(p => p.path.includes('selectableCards'))) {
        console.log('new selectable cards: ', current.selectableCards);
      }
      if (patch.some(p => p.path.includes('playerHands'))) {
        console.log('new player hand: ', current.playerHands[selfPlayerIdStore.get()!]);
      }
      if (patch.some(p => p.path.includes('playerDecks'))) {
        console.log('new player deck: ', current.playerDecks[selfPlayerIdStore.get()!]);
      }
      if (patch.some(p => p.path.includes('playerDiscards'))) {
        console.log('new player discard: ', current.playerDiscards[selfPlayerIdStore.get()!]);
      }
      if (patch.some(p => p.path.includes('playArea'))) {
        console.log('new playerArea: ', current.playArea);
      }
      matchStore.set(current);
    },
    playerConnected: (player) => {
      playerStore(player.id).set(player);

      if (!playerIdStore.get().includes(player.id)) {
        playerIdStore.set([...playerIdStore.get(), player.id]);
      }

      if (matchStartedStore.get()) {
        gamePausedStore.set(false);
      }
    },
    setPlayerList: players => {
      for (const player of players) {
        playerStore(player.id).set(player);
      }
      playerIdStore.set(players.map(player => player.id));
    },
    playerDisconnected: (player) => {
      playerStore(player.id).set(player);

      if (matchStartedStore.get()) {
        gamePausedStore.set(true);
      }
    },
    playerNameUpdated: (playerId: number, name: string) => {
      const current = playerStore(playerId).get();
      if (!current) return;
      playerStore(playerId).set({
        ...current,
        name
      });
    },
    playerReady: (playerId, ready) => {
      const current = playerStore(playerId).get();
      if (!current) return;

      playerStore(playerId).set({
        ...current,
        ready
      });
    },
    setPlayer: player => {
      selfPlayerIdStore.set(player.id);
    },
    selectCard: selectCardArgs => {
      const eventListener = (cardIds: number[]) => {
        gameEvents.off('cardsSelected', eventListener);
        selectedCardStore.set([]);
        clientSelectableCardsOverrideStore.set(null);
        socketService.emit('selectCardResponse', cardIds);
      };

      clientSelectableCardsOverrideStore.set(selectCardArgs.selectableCardIds);
      gameEvents.emit('selectCard', selectCardArgs);
      gameEvents.on('cardsSelected', eventListener);
    },
    userPrompt: userPromptArgs => {
      const userPromptResponseListener = (result: unknown) => {
        gameEvents.off('userPromptResponse', userPromptResponseListener);
        socketService.emit('userPromptResponse', result);
      };

      gameEvents.on('userPromptResponse', userPromptResponseListener);
      gameEvents.emit('userPrompt', userPromptArgs);
    },
    waitingForPlayer: playerId => {
      gameEvents.emit('waitingForPlayer', playerId);
    },
  }

  return map;
};
