import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { placeVictoryTokensPerPlayer } from './landmark-utils.ts';

export const configureBasilica = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Basilica handlers when the landmark is present.
  const hasBasilica = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'basilica',
  );
  if (!hasBasilica) return;

  registrar('onGameStartSetup', async (args) => {
    // Basilica setup: put 6 VP tokens per player on the landmark using the shared helper.
    await placeVictoryTokensPerPlayer(args, {
      landmarkKey: 'basilica',
      logKey: 'basilica',
      landmarkName: 'Basilica',
    });
  });

  registrar('onCardGained', async (args, eventArgs) => {
    // Basilica only triggers during the current player's buy phase.
    if (getTurnPhase(args.match.turnPhaseIndex) !== 'buy') return;

    const currentPlayer = getCurrentPlayer(args.match);
    if (currentPlayer.id !== eventArgs.playerId) return;

    // Basilica checks remaining treasure after the gain has resolved.
    const treasureRemaining = args.match.playerTreasure;
    if (treasureRemaining < 2) {
      return;
    }

    const victoryTokenId = prosperityTokenIds.victory;
    const tokensOnBasilica = Object.values(args.match.tokens ?? {}).filter(
      (token) =>
        token.tokenId === victoryTokenId &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === 'basilica',
    ).sort((a, b) => a.id.localeCompare(b.id));

    if (!tokensOnBasilica.length) {
      return;
    }

    const tokensToMove = tokensOnBasilica.slice(0, 2);

    for (const token of tokensToMove) {
      await args.actionService.run('moveToken', {
        tokenInstanceId: token.id,
        location: { type: 'player', playerId: eventArgs.playerId },
        ownerId: eventArgs.playerId,
      });
    }
  });
};
