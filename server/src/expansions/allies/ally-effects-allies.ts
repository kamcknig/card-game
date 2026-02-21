import { GameLifecycleCallbackContext } from '@server-types/index.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import {
  Ally,
  Card,
  CardId,
  CardKey,
  ComputedMatchConfiguration,
  Match,
  PlayerId,
} from 'shared/types/index.ts';
import { discardDownTo } from '../../utils/discard-down-to.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { isCardStillAtGainedLocation } from '../../utils/is-card-still-at-gained-location.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { alliesTokenIds } from './token-ids-allies.ts';

// onGameStart callbacks receive the game-lifecycle context without a concrete card id.
type AlliesGameContext = Omit<GameLifecycleCallbackContext, 'cardId'>;

// Ally implementations intentionally deferred until missing engine capabilities are modeled.
export const skippedAllyImplementations: Array<{ cardKey: CardKey; reason: string }> = [
];

// Returns current Favor count for one player.
export const getPlayerFavorCount = (match: Match, playerId: PlayerId): number => {
  return Object.values(match.tokens ?? {})
    .filter((token) =>
      token.tokenId === alliesTokenIds.favor &&
      token.location.type === 'player' &&
      token.location.playerId === playerId
    )
    .reduce((total, token) => total + Math.max(1, token.counters ?? 1), 0);
};

// Spends Favor from a player if they have enough, returning whether the spend succeeded.
const spendFavor = async (
  args: {
    actionService: GameLifecycleCallbackContext['actionService'];
    loggerService: GameLifecycleCallbackContext['loggerService'];
    match: Match;
  },
  options: { playerId: PlayerId; count: number; logTag: string },
): Promise<boolean> => {
  const currentFavors = getPlayerFavorCount(args.match, options.playerId);
  if (currentFavors < options.count) {
    args.loggerService.debug(
      `[${options.logTag}] player ${options.playerId} has ${currentFavors} Favor, needs ${options.count}`,
    );
    return false;
  }

  await args.actionService.run('gainFavor', { playerId: options.playerId, count: -options.count });
  args.loggerService.debug(
    `[${options.logTag}] player ${options.playerId} spent ${options.count} Favor (${getPlayerFavorCount(args.match, options.playerId)} remaining)`,
  );
  return true;
};

// Prompts a player to optionally spend Favor for an Ally effect.
const promptSpendFavor = async (
  args: {
    promptService: GameLifecycleCallbackContext['promptService'];
    loggerService?: GameLifecycleCallbackContext['loggerService'];
  },
  options: { ally: Ally; playerId: PlayerId; prompt: string; logTag?: string },
): Promise<boolean> => {
  const shouldSpend = await args.promptService.confirm(
    {
      playerId: options.playerId,
      prompt: options.prompt,
      actionButtons: [
        { label: 'NO', action: 1 },
        { label: 'YES', action: 2 },
      ],
      content: {
        type: 'display-cards',
        cardLikeIds: [options.ally.id],
      },
    },
    2,
  );

  if (args.loggerService) {
    const tag = options.logTag ?? `${options.ally.cardKey} ally`;
    args.loggerService.debug(
      `[${tag}] player ${options.playerId} ${shouldSpend ? 'accepted' : 'declined'} Favor spend prompt`,
    );
  }

  return shouldSpend;
};

// Resolves one visible top card per Supply pile key.
const getTopSupplyCards = (
  args: {
    findCardService: GameLifecycleCallbackContext['findCardService'];
    match: Match;
  },
): Card[] => {
  const supplyPileKeys = new Set<CardKey>([
    ...(args.match.config.basicSupply ?? []).map((supply) => supply.name),
    ...(args.match.config.kingdomSupply ?? []).map((supply) => supply.name),
  ]);
  const topCards: Card[] = [];

  for (const pileKey of supplyPileKeys) {
    const topCard = args.findCardService.findTopSupplyCardForPileKey({ pileKey });
    if (!topCard) {
      continue;
    }
    topCards.push(topCard);
  }

  return topCards;
};

// Returns all non-Victory Supply pile keys from match configuration.
const getNonVictorySupplyPileKeys = (match: Match): CardKey[] => {
  const pileKeys = new Set<CardKey>();
  const allSupply = [...(match.config.basicSupply ?? []), ...(match.config.kingdomSupply ?? [])];

  for (const supply of allSupply) {
    const pileDefinitionCard = getPileDefinitionCard(supply.cards, supply.name);
    if (!pileDefinitionCard) {
      continue;
    }

    if (pileDefinitionCard.type.includes('VICTORY')) {
      continue;
    }

    pileKeys.add(supply.name);
  }

  return [...pileKeys];
};

// Returns the count of Family-of-Inventors Favor tokens on one pile.
const getFavorTokenCountOnPile = (match: Match, pileKey: CardKey): number => {
  const tokens = Object.values(match.tokens ?? {});
  let count = 0;

  for (const token of tokens) {
    if (token.tokenId !== alliesTokenIds.favor) {
      continue;
    }
    if (token.location.type !== 'supplyPile') {
      continue;
    }
    if (token.location.cardKey !== pileKey) {
      continue;
    }
    count += Math.max(1, token.counters ?? 1);
  }

  return count;
};

