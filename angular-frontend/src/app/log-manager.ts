import { LogEntry } from 'shared/shared-types';
import { cardStore } from './state/card-state';
import { playerStore, selfPlayerIdStore } from './state/player-state';
import { gameEvents } from './core/event/events';

export const logManager = {
  addLogEntry: (logEntry: LogEntry) => {
    let msg: string;
    const playerSourceId = logEntry.playerSourceId;
    const cardsById = cardStore.get();
    const selfId = selfPlayerIdStore.get();

    switch (logEntry.type) {
      case 'draw': {
        const playerName = playerStore(playerSourceId).get()?.name;
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerSourceId) {
          msg = `You drew a ${cardName}`;
        } else {
          msg = `${playerName} drew a card`;
        }
        break;
      }
      case 'discard': {
        const playerName = playerStore(playerSourceId).get()?.name;
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerSourceId) {
          msg = `You discarded a ${cardName}`;
        } else {
          msg = `${playerName} discarded a card`;
        }
        break;
      }
      case 'gainBuy': {
        const playerName = playerStore(playerSourceId).get()?.name;
        if (selfId === playerSourceId) {
          msg = `You gained ${logEntry.count} buy/s`;
        } else {
          msg = `${playerName} gained ${logEntry.count} buy/s`;
        }
        break;
      }
      case 'gainTreasure': {
        const playerName = playerStore(playerSourceId).get()?.name;
        if (selfId === playerSourceId) {
          msg = `You gained ${logEntry.count} treasure`;
        } else {
          msg = `${playerName} gained ${logEntry.count} treasure`;
        }
        break;
      }
      case 'gainAction': {
        const playerName = playerStore(playerSourceId).get()?.name;
        if (selfId === playerSourceId) {
          msg = `You gained ${logEntry.count} action/s`;
        } else {
          msg = `${playerName} gained ${logEntry.count} action/s`;
        }
        break;
      }
      case 'gainCard': {
        const playerName = playerStore(playerSourceId).get()?.name;
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerSourceId) {
          msg = `You gained a ${cardName}`;
        } else {
          msg = `${playerName} gained a ${cardName}`;
        }
        break;
      }
      case 'playCard': {
        const playerName = playerStore(playerSourceId).get()?.name;
        const cardName = cardsById[logEntry.cardId].cardName;
        if (selfId === playerSourceId) {
          msg = `You played a ${cardName}`;
        } else {
          msg = `${playerName} played a ${cardName}`;
        }
        break;
      }
      case 'revealCard': {
        const playerName = playerStore(playerSourceId).get()?.name;
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerSourceId) {
          msg = `You revealed a ${cardName}`;
        } else {
          msg = `${playerName} revealed a ${cardName}`;
        }
        break;
      }
      case 'trashCard': {
        const playerName = playerStore(playerSourceId).get()?.name;
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerSourceId) {
          msg = `You trashed a ${cardName}`;
        } else {
          msg = `${playerName} trashed a ${cardName}`;
        }
        break;
      }
    }

    if (!msg) return;
    gameEvents.emit('addLogEntry', msg);
  }
}
