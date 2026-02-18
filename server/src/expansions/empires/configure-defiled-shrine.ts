import { loggerService } from '@logger';
import { CardKey, ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';

export const configureDefiledShrine = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Defiled Shrine handlers when the landmark is present.
  const hasDefiledShrine = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'defiled-shrine',
  );
  if (!hasDefiledShrine) return;

  loggerService.info(
    `[empires configurator] setting up defiled shrine landmark handlers`,
  );

  registrar('onGameStart', async (args) => {
    // Defiled Shrine setup: put 2 VP tokens on each non-Gathering Action supply pile.
    const supplyPiles = [
      ...(config.basicSupply ?? []),
      ...(config.kingdomSupply ?? []),
    ];
    const eligiblePileKeys = new Set<CardKey>();

    for (const supply of supplyPiles) {
      const pileCards = supply.cards ?? [];
      if (!pileCards.length) continue;

      // Skip Gathering piles so Farmers' Market/Temple/Wild Hunt keep their own tokens.
      const hasGathering = pileCards.some((card) => card.type.includes('GATHERING'));
      if (hasGathering) {
        loggerService.debug(
          `[defiled-shrine onGameStart] skipping Gathering pile ${supply.name}`,
        );
        continue;
      }

      eligiblePileKeys.add(supply.name as CardKey);
    }

    if (!eligiblePileKeys.size) {
      loggerService.debug(
        `[defiled-shrine onGameStart] no non-Gathering supply piles found`,
      );
      return;
    }

    const victoryTokenId = prosperityTokenIds.victory;
    for (const pileKey of eligiblePileKeys) {
      loggerService.info(
        `[defiled-shrine onGameStart] placing 2 VP token(s) on ${pileKey}`,
      );
      for (let i = 0; i < 2; i += 1) {
        await args.actionService.run('placeToken', {
          tokenId: victoryTokenId,
          location: { type: 'supplyPile', cardKey: pileKey },
        });
      }
    }
  });

  registrar('onCardGained', async (args, eventArgs) => {
    // Defiled Shrine reacts to Action gains and Curse gains in the buy phase.
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    const victoryTokenId = prosperityTokenIds.victory;

    if (gainedCard.type.includes('ACTION')) {
      // Move 1 VP from the gained card's pile to Defiled Shrine.
      const pileKey = getCardPileKey(gainedCard);
      const tokensOnPile = Object.values(args.match.tokens ?? {}).filter(
        (token) =>
          token.tokenId === victoryTokenId &&
          token.location.type === 'supplyPile' &&
          token.location.cardKey === pileKey,
      ).sort((a, b) => a.id.localeCompare(b.id));

      const tokenToMove = tokensOnPile[0];
      if (!tokenToMove) {
        loggerService.debug(
          `[defiled-shrine onCardGained] no VP tokens on ${pileKey} pile to move`,
        );
      } else {
        loggerService.info(
          `[defiled-shrine onCardGained] moving 1 VP from ${pileKey} to Defiled Shrine`,
        );
        await args.actionService.run('moveToken', {
          tokenInstanceId: tokenToMove.id,
          location: { type: 'supplyPile', cardKey: 'defiled-shrine' },
        });
      }
    }

    if (!gainedCard.type.includes('CURSE')) return;

    // Only award Defiled Shrine VP when the Curse gain happens in the current player's buy phase.
    if (getTurnPhase(args.match.turnPhaseIndex) !== 'buy') {
      loggerService.debug(
        `[defiled-shrine onCardGained] Curse gained outside buy phase, skipping`,
      );
      return;
    }

    const currentPlayer = getCurrentPlayer(args.match);
    if (currentPlayer.id !== eventArgs.playerId) {
      loggerService.debug(
        `[defiled-shrine onCardGained] Curse gained by non-current player, skipping`,
      );
      return;
    }

    const tokensOnShrine = Object.values(args.match.tokens ?? {}).filter(
      (token) =>
        token.tokenId === victoryTokenId &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === 'defiled-shrine',
    ).sort((a, b) => a.id.localeCompare(b.id));

    if (!tokensOnShrine.length) {
      loggerService.debug(
        `[defiled-shrine onCardGained] no VP tokens remaining on Defiled Shrine`,
      );
      return;
    }

    loggerService.info(
      `[defiled-shrine onCardGained] player ${eventArgs.playerId} gained a Curse in buy phase, moving ${tokensOnShrine.length} VP token(s)`,
    );

    for (const token of tokensOnShrine) {
      await args.actionService.run('moveToken', {
        tokenInstanceId: token.id,
        location: { type: 'player', playerId: eventArgs.playerId },
        ownerId: eventArgs.playerId,
      });
    }
  });
};
