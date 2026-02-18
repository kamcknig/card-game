import { loggerService } from '@logger';
import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { placeVictoryTokensPerPlayer } from './landmark-utils.ts';

export const configureBattlefield = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Battlefield handlers when the landmark is present.
  const hasBattlefield = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'battlefield',
  );
  if (!hasBattlefield) return;

  loggerService.info(
    `[empires configurator] setting up battlefield landmark handlers`,
  );

  registrar('onGameStart', async (args) => {
    // Battlefield setup: put 6 VP tokens per player on the landmark using the shared helper.
    await placeVictoryTokensPerPlayer(args, {
      landmarkKey: 'battlefield',
      logKey: 'battlefield',
      landmarkName: 'Battlefield',
    });
  });

  registrar('onCardGained', async (args, eventArgs) => {
    // Battlefield triggers on any Victory card gain.
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    if (!gainedCard.type.includes('VICTORY')) return;

    const victoryTokenId = prosperityTokenIds.victory;
    const tokensOnBattlefield = Object.values(args.match.tokens ?? {}).filter(
      (token) =>
        token.tokenId === victoryTokenId &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === 'battlefield',
    ).sort((a, b) => a.id.localeCompare(b.id));

    if (!tokensOnBattlefield.length) {
      loggerService.debug(
        `[battlefield onCardGained] no VP tokens remaining on Battlefield`,
      );
      return;
    }

    const tokensToMove = tokensOnBattlefield.slice(0, 2);
    loggerService.info(
      `[battlefield onCardGained] player ${eventArgs.playerId} gained ${gainedCard}, moving ${tokensToMove.length} VP token(s)`,
    );

    for (const token of tokensToMove) {
      await args.actionService.run('moveToken', {
        tokenInstanceId: token.id,
        location: { type: 'player', playerId: eventArgs.playerId },
        ownerId: eventArgs.playerId,
      });
    }
  });
};
