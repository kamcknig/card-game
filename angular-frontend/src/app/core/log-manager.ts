import { Card, CardId, LogEntry, LogEntrySource, Player, PlayerId } from 'shared/shared-types';
import { cardStore } from '../state/card-state';
import { playerStore } from '../state/player-state';
import { selfPlayerIdStore } from '../state/match-state';
import { logEntryIdsStore, logStore } from '../state/log-state';

export const logManager = {
  addLogEntry(logEntry: LogEntry) {
    let msg: string = '';
    const cardsById = cardStore.get();

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
      case 'gainAction': {
        const amount = `${logEntry.count} action${logEntry.count > 1 ? 's' : ''}`;
        msg = selfId === playerId ? `%Y% gained ${amount}` : `%P${player?.id}% gained ${amount}`;
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
      case 'trashCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% trashed <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`
          : `%P${player?.id}% trashed <span style="color: ${getSourceColor(logEntry.cardId, cardsById)}">${cardName}</span>`;
        break;
      }
      case 'newTurn': {
        msg = `<hr class="new-turn"><br>TURN ${logEntry.turn + 1}<br>`;
        break;
      }
      case 'newPlayerTurn': {
        msg = `<br><span style="color: ${playerColor}">${playerName}</span> - turn ${logEntry.turn + 1}<hr class="new-player-turn">`;
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
