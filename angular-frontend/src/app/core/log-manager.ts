import { LogEntry, Player, PlayerId } from 'shared/shared-types';
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
          ? `%Y% drew ${cardName}`
          : `%P${player?.id}% drew a card`;
        break;
      }
      case 'discard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% discarded ${cardName}`
          : `%P${player?.id}% discarded a card`;
        break;
      }
      case 'gainBuy': {
        const amount = `${logEntry.count > 0 ? '+' : ''}${logEntry.count} buy${logEntry.count > 1 ? 's' : ''}`;
        msg = selfId === playerId ? `%Y% gained ${amount}` : `%P${player?.id}% gained ${amount}`;
        break;
      }
      case 'gainTreasure': {
        const amount = `${logEntry.count > 0 ? '+' : ''}$${logEntry.count}`;
        msg = selfId === playerId ? `%Y% gained ${amount}` : `%P${player?.id}% gained ${amount}`;
        break;
      }
      case 'gainAction': {
        const amount = `${logEntry.count > 0 ? '+' : ''}${logEntry.count} action${logEntry.count > 1 ? 's' : ''}`;
        msg = selfId === playerId ? `%Y% gained ${amount}` : `%P${player?.id}% gained ${amount}`;
        break;
      }
      case 'gainCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% gained ${cardName}`
          : `%P${player?.id}% gained a ${cardName}`;
        break;
      }
      case 'cardPlayed': {
        const cardName = cardsById[logEntry.cardId].cardName;
        msg = selfId === playerId
          ? `%Y% played ${cardName}`
          : `%P${player?.id}% played a ${cardName}`;
        break;
      }
      case 'revealCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% revealed ${cardName}`
          : `%P${player?.id}% revealed ${cardName}`;
        break;
      }
      case 'trashCard': {
        const cardName = cardsById[logEntry.cardId]?.cardName;
        msg = selfId === playerId
          ? `%Y% trashed ${cardName}`
          : `%P${player?.id}% trashed ${cardName}`;
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

    console.log(JSON.parse(JSON.stringify(logEntry)));
    msg = `${'&nbsp;'.repeat((logEntry.depth ?? 0) * 3)}${msg}`;

    const ids = logEntryIdsStore.get();
    const newId = ids.length + 1;
    logEntryIdsStore.set([...ids, newId]);
    logStore.setKey(newId, { ...logEntry, message: msg, id: newId });
  }
};
