import { expansionLibrary } from '../expansion-library.ts';
import { ExpansionConfiguratorFactory } from '../../types.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';

// Seeds boons when Fate cards are present in the selected kingdom.
const configurator: ExpansionConfiguratorFactory = () => {
  // Track boon effect registration to avoid duplicates across configurator iterations.
  let boonEffectsRegistered = false;

  return async (args) => {
    if (!boonEffectsRegistered) {
      // Register The Earth's Gift boon effect for the current match.
      args.boonEffectRegistrar('the-earths-gift', async ({ playerId, runGameActionDelegate, cardLibrary, findCards }) => {
        console.info(`[the-earths-gift boon] resolving for player ${playerId}`);

        const treasuresInHand = findCards([
          { location: 'playerHand', playerId },
          { cardType: ['TREASURE'] },
        ]);

        if (treasuresInHand.length < 1) {
          console.info('[the-earths-gift boon] no Treasures in hand, skipping discard');
          return;
        }

        const discardedTreasureIds = await runGameActionDelegate('selectCard', {
          prompt: 'Discard a Treasure to gain a card costing up to $4',
          playerId: playerId,
          count: 1,
          optional: true,
          restrict: [
            { location: 'playerHand', playerId },
            { cardType: ['TREASURE'] },
          ],
        });

        const discardedTreasureId = discardedTreasureIds[0];
        if (!discardedTreasureId) {
          console.debug('[the-earths-gift boon] player declined to discard a Treasure');
          return;
        }

        console.debug(`[the-earths-gift boon] discarding Treasure ${cardLibrary.getCard(discardedTreasureId)}`);
        await runGameActionDelegate('moveCard', {
          cardId: discardedTreasureId,
          toPlayerId: playerId,
          to: { location: 'playerDiscard' },
        });

        console.debug('[the-earths-gift boon] selecting card to gain costing up to $4');
        const gainCardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Gain a card costing up to $4',
          playerId: playerId,
          count: 1,
          restrict: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { playerId, kind: 'upTo', amount: { treasure: 4 } },
          ],
        });

        const gainCardId = gainCardIds[0];
        if (!gainCardId) {
          console.info('[the-earths-gift boon] no eligible cards to gain');
          return;
        }

        console.debug(`[the-earths-gift boon] gaining card ${cardLibrary.getCard(gainCardId)}`);
        await runGameActionDelegate('gainCard', {
          playerId: playerId,
          cardId: gainCardId,
          to: { location: 'playerDiscard' },
        });
      });

      boonEffectsRegistered = true;
    }

    // Gather all selected kingdom cards to detect Fate types.
    const kingdomCards = args.config.kingdomSupply.flatMap(supply => supply.cards);
    // Fate cards determine whether boons are active for this match.
    const fateCards = kingdomCards.filter(card => card.type?.includes('FATE'));

    if (fateCards.length < 1) {
      // Clear out boons when the match does not contain any Fate cards.
      if ((args.config.boons ?? []).length > 0) {
        console.info('[nocturne configurator] clearing boons because no Fate cards are present');
      }
      // Ensure boons are cleared when Fate cards are absent.
      args.config.boons = [];
      return args.config;
    }

    // Limit boon selection to expansions that actually contributed Fate cards.
    const expansionsWithFate = Array.from(new Set(fateCards.map(card => card.expansionName)));

    // Pull boon definitions from the expansion library.
    const boons = expansionsWithFate.flatMap(expansionName =>
      Object.values(expansionLibrary[expansionName]?.boons ?? {})
    );
    // De-duplicate boons across expansions by card key.
    const uniqueBoons = uniqueByProp(boons, 'cardKey');

    if (uniqueBoons.length < 1) {
      // Log missing boon definitions so configuration issues are visible.
      console.warn(`[nocturne configurator] Fate cards present but no boons found for expansions ${expansionsWithFate.join(', ')}`);
      args.config.boons = [];
      return args.config;
    }

    // Seed the computed configuration with the selected boons.
    console.info(`[nocturne configurator] Fate cards present, seeding ${uniqueBoons.length} boons`);
    args.config.boons = structuredClone(uniqueBoons);
    return args.config;
  };
};

export default configurator;
