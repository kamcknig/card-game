import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { CardKey, ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';

export const configureAqueduct = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  const hasAqueduct = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'aqueduct',
  );

  if (!hasAqueduct) return;

  console.info(
    `[empires configurator] setting up aqueduct landmark handlers`,
  );

  registrar('onGameStart', async (args) => {
    // Aqueduct setup: put 8 VP tokens on Silver and Gold piles.
    console.info(
      `[aqueduct onGameStart] placing VP tokens on Silver and Gold piles`,
    );
    const victoryTokenId = prosperityTokenIds.victory;
    const targetPiles: CardKey[] = ['silver', 'gold'];

    for (const pileKey of targetPiles) {
      for (let i = 0; i < 8; i += 1) {
        await args.actionService.run('placeToken', {
          tokenId: victoryTokenId,
          location: { type: 'supplyPile', cardKey: pileKey },
        });
      }
    }
  });

  registrar('onCardGained', async (args, eventArgs) => {
    // Aqueduct triggers on any Treasure/Victory gain.
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    const isTreasure = gainedCard.type.includes('TREASURE');
    const isVictory = gainedCard.type.includes('VICTORY');

    if (!isTreasure && !isVictory) return;

    const victoryTokenId = prosperityTokenIds.victory;
    const pileKey = getCardPileKey(gainedCard);

    // Finds victory tokens on a supply pile keyed by cardKey.
    const getTokensOnPile = (cardKey: CardKey) =>
      Object.values(args.match.tokens).filter((token) =>
        token.tokenId === victoryTokenId &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === cardKey
      );

    // Moves one victory token from the gained card's pile to Aqueduct.
    const moveTokenToAqueduct = async (): Promise<boolean> => {
      const tokensOnPile = getTokensOnPile(pileKey).sort((a, b) => a.id.localeCompare(b.id));
      const token = tokensOnPile[0];
      if (!token) {
        console.debug(
          `[aqueduct onCardGained] no victory tokens on ${pileKey} pile`,
        );
        return false;
      }

      console.debug(
        `[aqueduct onCardGained] moving 1 VP from ${pileKey} to Aqueduct`,
      );
      await args.actionService.run('moveToken', {
        tokenInstanceId: token.id,
        location: { type: 'supplyPile', cardKey: 'aqueduct' },
      });
      return true;
    };

    // Moves all victory tokens from Aqueduct to the gaining player.
    const claimAqueductTokens = async (): Promise<void> => {
      const tokensOnAqueduct = getTokensOnPile('aqueduct').sort((a, b) => a.id.localeCompare(b.id));
      if (!tokensOnAqueduct.length) {
        console.debug(
          `[aqueduct onCardGained] no victory tokens on Aqueduct`,
        );
        return;
      }

      console.info(
        `[aqueduct onCardGained] moving ${tokensOnAqueduct.length} VP token(s) to player ${eventArgs.playerId}`,
      );
      for (const token of tokensOnAqueduct) {
        await args.actionService.run('moveToken', {
          tokenInstanceId: token.id,
          location: { type: 'player', playerId: eventArgs.playerId },
          ownerId: eventArgs.playerId,
        });
      }
    };

    // Resolve Treasure portion first, then Victory portion if both apply.
    if (isTreasure) {
      await moveTokenToAqueduct();
    }
    if (isVictory) {
      await claimAqueductTokens();
    }
  });
};
