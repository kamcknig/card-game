import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { placeVictoryTokensPerPlayer } from './landmark-utils.ts';

export const configureColonnade = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Colonnade handlers when the landmark is present.
  const hasColonnade = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'colonnade',
  );
  if (!hasColonnade) return;

  console.info(
    `[empires configurator] setting up colonnade landmark handlers`,
  );

  registrar('onGameStart', async (args) => {
    // Colonnade setup: put 6 VP tokens per player on the landmark using the shared helper.
    await placeVictoryTokensPerPlayer(args, {
      landmarkKey: 'colonnade',
      logKey: 'colonnade',
      landmarkName: 'Colonnade',
    });
  });

  registrar('onCardGained', async (args, eventArgs) => {
    // Colonnade only triggers during the current player's buy phase.
    if (getTurnPhase(args.match.turnPhaseIndex) !== 'buy') return;

    const currentPlayer = getCurrentPlayer(args.match);
    if (currentPlayer.id !== eventArgs.playerId) return;

    // Colonnade triggers only on Action card gains.
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    if (!gainedCard.type.includes('ACTION')) return;

    // Check for a copy of the gained Action in the player's play area.
    const copyInPlay = args.findCards([
      { location: 'playArea', playerId: eventArgs.playerId },
      { cardKeys: gainedCard.cardKey },
    ]).length > 0;

    if (!copyInPlay) {
      console.debug(
        `[colonnade onCardGained] no copy of ${gainedCard} in play, skipping`,
      );
      return;
    }

    const victoryTokenId = prosperityTokenIds.victory;
    const tokensOnColonnade = Object.values(args.match.tokens ?? {}).filter(
      (token) =>
        token.tokenId === victoryTokenId &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === 'colonnade',
    ).sort((a, b) => a.id.localeCompare(b.id));

    if (!tokensOnColonnade.length) {
      console.debug(
        `[colonnade onCardGained] no VP tokens remaining on Colonnade`,
      );
      return;
    }

    const tokensToMove = tokensOnColonnade.slice(0, 2);
    console.info(
      `[colonnade onCardGained] player ${eventArgs.playerId} gained ${gainedCard} with a copy in play, moving ${tokensToMove.length} VP token(s)`,
    );

    for (const token of tokensToMove) {
      await args.runGameActionDelegate('moveToken', {
        tokenInstanceId: token.id,
        location: { type: 'player', playerId: eventArgs.playerId },
        ownerId: eventArgs.playerId,
      });
    }
  });
};
