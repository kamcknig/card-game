import { CardKey, LogEntry, Match } from 'shared/types/index.ts';
import { playerIdStore, playerStore, selfPlayerIdStore } from '../../state/player-state';
import {
  matchConfigurationStore,
  matchStartedStore,
  matchStore,
  matchSummaryStore,
} from '../../state/match-state';
import { gameOwnerIdStore, sceneStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardStore } from '../../state/card-state';
import { tokenDefinitionStore } from '../../state/token-definition-state';
import { Assets } from 'pixi.js';
import { applyPatch, Operation } from 'fast-json-patch';
import { ClientListenEventNames, ClientListenEvents } from '../../../types';
import { logManager } from '../log-manager';
import { cardSourceStore, cardSourceTagMapStore } from '../../state/card-source-store';
import { basicSupplies, kingdomSupplies } from '../../state/match-logic';

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
    const s = new Audio('./assets/sounds/game-over.mp3');
    // Autoplay is blocked without user interaction, so guard and swallow the error.
    if (navigator.userActivation?.hasBeenActive) {
      void s.play().catch(() => null);
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

  map['setTokenDefinitions'] = definitions => {
    tokenDefinitionStore.set(definitions);
  };

  map['matchReady'] = async () => {
    const cardsById = cardStore.get();
    if (!cardsById || Object.keys(cardsById).length === 0) {
      console.warn('missing card library on matchReady, skipping setup');
      return;
    }

    const playerId = selfPlayerIdStore.get();
    if (!playerId) throw new Error('missing self playerId');

    const cardSource = cardSourceStore.get();
    if (!cardSource?.['basicSupply'] || !cardSource?.['kingdomSupply']) {
      console.warn('missing card source on matchReady, skipping setup');
      return;
    }

    let basics = cardSource['basicSupply'].reduce((prev, nextCard) => {
      const card = cardsById[nextCard];
      if (!card) return prev;

      if (card.type.includes(('VICTORY'))) {
        if (prev[0].includes(card.kingdom)) return prev;
        prev[0].push(card.kingdom);
        return prev;
      }
      else if (card.type.includes(('TREASURE'))) {
        if (prev[1].includes(card.kingdom)) return prev;
        prev[1].push(card.kingdom);
        return prev;
      }

      return prev;
    }, [[], []] as [CardKey[], CardKey[]]);
    basicSupplies.set(basics ?? [[], []]);

    const kingdoms = cardSource['kingdomSupply'].reduce((prev, nextCard) => {
      const card = cardsById[nextCard];
      if (prev.includes(card.kingdom)) return prev;
      prev.push(card.kingdom);
      return prev;
    }, [] as CardKey[]);
    kingdomSupplies.set(kingdoms ?? []);

    const baseBundle: Record<string, string> = {
      'card-back-full': `/assets/card-images/base-v2/full-size/card-back.jpg`,
      'card-back-detail': `/assets/card-images/base-v2/detail/card-back.jpg`,
      'card-back-half': `/assets/card-images/base-v2/half-size/card-back.jpg`,
      'treasure-bg': '/assets/ui-icons/treasure-bg.png',
      'potion-icon': '/assets/ui-icons/potion.png',
      // Shared debt icon for Empires-style costs.
      'debt-icon': '/assets/ui-icons/64px-debt.png',
    };

    const finalBundle = Object.values(cardsById).reduce((prev, c) => {
      prev[`${c.cardKey}-detail`] ??= c.detailImagePath;
      prev[`${c.cardKey}-full`] ??= c.fullImagePath;
      prev[`${c.cardKey}-half`] ??= c.halfImagePath;
      return prev;
    }, baseBundle);

    for (const event of matchStore.get()?.events ?? []) {
      finalBundle[`${event.cardKey}-full`] ??= event.fullImagePath;
      finalBundle[`${event.cardKey}-detail`] ??= event.detailImagePath;
    }

    // Ensure landmark images are loaded alongside events.
    for (const landmark of matchStore.get()?.landmarks ?? []) {
      finalBundle[`${landmark.cardKey}-full`] ??= landmark.fullImagePath;
      finalBundle[`${landmark.cardKey}-detail`] ??= landmark.detailImagePath;
    }

    // Ensure project images are loaded alongside other landscapes.
    for (const project of matchStore.get()?.projects ?? []) {
      finalBundle[`${project.cardKey}-full`] ??= project.fullImagePath;
      finalBundle[`${project.cardKey}-detail`] ??= project.detailImagePath;
    }

    // Ensure boon images are loaded for card-like selection prompts.
    for (const boon of matchStore.get()?.boons?.cards ?? []) {
      finalBundle[`${boon.cardKey}-full`] ??= boon.fullImagePath;
      finalBundle[`${boon.cardKey}-detail`] ??= boon.detailImagePath;
    }

    // Ensure hex images are loaded for card-like selection prompts.
    for (const hex of matchStore.get()?.hexes?.cards ?? []) {
      finalBundle[`${hex.cardKey}-full`] ??= hex.fullImagePath;
      finalBundle[`${hex.cardKey}-detail`] ??= hex.detailImagePath;
    }

    // Ensure state images are loaded for state display prompts.
    for (const state of matchStore.get()?.states?.cards ?? []) {
      finalBundle[`${state.cardKey}-full`] ??= state.fullImagePath;
      finalBundle[`${state.cardKey}-detail`] ??= state.detailImagePath;
    }

    // Ensure artifact images are loaded for artifact display prompts.
    for (const artifact of matchStore.get()?.artifacts?.cards ?? []) {
      finalBundle[`${artifact.cardKey}-full`] ??= artifact.fullImagePath;
      finalBundle[`${artifact.cardKey}-detail`] ??= artifact.detailImagePath;
    }

    Assets.addBundle('cardLibrary', finalBundle);

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
    if (patchCardLibrary?.length) map['patchCardLibrary']?.(patchCardLibrary);
    if (patchMatch?.length) map['patchMatch']?.(patchMatch);
  };

  map['patchMatch'] = (patch: Operation[]) => {
    const current = structuredClone(matchStore.get()) ?? {} as Match;
    applyPatch(current, patch);
    cardSourceStore.set(current.cardSources);
    cardSourceTagMapStore.set(current.cardSourceTagMap);
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
