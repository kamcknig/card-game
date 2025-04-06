import { ClientListenEventNames, ClientListenEvents, LogEntry } from 'shared/shared-types';
import { InjectionToken } from '@angular/core';
import {
  playerDeckStore,
  playerDiscardStore,
  playerHandStore,
  playerIdStore,
  playerScoreStore,
  playerStore,
  selfPlayerIdStore
} from '../../state/player-state';
import { $matchStarted, kingdomStore, matchConfigurationStore, supplyStore } from '../../state/match-state';
import { $gamePaused, gameOwnerIdStore, sceneStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardOverrideStore, cardStore } from '../../state/card-state';
import { playerTurnOrder } from '../../state/turn-state';
import { Assets } from 'pixi.js';

export const SOCKET_EVENT_MAP = new InjectionToken('socketEventMap');

export type SocketEventMap = { [p in ClientListenEventNames]: ClientListenEvents[p] };

export const socketToGameEventMap: SocketEventMap = {
  addLogEntry: (logEntry: LogEntry) => {
    /*logManager.addLogEntry(logEntry);*/
  },
  cardEffectsComplete: () => {
    /*gameEvents.emit('cardEffectsComplete')*/
  },
  doneWaitingForPlayer: playerId => {
    /*gameEvents.emit('doneWaitingForPlayer', playerId);*/
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
  matchConfigurationUpdated: val => {
    matchConfigurationStore.set({ ...val });
  },
  setCardLibrary: cards => {
    cardStore.set(cards);
  },
  setCardDataOverrides: overrides => {
    cardOverrideStore.set(overrides ?? {});
  },
  matchReady: async match => {
    supplyStore.set(match.supply);
    kingdomStore.set(match.kingdom);
    playerTurnOrder.set(match.players);

    Object.values(match.players).forEach(p => {
      const pId = +p;
      playerHandStore(pId).set(match?.playerHands[pId] ?? []);
      playerDiscardStore(pId).set(match?.playerDiscards[pId] ?? []);
      playerDeckStore(pId).set(match?.playerDecks[pId] ?? []);
    });

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
  matchStarted: match => {
    /*socketToGameEventMap.matchUpdated(match);
    gameEvents.emit('matchStarted');
    $matchStarted.set(true);*/
  },
  matchUpdated: match => {
    /*const keys = Object.keys(match);
    for (const key of keys) {
      switch (key) {
        case 'selectableCards':
          const currentlySelectable = $selectableCards.get();
          const newSelectable = match.selectableCards[$selfPlayerId.get()] ?? [];

          if (currentlySelectable.length !== newSelectable.length) {
            $selectableCards.set(newSelectable);
          }
          const sorted1 = [...currentlySelectable].sort((a, b) => a - b);
          const sorted2 = [...newSelectable].sort((a, b) => a - b);

          if (!sorted1.every((val, idx) => val === sorted2[idx])) {
            $selectableCards.set(newSelectable);
          }
          break;
        case 'scores':
          socketToGameEventMap.scoresUpdated(match.scores);
          break;
        case 'turnNumber':
          $turnNumber.set(match.turnNumber);
          break;
        case 'turnPhaseIndex':
          $turnPhase.set(TurnPhaseOrderValues[match.turnPhaseIndex]);
          break;
        case 'currentPlayerTurnIndex':
          $currentPlayerTurnIndex.set(match.currentPlayerTurnIndex);
          break;
        case 'playerBuys':
          $playerBuys.set(match.playerBuys);
          break;
        case 'playerActions':
          $playerActions.set(match.playerActions);
          break;
        case 'playerTreasure':
          $playerTreasure.set(match.playerTreasure);
          break;
        case 'playArea':
          $playAreaStore.set(match.playArea);
          break;
        case 'supply':
          $supplyStore.set(match.supply);
          break;
        case 'kingdom':
          $kingdomStore.set(match.kingdom);
          break;
        case 'playerHands':
          for (const playerId of Object.keys(match.playerHands)) {
            $playerHandStore(toNumber(playerId)).set(match.playerHands[toNumber(playerId)] ?? []);
          }
          break;
        case 'playerDecks':
          for (const playerId of Object.keys(match.playerDecks)) {
            $playerDeckStore(toNumber(playerId)).set(match.playerDecks[toNumber(playerId)] ?? []);
          }
          break;
        case 'playerDiscards':
          for (const playerId of Object.keys(match.playerDiscards)) {
            $playerDiscardStore(toNumber(playerId)).set(match.playerDiscards[toNumber(playerId)] ?? []);
          }
          break;
        case 'trash':
          $trashStore.set(match.trash);
          break;
      }
    }*/
  },
  playerConnected: (player) => {
    playerStore(player.id).set({ ...player });

    if (!playerIdStore.get().includes(player.id)) {
      playerIdStore.set([...playerIdStore.get(), player.id]);
    }

    if ($matchStarted.get()) {
      $gamePaused.set(false);
    }
  },
  setPlayerList: players => {
    for (const player of players) {
      playerStore(player.id).set({ ...player });
    }
    playerIdStore.set(players.map(player => player.id));
  },
  playerDisconnected: (player) => {
    playerStore(player.id).set({ ...player });

    if ($matchStarted.get()) {
      $gamePaused.set(true);
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
  scoresUpdated: scores => {
    Object.keys(scores).forEach(playerId => {
      const pId = +playerId;
      playerScoreStore(pId).set(scores[pId]);
    })
  },
  selectCard: selectCardArgs => {
    /*const eventListener = (cardIds: number[]) => {
      gameEvents.off('cardsSelected', eventListener);
      $selectedCards.set([]);
      socket.emit('selectCardResponse', cardIds);
    };

    $selectableCards.set(selectCardArgs.selectableCardIds);
    gameEvents.emit('selectCard', selectCardArgs);
    gameEvents.on('cardsSelected', eventListener);*/
  },
  userPrompt: userPromptArgs => {
    /*const userPromptResponseListener = (result: unknown) => {
      gameEvents.off('userPromptResponse', userPromptResponseListener);
      socket.emit('userPromptResponse', result);
    };

    gameEvents.on('userPromptResponse', userPromptResponseListener);
    gameEvents.emit('userPrompt', userPromptArgs);*/
  },
  waitingForPlayer: playerId => {
    /*gameEvents.emit('waitingForPlayer', playerId);*/
  },
}
