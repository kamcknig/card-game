import { loggerService } from '@logger';
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

// Seeds boons when Fate cards are present in the selected kingdom.
const configurator: ExpansionConfiguratorFactory = () => {
  // Track boon effect registration to avoid duplicates across configurator iterations.
  let boonEffectsRegistered = false;
  // Track hex effect registration to avoid duplicates across configurator iterations.
  let hexEffectsRegistered = false;
  // Track state effect registration to avoid duplicates across configurator iterations.
  let stateEffectsRegistered = false;

  return async (args) => {
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

    // Gather all selected kingdom cards for boons and heirloom-linked piles.
    const kingdomCards = args.config.kingdomSupply.flatMap((supply) => supply.cards);
    const hasCemetery = kingdomCards.some((card) => getCardPileKey(card) === 'cemetery');
    const hasExorcist = kingdomCards.some((card) => getCardPileKey(card) === 'exorcist');
    const hasFool = kingdomCards.some((card) => getCardPileKey(card) === 'fool');
    const hasVampire = kingdomCards.some((card) => getCardPileKey(card) === 'vampire');
    // Track which kingdom cards require the Imp pile.
    const impSources = new Set(['devils-workshop', 'tormentor', 'exorcist']);
    const hasImpSource = kingdomCards.some((card) => impSources.has(getCardPileKey(card)));
    const hasGhostSource = hasCemetery || hasExorcist;
    // Track which kingdom cards require the Wish pile.
    const wishSources = new Set(['leprechaun', 'secret-cave']);
    const hasWishSource = kingdomCards.some((card) => wishSources.has(getCardPileKey(card)));

    if (hasGhostSource) {
      configureGhost(args);
    } else if (args.config.nonSupply?.some((supply) => supply.name === 'ghost')) {
      loggerService.info('[nocturne configurator] removing Ghost pile because Cemetery/Exorcist are absent');
      args.config.nonSupply = args.config.nonSupply.filter((supply) => supply.name !== 'ghost');
    }

    // Ensure the Imp pile is present only when needed.
    if (hasImpSource) {
      configureImp(args);
    } else if (args.config.nonSupply?.some((supply) => supply.name === 'imp')) {
      loggerService.info('[nocturne configurator] removing Imp pile because no Imp gainers are present');
      args.config.nonSupply = args.config.nonSupply.filter((supply) => supply.name !== 'imp');
    }

    // Ensure the Wish pile is present only when needed.
    if (hasWishSource) {
      configureWish(args);
    } else if (args.config.nonSupply?.some((supply) => supply.name === 'wish')) {
      loggerService.info('[nocturne configurator] removing Wish pile because no Wish gainers are present');
      args.config.nonSupply = args.config.nonSupply.filter((supply) => supply.name !== 'wish');
    }

    // Ensure the Bat pile is present only when Vampire is in the kingdom.
    if (hasVampire) {
      configureBat(args);
    } else if (args.config.nonSupply?.some((supply) => supply.name === 'bat')) {
      loggerService.info('[nocturne configurator] removing Bat pile because Vampire is absent');
      args.config.nonSupply = args.config.nonSupply.filter((supply) => supply.name !== 'bat');
    }

    // Fate cards determine whether boons are active for this match.
    const fateCards = kingdomCards.filter((card) => card.type?.includes('FATE'));

    if (fateCards.length < 1) {
      // Clear out boons when the match does not contain any Fate cards.
      if ((args.config.boons ?? []).length > 0) {
        loggerService.info('[nocturne configurator] clearing boons because no Fate cards are present');
      }
      // Ensure boons are cleared when Fate cards are absent.
      args.config.boons = [];
    } else {
      // Limit boon selection to expansions that actually contributed Fate cards.
      const expansionsWithFate = Array.from(new Set(fateCards.map((card) => card.expansionName)));

      // Pull boon definitions from the expansion library.
      const boons = expansionsWithFate.flatMap((expansionName) =>
        Object.values(args.expansionCatalog[expansionName]?.boons ?? {})
      );
      // De-duplicate boons across expansions by card key.
      const uniqueBoons = uniqueByProp(boons, 'cardKey');

      if (uniqueBoons.length < 1) {
        // Log missing boon definitions so configuration issues are visible.
        loggerService.warn(
          `[nocturne configurator] Fate cards present but no boons found for expansions ${
            expansionsWithFate.join(', ')
          }`,
        );
        args.config.boons = [];
      } else {
        // Ensure Will-o'-Wisp pile exists when boons are active.
        configureWillOWisp(args);

        // Seed the computed configuration with the selected boons.
        loggerService.info(`[nocturne configurator] Fate cards present, seeding ${uniqueBoons.length} boons`);
        args.config.boons = structuredClone(uniqueBoons);
      }
    }

    // Ensure Will-o'-Wisp pile exists when Exorcist is present without other Fate cards.
    if (hasExorcist && fateCards.length < 1) {
      configureWillOWisp(args);
    }

    // Doom cards determine whether hexes are active for this match.
    const doomCards = kingdomCards.filter((card) => card.type?.includes('DOOM'));

    if (doomCards.length < 1) {
      // Clear out hexes when the match does not contain any Doom cards.
      if ((args.config.hexes ?? []).length > 0) {
        loggerService.info('[nocturne configurator] clearing hexes because no Doom cards are present');
      }
      // Ensure hexes are cleared when Doom cards are absent.
      args.config.hexes = [];
    } else {
      // Limit hex selection to expansions that actually contributed Doom cards.
      const expansionsWithDoom = Array.from(new Set(doomCards.map((card) => card.expansionName)));

      // Pull hex definitions from the expansion library.
      const hexes = expansionsWithDoom.flatMap((expansionName) =>
        Object.values(args.expansionCatalog[expansionName]?.hexes ?? {})
      );
      // De-duplicate hexes across expansions by card key.
      const uniqueHexes = uniqueByProp(hexes, 'cardKey');

      if (uniqueHexes.length < 1) {
        // Log missing hex definitions so configuration issues are visible.
        loggerService.warn(
          `[nocturne configurator] Doom cards present but no hexes found for expansions ${
            expansionsWithDoom.join(', ')
          }`,
        );
        args.config.hexes = [];
      } else {
        // Seed the computed configuration with the selected hexes.
        loggerService.info(`[nocturne configurator] Doom cards present, seeding ${uniqueHexes.length} hexes`);
        args.config.hexes = structuredClone(uniqueHexes);
      }
    }

    // Ensure Doom-linked states are present when hexes are active.
    const doomStateKeys = new Set(['deluded', 'envious', 'miserable', 'twice-miserable']);
    const existingStates = args.config.states ?? [];
    const nonDoomStates = existingStates.filter((state) => !doomStateKeys.has(state.cardKey));
    const doomStates = Array.from(doomStateKeys).flatMap((stateKey) => {
      const state = args.expansionCatalog['nocturne']?.states?.[stateKey];
      if (!state) {
        loggerService.warn(`[nocturne configurator] missing doom state ${stateKey}`);
        return [];
      }
      return structuredClone(state);
    });

    if (doomCards.length < 1) {
      if (existingStates.length !== nonDoomStates.length) {
        loggerService.info('[nocturne configurator] removing Doom states because no Doom cards are present');
      }
      args.config.states = nonDoomStates;
    } else {
      args.config.states = uniqueByProp([...nonDoomStates, ...doomStates], 'cardKey');
    }

    // Preserve any non-Nocturne states while toggling Lost in the Woods.
    const updatedStates = args.config.states ?? [];
    const filteredStates = updatedStates.filter((state) => state.cardKey !== 'lost-in-the-woods');

    if (!hasFool) {
      if (updatedStates.length !== filteredStates.length) {
        loggerService.info('[nocturne configurator] removing Lost in the Woods because Fool is absent');
      }
      args.config.states = filteredStates;
      return args.config;
    }

    const lostInTheWoods = args.expansionCatalog['nocturne']?.states?.['lost-in-the-woods'];
    if (!lostInTheWoods) {
      loggerService.warn('[nocturne configurator] Fool present but Lost in the Woods state not found');
      args.config.states = filteredStates;
      return args.config;
    }

    loggerService.info('[nocturne configurator] Fool present, ensuring Lost in the Woods state');
    args.config.states = uniqueByProp(
      [...filteredStates, structuredClone(lostInTheWoods)],
      'cardKey',
    );
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
    const hasTwiceMiserable = states.some((state) =>
      state.cardKey === 'twice-miserable' && stateIds.includes(state.id)
    );
    const hasMiserable = states.some((state) => state.cardKey === 'miserable' && stateIds.includes(state.id));

    if (hasTwiceMiserable) {
      match.scores[playerId] = (match.scores[playerId] ?? 0) - 4;
      return;
    }

    if (hasMiserable) {
      match.scores[playerId] = (match.scores[playerId] ?? 0) - 2;
    }
  });
};

