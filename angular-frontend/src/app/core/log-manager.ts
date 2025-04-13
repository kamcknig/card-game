import { LogEntry } from 'shared/shared-types';
import { cardStore } from '../state/card-state';
import { playerStore, selfPlayerIdStore } from '../state/player-state';
import { logEntryIdsStore, logStore } from '../state/log-state';
import { log } from '@angular-devkit/build-angular/src/builders/ssr-dev-server';

export const logManager = {
  addLogEntry: (logEntry: LogEntry) => {
    let msg: string = '';
    const cardsById = cardStore.get();
    const playerId = logEntry.playerId;
    const selfId = selfPlayerIdStore.get();
    const player = playerStore(playerId).get();
    const playerName = player?.name;
    const playerColor = player?.color;
    const youColor = playerStore(selfId!).get()?.color;

    switch (logEntry.type) {
      case 'draw': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% drew a ${cardName}`;
        } else {
          msg = `%P${player?.id}% drew a card`;
        }
        break;
      }
      case 'discard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% discarded a ${cardName}`;
        } else {
          msg = `%P${player?.id}% discarded a card`;
        }
        break;
      }
      case 'gainBuy': {
        if (selfId === playerId) {
          msg = `%Y% gained ${logEntry.count} buy/s`;
        } else {
          msg = `%P${player?.id}% gained ${logEntry.count} buy/s`;
        }
        break;
      }
      case 'gainTreasure': {
        if (selfId === playerId) {
          msg = `%Y% gained ${logEntry.count} treasure`;
        } else {
          msg = `%P${player?.id}% gained ${logEntry.count} treasure`;
        }
        break;
      }
      case 'gainAction': {
        if (selfId === playerId) {
          msg = `%Y% gained ${logEntry.count} action/s`;
        } else {
          msg = `%P${player?.id}% gained ${logEntry.count} action/s`;
        }
        break;
      }
      case 'gainCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% gained a ${cardName}`;
        } else {
          msg = `%P${player?.id}% gained a ${cardName}`;
        }
        break;
      }
      case 'playCard': {
        const cardName = cardsById[logEntry.cardId].cardName;
        if (selfId === playerId) {
          msg = `%Y% played a ${cardName}`;
        } else {
          msg = `%P${player?.id}% played a ${cardName}`;
        }
        break;
      }
      case 'revealCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% revealed a ${cardName}`;
        } else {
          msg = `%P${player?.id}% revealed a ${cardName}`;
        }
        break;
      }
      case 'trashCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% trashed a ${cardName}`;
        } else {
          msg = `%P${player?.id}% trashed a ${cardName}`;
        }
        break;
      }
      case 'newTurn':
        msg = `<hr><br>TURN ${logEntry.turn}<br>`
        break;
    }

    if (!msg) return;

    const youRegex = /%Y%/g;
    const playerRegex = /%P(\d+)%/g;

    msg = msg.replaceAll(youRegex, `<span style="color: ${youColor}">You</span>`);
    msg = msg.replaceAll(playerRegex, `<span style="color: ${playerColor}">${playerName}</span>`);

    const ids = logEntryIdsStore.get();
    const newId = ids.length + 1;
    logEntryIdsStore.set([...ids, newId])
    logStore.setKey(newId, { ...logEntry, message: msg, id: newId });
  }
}
