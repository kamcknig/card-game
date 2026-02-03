import { expansionLibrary } from '../expansion-library.ts';
import { ExpansionConfiguratorFactory, GameEventRegistrar } from '../../types.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { registerNocturneBoonEffects } from './boon-effects-nocturne.ts';
import { configureWillOWisp } from './configure-will-o-wisp.ts';
import { ComputedMatchConfiguration } from 'shared/shared-types.ts';
import { compareCardCosts } from 'shared/compare-card-cost.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { createCard } from '../../utils/create-card.ts';
import { configureGhost } from './configure-ghost.ts';
import { configureImp } from './configure-imp.ts';

// Seeds boons when Fate cards are present in the selected kingdom.
const configurator: ExpansionConfiguratorFactory = () => {
  // Track boon effect registration to avoid duplicates across configurator iterations.
  let boonEffectsRegistered = false;

  return async (args) => {
    if (!boonEffectsRegistered) {
      // Register all Nocturne boon effects once per match.
      registerNocturneBoonEffects(args.boonEffectRegistrar);
      boonEffectsRegistered = true;
    }

    // Gather all selected kingdom cards for boons and heirloom-linked piles.
    const kingdomCards = args.config.kingdomSupply.flatMap(supply => supply.cards);
    const hasCemetery = kingdomCards.some(card => getCardPileKey(card) === 'cemetery');
    // Track which kingdom cards require the Imp pile.
    const impSources = new Set(['devils-workshop', 'tormentor', 'exorcist']);
    const hasImpSource = kingdomCards.some(card => impSources.has(getCardPileKey(card)));

    if (hasCemetery) {
      configureGhost(args);
    }
    else if (args.config.nonSupply?.some(supply => supply.name === 'ghost')) {
      console.info('[nocturne configurator] removing Ghost pile because Cemetery is absent');
      args.config.nonSupply = args.config.nonSupply.filter(supply => supply.name !== 'ghost');
    }

    // Ensure the Imp pile is present only when needed.
    if (hasImpSource) {
      configureImp(args);
    }
    else if (args.config.nonSupply?.some(supply => supply.name === 'imp')) {
      console.info('[nocturne configurator] removing Imp pile because no Imp gainers are present');
      args.config.nonSupply = args.config.nonSupply.filter(supply => supply.name !== 'imp');
    }

    // Fate cards determine whether boons are active for this match.
    const fateCards = kingdomCards.filter(card => card.type?.includes('FATE'));

    if (fateCards.length < 1) {
      // Clear out boons when the match does not contain any Fate cards.
      if ((args.config.boons ?? []).length > 0) {
        console.info('[nocturne configurator] clearing boons because no Fate cards are present');
      }
      // Ensure boons are cleared when Fate cards are absent.
      args.config.boons = [];
    }
    else {
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
      }
      else {
        // Ensure Will-o'-Wisp pile exists when boons are active.
        configureWillOWisp(args);

        // Seed the computed configuration with the selected boons.
        console.info(`[nocturne configurator] Fate cards present, seeding ${uniqueBoons.length} boons`);
        args.config.boons = structuredClone(uniqueBoons);
      }
    }

    // Doom cards determine whether hexes are active for this match.
    const doomCards = kingdomCards.filter(card => card.type?.includes('DOOM'));

    if (doomCards.length < 1) {
      // Clear out hexes when the match does not contain any Doom cards.
      if ((args.config.hexes ?? []).length > 0) {
        console.info('[nocturne configurator] clearing hexes because no Doom cards are present');
      }
      // Ensure hexes are cleared when Doom cards are absent.
      args.config.hexes = [];
      return args.config;
    }

    // Limit hex selection to expansions that actually contributed Doom cards.
    const expansionsWithDoom = Array.from(new Set(doomCards.map(card => card.expansionName)));

    // Pull hex definitions from the expansion library.
    const hexes = expansionsWithDoom.flatMap(expansionName =>
      Object.values(expansionLibrary[expansionName]?.hexes ?? {})
    );
    // De-duplicate hexes across expansions by card key.
    const uniqueHexes = uniqueByProp(hexes, 'cardKey');

    if (uniqueHexes.length < 1) {
      // Log missing hex definitions so configuration issues are visible.
      console.warn(`[nocturne configurator] Doom cards present but no hexes found for expansions ${expansionsWithDoom.join(', ')}`);
      args.config.hexes = [];
      return args.config;
    }

    // Seed the computed configuration with the selected hexes.
    console.info(`[nocturne configurator] Doom cards present, seeding ${uniqueHexes.length} hexes`);
    args.config.hexes = structuredClone(uniqueHexes);
    return args.config;
  };
};

export default configurator;

