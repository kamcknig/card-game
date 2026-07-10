import {
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
  PlayerScoreDecoratorRegistrar,
} from '@server-types/index.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { registerNocturneBoonEffects } from './boon-effects-nocturne.ts';
import { configureWillOWisp } from './configure-will-o-wisp.ts';
import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { configureGhost } from './configure-ghost.ts';
import { configureImp } from './configure-imp.ts';
import { configureWish } from './configure-wish.ts';
import { registerStateEffects } from './state-effects-nocturne.ts';
import { configureBat } from './configure-bat.ts';
import { registerNocturneHexEffects } from './hex-effects-nocturne.ts';
import { getConfiguredCardPileLocation } from '../../utils/get-configured-card-pile-location.ts';
import { returnCardToConfiguredPileTop } from '../../utils/return-card-to-configured-pile-top.ts';

// Seeds boons when Fate cards are present in the selected kingdoms.
const configurator: ExpansionConfiguratorFactory = () => {
  // Track boon effect registration to avoid duplicates across configurator iterations.
  let boonEffectsRegistered = false;
  // Track hex effect registration to avoid duplicates across configurator iterations.
  let hexEffectsRegistered = false;
  // Track state effect registration to avoid duplicates across configurator iterations.
  let stateEffectsRegistered = false;

  return async args => {
    if (!boonEffectsRegistered) {
      // Register all Nocturne boon effects once per match.
      registerNocturneBoonEffects(args.expansionRegistration.registerBoonEffect);
      boonEffectsRegistered = true;
    }
    if (!stateEffectsRegistered) {
      // Register all state effects once per match.
      registerStateEffects(args.expansionRegistration.registerStateEffect);
      stateEffectsRegistered = true;
    }
    if (!hexEffectsRegistered) {
      // Register all Nocturne hex effects once per match.
      registerNocturneHexEffects(args.expansionRegistration.registerHexEffect);
      hexEffectsRegistered = true;
    }

    // Gather all selected kingdoms cards for boons and heirloom-linked piles.
    const kingdomCards = args.config.kingdomSupply.flatMap(supply => supply.cards);
    const hasCemetery = kingdomCards.some(card => getCardPileKey(card) === 'cemetery');
    const hasExorcist = kingdomCards.some(card => getCardPileKey(card) === 'exorcist');
    const hasFool = kingdomCards.some(card => getCardPileKey(card) === 'fool');
    const hasVampire = kingdomCards.some(card => getCardPileKey(card) === 'vampire');
    // Track which kingdoms cards require the Imp pile.
    const impSources = new Set(['devils-workshop', 'tormentor', 'exorcist']);
    const hasImpSource = kingdomCards.some(card => impSources.has(getCardPileKey(card)));
    const hasGhostSource = hasCemetery || hasExorcist;
    // Track which kingdoms cards require the Wish pile.
    const wishSources = new Set(['leprechaun', 'secret-cave']);
    const hasWishSource = kingdomCards.some(card => wishSources.has(getCardPileKey(card)));

    if (hasGhostSource) {
      configureGhost(args);
    } else if (args.config.nonSupply?.some(supply => supply.name === 'ghost')) {
      args.config.nonSupply = args.config.nonSupply.filter(supply => supply.name !== 'ghost');
    }

    // Ensure the Imp pile is present only when needed.
    if (hasImpSource) {
      configureImp(args);
    } else if (args.config.nonSupply?.some(supply => supply.name === 'imp')) {
      args.config.nonSupply = args.config.nonSupply.filter(supply => supply.name !== 'imp');
    }

    // Ensure the Wish pile is present only when needed.
    if (hasWishSource) {
      configureWish(args);
    } else if (args.config.nonSupply?.some(supply => supply.name === 'wish')) {
      args.config.nonSupply = args.config.nonSupply.filter(supply => supply.name !== 'wish');
    }

    // Ensure the Bat pile is present only when Vampire is in the kingdoms.
    if (hasVampire) {
      configureBat(args);
    } else if (args.config.nonSupply?.some(supply => supply.name === 'bat')) {
      args.config.nonSupply = args.config.nonSupply.filter(supply => supply.name !== 'bat');
    }

    // Fate cards determine whether boons are active for this match.
    const fateCards = kingdomCards.filter(card => card.type?.includes('FATE'));

    if (fateCards.length < 1) {
      // Clear out boons when the match does not contain any Fate cards.
      // Ensure boons are cleared when Fate cards are absent.
      args.config.boons = [];
    } else {
      // Limit boon selection to expansions that actually contributed Fate cards.
      const expansionsWithFate = Array.from(new Set(fateCards.map(card => card.expansionName)));

      // Pull boon definitions from the expansion library.
      const boons = expansionsWithFate.flatMap(expansionName =>
        Object.values(args.expansionCatalog[expansionName]?.boons ?? {}),
      );
      // De-duplicate boons across expansions by card key.
      const uniqueBoons = uniqueByProp(boons, 'cardKey');

      if (uniqueBoons.length < 1) {
        // Log missing boon definitions so configuration issues are visible.
        args.loggerService.warn(
          `[nocturne configurator] Fate cards present but no boons found for expansions ${expansionsWithFate.join(
            ', ',
          )}`,
        );
        args.config.boons = [];
      } else {
        // Ensure Will-o'-Wisp pile exists when boons are active.
        configureWillOWisp(args);

        // Seed the computed configuration with the selected boons.
        args.config.boons = structuredClone(uniqueBoons);
      }
    }

    // Ensure Will-o'-Wisp pile exists when Exorcist is present without other Fate cards.
    if (hasExorcist && fateCards.length < 1) {
      configureWillOWisp(args);
    }

    // Doom cards determine whether hexes are active for this match.
    const doomCards = kingdomCards.filter(card => card.type?.includes('DOOM'));

    if (doomCards.length < 1) {
      // Clear out hexes when the match does not contain any Doom cards.
      // Ensure hexes are cleared when Doom cards are absent.
      args.config.hexes = [];
    } else {
      // Limit hex selection to expansions that actually contributed Doom cards.
      const expansionsWithDoom = Array.from(new Set(doomCards.map(card => card.expansionName)));

      // Pull hex definitions from the expansion library.
      const hexes = expansionsWithDoom.flatMap(expansionName =>
        Object.values(args.expansionCatalog[expansionName]?.hexes ?? {}),
      );
      // De-duplicate hexes across expansions by card key.
      const uniqueHexes = uniqueByProp(hexes, 'cardKey');

      if (uniqueHexes.length < 1) {
        // Log missing hex definitions so configuration issues are visible.
        args.loggerService.warn(
          `[nocturne configurator] Doom cards present but no hexes found for expansions ${expansionsWithDoom.join(
            ', ',
          )}`,
        );
        args.config.hexes = [];
      } else {
        // Seed the computed configuration with the selected hexes.
        args.config.hexes = structuredClone(uniqueHexes);
      }
    }

    // Ensure Doom-linked states are present when hexes are active.
    const doomStateKeys = new Set(['deluded', 'envious', 'miserable', 'twice-miserable']);
    const existingStates = args.config.states ?? [];
    const nonDoomStates = existingStates.filter(state => !doomStateKeys.has(state.cardKey));
    const doomStates = Array.from(doomStateKeys).flatMap(stateKey => {
      const state = args.expansionCatalog['nocturne']?.states?.[stateKey];
      if (!state) {
        args.loggerService.warn(`[nocturne configurator] missing doom state ${stateKey}`);
        return [];
      }
      return structuredClone(state);
    });

    if (doomCards.length < 1) {
      args.config.states = nonDoomStates;
    } else {
      args.config.states = uniqueByProp([...nonDoomStates, ...doomStates], 'cardKey');
    }

    // Preserve any non-Nocturne states while toggling Lost in the Woods.
    const updatedStates = args.config.states ?? [];
    const filteredStates = updatedStates.filter(state => state.cardKey !== 'lost-in-the-woods');

    if (!hasFool) {
      args.config.states = filteredStates;
      return args.config;
    }

    const lostInTheWoods = args.expansionCatalog['nocturne']?.states?.['lost-in-the-woods'];
    if (!lostInTheWoods) {
      args.loggerService.warn('[nocturne configurator] Fool present but Lost in the Woods state not found');
      args.config.states = filteredStates;
      return args.config;
    }

    args.config.states = uniqueByProp([...filteredStates, structuredClone(lostInTheWoods)], 'cardKey');
    return args.config;
  };
};