// Returns consecutive turns for one player at the end of turn history.
const getTrailingConsecutiveTurns = (match: Match, playerId: PlayerId): number => {
  const turns = match.stats?.turns ?? [];
  let count = 0;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.playerId !== playerId) {
      break;
    }
    count += 1;
  }

  return count;
};

// Returns true if adding an Island Folk turn would create a 3rd turn in a row.
const wouldCreateThirdTurnInRow = (match: Match, playerId: PlayerId): boolean => {
  const consecutiveTurns = getTrailingConsecutiveTurns(match, playerId);
  const queuedSamePlayerTurns = (match.extraTurnQueue ?? []).filter((turn) => turn.playerId === playerId).length;
  return consecutiveTurns + queuedSamePlayerTurns >= 2;
};

// Returns cards set aside by Coastal Haven for one player.
const getCoastalHavenSetAsideCards = (
  args: {
    cardSourceController: GameLifecycleCallbackContext['cardSourceController'];
    match: Match;
  },
  playerId: PlayerId,
  allyId: CardId,
): CardId[] => {
  let setAsideCards: CardId[] = [];
  try {
    setAsideCards = [...args.cardSourceController.getSource('set-aside', playerId)];
  } catch {
    return [];
  }

  return setAsideCards.filter((cardId) => {
    const source = args.match.setAsideSourceById?.[cardId];
    return source?.sourceKind === 'ally' && source.sourceCardLikeId === allyId;
  });
};

// Registers Architects' Guild trigger logic for all players.
const registerArchitectsGuild = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[architects-guild ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'cardGained', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }

        if (getPlayerFavorCount(conditionArgs.match, playerId) < 2) {
          return false;
        }

        const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
        const gainedCardCost = conditionArgs.cardPriceController.applyRules(gainedCard, { playerId }).cost;
        const hasCheaperNonVictorySupply = getTopSupplyCards(conditionArgs).some((candidateCard) => {
          if (candidateCard.type.includes('VICTORY')) {
            return false;
          }
          const candidateCost = conditionArgs.cardPriceController.applyRules(candidateCard, { playerId }).cost;
          return compareCardCosts(candidateCost, gainedCardCost) === -1;
        });

        return hasCheaperNonVictorySupply;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
        const gainedCardCost = triggeredArgs.cardPriceController.applyRules(gainedCard, { playerId }).cost;
        const eligibleCards = getTopSupplyCards(triggeredArgs).filter((candidateCard) => {
          if (candidateCard.type.includes('VICTORY')) {
            return false;
          }
          const candidateCost = triggeredArgs.cardPriceController.applyRules(candidateCard, { playerId }).cost;
          return compareCardCosts(candidateCost, gainedCardCost) === -1;
        });

        if (!eligibleCards.length) {
          triggeredArgs.loggerService.debug('[architects-guild ally] no eligible cheaper non-Victory Supply card');
          return;
        }

        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 2 Favor to gain a cheaper non-Victory card (Architects\' Guild)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, { playerId, count: 2, logTag: 'architects-guild ally' });
        if (!spent) {
          return;
        }

        const selectedCardId = await triggeredArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Gain a cheaper non-Victory card',
          restrict: eligibleCards.map((card) => card.id),
          count: 1,
        });
        if (!selectedCardId) {
          triggeredArgs.loggerService.warn('[architects-guild ally] no card selected after spending Favor');
          return;
        }

        await triggeredArgs.actionService.run('gainCard', {
          playerId,
          cardId: selectedCardId,
          to: { location: 'playerDiscard' },
        });
      },
    });
  }
};

// Registers Band of Nomads trigger logic for all players.
const registerBandOfNomads = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[band-of-nomads ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'cardGained', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }

        const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
        const gainedCardCost = conditionArgs.cardPriceController.applyRules(gainedCard, { playerId }).cost;
        return compareCardCosts(gainedCardCost, { treasure: 3 }) >= 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 1 Favor for +1 Card, +1 Action, or +1 Buy (Band of Nomads)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, { playerId, count: 1, logTag: 'band-of-nomads ally' });
        if (!spent) {
          return;
        }

        const action = await triggeredArgs.promptService.chooseOne({
          playerId,
          prompt: 'Choose Band of Nomads bonus',
          actionButtons: [
            { label: '+1 Card', action: 1 },
            { label: '+1 Action', action: 2 },
            { label: '+1 Buy', action: 3 },
          ],
          content: {
            type: 'display-cards',
            cardLikeIds: [ally.id],
          },
        });

        if (action === 1) {
          await triggeredArgs.actionService.run('drawCard', { playerId, count: 1 });
          triggeredArgs.loggerService.debug('[band-of-nomads ally] spent 1 Favor for +1 Card');
          return;
        }

        if (action === 2) {
          await triggeredArgs.actionService.run('gainAction', { count: 1 });
          triggeredArgs.loggerService.debug('[band-of-nomads ally] spent 1 Favor for +1 Action');
          return;
        }

        if (action === 3) {
          await triggeredArgs.actionService.run('gainBuy', { count: 1 });
          triggeredArgs.loggerService.debug('[band-of-nomads ally] spent 1 Favor for +1 Buy');
        }
      },
    });
  }
};

