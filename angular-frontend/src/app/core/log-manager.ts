import { Card, CardId, LogEntry, LogEntrySource, Player, PlayerId } from 'shared/types';
import { cardStore } from '../state/card-state';
import { playerStore, selfPlayerIdStore } from '../state/player-state';
import { logEntryIdsStore, logStore } from '../state/log-state';
import { tokenDefinitionStore } from '../state/token-definition-state';
import { matchStore } from '../state/match-state';
import { findCardLikeInMatch } from 'shared/find-card-like-in-match';

export const logManager = {
  addLogEntry(logEntry: LogEntry) {
    let msg: string = '';
    const cardsById = cardStore.get();
    // Token definitions are used for readable log labels.
    const tokenDefinitions = tokenDefinitionStore.get();

    let playerId: PlayerId | undefined = undefined;
    let player: Player | undefined = undefined;
    let playerName: string | undefined = undefined;
    let playerColor: string | undefined = undefined;

    if ('playerId' in logEntry) {
      playerId = logEntry.playerId;
      player = playerStore(playerId).get();
      playerName = player?.name;
      playerColor = player?.color;
    }

    const selfId = selfPlayerIdStore.get();
    const youColor = playerStore(selfId!).get()?.color;

    switch (logEntry.type) {
      case 'draw': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% drew <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`
          : `%P${player?.id}% drew a card`;
        break;
      }
      case 'drawHand': {
        msg = selfId === playerId
          ? `%Y% drew a new hand`
          : `%P${player?.id}% drew a new hand`;
        break;
      }
      case 'discard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% discarded <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`
          : `%P${player?.id}% discarded a card`;
        break;
      }
      case 'gainBuy': {
        const amount = `${logEntry.count} buy${logEntry.count > 1 ? 's' : ''}`;
        msg = selfId === playerId ? `%Y% gained ${amount}` : `%P${player?.id}% gained ${amount}`;
        break;
      }
      case 'gainTreasure': {
        const amount = `$${logEntry.count}`;
        msg = selfId === playerId ? `%Y% gained ${amount}` : `%P${player?.id}% gained ${amount}`;
        break;
      }
      case 'payDebt': {
        const amount = `${logEntry.count} <span style="color: #9F5F2D">Debt</span>`;
        msg = selfId === playerId ? `%Y% paid ${amount}` : `%P${player?.id}% paid ${amount}`;
        break;
      }
      case 'gainAction': {
        const amount = `${logEntry.count} action${logEntry.count > 1 ? 's' : ''}`;
        msg = selfId === playerId ? `%Y% gained ${amount}` : `%P${player?.id}% gained ${amount}`;
        break;
      }
      case 'tokenEffect': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% triggered ${logEntry.effectText} from <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`
          : `%P${player?.id}% triggered ${logEntry.effectText} from <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`;
        break;
      }
      case 'cardLikeEffect': {
        const display = getCardLikeDisplay(logEntry.cardLikeId);
        msg = selfId === playerId
          ? `${logEntry.effectText} from <span style="color: ${display.color}">${display.name}</span>`
          : `${logEntry.effectText} from <span style="color: ${display.color}">${display.name}</span>`;
        break;
      }
      // Token placement and consumption logs.
      case 'tokenPlaced': {
        const tokenName = tokenDefinitions[logEntry.tokenId]?.name ?? logEntry.tokenId;
        msg = selfId === playerId
          ? `%Y% received ${tokenName}`
          : `%P${player?.id}% received ${tokenName}`;
        break;
      }
      case 'tokenConsumed': {
        const tokenName = tokenDefinitions[logEntry.tokenId]?.name ?? logEntry.tokenId;
        msg = selfId === playerId
          ? `%Y% used ${tokenName}`
          : `%P${player?.id}% used ${tokenName}`;
        break;
      }
      case 'buyProject': {
        const display = getCardLikeDisplay(logEntry.cardLikeId);
        msg = selfId === playerId
          ? `%Y% bought <span style="color: ${display.color}">${display.name}</span>`
          : `%P${player?.id}% bought <span style="color: ${display.color}">${display.name}</span>`;
        break;
      }
      case 'gainCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% gained <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`
          : `%P${player?.id}% gained a <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`;
        break;
      }
      case 'cardPlayed': {
        const cardName = cardsById[logEntry.cardId].cardName;
        msg = selfId === playerId
          ? `%Y% played <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`
          : `%P${player?.id}% played a <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`;
        break;
      }
      case 'revealCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% revealed <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`
          : `%P${player?.id}% revealed <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`;
        break;
      }
      case 'shuffleDeck': {
        msg = selfId === playerId
          ? `%Y% shuffled your discard to your deck`
          : `%P${player?.id}% shuffled their discard to their deck`;
        break;
      }
      case 'trashCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% trashed <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`
          : `%P${player?.id}% trashed <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`;
        break;
      }
      case 'newPlayerTurn': {
        msg = `<br><span style="color: ${playerColor}">${playerName}</span> - turn ${logEntry.turn}<hr class="new-player-turn">`;
        break;
      }
    }

    if (!msg) return;

    msg = msg
      .replace(/%Y%/g, `<span style="color: ${youColor}">You</span>`)
      .replace(/%P(\d+)%/g, (_, id) => {
        const p = playerStore(Number(id)).get();
        return `<span style="color: ${p?.color || 'white'}">${p?.name || 'Player'}</span>`;
      });

    msg = `${'&nbsp;'.repeat((logEntry.depth ?? 0) * 3)}${msg}`;

    if (logEntry.source) {
      const sourceCard = cardsById[logEntry.source];
      msg = `${msg} (<span style="color: ${getSourceColor(logEntry.source, cardsById)}">${sourceCard.cardName}</span>)`;
    }

    const ids = logEntryIdsStore.get();
    const newId = ids.length + 1;
    logEntryIdsStore.set([...ids, newId]);
    logStore.setKey(newId, { ...logEntry, message: msg, id: newId });
  }
};

const SourceColors = {
  treasure: '#fdda56',
  victory: '#8efb49',
  curse: '#d45ffb',
  duration: '#ff8d34'
}

const getSourceColor = (source: LogEntrySource, cardsById: Record<CardId, Card>) => {
  const sourceCard = cardsById[source];

  if (sourceCard.cardKey === 'curse') {
    return SourceColors.curse;
  }

  if (sourceCard.type.includes('TREASURE')) {
    return SourceColors.treasure;
  }

  if (sourceCard.type.includes('VICTORY')) {
    return SourceColors.victory;
  }

  if (sourceCard.type.includes('DURATION')) {
    return SourceColors.duration;
  }

  return 'white';
}

// Resolves card-like names for log entries (events/landmarks/boons/hexes/states/artifacts).
const getCardLikeDisplay = (cardLikeId: number) => {
  const match = matchStore.get();
  if (!match) {
    return { name: 'Card-like', color: 'white' };
  }

  const cardLike = findCardLikeInMatch(match, cardLikeId);

  return { name: cardLike?.cardName ?? 'Card-like', color: 'white' };
}