export default configurator;

// Registers scoring adjustments for Nocturne states like Miserable.
export const registerScoringFunctions = (registrar: PlayerScoreDecoratorRegistrar) => {
  registrar((playerId, match) => {
    const stateIds = match.states?.byPlayer?.[playerId] ?? [];
    if (!stateIds.length) {
      return;
    }

    const states = match.states?.cards ?? [];
    const hasTwiceMiserable = states.some(state => state.cardKey === 'twice-miserable' && stateIds.includes(state.id));
    const hasMiserable = states.some(state => state.cardKey === 'miserable' && stateIds.includes(state.id));

    if (hasTwiceMiserable) {
      match.scores[playerId] = (match.scores[playerId] ?? 0) - 4;
      return;
    }

    if (hasMiserable) {
      match.scores[playerId] = (match.scores[playerId] ?? 0) - 2;
    }
  });
};

// Registers the Cemetery heirloom swap at game start when present in the kingdoms.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  const hasCemetery = config.kingdomSupply.some(supply =>
    supply.cards.some(card => getCardPileKey(card) === 'cemetery'),
  );
  const hasFool = config.kingdomSupply.some(supply => supply.cards.some(card => getCardPileKey(card) === 'fool'));
  const hasDruid = config.kingdomSupply.some(supply => supply.cards.some(card => getCardPileKey(card) === 'druid'));
  const hasPixie = config.kingdomSupply.some(supply => supply.cards.some(card => getCardPileKey(card) === 'pixie'));
  const hasPooka = config.kingdomSupply.some(supply => supply.cards.some(card => getCardPileKey(card) === 'pooka'));
  const hasSecretCave = config.kingdomSupply.some(supply =>
    supply.cards.some(card => getCardPileKey(card) === 'secret-cave'),
  );
  const hasShepherd = config.kingdomSupply.some(supply =>
    supply.cards.some(card => getCardPileKey(card) === 'shepherd'),
  );
  const hasTracker = config.kingdomSupply.some(supply => supply.cards.some(card => getCardPileKey(card) === 'tracker'));
  const hasNecromancer = config.kingdomSupply.some(supply =>
    supply.cards.some(card => getCardPileKey(card) === 'necromancer'),
  );
  if (hasCemetery) {
    registrar('onGameStartSetup', async args => {
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
          args.loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace`);
          continue;
        }

        // Choose a random Copper to swap so the heirloom position is uniformly random.
        const chosenIndex = copperIndices[args.rngService.nextIndex(copperIndices.length)];
        const copperId = deck[chosenIndex];

        await args.actionService.run('moveCard', {
          cardId: copperId,
          to: { location: 'basicSupply' },
        });

        // Create the Haunted Mirror and insert it in the same deck position.
        const hauntedMirror = args.cardInstanceFactoryService.createCard('haunted-mirror', {
          owner: player.id,
          partOfSupply: false,
        });
        hauntedMirror.facing = 'back';
        args.cardLibrary.addCard(hauntedMirror);
        deck.splice(chosenIndex, 0, hauntedMirror.id);
      }
    });
  }

  if (hasFool) {
    registrar('onGameStartSetup', async args => {
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
          args.loggerService.warn(
            `[nocturne onGameStart] player ${player.id} has no Copper to replace with Lucky Coin`,
          );
          continue;
        }

        // Choose a random Copper to swap so the heirloom position is uniformly random.
        const chosenIndex = copperIndices[args.rngService.nextIndex(copperIndices.length)];
        const copperId = deck[chosenIndex];

        await args.actionService.run('moveCard', {
          cardId: copperId,
          to: { location: 'basicSupply' },
        });

        // Create the Lucky Coin and insert it in the same deck position.
        const luckyCoin = args.cardInstanceFactoryService.createCard('lucky-coin', {
          owner: player.id,
          partOfSupply: false,
        });
        luckyCoin.facing = 'back';
        args.cardLibrary.addCard(luckyCoin);
        deck.splice(chosenIndex, 0, luckyCoin.id);
      }
    });
  }

  if (hasPixie) {
    registrar('onGameStartSetup', async args => {
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
          args.loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Goat`);
          continue;
        }

        // Choose a random Copper to swap so the heirloom position is uniformly random.
        const chosenIndex = copperIndices[args.rngService.nextIndex(copperIndices.length)];
        const copperId = deck[chosenIndex];

        await args.actionService.run('moveCard', {
          cardId: copperId,
          to: { location: 'basicSupply' },
        });

        // Create the Goat and insert it in the same deck position.
        const goat = args.cardInstanceFactoryService.createCard('goat', { owner: player.id, partOfSupply: false });
        goat.facing = 'back';
        args.cardLibrary.addCard(goat);
        deck.splice(chosenIndex, 0, goat.id);
      }
    });
  }

  if (hasPooka) {
    registrar('onGameStartSetup', async args => {
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
          args.loggerService.warn(
            `[nocturne onGameStart] player ${player.id} has no Copper to replace with Cursed Gold`,
          );
          continue;
        }

        // Choose a random Copper to swap so the heirloom position is uniformly random.
        const chosenIndex = copperIndices[args.rngService.nextIndex(copperIndices.length)];
        const copperId = deck[chosenIndex];

        await args.actionService.run('moveCard', {
          cardId: copperId,
          to: { location: 'basicSupply' },
        });

        // Create the Cursed Gold and insert it in the same deck position.
        const cursedGold = args.cardInstanceFactoryService.createCard('cursed-gold', {
          owner: player.id,
          partOfSupply: false,
        });
        cursedGold.facing = 'back';
        args.cardLibrary.addCard(cursedGold);
        deck.splice(chosenIndex, 0, cursedGold.id);
      }
    });
  }

  if (hasSecretCave) {
    registrar('onGameStartSetup', async args => {
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
          args.loggerService.warn(
            `[nocturne onGameStart] player ${player.id} has no Copper to replace with Magic Lamp`,
          );
          continue;
        }

        // Choose a random Copper to swap so the heirloom position is uniformly random.
        const chosenIndex = copperIndices[args.rngService.nextIndex(copperIndices.length)];
        const copperId = deck[chosenIndex];

        await args.actionService.run('moveCard', {
          cardId: copperId,
          to: { location: 'basicSupply' },
        });

        // Create the Magic Lamp and insert it in the same deck position.
        const magicLamp = args.cardInstanceFactoryService.createCard('magic-lamp', {
          owner: player.id,
          partOfSupply: false,
        });
        magicLamp.facing = 'back';
        args.cardLibrary.addCard(magicLamp);
        deck.splice(chosenIndex, 0, magicLamp.id);
      }
    });
  }

  if (hasShepherd) {
    registrar('onGameStartSetup', async args => {
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
          args.loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Pasture`);
          continue;
        }

        // Choose a random Copper to swap so the heirloom position is uniformly random.
        const chosenIndex = copperIndices[args.rngService.nextIndex(copperIndices.length)];
        const copperId = deck[chosenIndex];

        await args.actionService.run('moveCard', {
          cardId: copperId,
          to: { location: 'basicSupply' },
        });

        // Create the Pasture and insert it in the same deck position.
        const pasture = args.cardInstanceFactoryService.createCard('pasture', {
          owner: player.id,
          partOfSupply: false,
        });
        pasture.facing = 'back';
        args.cardLibrary.addCard(pasture);
        deck.splice(chosenIndex, 0, pasture.id);
      }
    });
  }

  if (hasTracker) {
    registrar('onGameStartSetup', async args => {
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
          args.loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Pouch`);
          continue;
        }

        // Choose a random Copper to swap so the heirloom position is uniformly random.
        const chosenIndex = copperIndices[args.rngService.nextIndex(copperIndices.length)];
        const copperId = deck[chosenIndex];

        await args.actionService.run('moveCard', {
          cardId: copperId,
          to: { location: 'basicSupply' },
        });

        // Create the Pouch and insert it in the same deck position.
        const pouch = args.cardInstanceFactoryService.createCard('pouch', { owner: player.id, partOfSupply: false });
        pouch.facing = 'back';
        args.cardLibrary.addCard(pouch);
        deck.splice(chosenIndex, 0, pouch.id);
      }
    });
  }

  if (hasDruid) {
    registrar('onGameStartSetup', async args => {
      if (!args.match.boons) {
        args.loggerService.warn('[nocturne onGameStart] no boons configured for Druid');
        return;
      }

      args.match.boons.setAside ??= [];

      if (args.match.boons.setAside.length > 0) {
        return;
      }

      const availableBoons = args.match.boons.deck.length;
      if (availableBoons < 1) {
        args.loggerService.warn('[nocturne onGameStart] boon deck empty, cannot set aside for Druid');
        return;
      }

      const setAsideCount = Math.min(3, availableBoons);
      for (let index = 0; index < setAsideCount; index++) {
        const boonId = args.match.boons.deck.pop();
        if (boonId === undefined) {
          args.loggerService.warn('[nocturne onGameStart] boon draw failed while setting aside for Druid');
          break;
        }
        args.match.boons.setAside.push(boonId);
      }
    });
  }

  if (hasNecromancer) {
    registrar('onGameStartSetup', async args => {
      // Create and place the three Zombies into the trash pile.
      const zombieKeys = ['zombie-apprentice', 'zombie-mason', 'zombie-spy'] as const;
      for (const zombieKey of zombieKeys) {
        const zombieCard = args.cardInstanceFactoryService.createCard(zombieKey, { partOfSupply: false });
        args.cardLibrary.addCard(zombieCard);
        await args.actionService.run('moveCard', {
          cardId: zombieCard.id,
          to: { location: 'trash' },
        });
        args.loggerService.debug(`[nocturne onGameStart] moved ${zombieCard} to trash`);
      }
    });
  }

  // Register Changeling exchange rules when Changeling is in the kingdoms supply.
  const hasChangeling = config.kingdomSupply.some(supply =>
    supply.cards.some(card => getCardPileKey(card) === 'changeling'),
  );

  if (!hasChangeling) {
    return;
  }

  registrar('onGameStartSetup', async args => {
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
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== player.id) {
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          // Exchange is allowed when the gained card can be returned to a configured pile.
          const returnLocation = getConfiguredCardPileLocation(conditionArgs.match, gainedCard);
          if (!returnLocation) {
            args.loggerService.debug('[changeling exchange condition] gained card has no configured pile in match');
            return false;
          }

          // Changeling exchange only applies to comparable treasure-cost cards costing at least $3.
          const { cost } = conditionArgs.cardPriceController.applyRules(gainedCard, {
            playerId: player.id,
          });

          const costComparison = compareCardCosts(cost, { treasure: 3 });
          if (costComparison < 0 || (cost.treasure ?? 0) < 3) {
            args.loggerService.debug('[changeling exchange condition] gained card costs less than $3');
            return false;
          }

          // Ensure there is at least one Changeling in the supply pile.
          const changelingCards = conditionArgs.findCardService.findCards({
            all: [{ location: 'kingdomSupply' }, { cardKeys: 'changeling' }],
          });

          if (!changelingCards.length) {
            args.loggerService.debug('[changeling exchange condition] no changelings in supply');
            return false;
          }

          args.loggerService.debug(
            `[changeling exchange condition] ${gainedCard} eligible for exchange via ${returnLocation.location}`,
          );
          return changelingCards.length > 0;
        },
        triggeredEffectFn: async triggeredArgs => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);

          // Offer the exchange decision to the gaining player.
          const shouldExchange = await triggeredArgs.promptService.confirm(
            {
              playerId: player.id,
              prompt: `Exchange ${gainedCard.cardName} for Changeling?`,
              actionButtons: [
                { label: 'CANCEL', action: 1 },
                { label: 'EXCHANGE', action: 2 },
              ],
            },
            2,
          );

          if (!shouldExchange) {
            args.loggerService.debug('[changeling exchange] player declined exchange');
            return;
          }

          // Confirm the gained card still exists in a source before moving it.
          try {
            triggeredArgs.cardSourceController.findCardSource(gainedCard.id);
          } catch (error) {
            args.loggerService.warn('[changeling exchange] gained card source not found, skipping exchange');
            return;
          }

          // Return the gained card to the top of its configured pile.
          const returnSucceeded = await returnCardToConfiguredPileTop({
            actionService: triggeredArgs.actionService,
            loggerService: triggeredArgs.loggerService,
            match: triggeredArgs.match,
            card: gainedCard,
            logTag: 'changeling exchange',
          });
          if (!returnSucceeded) {
            args.loggerService.warn(
              '[changeling exchange] gained card has no configured pile in match, skipping exchange',
            );
            return;
          }

          // Move the top Changeling to the player's discard (exchange is not a gain).
          const changelingCards = triggeredArgs.findCardService.findCards({
            all: [{ location: 'kingdomSupply' }, { cardKeys: 'changeling' }],
          });

          if (!changelingCards.length) {
            args.loggerService.warn('[changeling exchange] no changelings available to exchange');
            return;
          }

          const changelingCard = changelingCards.slice(-1)[0];
          args.loggerService.debug(`[changeling exchange] moving ${changelingCard} to discard`);
          await triggeredArgs.actionService.run('moveCard', {
            cardId: changelingCard.id,
            toPlayerId: player.id,
            to: { location: 'playerDiscard' },
          });
        },
      });
    }
  });
};