// Registers the Cemetery heirloom swap at game start when present in the kingdom.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (registrar, config) => {
  const hasCemetery = config.kingdomSupply.some(
    supply => supply.cards.some(card => getCardPileKey(card) === 'cemetery')
  );
  if (hasCemetery) {
    console.info('[nocturne configurator] setting up cemetery heirloom onGameStart handler');

    registrar('onGameStart', async (args) => {
      console.info('[nocturne onGameStart] replacing starting Copper with Haunted Mirror');

      for (const player of args.match.players) {
        // Locate all Copper cards in the player deck.
        const deck = args.cardSourceController.getSource('playerDeck', player.id);
        const copperIndices: number[] = [];

        for (let idx = 0; idx < deck.length; idx++) {
          const card = args.cardLibrary.getCard(deck[idx]);
          if (card.cardKey === 'copper') {
            copperIndices.push(idx);
          }
        }

        if (copperIndices.length < 1) {
          console.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace`);
          continue;
        }

        // Choose a random Copper to swap so the heirloom position is uniformly random.
        const chosenIndex = copperIndices[Math.floor(Math.random() * copperIndices.length)];
        const copperId = deck[chosenIndex];

        await args.runGameActionDelegate('moveCard', {
          cardId: copperId,
          to: { location: 'basicSupply' }
        });

        // Create the Haunted Mirror and insert it in the same deck position.
        const hauntedMirror = createCard('haunted-mirror', { owner: player.id, partOfSupply: false });
        hauntedMirror.facing = 'back';
        args.cardLibrary.addCard(hauntedMirror);
        deck.splice(chosenIndex, 0, hauntedMirror.id);

        console.info(`[nocturne onGameStart] player ${player.id} replaced Copper with Haunted Mirror`);
      }
    });
  }

  // Register Changeling exchange rules when Changeling is in the kingdom supply.
  const hasChangeling = config.kingdomSupply.some(
    supply => supply.cards.some(card => getCardPileKey(card) === 'changeling')
  );

  if (!hasChangeling) {
    return;
  }

  console.info('[nocturne configurator] setting up changeling exchange onGameStart handler');

  registrar('onGameStart', async (args) => {
    console.info('[nocturne onGameStart] registering changeling exchange reactions');

    for (const player of args.match.players) {
      // Listen for qualifying gains so the player can exchange for Changeling.
      args.reactionManager.registerReactionTemplate({
        id: `changeling:exchange:${player.id}`,
        listeningFor: 'cardGained',
        playerId: player.id,
        once: false,
        compulsory: false,
        allowMultipleInstances: true,
        system: true,
        condition: async (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== player.id) {
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);

          if (!gainedCard.partOfSupply) {
            console.debug('[changeling exchange condition] gained card is not part of supply');
            return false;
          }

          // Only allow exchanging when the gained card has a supply pile in the match.
          const pileKey = getCardPileKey(gainedCard);
          // Check match configuration to ensure the pile exists, regardless of where it was gained from.
          const inBasicSupply = conditionArgs.match.config.basicSupply.some(supply =>
            supply.cards.some(card => getCardPileKey(card) === pileKey)
          );
          const inKingdomSupply = conditionArgs.match.config.kingdomSupply.some(supply =>
            supply.cards.some(card => getCardPileKey(card) === pileKey)
          );

          if (!inBasicSupply && !inKingdomSupply) {
            console.debug('[changeling exchange condition] gained card has no supply pile in match');
            return false;
          }

          // Changeling exchange only applies to comparable treasure-cost cards costing at least $3.
          const { cost } = conditionArgs.cardPriceController.applyRules(gainedCard, {
            playerId: player.id,
          });

          const costComparison = compareCardCosts(cost, {treasure: 3});
          if (costComparison < 0 || (cost.treasure ?? 0) < 3) {
            console.debug('[changeling exchange condition] gained card costs less than $3');
            return false;
          }

          // Ensure there is at least one Changeling in the supply pile.
          const changelingCards = conditionArgs.findCards([
            { location: 'kingdomSupply' },
            { cardKeys: 'changeling' },
          ]);

          if (!changelingCards.length) {
            console.debug('[changeling exchange condition] no changelings in supply');
            return false;
          }

          console.debug(`[changeling exchange condition] ${gainedCard} eligible for exchange`);
          return changelingCards.length > 0;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          console.info(`[changeling exchange] prompting exchange for ${gainedCard}`);

          // Offer the exchange decision to the gaining player.
          const decision = await triggeredArgs.runGameActionDelegate('userPrompt', {
            playerId: player.id,
            prompt: `Exchange ${gainedCard.cardName} for Changeling?`,
            actionButtons: [
              { label: 'CANCEL', action: 1 },
              { label: 'EXCHANGE', action: 2 },
            ],
          }) as { action: number };

          if (decision.action === 1) {
            console.debug('[changeling exchange] player declined exchange');
            return;
          }

          // Confirm the gained card still exists in a source before moving it.
          try {
            triggeredArgs.cardSourceController.findCardSource(gainedCard.id);
          }
          catch (error) {
            console.warn('[changeling exchange] gained card source not found, skipping exchange');
            return;
          }

          const pileKey = getCardPileKey(gainedCard);
          // Resolve the pile location from the match configuration for the return.
          const inBasicSupply = triggeredArgs.match.config.basicSupply.some(supply =>
            supply.cards.some(card => getCardPileKey(card) === pileKey)
          );
          const inKingdomSupply = triggeredArgs.match.config.kingdomSupply.some(supply =>
            supply.cards.some(card => getCardPileKey(card) === pileKey)
          );

          if (!inBasicSupply && !inKingdomSupply) {
            console.warn('[changeling exchange] gained card has no supply pile in match, skipping exchange');
            return;
          }

          // Prefer basic supply if both are present (should not happen in normal setups).
          const returnLocation = inBasicSupply ? 'basicSupply' : 'kingdomSupply';

          // Return the gained card to its original supply pile.
          console.debug(`[changeling exchange] returning ${gainedCard} to supply`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: gainedCard.id,
            to: { location: returnLocation },
          });

          // Move the top Changeling to the player's discard (exchange is not a gain).
          const changelingCards = triggeredArgs.findCards([
            { location: 'kingdomSupply' },
            { cardKeys: 'changeling' },
          ]);

          if (!changelingCards.length) {
            console.warn('[changeling exchange] no changelings available to exchange');
            return;
          }

          const changelingCard = changelingCards.slice(-1)[0];
          console.debug(`[changeling exchange] moving ${changelingCard} to discard`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: changelingCard.id,
            toPlayerId: player.id,
            to: { location: 'playerDiscard' },
          });

          console.info(`[changeling exchange] exchanged ${gainedCard} for ${changelingCard}`);
        },
      });
    }
  });
};