// Registers Cave Dwellers trigger logic for all players.
const registerCaveDwellers = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[cave-dwellers ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurn', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        return conditionArgs.trigger.args.playerId === playerId && getPlayerFavorCount(conditionArgs.match, playerId) > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        let hand = [...triggeredArgs.cardSourceController.getSource('playerHand', playerId)];
        while (getPlayerFavorCount(triggeredArgs.match, playerId) > 0 && hand.length > 0) {
          const spend = await promptSpendFavor(triggeredArgs, {
            ally,
            playerId,
            prompt: 'Spend 1 Favor to discard a card and draw a card (Cave Dwellers)?',
          });
          if (!spend) {
            return;
          }

          const spent = await spendFavor(triggeredArgs, { playerId, count: 1, logTag: 'cave-dwellers ally' });
          if (!spent) {
            return;
          }

          const discardedCardId = await triggeredArgs.actionService.run('selectSingleCard', {
            playerId,
            prompt: 'You may discard a card (Cave Dwellers)',
            restrict: hand
          });

          if (discardedCardId) {
            await triggeredArgs.actionService.run('discardCard', { playerId, cardId: discardedCardId });
          }

          await triggeredArgs.actionService.run('drawCard', { playerId, count: 1 });
          triggeredArgs.loggerService.debug('[cave-dwellers ally] spent 1 Favor to discard and draw');

          hand = [...triggeredArgs.cardSourceController.getSource('playerHand', playerId)];
        }
      },
    });
  }
};

// Registers Circle of Witches trigger logic for all players.
const registerCircleOfWitches = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[circle-of-witches ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'afterCardPlayed', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }

        if (getPlayerFavorCount(conditionArgs.match, playerId) < 3) {
          return false;
        }

        const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
        return playedCard.type.includes('LIAISON');
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 3 Favor to make each other player gain a Curse (Circle of Witches)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, { playerId, count: 3, logTag: 'circle-of-witches ally' });
        if (!spent) {
          return;
        }

        for (const targetPlayer of triggeredArgs.match.players) {
          if (targetPlayer.id === playerId) {
            continue;
          }

          await triggeredArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: targetPlayer.id,
            pileKey: 'curse',
            to: { location: 'playerDiscard' },
            logTag: 'circle-of-witches ally',
          });
        }

        triggeredArgs.loggerService.debug('[circle-of-witches ally] spent 3 Favor: each other player gains a Curse');
      },
    });
  }
};

// Registers City-state trigger logic for all players.
const registerCityState = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[city-state ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'cardGained', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }

        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }

        if (getPlayerFavorCount(conditionArgs.match, playerId) < 2) {
          return false;
        }

        const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
        if (!gainedCard.type.includes('ACTION')) {
          return false;
        }

        return isCardStillAtGainedLocation(
          conditionArgs.cardSourceController,
          gainedCard.id,
          conditionArgs.trigger.args.gainedLocation,
        );
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);

        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: `Spend 2 Favor to play ${gainedCard.cardName} (City-state)?`,
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, { playerId, count: 2, logTag: 'city-state ally' });
        if (!spent) {
          return;
        }

        await triggeredArgs.actionService.run('playCard', {
          playerId,
          cardId: gainedCard.id,
          overrides: {
            actionCost: 0,
          },
        });

        triggeredArgs.loggerService.debug('[city-state ally] spent 2 Favor to play a gained Action');
      },
    });
  }
};

// Registers Coastal Haven trigger logic for all players.
const registerCoastalHaven = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[coastal-haven ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurnPhase', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'cleanup') {
          return false;
        }
        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }

        const hand = conditionArgs.cardSourceController.getSource('playerHand', playerId);
        return hand.length > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const hand = [...triggeredArgs.cardSourceController.getSource('playerHand', playerId)];
        const maxKeep = Math.min(hand.length, getPlayerFavorCount(triggeredArgs.match, playerId));
        if (maxKeep < 1) {
          return;
        }

        const selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
          playerId,
          prompt: 'Choose cards to keep in hand for next turn (Coastal Haven)',
          restrict: hand,
          optional: true,
          count: { kind: 'upTo', count: maxKeep },
        });

        if (!selectedCardIds.length) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: selectedCardIds.length,
          logTag: 'coastal-haven ally',
        });
        if (!spent) {
          return;
        }

        for (const cardId of selectedCardIds) {
          await triggeredArgs.actionService.run('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: { location: 'set-aside' },
            setAsideSource: {
              ownerPlayerId: playerId,
              sourceKind: 'ally',
              sourceCardLikeId: ally.id,
              sourceCardKey: ally.cardKey,
              sourceLabel: ally.cardName,
            },
          });
        }

        triggeredArgs.loggerService.debug(
          `[coastal-haven ally] spent ${selectedCardIds.length} Favor to keep ${selectedCardIds.length} card(s)`,
        );
      },
    });

    args.reactionManager.registerReactionTemplate(ally, 'endTurn', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      autoResolve: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        return getCoastalHavenSetAsideCards(conditionArgs, playerId, ally.id).length > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        triggeredArgs.loggerService.debug(`[coastal-haven ally] returning set-aside cards for player ${playerId}`);
        const setAsideCards = getCoastalHavenSetAsideCards(triggeredArgs, playerId, ally.id);
        for (const cardId of setAsideCards) {
          await triggeredArgs.actionService.run('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: { location: 'playerHand' },
          });
        }

        if (setAsideCards.length > 0) {
          triggeredArgs.loggerService.debug(
            `[coastal-haven ally] returned ${setAsideCards.length} kept card(s) to hand`,
          );
        }
      },
    });
  }
};

