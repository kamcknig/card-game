import { Card, CardKey, LogEntry, Match, MatchConfiguration } from 'shared/shared-types';
import { playerIdStore, playerStore } from '../../state/player-state';
import {
  matchConfigurationStore,
  matchStartedStore,
  matchStore,
  matchSummaryStore,
  selfPlayerIdStore
} from '../../state/match-state';
import { gameOwnerIdStore, sceneStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardOverrideStore, cardStore } from '../../state/card-state';
import { Assets } from 'pixi.js';
import { applyPatch, Operation } from 'fast-json-patch';
import { ClientListenEventNames, ClientListenEvents } from '../../../types';
import { logManager } from '../log-manager';
import { kingdomCardKeyStore, supplyCardKeyStore } from '../../state/match-logic';

export type SocketEventMap = Partial<{ [p in ClientListenEventNames]: ClientListenEvents[p] }>;

export const socketToGameEventMap = (): SocketEventMap => {
  const map = {} as SocketEventMap;

  map['addLogEntry'] = (logEntries: LogEntry[]) => {
    for (const logEntry of logEntries) {
      logManager.addLogEntry(logEntry);
    }
  };

  map['matchConfigurationUpdated'] = config => {
    matchConfigurationStore.set(config);
  };

  map['expansionList'] = val => {
    expansionListStore.set(val);
  };

  map['gameOver'] = async summary => {
    try {
      const s = new Audio('./assets/sounds/game-over.mp3');
      await s?.play();
    } catch (error) {
      console.error('error playing game over sound');
      console.error(error);
    }

    matchSummaryStore.set(summary);
    sceneStore.set('gameSummary');
  };

  map['gameOwnerUpdated'] = playerId => {
    gameOwnerIdStore.set(playerId);
  };

  map['setCardLibrary'] = cards => {
    cardStore.set(cards);
  };

  map['setCardDataOverrides'] = overrides => {
    cardOverrideStore.set(overrides ?? {});
  };

  map['matchReady'] = async match => {
    if (!cardStore.get()) throw new Error('missing card library');

    matchStore.set(match);

    const allCards = cardStore.get();
    const kingdomSupplyCardKeys = match?.basicSupply.reduce((prev, nextCard) => {
      const card = allCards[nextCard];

      if (card.type.includes(('VICTORY'))) {
        if (prev[0].includes(card.cardKey)) return prev;
        prev[0].push(card.cardKey);
        return prev;
      }
      else if (card.type.includes(('TREASURE'))) {
        if (prev[1].includes(card.cardKey)) return prev;
        prev[1].push(card.cardKey);
        return prev;
      }

      return prev;
    }, [[], []] as [CardKey[], CardKey[]]);
    supplyCardKeyStore.set(kingdomSupplyCardKeys ?? [[], []]);

    const kingdomCardKeys = match?.kingdomSupply.reduce((prev, nextCard) => {
      const card = allCards[nextCard];
      if (prev.includes(card.cardKey)) return prev;
      prev.push(card.cardKey);
      return prev;
    }, [] as CardKey[]);
    kingdomCardKeyStore.set(kingdomCardKeys ?? []);

    const playerId = selfPlayerIdStore.get();
    if (!playerId) throw new Error('missing self playerId');

    const cardsById = cardStore.get();

    Assets.addBundle('cardLibrary', Object.values(cardsById).reduce((prev, c) => {
      prev[`${c.cardKey}-detail`] ??= c.detailImagePath;
      prev[`${c.cardKey}-full`] ??= c.fullImagePath;
      prev[`${c.cardKey}-half`] ??= c.halfImagePath;
      return prev;
    }, {
      'card-back-full': `/assets/card-images/base-v2/full-size/card-back.jpg`,
      'card-back-detail': `/assets/card-images/base-v2/detail/card-back.jpg`,
      'card-back-half': `/assets/card-images/base-v2/half-size/card-back.jpg`,
      'treasure-bg': '/assets/ui-icons/treasure-bg.png',
      'potion-icon': '/assets/ui-icons/potion.png',
    } as Record<string, string>));

    sceneStore.set('match');
  };

  map['matchStarted'] = () => {
    matchStartedStore.set(true);
  };

  map['patchCardLibrary'] = patch => {
    const current = structuredClone(cardStore.get()) ?? {};
    applyPatch(current, patch);
    cardStore.set(current);
  };

  map['patchUpdate'] = (patchMatch, patchCardLibrary) => {
    if (patchMatch?.length) map['patchMatch']?.(patchMatch);
    if (patchCardLibrary?.length) map['patchCardLibrary']?.(patchCardLibrary);
  };

  map['patchMatch'] = (patch: Operation[]) => {
    const current = structuredClone(matchStore.get()) ?? {} as Match;
    applyPatch(current, patch);
    matchStore.set(current);
  };

  map['playerConnected'] = (player) => {
    playerStore(player.id).set(player);

    if (!playerIdStore.get().includes(player.id)) {
      playerIdStore.set([...playerIdStore.get(), player.id]);
    }
  };

  map['setPlayerList'] = players => {
    for (const player of players) {
      playerStore(player.id).set(player);
    }
    playerIdStore.set(players.map(player => player.id));
  };

  map['playerDisconnected'] = (player) => {
    playerStore(player.id).set(player);
  };

  map['playerNameUpdated'] = (playerId: number, name: string) => {
    const current = playerStore(playerId).get();
    if (!current) return;
    playerStore(playerId).set({
      ...current,
      name
    });
  };

  map['playerReady'] = (playerId, ready) => {
    const current = playerStore(playerId).get();
    if (!current) return;

    playerStore(playerId).set({
      ...current,
      ready
    });
  };

  map['setPlayer'] = player => {
    selfPlayerIdStore.set(player.id);
  }
  return map;
}
