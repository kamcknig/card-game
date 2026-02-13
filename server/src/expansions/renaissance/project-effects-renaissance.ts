import { CardExpansionModule } from '@server-types/index.ts';
import { Card, CardId, Match, PlayerId, Project } from 'shared/types/index.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';

// Checks whether a player has a cube placed on the given project.
function isProjectOwned(match: Match, playerId: PlayerId, project: Project) {
  return Object.values(match.tokens ?? {}).some((token) =>
    token.tokenId === 'cube-token' &&
    token.ownerId === playerId &&
    token.location.type === 'cardLike' &&
    token.location.cardLikeId === project.id
  );
}

// Runtime metadata used by Capitalism to cache qualification and track temporary type changes.
type CapitalismCardMetadata = {
  capitalism?: {
    hasPlusCoinAmountInText?: boolean;
    treasureTypeAddedForPlayerId?: PlayerId;
    treasureTypeAddedForTurnNumber?: number;
  };
};

// Matches printed +$ amounts (e.g., "+$1", "+$X") for Capitalism qualification checks.
const PLUS_DOLLAR_AMOUNT_PATTERN = /\+\$[0-9Xx*]+/;

// Returns true when the card text has a printed +$ amount using either supported text style.
const hasPrintedPlusCoinAmount = (abilityText: string) => PLUS_DOLLAR_AMOUNT_PATTERN.test(abilityText);

// Returns the Capitalism metadata bucket for the given card, creating it when absent.
const getCapitalismMetadata = (card: Card<CapitalismCardMetadata>) => {
  card.metadata.capitalism ??= {};
  return card.metadata.capitalism;
};

// Returns true when it is currently the specified player's turn.
const isCurrentTurnPlayer = (match: Match, playerId: PlayerId) => {
  const currentPlayer = match.players[match.currentPlayerTurnIndex];
  return currentPlayer?.id === playerId;
};

// Evaluates and caches whether a card has printed +$ text for Capitalism.
const isCapitalismTextQualified = (card: Card<CapitalismCardMetadata>) => {
  const metadata = getCapitalismMetadata(card);

  if (metadata.hasPlusCoinAmountInText === undefined) {
    metadata.hasPlusCoinAmountInText = hasPrintedPlusCoinAmount(card.abilityText ?? '');
    // Cache decisions once to avoid repeated regex work each turn.
    console.debug(`[capitalism project] cached +$ text qualification for ${card}: ${metadata.hasPlusCoinAmountInText}`);
  }

  return metadata.hasPlusCoinAmountInText;
};

// Applies Capitalism's temporary Treasure type to all qualifying Action cards in the match library.
const applyCapitalismTreasureTypes = (match: Match, cardLibrary: {
  getAllCardsAsArray: () => Card[];
  getCard: <M = unknown>(cardId: number) => Card<M>;
}, playerId: PlayerId) => {
  let addedCount = 0;
  // Iterate in id order to keep deterministic type mutation/log order.
  const cards = cardLibrary.getAllCardsAsArray()
    .map((card) => cardLibrary.getCard<CapitalismCardMetadata>(card.id))
    .sort((a, b) => a.id - b.id);

  for (const card of cards) {
    if (!card.type.includes('ACTION')) {
      continue;
    }

    if (!isCapitalismTextQualified(card)) {
      continue;
    }

    if (card.type.includes('TREASURE')) {
      continue;
    }

    card.type.push('TREASURE');
    const metadata = getCapitalismMetadata(card);
    metadata.treasureTypeAddedForPlayerId = playerId;
    metadata.treasureTypeAddedForTurnNumber = match.turnNumber;
    addedCount++;
  }

  return addedCount;
};