// Registers the Cemetery heirloom swap at game start when present in the kingdom.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  const hasCemetery = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'cemetery'),
  );
  const hasFool = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'fool'),
  );
  const hasDruid = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'druid'),
  );
  const hasPixie = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'pixie'),
  );
  const hasPooka = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'pooka'),
  );
  const hasSecretCave = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'secret-cave'),
  );
  const hasShepherd = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'shepherd'),
  );
  const hasTracker = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'tracker'),
  );
  const hasNecromancer = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'necromancer'),
  );
  if (hasCemetery) {
    loggerService.info('[nocturne configurator] setting up cemetery heirloom onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] replacing starting Copper with Haunted Mirror');

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
          loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace`);
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
        const hauntedMirror = args.cardInstanceFactoryService.createCard('haunted-mirror', { owner: player.id, partOfSupply: false });
        hauntedMirror.facing = 'back';
        args.cardLibrary.addCard(hauntedMirror);
        deck.splice(chosenIndex, 0, hauntedMirror.id);

        loggerService.info(`[nocturne onGameStart] player ${player.id} replaced Copper with Haunted Mirror`);
      }
    });
  }

  if (hasFool) {
    loggerService.info('[nocturne configurator] setting up fool heirloom onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] replacing starting Copper with Lucky Coin');

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
          loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Lucky Coin`);
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
        const luckyCoin = args.cardInstanceFactoryService.createCard('lucky-coin', { owner: player.id, partOfSupply: false });
        luckyCoin.facing = 'back';
        args.cardLibrary.addCard(luckyCoin);
        deck.splice(chosenIndex, 0, luckyCoin.id);

        loggerService.info(`[nocturne onGameStart] player ${player.id} replaced Copper with Lucky Coin`);
      }
    });
  }

  if (hasPixie) {
    loggerService.info('[nocturne configurator] setting up pixie heirloom onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] replacing starting Copper with Goat');

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
          loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Goat`);
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

        loggerService.info(`[nocturne onGameStart] player ${player.id} replaced Copper with Goat`);
      }
    });
  }

  if (hasPooka) {
    loggerService.info('[nocturne configurator] setting up pooka heirloom onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] replacing starting Copper with Cursed Gold');

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
          loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Cursed Gold`);
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
        const cursedGold = args.cardInstanceFactoryService.createCard('cursed-gold', { owner: player.id, partOfSupply: false });
        cursedGold.facing = 'back';
        args.cardLibrary.addCard(cursedGold);
        deck.splice(chosenIndex, 0, cursedGold.id);

        loggerService.info(`[nocturne onGameStart] player ${player.id} replaced Copper with Cursed Gold`);
      }
    });
  }

  if (hasSecretCave) {
    loggerService.info('[nocturne configurator] setting up secret cave heirloom onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] replacing starting Copper with Magic Lamp');

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
          loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Magic Lamp`);
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
        const magicLamp = args.cardInstanceFactoryService.createCard('magic-lamp', { owner: player.id, partOfSupply: false });
        magicLamp.facing = 'back';
        args.cardLibrary.addCard(magicLamp);
        deck.splice(chosenIndex, 0, magicLamp.id);

        loggerService.info(`[nocturne onGameStart] player ${player.id} replaced Copper with Magic Lamp`);
      }
    });
  }

  if (hasShepherd) {
    loggerService.info('[nocturne configurator] setting up shepherd heirloom onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] replacing starting Copper with Pasture');

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
          loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Pasture`);
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
        const pasture = args.cardInstanceFactoryService.createCard('pasture', { owner: player.id, partOfSupply: false });
        pasture.facing = 'back';
        args.cardLibrary.addCard(pasture);
        deck.splice(chosenIndex, 0, pasture.id);

        loggerService.info(`[nocturne onGameStart] player ${player.id} replaced Copper with Pasture`);
      }
    });
  }

  if (hasTracker) {
    loggerService.info('[nocturne configurator] setting up tracker heirloom onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] replacing starting Copper with Pouch');

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
          loggerService.warn(`[nocturne onGameStart] player ${player.id} has no Copper to replace with Pouch`);
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

        loggerService.info(`[nocturne onGameStart] player ${player.id} replaced Copper with Pouch`);
      }
    });
  }

  if (hasDruid) {
    loggerService.info('[nocturne configurator] setting up druid boon set-aside onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] setting aside top 3 boons for Druid');

      if (!args.match.boons) {
        loggerService.warn('[nocturne onGameStart] no boons configured for Druid');
        return;
      }

      args.match.boons.setAside ??= [];

      if (args.match.boons.setAside.length > 0) {
        loggerService.info('[nocturne onGameStart] boons already set aside for Druid');
        return;
      }

      const availableBoons = args.match.boons.deck.length;
      if (availableBoons < 1) {
        loggerService.warn('[nocturne onGameStart] boon deck empty, cannot set aside for Druid');
        return;
      }

      const setAsideCount = Math.min(3, availableBoons);
      for (let index = 0; index < setAsideCount; index++) {
        const boonId = args.match.boons.deck.pop();
        if (boonId === undefined) {
          loggerService.warn('[nocturne onGameStart] boon draw failed while setting aside for Druid');
          break;
        }
        args.match.boons.setAside.push(boonId);
      }

      loggerService.info(`[nocturne onGameStart] set aside ${args.match.boons.setAside.length} boon(s) for Druid`);
    });
  }

  if (hasNecromancer) {
    loggerService.info('[nocturne configurator] setting up Necromancer zombies onGameStart handler');

    registrar('onGameStart', async (args) => {
      loggerService.info('[nocturne onGameStart] adding Zombies to the trash');

      // Create and place the three Zombies into the trash pile.
      const zombieKeys = ['zombie-apprentice', 'zombie-mason', 'zombie-spy'] as const;
      for (const zombieKey of zombieKeys) {
        const zombieCard = args.cardInstanceFactoryService.createCard(zombieKey, { partOfSupply: false });
        args.cardLibrary.addCard(zombieCard);
        await args.actionService.run('moveCard', {
          cardId: zombieCard.id,
          to: { location: 'trash' },
        });
        loggerService.debug(`[nocturne onGameStart] moved ${zombieCard} to trash`);
      }
    });
  }

  // Register Changeling exchange rules when Changeling is in the kingdom supply.
  const hasChangeling = config.kingdomSupply.some(
    (supply) => supply.cards.some((card) => getCardPileKey(card) === 'changeling'),
  );

  if (!hasChangeling) {
    return;
  }

  loggerService.info('[nocturne configurator] setting up changeling exchange onGameStart handler');

  registrar('onGameStart', async (args) => {
    loggerService.info('[nocturne onGameStart] registering changeling exchange reactions');

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
            loggerService.debug('[changeling exchange condition] gained card is not part of supply');
            return false;
          }

          // Only allow exchanging when the gained card has a supply pile in the match.
          const pileKey = getCardPileKey(gainedCard);
          // Check match configuration to ensure the pile exists, regardless of where it was gained from.
          const inBasicSupply = conditionArgs.match.config.basicSupply.some((supply) =>
            supply.cards.some((card) => getCardPileKey(card) === pileKey)
          );
          const inKingdomSupply = conditionArgs.match.config.kingdomSupply.some((supply) =>
            supply.cards.some((card) => getCardPileKey(card) === pileKey)
          );

          if (!inBasicSupply && !inKingdomSupply) {
            loggerService.debug('[changeling exchange condition] gained card has no supply pile in match');
            return false;
          }

          // Changeling exchange only applies to comparable treasure-cost cards costing at least $3.
          const { cost } = conditionArgs.cardPriceController.applyRules(gainedCard, {
            playerId: player.id,
          });

          const costComparison = compareCardCosts(cost, { treasure: 3 });
          if (costComparison < 0 || (cost.treasure ?? 0) < 3) {
            loggerService.debug('[changeling exchange condition] gained card costs less than $3');
            return false;
          }

          // Ensure there is at least one Changeling in the supply pile.
          const changelingCards = conditionArgs.findCardService.findCards([
            { location: 'kingdomSupply' },
            { cardKeys: 'changeling' },
          ]);

          if (!changelingCards.length) {
            loggerService.debug('[changeling exchange condition] no changelings in supply');
            return false;
          }

          loggerService.debug(`[changeling exchange condition] ${gainedCard} eligible for exchange`);
          return changelingCards.length > 0;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          loggerService.info(`[changeling exchange] prompting exchange for ${gainedCard}`);

          // Offer the exchange decision to the gaining player.
          const decision = await triggeredArgs.actionService.run('userPrompt', {
            playerId: player.id,
            prompt: `Exchange ${gainedCard.cardName} for Changeling?`,
            actionButtons: [
              { label: 'CANCEL', action: 1 },
              { label: 'EXCHANGE', action: 2 },
            ],
          }) as { action: number };

          if (decision.action === 1) {
            loggerService.debug('[changeling exchange] player declined exchange');
            return;
          }

          // Confirm the gained card still exists in a source before moving it.
          try {
            triggeredArgs.cardSourceController.findCardSource(gainedCard.id);
          } catch (error) {
            loggerService.warn('[changeling exchange] gained card source not found, skipping exchange');
            return;
          }

          const pileKey = getCardPileKey(gainedCard);
          // Resolve the pile location from the match configuration for the return.
          const inBasicSupply = triggeredArgs.match.config.basicSupply.some((supply) =>
            supply.cards.some((card) => getCardPileKey(card) === pileKey)
          );
          const inKingdomSupply = triggeredArgs.match.config.kingdomSupply.some((supply) =>
            supply.cards.some((card) => getCardPileKey(card) === pileKey)
          );

          if (!inBasicSupply && !inKingdomSupply) {
            loggerService.warn('[changeling exchange] gained card has no supply pile in match, skipping exchange');
            return;
          }

          // Prefer basic supply if both are present (should not happen in normal setups).
          const returnLocation = inBasicSupply ? 'basicSupply' : 'kingdomSupply';

          // Return the gained card to its original supply pile.
          loggerService.debug(`[changeling exchange] returning ${gainedCard} to supply`);
          await triggeredArgs.actionService.run('moveCard', {
            cardId: gainedCard.id,
            to: { location: returnLocation },
          });

          // Move the top Changeling to the player's discard (exchange is not a gain).
          const changelingCards = triggeredArgs.findCardService.findCards([
            { location: 'kingdomSupply' },
            { cardKeys: 'changeling' },
          ]);

          if (!changelingCards.length) {
            loggerService.warn('[changeling exchange] no changelings available to exchange');
            return;
          }

          const changelingCard = changelingCards.slice(-1)[0];
          loggerService.debug(`[changeling exchange] moving ${changelingCard} to discard`);
          await triggeredArgs.actionService.run('moveCard', {
            cardId: changelingCard.id,
            toPlayerId: player.id,
            to: { location: 'playerDiscard' },
          });

          loggerService.info(`[changeling exchange] exchanged ${gainedCard} for ${changelingCard}`);
        },
      });
    }
  });
};
