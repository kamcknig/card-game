import { expansionLibrary } from '../expansion-library.ts';
import { ExpansionConfiguratorFactory, GameEventRegistrar } from '../../types.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { registerNocturneBoonEffects } from './boon-effects-nocturne.ts';
import { configureWillOWisp } from './configure-will-o-wisp.ts';
import { ComputedMatchConfiguration } from 'shared/shared-types.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { createCard } from '../../utils/create-card.ts';
import { configureGhost } from './configure-ghost.ts';

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

    if (hasCemetery) {
      configureGhost(args);
    }
    else if (args.config.nonSupply?.some(supply => supply.name === 'ghost')) {
      console.info('[nocturne configurator] removing Ghost pile because Cemetery is absent');
      args.config.nonSupply = args.config.nonSupply.filter(supply => supply.name !== 'ghost');
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

    // Ensure Will-o'-Wisp pile exists when boons are active.
    configureWillOWisp(args);

    // Seed the computed configuration with the selected boons.
    console.info(`[nocturne configurator] Fate cards present, seeding ${uniqueBoons.length} boons`);
    args.config.boons = structuredClone(uniqueBoons);
    return args.config;
  };
};

export default configurator;

// Registers the Cemetery heirloom swap at game start when present in the kingdom.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (registrar, config) => {
  const hasCemetery = config.kingdomSupply.some(
    supply => supply.cards.some(card => getCardPileKey(card) === 'cemetery')
  );
  if (!hasCemetery) {
    return;
  }

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
};
