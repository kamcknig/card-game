import { LogEntry, Player, PlayerId } from 'shared/shared-types';
import { cardStore } from '../state/card-state';
import { playerStore } from '../state/player-state';
import { logEntryIdsStore, logStore } from '../state/log-state';
import { selfPlayerIdStore } from '../state/match-state';

export const logManager = {
  addLogEntry: (logEntry: LogEntry) => {
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
        if (selfId === playerId) {
          msg = `%Y% drew ${cardName}`;
        } else {
          msg = `%P${player?.id}% drew a card`;
        }
        break;
      }
      case 'discard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% discarded ${cardName}`;
        } else {
          msg = `%P${player?.id}% discarded a card`;
        }
        break;
      }
      case 'gainBuy': {
        if (selfId === playerId) {
          msg = `%Y% gained ${logEntry.count > 0 ? '+' : ''}${logEntry.count} buy${logEntry.count > 1 ? 's' : ''}`;
        } else {
          msg = `%P${player?.id}% gained ${logEntry.count > 0 ? '+' : ''}${logEntry.count} buy${logEntry.count > 1 ? 's' : ''}`;
        }
        break;
      }
      case 'gainTreasure': {
        if (selfId === playerId) {
          msg = `%Y% gained ${logEntry.count > 0 ? '+' : ''}$${logEntry.count}`;
        } else {
          msg = `%P${player?.id}% gained ${logEntry.count > 0 ? '+' : ''}$${logEntry.count}`;
        }
        break;
      }
      case 'gainAction': {
        if (selfId === playerId) {
          msg = `%Y% gained ${logEntry.count > 0 ? '+' : ''}${logEntry.count} action${logEntry.count > 1 ? 's' : ''}`;
        } else {
          msg = `%P${player?.id}% gained ${logEntry.count > 0 ? '+' : ''}${logEntry.count} action${logEntry.count > 1 ? 's' : ''}`;
        }
        break;
      }
      case 'gainCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% gained ${cardName}`;
        } else {
          msg = `%P${player?.id}% gained a ${cardName}`;
        }
        break;
      }
      case 'cardPlayed': {
        const cardName = cardsById[logEntry.cardId].cardName;
        if (selfId === playerId) {
          msg = `%Y% played ${cardName}`;
        } else {
          msg = `%P${player?.id}% played a ${cardName}`;
        }
        break;
      }
      case 'revealCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% revealed ${cardName}`;
        } else {
          msg = `%P${player?.id}% revealed ${cardName}`;
        }
        break;
      }
      case 'trashCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        if (selfId === playerId) {
          msg = `%Y% trashed ${cardName}`;
        } else {
          msg = `%P${player?.id}% trashed ${cardName}`;
        }
        break;
      }
      case 'newTurn':
        msg = `<hr class="new-turn"><br>TURN ${logEntry.turn + 1}<br>`
        break;
      case 'newPlayerTurn':
        msg = `<br><span style="color: ${playerColor}">${playerName}</span> - turn ${logEntry.turn + 1}<hr class="new-player-turn">`;
        break;
    }

    if (!msg) return;

    const youRegex = /%Y%/g;
    const playerRegex = /%P(\d+)%/g;

    msg = msg.replaceAll(youRegex, `<span style="color: ${youColor}">You</span>`);
    msg = msg.replaceAll(playerRegex, `<span style="color: ${playerColor}">${playerName}</span>`);
    msg = `${'&nbsp;'.repeat((logEntry.depth ?? 0) * 4)}${msg}`;

    const ids = logEntryIdsStore.get();
    const newId = ids.length + 1;
    logEntryIdsStore.set([...ids, newId])
    logStore.setKey(newId, { ...logEntry, message: msg, id: newId });
  }
}