// Registers Crafters' Guild trigger logic for all players.
const registerCraftersGuild = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[crafters-guild ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurn', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 2) {
          return false;
        }

        const gainableCards = getTopSupplyCards(conditionArgs).filter((card) => {
          const cost = conditionArgs.cardPriceController.applyRules(card, { playerId }).cost;
          return compareCardCosts(cost, { treasure: 4 }) <= 0;
        });

        return gainableCards.length > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const gainableCards = getTopSupplyCards(triggeredArgs).filter((card) => {
          const cost = triggeredArgs.cardPriceController.applyRules(card, { playerId }).cost;
          return compareCardCosts(cost, { treasure: 4 }) <= 0;
        });

        if (!gainableCards.length) {
          return;
        }

        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 2 Favor to gain a card costing up to $4 onto your deck (Crafters\' Guild)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, { playerId, count: 2, logTag: 'crafters-guild ally' });
        if (!spent) {
          return;
        }

        const selectedCardId = await triggeredArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Gain a card costing up to $4 onto your deck',
          restrict: gainableCards.map((card) => card.id),
        });
        if (!selectedCardId) {
          triggeredArgs.loggerService.warn('[crafters-guild ally] no card selected after spending Favor');
          return;
        }

        await triggeredArgs.actionService.run('gainCard', {
          playerId,
          cardId: selectedCardId,
          to: { location: 'playerDeck' },
        });

        triggeredArgs.loggerService.debug('[crafters-guild ally] spent 2 Favor to gain a card onto deck');
      },
    });
  }
};

// Registers Desert Guides trigger logic for all players.
const registerDesertGuides = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[desert-guides ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurn', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        return conditionArgs.trigger.args.playerId === playerId && getPlayerFavorCount(conditionArgs.match, playerId) > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        while (getPlayerFavorCount(triggeredArgs.match, playerId) > 0) {
          const spend = await promptSpendFavor(triggeredArgs, {
            ally,
            playerId,
            prompt: 'Spend 1 Favor to discard your hand and draw 5 cards (Desert Guides)?',
          });
          if (!spend) {
            return;
          }

          const spent = await spendFavor(triggeredArgs, { playerId, count: 1, logTag: 'desert-guides ally' });
          if (!spent) {
            return;
          }

          const hand = [...triggeredArgs.cardSourceController.getSource('playerHand', playerId)];
          for (const cardId of hand) {
            await triggeredArgs.actionService.run('discardCard', { playerId, cardId });
          }

          await triggeredArgs.actionService.run('drawHand', { playerId, count: 5 });
          triggeredArgs.loggerService.debug('[desert-guides ally] spent 1 Favor to replace hand');
        }
      },
    });
  }
};

// Registers Family of Inventors persistent pile cost rules.
const registerFamilyOfInventorsCostRules = (args: AlliesGameContext): void => {
  args.loggerService.info('[family-of-inventors ally] registering pile cost rules');
  const supplyCards = args.findCardService.findCards({ location: ['basicSupply', 'kingdomSupply'] });

  for (const card of supplyCards) {
    const pileKey = getCardPileKey(card);

    args.cardPriceController.registerRule(card, (ruleCard, ruleContext) => {
      const inBasicSupply = (ruleContext.match.cardSources.basicSupply ?? []).includes(ruleCard.id);
      const inKingdomSupply = (ruleContext.match.cardSources.kingdomSupply ?? []).includes(ruleCard.id);
      if (!inBasicSupply && !inKingdomSupply) {
        return { restricted: false, cost: { treasure: 0 } };
      }

      const tokenCount = getFavorTokenCountOnPile(ruleContext.match, pileKey);
      if (tokenCount < 1) {
        return { restricted: false, cost: { treasure: 0 } };
      }

      return {
        restricted: false,
        cost: { treasure: -tokenCount },
      };
    });
  }
};

// Registers Family of Inventors trigger logic for all players.
const registerFamilyOfInventors = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[family-of-inventors ally] registering reaction templates');
  registerFamilyOfInventorsCostRules(args);

  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurnPhase', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
          return false;
        }

        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }

        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }

        return getNonVictorySupplyPileKeys(conditionArgs.match).length > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const availablePileKeys = getNonVictorySupplyPileKeys(triggeredArgs.match);
        if (!availablePileKeys.length) {
          return;
        }

        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 1 Favor to place a Favor token on a non-Victory Supply pile (Family of Inventors)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: 1,
          logTag: 'family-of-inventors ally',
        });
        if (!spent) {
          return;
        }

        const selectedPileKeys = await triggeredArgs.promptService.requestResult<string[]>({
          playerId,
          prompt: 'Choose a non-Victory Supply pile',
          actionButtons: [{ label: 'DONE', action: 1 }],
          content: {
            type: 'select-pile',
            pileNames: availablePileKeys,
            selectCount: { kind: 'exact', count: 1 },
          },
        });

        const selectedPileKey = selectedPileKeys?.[0];
        if (!selectedPileKey) {
          triggeredArgs.loggerService.warn('[family-of-inventors ally] no pile selected after spending Favor');
          return;
        }

        await triggeredArgs.actionService.run('placeToken', {
          tokenId: alliesTokenIds.favor,
          ownerId: playerId,
          location: { type: 'supplyPile', cardKey: selectedPileKey },
        });

        triggeredArgs.loggerService.debug(`[family-of-inventors ally] spent 1 Favor to place token on ${selectedPileKey}`);
      },
    });
  }
};

