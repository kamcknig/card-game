import { Card, CardId, LogEntry, LogEntrySource, Player, PlayerId } from 'shared/types';
import { cardStore } from '../state/card-state';
import { playerStore, selfPlayerIdStore } from '../state/player-state';
import { logEntryIdsStore, logStore } from '../state/log-state';
import { tokenDefinitionStore } from '../state/token-definition-state';
import { matchStore } from '../state/match-state';
import { findCardLikeEntryInMatch } from 'shared/find-card-like-in-match';
import { getSourceAccentColorForCard, getSourceAccentColorForCardLikeKind } from './source-accent-colors';

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
        msg = selfId === playerId
          ? `%Y% drew ${cardLink(logEntry.cardId, cardsById)}`
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
        const discardCount = logEntry.count ?? 1;
        if (discardCount > 1) {
          // Multi-discard: show the count prefix then a clickable final card name for both players.
          msg = selfId === playerId
            ? `%Y% discards ${discardCount} cards and ${cardLink(logEntry.cardId, cardsById)}`
            : `%P${player?.id}% discards ${discardCount} cards and ${cardLink(logEntry.cardId, cardsById)}`;
          break;
        }

        msg = selfId === playerId
          ? `%Y% discarded ${cardLink(logEntry.cardId, cardsById)}`
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
        // Card name is clickable; the effectText prose between it and the trigger word stays plain.
        msg = selfId === playerId
          ? `%Y% triggered ${logEntry.effectText} from ${cardLink(logEntry.cardId, cardsById)}`
          : `%P${player?.id}% triggered ${logEntry.effectText} from ${cardLink(logEntry.cardId, cardsById)}`;
        break;
      }
      case 'cardLikeEffect': {
        // effectText is server-supplied prose — keep plain. Only the card-like name is clickable.
        msg = selfId === playerId
          ? `${logEntry.effectText} from ${cardLikeLink(logEntry.cardLikeId)}`
          : `${logEntry.effectText} from ${cardLikeLink(logEntry.cardLikeId)}`;
        break;
      }
      // Token placement and consumption logs — token names are not card or
      // card-like references and therefore stay as plain text.
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
        msg = selfId === playerId
          ? `%Y% bought ${cardLikeLink(logEntry.cardLikeId)}`
          : `%P${player?.id}% bought ${cardLikeLink(logEntry.cardLikeId)}`;
        break;
      }
      case 'gainCard': {
        msg = selfId === playerId
          ? `%Y% gained ${cardLink(logEntry.cardId, cardsById)}`
          : `%P${player?.id}% gained a ${cardLink(logEntry.cardId, cardsById)}`;
        break;
      }
      case 'cardPlayed': {
        msg = selfId === playerId
          ? `%Y% played ${cardLink(logEntry.cardId, cardsById)}`
          : `%P${player?.id}% played a ${cardLink(logEntry.cardId, cardsById)}`;
        break;
      }
      case 'revealCard': {
        msg = selfId === playerId
          ? `%Y% revealed ${cardLink(logEntry.cardId, cardsById)}`
          : `%P${player?.id}% revealed ${cardLink(logEntry.cardId, cardsById)}`;
        break;
      }
      case 'shuffleDeck': {
        msg = selfId === playerId
          ? `%Y% shuffled your discard to your deck`
          : `%P${player?.id}% shuffled their discard to their deck`;
        break;
      }
      case 'playerLeft': {
        msg = selfId === playerId
          ? `%Y% resigned and left the game`
          : `%P${player?.id}% resigned and left the game`;
        break;
      }
      case 'undoApplied': {
        // Shown to all players; uses the originator's accent color so it stands out.
        msg = selfId === playerId
          ? `%Y% undid their last action`
          : `%P${player?.id}% undid their last action`;
        break;
      }
      case 'trashCard': {
        msg = selfId === playerId
          ? `%Y% trashed ${cardLink(logEntry.cardId, cardsById)}`
          : `%P${player?.id}% trashed ${cardLink(logEntry.cardId, cardsById)}`;
        break;
      }
      case 'newPlayerTurn': {
        // Dashed separator precedes the turn header so it visually divides the
        // previous turn's entries from the new turn's header line.
        msg = `<hr class="new-player-turn"><span style="color: ${playerColor}">${playerName}</span> - turn ${logEntry.turn}`;
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

    // Server emits root entries (turn headers) at depth 0 and the chain's main
    // actions at depth 1 (rootLog calls enter() after sending). Subtracting 1
    // before computing indent collapses depth 0 and depth 1 to the same column,
    // so a turn header and the main actions of that turn share an indent and
    // sub-actions step in by one level.
    const indentLevels = Math.max(0, (logEntry.depth ?? 0) - 1);
    msg = `${'&nbsp;'.repeat(indentLevels * 3)}${msg}`;

    // Source attribution: render the source card as a clickable card-link in
    // parentheses so players can open its detail view too.
    if (logEntry.source) {
      msg = `${msg} (${cardLink(logEntry.source, cardsById)})`;
    }

    const ids = logEntryIdsStore.get();
    const newId = ids.length + 1;
    logEntryIdsStore.set([...ids, newId]);
    logStore.setKey(newId, { ...logEntry, message: msg, id: newId });
  }
};

const getSourceColor = (source: LogEntrySource, cardsById: Record<CardId, Card>) => {
  const sourceCard = cardsById[source];
  return getSourceAccentColorForCard(sourceCard);
}

// Resolves landscape-style names for log entries (events/landmarks/boons/hexes/states/artifacts).
const getCardLikeDisplay = (cardLikeId: number) => {
  const match = matchStore.get();
  if (!match) {
    return { name: 'Landscape', color: getSourceAccentColorForCardLikeKind(undefined) };
  }

  const entry = findCardLikeEntryInMatch(match, cardLikeId);
  return {
    name: entry?.cardLike.cardName ?? 'Landscape',
    color: getSourceAccentColorForCardLikeKind(entry?.kind),
  };
}

/**
 * Builds the inline-button markup for a clickable card name in the log.
 *
 * The button is styled by `.log-card-link` in `game-log.component.scss` to
 * render as colored inline text with a hover/focus affordance. The
 * `data-card-id` attribute is read by the delegated click handler in
 * `GameLogComponent` to open the global card detail dialog.
 */
const cardLink = (cardId: CardId, cardsById: Record<CardId, Card>): string => {
  const cardName = cardsById[cardId]?.cardName ?? '';
  const color = getSourceColor(cardId, cardsById);
  return `<button type="button" class="log-card-link" data-card-id="${cardId}" style="color: ${color}">${cardName}</button>`;
};

/**
 * Builds the inline-button markup for a clickable card-like name in the log
 * (events, projects, landmarks, boons, hexes, states, artifacts, etc.).
 *
 * The `data-card-like-id` attribute is read by the delegated click handler in
 * `GameLogComponent` to resolve the card-like's detail image path and open the
 * global card detail dialog.
 */
const cardLikeLink = (cardLikeId: number): string => {
  const display = getCardLikeDisplay(cardLikeId);
  return `<button type="button" class="log-card-link" data-card-like-id="${cardLikeId}" style="color: ${display.color}">${display.name}</button>`;
};
