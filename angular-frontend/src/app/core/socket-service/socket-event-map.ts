import { ClientListenEventNames, ClientListenEvents, LogEntry } from 'shared/shared-types';
import { InjectionToken } from '@angular/core';
import { playerIdStore, playerStore, selfPlayerIdStore } from '../../state/player-state';
import { matchStartedStore } from '../../state/match-state';
import { gameOwnerIdStore, gamePausedStore, sceneStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardOverrideStore, cardStore } from '../../state/card-state';
import { Assets } from 'pixi.js';
import { selectableCardStore, selectedCardStore } from '../../state/interactive-state';
import { gameEvents } from '../event/events';
import { type SocketService } from './socket.service';
import { matchStore } from '../../state/match';
import { applyPatch, Operation } from 'fast-json-patch';

export const SOCKET_EVENT_MAP = new InjectionToken('socketEventMap');

export type SocketEventMap = { [p in ClientListenEventNames]: ClientListenEvents[p] };

export const socketToGameEventMap = (socketService: SocketService): SocketEventMap => {
  const map: SocketEventMap = {
    addLogEntry: (logEntry: LogEntry) => {
      /*logManager.addLogEntry(logEntry);*/
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
      applyPatch(current, patch);
      matchStore.set(current);
    },
    /*matchUpdated: match => {
      const keys = Object.keys(match);
      for (const key of keys) {
        switch (key) {
          case 'selectableCards':
            const currentlySelectable = selectableCardStore.get();
            const newSelectable = match.selectableCards?.[selfPlayerIdStore.get()!] ?? [];

            if (currentlySelectable.length !== newSelectable.length) {
              selectableCardStore.set(newSelectable);
            }

            const sorted1 = [...currentlySelectable].sort((a, b) => a - b);
            const sorted2 = [...newSelectable].sort((a, b) => a - b);

            if (!sorted1.every((val, idx) => val === sorted2[idx])) {
              selectableCardStore.set(newSelectable);
            }
            break;
          case 'scores':
            map.scoresUpdated(match.scores ?? {});
            break;
          case 'turnNumber':
            turnNumberStore.set(match.turnNumber ?? 0);
            break;
          case 'turnPhaseIndex':
            turnPhaseStore.set(TurnPhaseOrderValues[match.turnPhaseIndex ?? 0]);
            break;
          case 'currentPlayerTurnIndex':
            currentPlayerTurnIndexStore.set(match.currentPlayerTurnIndex ?? 0);
            break;
          case 'playerBuys':
            playerBuysStore.set(match.playerBuys ?? 0);
            break;
          case 'playerActions':
            playerActionsStore.set(match.playerActions ?? 0);
            break;
          case 'playerTreasure':
            playerTreasureStore.set(match.playerTreasure ?? 0);
            break;
          case 'playArea':
            playAreaStore.set(match.playArea ?? []);
            break;
          case 'supply':
            supplyStore.set(match.supply ?? []);
            break;
          case 'kingdom':
            kingdomStore.set(match.kingdom ?? []);
            break;
          case 'playerHands':
            for (const playerId of Object.keys(match.playerHands ?? {})) {
              playerHandStore(+playerId).set(match.playerHands?.[+playerId] ?? []);
            }
            break;
          case 'playerDecks':
            for (const playerId of Object.keys(match.playerDecks ?? {})) {
              playerDeckStore(+playerId).set(match.playerDecks?.[+playerId] ?? []);
            }
            break;
          case 'playerDiscards':
            for (const playerId of Object.keys(match.playerDiscards ?? {})) {
              playerDiscardStore(+playerId).set(match.playerDiscards?.[+playerId] ?? []);
            }
            break;
          case 'trash':
            trashStore.set(match.trash ?? []);
            break;
        }
      }
    },*/
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
    /*scoresUpdated: scores => {
      Object.keys(scores).forEach(playerId => {
        const pId = +playerId;
        playerScoreStore(pId).set(scores[pId]);
      })
    },*/
    selectCard: selectCardArgs => {
      const eventListener = (cardIds: number[]) => {
        gameEvents.off('cardsSelected', eventListener);
        selectedCardStore.set([]);
        socketService.emit('selectCardResponse', cardIds);
      };

      selectableCardStore.set(selectCardArgs.selectableCardIds);
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