// Registers Fellowship of Scribes trigger logic for all players.
const registerFellowshipOfScribes = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[fellowship-of-scribes ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'afterCardPlayed', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }

        const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
        if (!playedCard.type.includes('ACTION')) {
          return false;
        }

        const handSize = conditionArgs.cardSourceController.getSource('playerHand', playerId).length;
        if (handSize > 4) {
          return false;
        }

        return getPlayerFavorCount(conditionArgs.match, playerId) > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 1 Favor for +1 Card (Fellowship of Scribes)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: 1,
          logTag: 'fellowship-of-scribes ally',
        });
        if (!spent) {
          return;
        }

        await triggeredArgs.actionService.run('drawCard', { playerId, count: 1 });
        triggeredArgs.loggerService.debug('[fellowship-of-scribes ally] spent 1 Favor for +1 Card');
      },
    });
  }
};

// Registers Forest Dwellers trigger logic for all players.
const registerForestDwellers = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[forest-dwellers ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurn', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }

        const deck = conditionArgs.cardSourceController.getSource('playerDeck', playerId);
        const discard = conditionArgs.cardSourceController.getSource('playerDiscard', playerId);
        return deck.length + discard.length > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 1 Favor to look at top 3 cards of your deck (Forest Dwellers)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: 1,
          logTag: 'forest-dwellers ally',
        });
        if (!spent) {
          return;
        }

        const deck = triggeredArgs.cardSourceController.getSource('playerDeck', playerId);
        const discard = triggeredArgs.cardSourceController.getSource('playerDiscard', playerId);
        if (deck.length < 3 && discard.length > 0) {
          await triggeredArgs.actionService.run('shuffleDeck', { playerId });
        }

        const cardsToLookAt = [...triggeredArgs.cardSourceController.getSource('playerDeck', playerId).slice(-3)];
        if (!cardsToLookAt.length) {
          return;
        }

        const cardsToDiscard = await triggeredArgs.actionService.run('selectCard', {
          playerId,
          prompt: 'Discard any number of the looked-at cards (Forest Dwellers)',
          restrict: cardsToLookAt,
          optional: true,
          count: { kind: 'upTo', count: cardsToLookAt.length },
        });

        for (const cardId of cardsToDiscard) {
          await triggeredArgs.actionService.run('discardCard', {
            playerId,
            cardId,
          });
        }

        const cardsToRearrange = cardsToLookAt.filter((cardId) => !cardsToDiscard.includes(cardId));
        if (cardsToRearrange.length === 1) {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: cardsToRearrange[0],
            toPlayerId: playerId,
            to: { location: 'playerDeck' },
          });
        } else if (cardsToRearrange.length > 1) {
          const rearranged = await triggeredArgs.promptService.requestActionResult<CardId[]>({
            playerId,
            prompt: 'Put the rest back on top in any order',
            actionButtons: [{ label: 'DONE', action: 1 }],
            content: {
              type: 'rearrange',
              cardIds: cardsToRearrange,
            },
          });

          for (const cardId of rearranged?.result ?? []) {
            await triggeredArgs.actionService.run('moveCard', {
              cardId,
              toPlayerId: playerId,
              to: { location: 'playerDeck' },
            });
          }
        }

        triggeredArgs.loggerService.debug('[forest-dwellers ally] spent 1 Favor to filter top cards');
      },
    });
  }
};

// Registers Gang of Pickpockets trigger logic for all players.
const registerGangOfPickpockets = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[gang-of-pickpockets ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurn', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => conditionArgs.trigger.args.playerId === playerId,
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        if (getPlayerFavorCount(triggeredArgs.match, playerId) > 0) {
          const spend = await promptSpendFavor(triggeredArgs, {
            ally,
            playerId,
            prompt: 'Spend 1 Favor to avoid discarding down to 4 cards (Gang of Pickpockets)?',
          });

          if (spend) {
            const spent = await spendFavor(triggeredArgs, {
              playerId,
              count: 1,
              logTag: 'gang-of-pickpockets ally',
            });

            if (spent) {
              triggeredArgs.loggerService.debug('[gang-of-pickpockets ally] spent 1 Favor to avoid discarding');
              return;
            }
          }
        }

        await discardDownTo(triggeredArgs, {
          playerId,
          targetHandSize: 4,
          prompt: 'Discard down to 4 cards in hand',
          logTag: 'gang-of-pickpockets ally',
        });
      },
    });
  }
};

// Registers Island Folk trigger logic for all players.
const registerIslandFolk = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[island-folk ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'endTurn', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 5) {
          return false;
        }
        return !wouldCreateThirdTurnInRow(conditionArgs.match, playerId);
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        if (wouldCreateThirdTurnInRow(triggeredArgs.match, playerId)) {
          return;
        }

        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 5 Favor to take an extra turn (Island Folk)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: 5,
          logTag: 'island-folk ally',
        });
        if (!spent) {
          return;
        }

        await triggeredArgs.actionService.run('queueExtraTurn', {
          turn: {
            playerId,
            controllerId: playerId,
            sourceId: ally.id,
          },
        });

        triggeredArgs.loggerService.debug('[island-folk ally] spent 5 Favor for an extra turn');
      },
    });
  }
};