// Removes only the Treasure types that were temporarily added by Capitalism for the specified player.
function clearCapitalismTreasureTypes(cardLibrary: {
  getAllCardsAsArray: () => Card[];
  getCard: <M = unknown>(cardId: number) => Card<M>;
}, playerId: PlayerId) {
  let removedCount = 0;
  // Iterate in id order to keep deterministic cleanup order.
  const cards = cardLibrary.getAllCardsAsArray()
    .map((card) => cardLibrary.getCard<CapitalismCardMetadata>(card.id))
    .sort((a, b) => a.id - b.id);

  for (const card of cards) {
    const metadata = getCapitalismMetadata(card);
    if (metadata.treasureTypeAddedForPlayerId !== playerId) {
      continue;
    }

    const treasureTypeIndex = card.type.indexOf('TREASURE');
    if (treasureTypeIndex !== -1) {
      card.type.splice(treasureTypeIndex, 1);
      removedCount++;
    }

    delete metadata.treasureTypeAddedForPlayerId;
    delete metadata.treasureTypeAddedForTurnNumber;
  }

  return removedCount;
}

const effectMap: CardExpansionModule = {
  'academy': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[academy project] project card not found');
        return;
      }

      console.info(`[academy project] registering gain trigger for player ${cardEffectArgs.playerId}`);
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const projectOwned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);

          if (!projectOwned) {
            // Log ownership failures to help trace missing cube issues.
            console.debug(
              `[academy project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          // Log the gained card check for action filtering.
          console.debug(`[academy project] evaluating gained card ${gainedCard}`);
          return gainedCard.type.includes('ACTION');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          // Log the Villager grant before applying it.
          console.debug(
            `[academy project] granting +1 Villager to player ${cardEffectArgs.playerId} on turn ${triggeredArgs.match.turnNumber}`,
          );
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Villager',
          });

          await triggeredArgs.runGameActionDelegate('gainVillager', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'barracks': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[barracks project] project card not found');
        return;
      }

      console.info(`[barracks project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          // Log ownership checks to aid debugging missing cubes.
          if (!owned) {
            console.debug(
              `[barracks project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          // Log the timing for the Barracks bonus.
          console.debug(
            `[barracks project] granting +1 Action to player ${cardEffectArgs.playerId} on turn ${triggeredArgs.match.turnNumber}`,
          );
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Action',
          });

          await triggeredArgs.runGameActionDelegate('gainAction', { count: 1 });
        },
      });
    },
  },
  'canal': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[canal project] project card not found');
        return;
      }

      console.info(`[canal project] registering cost rules for player ${cardEffectArgs.playerId}`);

      let ruleUnsubs: (() => void)[] = [];

      // Apply the per-card cost rules for this player's turn.
      const registerRules = () => {
        if (ruleUnsubs.length > 0) {
          ruleUnsubs.forEach((unsub) => unsub());
          ruleUnsubs = [];
        }

        const allCards = cardEffectArgs.cardLibrary.getAllCardsAsArray();
        // Log the rule registration count once per start-of-turn.
        console.debug(`[canal project] registering cost rules for ${allCards.length} cards`);

        for (const card of allCards) {
          const unsub = cardEffectArgs.cardPriceController.registerRule(card, (_targetCard, context) => {
            if (context.playerId !== cardEffectArgs.playerId) {
              return { restricted: false, cost: { treasure: 0 } };
            }

            const currentPlayer = context.match.players[context.match.currentPlayerTurnIndex];
            if (currentPlayer?.id !== cardEffectArgs.playerId) {
              return { restricted: false, cost: { treasure: 0 } };
            }

            const projectOwned = isProjectOwned(context.match, cardEffectArgs.playerId, project);

            if (!projectOwned) {
              return { restricted: false, cost: { treasure: 0 } };
            }

            return { restricted: false, cost: { treasure: -1 } };
          });

          ruleUnsubs.push(unsub);
        }
      };

      // Remove all cost rule subscriptions after the turn ends.
      const clearRules = () => {
        if (!ruleUnsubs.length) return;
        console.debug(`[canal project] clearing ${ruleUnsubs.length} cost rules`);
        ruleUnsubs.forEach((unsub) => unsub());
        ruleUnsubs = [];
      };

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          // Log ownership failures to avoid silent skips.
          if (!owned) {
            console.debug(
              `[canal project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async () => {
          console.debug(`[canal project] applying cost reduction for player ${cardEffectArgs.playerId}`);
          registerRules();
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async () => {
          console.debug(`[canal project] removing cost reduction for player ${cardEffectArgs.playerId}`);
          clearRules();
        },
      });
    },
  },
  'capitalism': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[capitalism project] project card not found');
        return;
      }

      console.info(
        `[capitalism project] registering turn type mutation triggers for player ${cardEffectArgs.playerId}`,
      );

      // Apply Capitalism at the start of each owned turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        autoResolve: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[capitalism project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const addedCount = applyCapitalismTreasureTypes(
            triggeredArgs.match,
            triggeredArgs.cardLibrary,
            cardEffectArgs.playerId,
          );
          console.debug(
            `[capitalism project] added TREASURE type to ${addedCount} card(s) for player ${cardEffectArgs.playerId} on turn ${triggeredArgs.match.turnNumber}`,
          );
        },
      });

      // Remove Capitalism's temporary Treasure types at end of the owner's turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        autoResolve: true,
        condition: (conditionArgs) => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          const removedCount = clearCapitalismTreasureTypes(triggeredArgs.cardLibrary, cardEffectArgs.playerId);
          console.debug(
            `[capitalism project] removed TREASURE type from ${removedCount} card(s) for player ${cardEffectArgs.playerId} on turn ${triggeredArgs.match.turnNumber}`,
          );
        },
      });

      // Buying Capitalism mid-turn should apply immediately for the rest of that turn.
      if (!isCurrentTurnPlayer(cardEffectArgs.match, cardEffectArgs.playerId)) {
        return;
      }

      if (!isProjectOwned(cardEffectArgs.match, cardEffectArgs.playerId, project)) {
        console.debug(
          `[capitalism project] player ${cardEffectArgs.playerId} does not own cube yet for immediate apply`,
        );
        return;
      }

      const addedCount = applyCapitalismTreasureTypes(
        cardEffectArgs.match,
        cardEffectArgs.cardLibrary,
        cardEffectArgs.playerId,
      );
      console.debug(
        `[capitalism project] immediate apply added TREASURE type to ${addedCount} card(s) for player ${cardEffectArgs.playerId} on turn ${cardEffectArgs.match.turnNumber}`,
      );
    },
  },
  'cathedral': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[cathedral project] project card not found');
        return;
      }

      console.info(`[cathedral project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      // Cathedral forces a trash at the start of each of the owner's turns.
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          // Log missing cube ownership for Cathedral.
          if (!owned) {
            console.debug(
              `[cathedral project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            console.debug('[cathedral project] no cards in hand to trash');
            return;
          }

          // Log the mandatory trash prompt for tracing turn start effects.
          console.debug(
            `[cathedral project] prompting player ${cardEffectArgs.playerId} to trash from ${hand.length} card(s)`,
          );
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Trash a card',
          });

          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Trash a card',
            restrict: hand,
            count: 1,
          }) as CardId[];

          if (!selectedCardIds.length) {
            console.warn('[cathedral project] no card selected to trash');
            return;
          }

          // Log the selected card id before trashing.
          console.debug(`[cathedral project] trashing ${selectedCardIds[0]}`);
          await triggeredArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardIds[0],
          });
        },
      });
    },
  },
  'citadel': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[citadel project] project card not found');
        return;
      }

      console.info(`[citadel project] registering replay trigger for player ${cardEffectArgs.playerId}`);

      // Citadel replays the first Action card played each turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'afterCardPlayed', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const currentPlayer = conditionArgs.match.players[conditionArgs.match.currentPlayerTurnIndex];
          if (currentPlayer?.id !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[citadel project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
            return false;
          }

          const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (!playedCard.type.includes('ACTION')) {
            // Log non-action plays that skip Citadel.
            console.debug(`[citadel project] skipping non-action ${playedCard}`);
            return false;
          }

          const turnNumber = conditionArgs.match.turnNumber;
          const playedThisTurn = conditionArgs.match.stats.playedCardsByTurn[turnNumber] ?? [];
          const actionPlaysThisTurn = playedThisTurn.filter((cardId) => {
            const playStats = conditionArgs.match.stats.playedCards[cardId];
            if (playStats?.playerId !== cardEffectArgs.playerId) {
              return false;
            }
            const card = conditionArgs.cardLibrary.getCard(cardId);
            return card.type.includes('ACTION');
          });
          const isFirstAction = actionPlaysThisTurn.length === 1;
          if (!isFirstAction) {
            console.debug(
              `[citadel project] action count for player ${cardEffectArgs.playerId} this turn is ${actionPlaysThisTurn.length}`,
            );
          }
          return isFirstAction;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const replayCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          // Log the replay before executing it.
          console.debug(`[citadel project] replaying ${replayCard}`);
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Replay Action',
          });

          await triggeredArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: replayCard.id,
            overrides: {
              actionCost: 0,
              moveCard: false,
            },
          });
        },
      });
    },
  },
  'city-gate': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[city-gate project] project card not found');
        return;
      }

      console.info(`[city-gate project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[city-gate project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          // Draw first, then topdeck a card from hand.
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Card',
          });

          console.debug(`[city-gate project] drawing 1 card for player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });

          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            console.debug('[city-gate project] no cards in hand to topdeck');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Topdeck a card',
          });

          console.debug(`[city-gate project] prompting to topdeck from ${hand.length} card(s)`);
          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Put a card from your hand onto your deck',
            restrict: hand,
            count: 1,
          }) as CardId[];

          if (!selectedCardIds.length) {
            console.warn('[city-gate project] no card selected to topdeck');
            return;
          }

          console.debug(`[city-gate project] topdecking ${selectedCardIds[0]}`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: selectedCardIds[0],
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });
    },
  },
  'crop-rotation': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[crop-rotation project] project card not found');
        return;
      }

      console.info(`[crop-rotation project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[crop-rotation project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const victoryCards = triggeredArgs.findCards([
            { location: 'playerHand', playerId: cardEffectArgs.playerId },
            { cardType: ['VICTORY'] },
          ]);

          if (!victoryCards.length) {
            console.debug('[crop-rotation project] no Victory cards in hand to discard');
            return;
          }

          console.debug(`[crop-rotation project] prompting discard from ${victoryCards.length} Victory card(s)`);
          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Discard a Victory card for +2 Cards?',
            restrict: victoryCards.map((card) => card.id),
            count: 1,
            optional: true,
          }) as CardId[];

          if (!selectedCardIds.length) {
            console.debug('[crop-rotation project] player declined to discard a Victory card');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Discard a Victory card',
          });

          console.debug(`[crop-rotation project] discarding ${selectedCardIds[0]}`);
          await triggeredArgs.runGameActionDelegate('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardIds[0],
          });

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+2 Cards',
          });

          console.debug(`[crop-rotation project] drawing 2 cards for player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2,
          });
        },
      });
    },
  },
  'exploration': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[exploration project] project card not found');
        return;
      }

      console.info(`[exploration project] registering buy-phase triggers for player ${cardEffectArgs.playerId}`);

      let gainedDuringBuyPhase = false;

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
            return false;
          }
          if (getCurrentPlayer(conditionArgs.match).id !== cardEffectArgs.playerId) {
            return false;
          }
          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[exploration project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async () => {
          gainedDuringBuyPhase = false;
          console.debug(`[exploration project] reset buy-phase gain tracking for player ${cardEffectArgs.playerId}`);
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          if (getTurnPhase(conditionArgs.match.turnPhaseIndex) !== 'buy') {
            return false;
          }
          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);

          if (!owned) {
            return false;
          }

          return true;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          if (gainedDuringBuyPhase) {
            console.debug('[exploration project] already recorded a gain this buy phase');
            return;
          }
          gainedDuringBuyPhase = true;
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          console.debug(`[exploration project] recorded gain of ${gainedCard} during buy phase`);
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'endTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
            return false;
          }

          if (gainedDuringBuyPhase) {
            console.debug('[exploration project] player gained a card during buy phase, skipping reward');
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[exploration project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
            return false;
          }
          return true;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Coffer, +1 Villager',
          });

          console.debug(
            `[exploration project] granting +1 Coffer and +1 Villager to player ${cardEffectArgs.playerId}`,
          );
          await triggeredArgs.runGameActionDelegate('gainCoffer', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
          await triggeredArgs.runGameActionDelegate('gainVillager', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'fair': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[fair project] project card not found');
        return;
      }

      console.info(`[fair project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[fair project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Buy',
          });

          console.debug(`[fair project] granting +1 Buy to player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('gainBuy', { count: 1 });
        },
      });
    },
  },
  'guildhall': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[guildhall project] project card not found');
        return;
      }

      console.info(`[guildhall project] registering treasure-gain trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[guildhall project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          console.debug(`[guildhall project] evaluating gained card ${gainedCard}`);
          return gainedCard.type.includes('TREASURE');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Coffer',
          });

          console.debug(`[guildhall project] granting +1 Coffer to player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('gainCoffer', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'innovation': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[innovation project] project card not found');
        return;
      }

      console.info(`[innovation project] registering gain trigger for player ${cardEffectArgs.playerId}`);

      let usedThisTurn = false;

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[innovation project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async () => {
          usedThisTurn = false;
          console.debug(`[innovation project] reset usage for player ${cardEffectArgs.playerId}`);
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            return false;
          }

          if (usedThisTurn) {
            console.debug('[innovation project] already used this turn, skipping');
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          console.debug(`[innovation project] evaluating gained card ${gainedCard}`);
          return gainedCard.type.includes('ACTION');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          console.debug(`[innovation project] prompting to play gained card ${gainedCard}`);

          const promptResult = await triggeredArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: `Play ${gainedCard.cardName}?`,
            actionButtons: [
              { label: 'NO', action: 1 },
              { label: 'YES', action: 2 },
            ],
            content: {
              type: 'display-cards',
              cardIds: [gainedCard.id],
            },
          }) as { action: number };

          if (promptResult.action !== 2) {
            console.debug('[innovation project] player declined to play gained card');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Play gained Action',
          });

          console.debug(`[innovation project] playing ${gainedCard}`);
          await triggeredArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: gainedCard.id,
            overrides: {
              actionCost: 0,
            },
          });

          usedThisTurn = true;
        },
      });
    },
  },
  'pageant': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[pageant project] project card not found');
        return;
      }

      console.info(`[pageant project] registering end buy phase trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'endTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[pageant project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          if (triggeredArgs.match.playerTreasure < 1) {
            console.debug('[pageant project] no treasure available to pay $1');
            return;
          }

          const result = await triggeredArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Pay $1 for +1 Coffers? (Pageant)',
            actionButtons: [
              { label: 'NO', action: 1 },
              { label: 'YES', action: 2 },
            ],
          }) as { action: number };

          if (result.action !== 2) {
            console.debug('[pageant project] player declined to pay $1');
            return;
          }

          if (triggeredArgs.match.playerTreasure < 1) {
            console.debug('[pageant project] player no longer has $1 to pay');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Pay $1 for +1 Coffer',
          });

          console.debug('[pageant project] paying $1 and granting +1 Coffer');
          await triggeredArgs.runGameActionDelegate('gainTreasure', { count: -1 });
          await triggeredArgs.runGameActionDelegate('gainCoffer', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'piazza': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[piazza project] project card not found');
        return;
      }

      console.info(`[piazza project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[piazza project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          let deck = triggeredArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

          if (!deck.length) {
            console.debug('[piazza project] deck empty, shuffling');
            await triggeredArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
            deck = triggeredArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
          }

          if (!deck.length) {
            console.debug('[piazza project] no cards to reveal after shuffling');
            return;
          }

          const topCardId = deck.slice(-1)[0];
          const topCard = triggeredArgs.cardLibrary.getCard(topCardId);
          console.debug(`[piazza project] revealing ${topCard}`);

          await triggeredArgs.runGameActionDelegate('revealCard', {
            playerId: cardEffectArgs.playerId,
            cardId: topCardId,
          });

          if (!topCard.type.includes('ACTION')) {
            console.debug('[piazza project] revealed card is not an Action, leaving on top');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Play top Action',
          });

          console.debug(`[piazza project] playing ${topCard}`);
          await triggeredArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: topCardId,
          });
        },
      });
    },
  },
  'road-network': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[road-network project] project card not found');
        return;
      }

      console.info(`[road-network project] registering victory gain trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId === cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[road-network project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          console.debug(`[road-network project] evaluating gained card ${gainedCard}`);
          return gainedCard.type.includes('VICTORY');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Card',
          });

          console.debug(`[road-network project] drawing 1 card for player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'sewers': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[sewers project] project card not found');
        return;
      }

      console.info(`[sewers project] registering trash trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardTrashed', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: false,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[sewers project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
            return false;
          }

          // Ignore trashing caused by Sewers itself.
          if (conditionArgs.trigger.args.source === project.id) {
            console.debug('[sewers project] ignoring trash triggered by sewers');
            return false;
          }

          const hand = conditionArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            console.debug('[sewers project] no cards in hand to trash');
            return false;
          }

          return true;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            console.debug('[sewers project] no cards in hand to trash');
            return;
          }

          console.debug(`[sewers project] prompting to trash from ${hand.length} card(s)`);
          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Trash a card from your hand',
            restrict: hand,
            count: 1,
            optional: true,
          }) as CardId[];

          if (!selectedCardIds.length) {
            console.debug('[sewers project] player declined to trash');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Trash a card',
          });

          console.debug(`[sewers project] trashing ${selectedCardIds[0]}`);
          await triggeredArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardIds[0],
          }, {
            // Mark the source so Sewers can ignore its own trash trigger.
            loggingContext: { source: project.id },
          });
        },
      });
    },
  },
  'silos': {
    registerEffects: () => async (cardEffectArgs) => {
      // Resolve the Silos project to attach start-of-turn behavior.
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[silos project] project card not found');
        return;
      }

      console.info(`[silos project] registering start turn trigger for player ${cardEffectArgs.playerId}`);
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[silos project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
            return false;
          }

          const hand = conditionArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          const copperCount = hand.filter((cardId) =>
            conditionArgs.cardLibrary.getCard(cardId).cardKey === 'copper'
          ).length;
          if (!copperCount) {
            console.debug('[silos project] no Copper cards in hand to discard');
            return false;
          }

          return true;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          const copperIds = hand.filter((cardId) => triggeredArgs.cardLibrary.getCard(cardId).cardKey === 'copper');
          if (!copperIds.length) {
            console.debug('[silos project] no Copper cards in hand to discard');
            return;
          }

          console.debug(`[silos project] prompting to discard from ${copperIds.length} Copper(s)`);
          const selectedIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Discard any number of Coppers',
            count: { kind: 'upTo', count: copperIds.length },
            optional: true,
            restrict: copperIds,
          }) as CardId[];

          if (!selectedIds.length) {
            console.debug('[silos project] player declined to discard Coppers');
            return;
          }

          // Log the Silos effect once before the discard/draw sequence.
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Discard Coppers to draw that many cards',
          });

          console.debug(`[silos project] revealing and discarding ${selectedIds.length} Copper(s)`);
          for (const cardId of selectedIds) {
            await triggeredArgs.runGameActionDelegate('revealCard', {
              playerId: cardEffectArgs.playerId,
              cardId,
            });
            await triggeredArgs.runGameActionDelegate('discardCard', {
              playerId: cardEffectArgs.playerId,
              cardId,
            });
          }

          console.debug(`[silos project] drawing ${selectedIds.length} card(s) after discarding Coppers`);
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: selectedIds.length,
          });
        },
      });
    },
  },
  'sinister-plot': {
    registerEffects: () => async (cardEffectArgs) => {
      // Resolve the Sinister Plot project to attach start-of-turn behavior.
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[sinister-plot project] project card not found');
        return;
      }

      console.info(`[sinister-plot project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        autoResolve: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[sinister-plot project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          // Gather this player's Sinister Plot tokens at this project in deterministic order.
          const ownedTokenIds = Object.values(triggeredArgs.match.tokens ?? {})
            .filter((token) =>
              token.tokenId === 'renaissance:sinister-plot' &&
              token.ownerId === cardEffectArgs.playerId &&
              token.location.type === 'cardLike' &&
              token.location.cardLikeId === project.id
            )
            .map((token) => token.id)
            .sort((a, b) => a.localeCompare(b));

          const promptResult = await triggeredArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: `Sinister Plot: Add a token, or remove ${ownedTokenIds.length} token(s) to draw that many cards?`,
            actionButtons: [
              { label: 'ADD TOKEN', action: 1 },
              { label: 'REMOVE TOKENS', action: 2 },
            ],
            content: {
              type: 'display-cards',
              cardLikeIds: [project.id],
            },
          }) as { action?: number } | null;

          const selectedAction = promptResult?.action === 2 ? 2 : 1;

          if (selectedAction === 2) {
            const removedCount = ownedTokenIds.length;
            console.debug(
              `[sinister-plot project] removing ${removedCount} token(s) for player ${cardEffectArgs.playerId}`,
            );
            for (const tokenInstanceId of ownedTokenIds) {
              await triggeredArgs.runGameActionDelegate('removeToken', { tokenInstanceId });
            }

            if (removedCount <= 0) {
              console.debug('[sinister-plot project] no tokens to remove, skipping draw');
              return;
            }

            triggeredArgs.logManager.addLogEntry({
              type: 'cardLikeEffect',
              playerId: cardEffectArgs.playerId,
              cardLikeId: project.id,
              effectText: `Remove ${removedCount} Sinister Plot token(s) for +${removedCount} Card(s)`,
            });

            console.debug(
              `[sinister-plot project] drawing ${removedCount} card(s) for player ${cardEffectArgs.playerId}`,
            );
            await triggeredArgs.runGameActionDelegate('drawCard', {
              playerId: cardEffectArgs.playerId,
              count: removedCount,
            });
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Add 1 Sinister Plot token',
          });

          console.debug(`[sinister-plot project] adding token for player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('placeToken', {
            tokenId: 'renaissance:sinister-plot',
            ownerId: cardEffectArgs.playerId,
            location: { type: 'cardLike', cardLikeId: project.id },
          });
        },
      });
    },
  },
  'star-chart': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find((candidate) => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[star-chart project] project card not found');
        return;
      }

      console.info(`[star-chart project] registering shuffle trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'shuffle', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(
              `[star-chart project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`,
            );
            return false;
          }

          const shuffledCardIds = conditionArgs.trigger.args.cardIds ?? [];
          if (shuffledCardIds.length < 2) {
            console.debug('[star-chart project] fewer than 2 shuffled cards, skipping');
            return false;
          }

          return true;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const shuffledCardIds = triggeredArgs.trigger.args.cardIds ?? [];
          if (shuffledCardIds.length < 2) {
            return;
          }

          console.debug(
            `[star-chart project] prompting player ${cardEffectArgs.playerId} to choose top card from ${shuffledCardIds.length} shuffled card(s)`,
          );
          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Choose a shuffled card to put on top (Star Chart)',
            restrict: shuffledCardIds,
            count: 1,
            optional: true,
          }) as CardId[];

          const selectedCardId = selectedCardIds[0];
          if (!selectedCardId) {
            console.debug('[star-chart project] player declined to choose a top card');
            return;
          }

          const selectedCard = triggeredArgs.cardLibrary.getCard(selectedCardId);
          console.debug(`[star-chart project] moving ${selectedCard} to top of shuffled cards`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: selectedCardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: `Put ${selectedCard.cardName} on top of shuffled cards`,
          });
        },
      });
    },
  },
};

export default effectMap;