// Registers League of Bankers trigger logic for all players.
const registerLeagueOfBankers = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[league-of-bankers ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurnPhase', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }
        return getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'buy';
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const bonusTreasure = Math.floor(getPlayerFavorCount(triggeredArgs.match, playerId) / 4);
        if (bonusTreasure < 1) {
          triggeredArgs.loggerService.debug(`[league-of-bankers ally] player ${playerId} has no treasure bonus`);
          return;
        }

        await triggeredArgs.actionService.run('gainTreasure', { count: bonusTreasure });
        triggeredArgs.loggerService.debug(`[league-of-bankers ally] +$${bonusTreasure} from Favor`);
      },
    });
  }
};

// Registers League of Shopkeepers trigger logic for all players.
const registerLeagueOfShopkeepers = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[league-of-shopkeepers ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'afterCardPlayed', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }

        const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
        if (!playedCard.type.includes('LIAISON')) {
          return false;
        }

        return getPlayerFavorCount(conditionArgs.match, playerId) >= 5;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const favorCount = getPlayerFavorCount(triggeredArgs.match, playerId);
        if (favorCount < 5) {
          triggeredArgs.loggerService.debug(`[league-of-shopkeepers ally] player ${playerId} has insufficient Favor`);
          return;
        }

        await triggeredArgs.actionService.run('gainTreasure', { count: 1 });

        if (favorCount >= 10) {
          await triggeredArgs.actionService.run('gainAction', { count: 1 });
          await triggeredArgs.actionService.run('gainBuy', { count: 1 });
        }

        triggeredArgs.loggerService.debug(
          `[league-of-shopkeepers ally] ${favorCount >= 10 ? '+$1, +1 Action, +1 Buy' : '+$1'}`,
        );
      },
    });
  }
};

// Registers Market Towns trigger logic for all players.
const registerMarketTowns = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[market-towns ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurnPhase', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }
        if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
          return false;
        }

        const hand = conditionArgs.cardSourceController.getSource('playerHand', playerId);
        const hasActionInHand = hand.some((cardId) => conditionArgs.cardLibrary.getCard(cardId).type.includes('ACTION'));
        return hasActionInHand && getPlayerFavorCount(conditionArgs.match, playerId) > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        while (getPlayerFavorCount(triggeredArgs.match, playerId) > 0) {
          const actionCardsInHand = [...triggeredArgs.cardSourceController.getSource('playerHand', playerId)]
            .filter((cardId) => triggeredArgs.cardLibrary.getCard(cardId).type.includes('ACTION'));

          if (!actionCardsInHand.length) {
            return;
          }

          const spend = await promptSpendFavor(triggeredArgs, {
            ally,
            playerId,
            prompt: 'Spend 1 Favor to play an Action card from your hand (Market Towns)?',
          });
          if (!spend) {
            return;
          }

          const spent = await spendFavor(triggeredArgs, {
            playerId,
            count: 1,
            logTag: 'market-towns ally',
          });
          if (!spent) {
            return;
          }

          const selectedCardId = await triggeredArgs.actionService.run('selectSingleCard', {
            playerId,
            prompt: 'Play an Action card from your hand',
            restrict: actionCardsInHand,
            count: 1,
          });
          if (!selectedCardId) {
            triggeredArgs.loggerService.warn('[market-towns ally] no Action selected after spending Favor');
            return;
          }

          await triggeredArgs.actionService.run('playCard', {
            playerId,
            cardId: selectedCardId,
            overrides: {
              actionCost: 0,
            },
          });

          triggeredArgs.loggerService.debug('[market-towns ally] spent 1 Favor to play an Action in Buy phase');
        }
      },
    });
  }
};

// Registers Mountain Folk trigger logic for all players.
const registerMountainFolk = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[mountain-folk ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurn', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        return conditionArgs.trigger.args.playerId === playerId && getPlayerFavorCount(conditionArgs.match, playerId) >= 5;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 5 Favor for +3 Cards (Mountain Folk)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: 5,
          logTag: 'mountain-folk ally',
        });
        if (!spent) {
          return;
        }

        await triggeredArgs.actionService.run('drawCard', { playerId, count: 3 });
        triggeredArgs.loggerService.debug('[mountain-folk ally] spent 5 Favor for +3 Cards');
      },
    });
  }
};

// Registers Order of Astrologers trigger logic for all players.
const registerOrderOfAstrologers = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[order-of-astrologers ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'shuffle', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }
        return (conditionArgs.trigger.args.cardIds ?? []).length > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const availableCards = [...(triggeredArgs.trigger.args.cardIds ?? [])];
        if (!availableCards.length) {
          return;
        }

        const maxSelectable = Math.min(availableCards.length, getPlayerFavorCount(triggeredArgs.match, playerId));
        if (maxSelectable < 1) {
          return;
        }

        const selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
          playerId,
          prompt: `Choose up to ${maxSelectable} shuffled card(s) to put on top`,
          restrict: availableCards,
          optional: true,
          count: { kind: 'upTo', count: maxSelectable },
        });

        if (!selectedCardIds.length) {
          triggeredArgs.loggerService.debug('[order-of-astrologers ally] no cards selected to put on top');
          return;
        }

        let orderedCardIds = [...selectedCardIds];
        if (selectedCardIds.length > 1) {
          const rearranged = await triggeredArgs.promptService.requestActionResult<CardId[]>({
            playerId,
            prompt: 'Order selected cards to put on top',
            actionButtons: [{ label: 'DONE', action: 1 }],
            content: {
              type: 'rearrange',
              cardIds: selectedCardIds,
            },
          });

          if (rearranged?.result?.length === selectedCardIds.length) {
            orderedCardIds = [...rearranged.result];
          }
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: orderedCardIds.length,
          logTag: 'order-of-astrologers ally',
        });
        if (!spent) {
          return;
        }

        for (const selectedCardId of orderedCardIds) {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: selectedCardId,
            toPlayerId: playerId,
            to: { location: 'playerDeck' },
          });
        }

        triggeredArgs.loggerService.debug(
          `[order-of-astrologers ally] spent ${orderedCardIds.length} Favor to put ${orderedCardIds.length} card(s) on top`,
        );
      },
    });
  }
};

// Registers Order of Masons trigger logic for all players.
const registerOrderOfMasons = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[order-of-masons ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'shuffle', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }
        return (conditionArgs.trigger.args.cardIds ?? []).length > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const availableCards = [...(triggeredArgs.trigger.args.cardIds ?? [])];
        if (!availableCards.length) {
          return;
        }

        const maxSelectable = Math.min(availableCards.length, getPlayerFavorCount(triggeredArgs.match, playerId) * 2);
        if (maxSelectable < 1) {
          return;
        }

        const selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
          playerId,
          prompt: `Choose up to ${maxSelectable} shuffled card(s) to put into discard`,
          restrict: availableCards,
          optional: true,
          count: { kind: 'upTo', count: maxSelectable },
        });

        if (!selectedCardIds.length) {
          triggeredArgs.loggerService.debug('[order-of-masons ally] no cards selected to move into discard');
          return;
        }

        const favorToSpend = Math.ceil(selectedCardIds.length / 2);
        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: favorToSpend,
          logTag: 'order-of-masons ally',
        });
        if (!spent) {
          return;
        }

        for (const selectedCardId of selectedCardIds) {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: selectedCardId,
            toPlayerId: playerId,
            to: { location: 'playerDiscard' },
          });
        }

        triggeredArgs.loggerService.debug(
          `[order-of-masons ally] spent ${favorToSpend} Favor: moved ${selectedCardIds.length} card(s) to discard`,
        );
      },
    });
  }
};

// Registers Peaceful Cult trigger logic for all players.
const registerPeacefulCult = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[peaceful-cult ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurnPhase', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }
        if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }

        return conditionArgs.cardSourceController.getSource('playerHand', playerId).length > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const hand = [...triggeredArgs.cardSourceController.getSource('playerHand', playerId)];
        const maxTrashCount = Math.min(hand.length, getPlayerFavorCount(triggeredArgs.match, playerId));
        if (maxTrashCount < 1) {
          return;
        }

        const selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
          playerId,
          prompt: 'Choose cards to trash with Peaceful Cult',
          restrict: hand,
          optional: true,
          count: { kind: 'upTo', count: maxTrashCount },
        });

        if (!selectedCardIds.length) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: selectedCardIds.length,
          logTag: 'peaceful-cult ally',
        });
        if (!spent) {
          return;
        }

        for (const cardId of selectedCardIds) {
          await triggeredArgs.actionService.run('trashCard', {
            playerId,
            cardId,
          });
        }

        triggeredArgs.loggerService.debug(
          `[peaceful-cult ally] spent ${selectedCardIds.length} Favor to trash ${selectedCardIds.length} card(s)`,
        );
      },
    });
  }
};

// Registers Trappers' Lodge trigger logic for all players.
const registerTrappersLodge = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[trappers-lodge ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'cardGained', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }

        return isCardStillAtGainedLocation(
          conditionArgs.cardSourceController,
          conditionArgs.trigger.args.cardId,
          conditionArgs.trigger.args.gainedLocation,
        );
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const gainedCardId = triggeredArgs.trigger.args.cardId;

        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 1 Favor to put the gained card onto your deck (Trappers\' Lodge)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: 1,
          logTag: 'trappers-lodge ally',
        });
        if (!spent) {
          return;
        }

        await triggeredArgs.actionService.run('moveCard', {
          cardId: gainedCardId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });

        triggeredArgs.loggerService.debug('[trappers-lodge ally] spent 1 Favor to top-deck gained card');
      },
    });
  }
};

// Registers Woodworkers' Guild trigger logic for all players.
const registerWoodworkersGuild = (args: AlliesGameContext, ally: Ally): void => {
  args.loggerService.info('[woodworkers-guild ally] registering reaction templates');
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(ally, 'startTurnPhase', {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: true,
      condition: (conditionArgs) => {
        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }
        if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
          return false;
        }
        if (getPlayerFavorCount(conditionArgs.match, playerId) < 1) {
          return false;
        }

        const hand = conditionArgs.cardSourceController.getSource('playerHand', playerId);
        return hand.some((cardId) => conditionArgs.cardLibrary.getCard(cardId).type.includes('ACTION'));
      },
      triggeredEffectFn: async (triggeredArgs) => {
        triggeredArgs.loggerService.debug(`[${ally.cardKey} ally] resolving trigger for player ${playerId}`);
        const actionCardsInHand = [...triggeredArgs.cardSourceController.getSource('playerHand', playerId)]
          .filter((cardId) => triggeredArgs.cardLibrary.getCard(cardId).type.includes('ACTION'));
        if (!actionCardsInHand.length) {
          return;
        }

        const spend = await promptSpendFavor(triggeredArgs, {
          ally,
          playerId,
          prompt: 'Spend 1 Favor to trash an Action card from hand (Woodworkers\' Guild)?',
        });
        if (!spend) {
          return;
        }

        const spent = await spendFavor(triggeredArgs, {
          playerId,
          count: 1,
          logTag: 'woodworkers-guild ally',
        });
        if (!spent) {
          return;
        }

        const trashedActionId = await triggeredArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Choose an Action card to trash',
          restrict: actionCardsInHand,
          count: 1,
        });
        if (!trashedActionId) {
          triggeredArgs.loggerService.warn('[woodworkers-guild ally] no Action selected to trash after spending Favor');
          return;
        }

        await triggeredArgs.actionService.run('trashCard', {
          playerId,
          cardId: trashedActionId,
        });

        const gainableActionCards = getTopSupplyCards(triggeredArgs)
          .filter((card) => card.type.includes('ACTION'));
        if (!gainableActionCards.length) {
          return;
        }

        const selectedGainId = await triggeredArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Gain an Action card',
          restrict: gainableActionCards.map((card) => card.id),
          count: 1,
        });
        if (!selectedGainId) {
          triggeredArgs.loggerService.warn('[woodworkers-guild ally] no Action selected to gain');
          return;
        }

        await triggeredArgs.actionService.run('gainCard', {
          playerId,
          cardId: selectedGainId,
          to: { location: 'playerDiscard' },
        });

        triggeredArgs.loggerService.debug('[woodworkers-guild ally] spent 1 Favor to trash an Action and gain an Action');
      },
    });
  }
};

// Registers all ally effects for the active ally in the match.
export const registerActiveAllyEffects = (
  args: AlliesGameContext,
  config: ComputedMatchConfiguration,
): void => {
  const ally = args.match.allies?.[0];
  if (!ally) {
    args.loggerService.info('[allies effects] no active ally in match state; skipping ally effect registration');
    return;
  }

  const configuredAllyKey = config.allies?.[0]?.cardKey;
  if (configuredAllyKey && configuredAllyKey !== ally.cardKey) {
    args.loggerService.warn(
      `[allies effects] config ally ${configuredAllyKey} differs from match ally ${ally.cardKey}; using match ally`,
    );
  }

  const skipped = skippedAllyImplementations.find((entry) => entry.cardKey === ally.cardKey);
  if (skipped) {
    args.loggerService.warn(`[allies effects] skipping ${ally.cardKey}: ${skipped.reason}`);
    return;
  }

  args.loggerService.info(`[allies effects] registering effects for ally ${ally.cardKey}`);

  switch (ally.cardKey) {
    case 'architects-guild':
      registerArchitectsGuild(args, ally);
      return;
    case 'band-of-nomads':
      registerBandOfNomads(args, ally);
      return;
    case 'cave-dwellers':
      registerCaveDwellers(args, ally);
      return;
    case 'circle-of-witches':
      registerCircleOfWitches(args, ally);
      return;
    case 'city-state':
      registerCityState(args, ally);
      return;
    case 'coastal-haven':
      registerCoastalHaven(args, ally);
      return;
    case 'crafters-guild':
      registerCraftersGuild(args, ally);
      return;
    case 'desert-guides':
      registerDesertGuides(args, ally);
      return;
    case 'family-of-inventors':
      registerFamilyOfInventors(args, ally);
      return;
    case 'fellowship-of-scribes':
      registerFellowshipOfScribes(args, ally);
      return;
    case 'forest-dwellers':
      registerForestDwellers(args, ally);
      return;
    case 'gang-of-pickpockets':
      registerGangOfPickpockets(args, ally);
      return;
    case 'island-folk':
      registerIslandFolk(args, ally);
      return;
    case 'league-of-bankers':
      registerLeagueOfBankers(args, ally);
      return;
    case 'league-of-shopkeepers':
      registerLeagueOfShopkeepers(args, ally);
      return;
    case 'market-towns':
      registerMarketTowns(args, ally);
      return;
    case 'mountain-folk':
      registerMountainFolk(args, ally);
      return;
    case 'order-of-astrologers':
      registerOrderOfAstrologers(args, ally);
      return;
    case 'order-of-masons':
      registerOrderOfMasons(args, ally);
      return;
    case 'peaceful-cult':
      registerPeacefulCult(args, ally);
      return;
    case 'plateau-shepherds':
      args.loggerService.debug('[plateau-shepherds ally] no runtime reactions to register');
      return;
    case 'trappers-lodge':
      registerTrappersLodge(args, ally);
      return;
    case 'woodworkers-guild':
      registerWoodworkersGuild(args, ally);
      return;
    default:
      args.loggerService.warn(`[allies effects] no implementation mapped for ally ${ally.cardKey}`);
      return;
  }
};
