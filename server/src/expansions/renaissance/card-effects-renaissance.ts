import { Card, CardId } from 'shared/types/index.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { renaissanceArtifactKeys } from './artifact-keys-renaissance.ts';

// Renaissance card effects module (artifacts handled separately).
const expansion: CardExpansionModule = {
  'border-guard': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Border Guard grants +1 Action on play.
      loggerService.debug('[border-guard effect] gaining 1 action');
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Resolve whether the player currently owns the Lantern artifact.
      const artifacts = cardEffectArgs.match.artifacts;
      const ownedArtifacts = artifacts?.byPlayer?.[cardEffectArgs.playerId] ?? [];
      const lantern = artifacts?.cards?.find((candidate) => candidate.cardKey === renaissanceArtifactKeys.lantern);
      const hasLantern = !!lantern && ownedArtifacts.includes(lantern.id);
      const revealCount = hasLantern ? 3 : 2;

      loggerService.debug(`[border-guard effect] revealing ${revealCount} card(s) (lantern: ${hasLantern})`);

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const revealedCards: Card[] = [];

      // Reveal the top N cards, shuffling if needed.
      for (let index = 0; index < revealCount; index++) {
        if (deck.length < 1) {
          loggerService.debug('[border-guard effect] deck empty, shuffling discard');
          await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });
          if (deck.length < 1) {
            loggerService.debug('[border-guard effect] no cards to reveal after shuffling');
            break;
          }
        }

        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        revealedCards.push(card);
        await cardEffectArgs.actionService.run('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });
      }

      if (!revealedCards.length) {
        loggerService.debug('[border-guard effect] no cards revealed');
        return;
      }

      // Prompt the player to choose one revealed card to put into hand.
      const revealedIds = revealedCards.map((card) => card.id);
      const selectedId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card to put into your hand',
        restrict: revealedIds,
        count: 1,
      });

      const chosenId = selectedId ?? revealedIds[0];
      loggerService.debug(`[border-guard effect] moving chosen card ${chosenId} to hand`);
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: chosenId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerHand' },
      });

      // Discard the remaining revealed cards.
      for (const card of revealedCards) {
        if (card.id === chosenId) continue;
        loggerService.debug(`[border-guard effect] discarding revealed card ${card}`);
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
      }

      // Only award artifacts when the full reveal count was met and all were Actions.
      if (revealedCards.length !== revealCount) {
        loggerService.debug('[border-guard effect] revealed fewer than required, skipping artifact');
        return;
      }
      const allActions = revealedCards.every((card) => card.type.includes('ACTION'));
      if (!allActions) {
        loggerService.debug('[border-guard effect] revealed cards not all actions, skipping artifact');
        return;
      }

      // Determine which artifacts are available to take.
      const horn = artifacts?.cards?.find((candidate) => candidate.cardKey === renaissanceArtifactKeys.horn);
      const ownedLantern = !!lantern && ownedArtifacts.includes(lantern.id);
      const ownedHorn = !!horn && ownedArtifacts.includes(horn.id);
      const availableArtifacts: { label: string; artifactId: number }[] = [];

      if (hasLantern) {
        if (horn && !ownedHorn) {
          availableArtifacts.push({ label: 'TAKE HORN', artifactId: horn.id });
        }
      } else {
        if (lantern && !ownedLantern) {
          availableArtifacts.push({ label: 'TAKE LANTERN', artifactId: lantern.id });
        }
        if (horn && !ownedHorn) {
          availableArtifacts.push({ label: 'TAKE HORN', artifactId: horn.id });
        }
      }

      if (!availableArtifacts.length) {
        loggerService.debug('[border-guard effect] no artifacts available to take');
        return;
      }

      if (availableArtifacts.length === 1) {
        const selectedArtifact = availableArtifacts[0];
        loggerService.debug(`[border-guard effect] gaining artifact ${selectedArtifact.artifactId}`);
        await cardEffectArgs.actionService.run('gainArtifact', {
          playerId: cardEffectArgs.playerId,
          artifactId: selectedArtifact.artifactId,
        });
        return;
      }

      // Prompt the player to take an artifact or decline when multiple are available.
      const actionButtons = [
        ...availableArtifacts.map((artifact, index) => ({
          label: artifact.label,
          action: index + 1,
        })),
      ];
      const result = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Take an Artifact?',
        actionButtons,
      }) as { action: number };

      const selectedArtifact = availableArtifacts[result.action - 1];
      if (!selectedArtifact) {
        loggerService.warn('[border-guard effect] no artifact found to gain');
        return;
      }

      loggerService.debug(`[border-guard effect] gaining artifact ${selectedArtifact.artifactId}`);
      await cardEffectArgs.actionService.run('gainArtifact', {
        playerId: cardEffectArgs.playerId,
        artifactId: selectedArtifact.artifactId,
      });
    },
  },
  'acting-troupe': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const actingTroupeCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Acting Troupe always grants +4 Villagers even if the trash step later cannot happen.
      loggerService.debug('[acting-troupe effect] granting +4 Villagers');
      await cardEffectArgs.actionService.run('gainVillager', {
        playerId: cardEffectArgs.playerId,
        count: 4,
      });

      // Trash this only if it is currently in play; replay effects can resolve after it has already moved.
      let sourceLocation: string | undefined;
      try {
        sourceLocation = cardEffectArgs.cardSourceController.findCardSource(actingTroupeCard.id).sourceKey;
      } catch {
        sourceLocation = undefined;
      }

      const isInPlay = sourceLocation === 'playArea' || sourceLocation === 'activeDuration';
      if (!isInPlay) {
        loggerService.debug(
          `[acting-troupe effect] skipping trash for ${actingTroupeCard}; source location is ${
            sourceLocation ?? 'unknown'
          }`,
        );
        return;
      }

      loggerService.debug(`[acting-troupe effect] trashing ${actingTroupeCard}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: actingTroupeCard.id,
      });
    },
  },
  'cargo-ship': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const cargoShipCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Build a per-play identifier so replaying Cargo Ship in one turn doesn't collide trigger IDs.
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnStatsIndex] ?? [];
      const cargoShipPlayInstance = playedThisTurn
        .filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;
      const cardGainedTriggerIdSuffix = `card-gained:${cargoShipPlayInstance}`;

      // Cargo Ship gives +$2 immediately when played.
      loggerService.debug('[cargo-ship effect] gaining +2 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Track whether this instance already set a card aside.
      let hasSetAsideCard = false;
      let setAsideCardId: CardId | undefined;

      // Returns true when this Cargo Ship card is still in a play zone.
      const isCargoShipInPlay = () => {
        try {
          const sourceLocation = cardEffectArgs.cardSourceController.findCardSource(cargoShipCard.id).sourceKey;
          return sourceLocation === 'playArea' || sourceLocation === 'activeDuration';
        } catch {
          return false;
        }
      };

      // Once this turn, when you gain a card, you may set it aside.
      const cardGainedTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate(
        cargoShipCard,
        'cardGained',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: ({ trigger }) => {
            if (trigger.args.playerId !== cardEffectArgs.playerId) {
              return false;
            }

            // Disable once a card has been set aside for this Cargo Ship play.
            return !hasSetAsideCard;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const gainedCardId = triggeredArgs.trigger.args.cardId;
            const gainedCard = triggeredArgs.cardLibrary.getCard(gainedCardId);

            loggerService.debug(`[cargo-ship cardGained effect] gained ${gainedCard}; prompting set-aside choice`);
            const promptResult = await triggeredArgs.actionService.run('userPrompt', {
              playerId: cardEffectArgs.playerId,
              prompt: `Set aside ${gainedCard.cardName} with Cargo Ship?`,
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
              content: {
                type: 'display-cards',
                cardIds: [gainedCardId],
              },
            }) as { action?: number } | null;

            if (promptResult?.action !== 2) {
              loggerService.debug('[cargo-ship cardGained effect] player declined set-aside');
              return;
            }

            hasSetAsideCard = true;
            setAsideCardId = gainedCardId;

            loggerService.debug(`[cargo-ship cardGained effect] setting aside ${gainedCard}`);
            await triggeredArgs.actionService.run('moveCard', {
              cardId: gainedCardId,
              toPlayerId: cardEffectArgs.playerId,
              to: { location: 'set-aside' },
              facing: 'front',
            });

            // This play of Cargo Ship can only set aside one gained card.
            triggeredArgs.reactionManager.unregisterTrigger(cardGainedTriggerId);

            // If Cargo Ship is not in play, the set-aside card remains set aside for the rest of the game.
            if (!isCargoShipInPlay()) {
              loggerService.debug(
                '[cargo-ship cardGained effect] Cargo Ship is no longer in play; set-aside card will stay set aside',
              );
              return;
            }

            loggerService.debug('[cargo-ship cardGained effect] registering next-turn retrieval');

            // Keep Cargo Ship through cleanup and return the set-aside card next turn.
            cardEffectArgs.registerDurationEffect(cargoShipCard, {
              id: `cargo-ship:${cardEffectArgs.cardId}:startTurn:${cargoShipPlayInstance}`,
              playerId: cardEffectArgs.playerId,
              compulsory: true,
              once: true,
              allowMultipleInstances: true,
              listeningFor: 'startTurn',
              condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
              triggeredEffectFn: async (startTurnArgs) => {
                // Move Cargo Ship back to playArea so it discards normally in this turn's cleanup.
                await startTurnArgs.actionService.run('moveCard', {
                  cardId: cargoShipCard.id,
                  to: { location: 'playArea' },
                });

                if (setAsideCardId === undefined) {
                  loggerService.debug('[cargo-ship startTurn effect] no card was set aside');
                  return;
                }

                const setAsideCards = startTurnArgs.cardSourceController.getSource(
                  'set-aside',
                  cardEffectArgs.playerId,
                );
                if (!setAsideCards.includes(setAsideCardId)) {
                  loggerService.debug(
                    `[cargo-ship startTurn effect] set-aside card ${setAsideCardId} no longer in set-aside zone`,
                  );
                  return;
                }

                const cardToMove = startTurnArgs.cardLibrary.getCard(setAsideCardId);
                loggerService.debug(`[cargo-ship startTurn effect] moving ${cardToMove} to hand`);
                await startTurnArgs.actionService.run('moveCard', {
                  cardId: setAsideCardId,
                  toPlayerId: cardEffectArgs.playerId,
                  to: { location: 'playerHand' },
                });
              },
            });
          },
        },
        { idSuffix: cardGainedTriggerIdSuffix },
      );

      // Clean up this-turn gain listener at end of turn whether or not it was used.
      cardEffectArgs.reactionManager.registerSystemTemplate(cargoShipCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          loggerService.debug('[cargo-ship endTurn effect] removing gain listener for this play');
          triggeredArgs.reactionManager.unregisterTrigger(cardGainedTriggerId);
        },
      }, { idSuffix: `cleanup-gain-listener:${cargoShipPlayInstance}` });
    },
  },
  'ducat': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Ducat lets you optionally trash one Copper from hand when gained.
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', eventArgs.playerId);
        const copperInHandIds = hand.filter((cardId) =>
          cardEffectArgs.cardLibrary.getCard(cardId).cardKey === 'copper'
        );
        if (!copperInHandIds.length) {
          loggerService.debug('[ducat onGained effect] no Copper in hand to trash');
          return;
        }

        loggerService.debug(
          `[ducat onGained effect] prompting whether to trash Copper from ${copperInHandIds.length} card(s)`,
        );
        const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
          playerId: eventArgs.playerId,
          prompt: 'Trash a Copper from your hand?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
        }) as { action?: number } | null;

        if (promptResult?.action !== 2) {
          loggerService.debug('[ducat onGained effect] player declined to trash Copper');
          return;
        }

        const selectedCopperId = copperInHandIds[0];
        const selectedCopper = cardEffectArgs.cardLibrary.getCard(selectedCopperId);
        loggerService.debug(`[ducat onGained effect] trashing ${selectedCopper}`);
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: eventArgs.playerId,
          cardId: selectedCopperId,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Ducat grants +1 Coffer and +1 Buy when played.
      loggerService.debug('[ducat effect] gaining +1 Coffer and +1 Buy');
      await cardEffectArgs.actionService.run('gainCoffer', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainBuy', {
        count: 1,
      });
    },
  },
  'experiment': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Extra copies still fire onGained, but must not chain another extra gain.
        // If the gain source is another Experiment instance, skip chaining.
        if (eventArgs.gainContext?.sourceCardId !== undefined) {
          const gainedCard = cardEffectArgs.cardLibrary.getCard(eventArgs.cardId);
          const sourceCard = cardEffectArgs.cardLibrary.getCard(eventArgs.gainContext.sourceCardId);
          if (gainedCard.cardKey === sourceCard.cardKey) {
            loggerService.debug('[experiment onGained effect] skipping chained extra gain for same card key source');
            return;
          }
        }

        // Experiment gains one additional copy from supply without chaining further onGained effects.
        const experimentToGain = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
          pileKey: 'experiment',
          from: ['kingdomSupply', 'basicSupply'],
        });
        if (!experimentToGain) {
          loggerService.debug('[experiment onGained effect] no Experiment in supply to gain');
          return;
        }

        const extraExperimentCard = cardEffectArgs.cardLibrary.getCard(experimentToGain.id);
        loggerService.debug(`[experiment onGained effect] gaining additional ${extraExperimentCard}`);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: eventArgs.playerId,
          cardId: extraExperimentCard.id,
          to: { location: 'playerDiscard' },
        }, {
          loggingContext: { source: eventArgs.cardId },
          lifecycleContext: {
            onGained: {
              sourceCardId: eventArgs.cardId,
            },
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const experimentCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Experiment gives +2 Cards and +1 Action every time it is played.
      loggerService.debug('[experiment effect] drawing 2 cards and gaining 1 action');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      }, {
        loggingContext: { source: cardEffectArgs.cardId },
      });
      await cardEffectArgs.actionService.run('gainAction', {
        count: 1,
      }, {
        loggingContext: { source: cardEffectArgs.cardId },
      });

      // Return this to its pile only when it is currently in play.
      let sourceLocation: string | undefined;
      try {
        sourceLocation = cardEffectArgs.cardSourceController.findCardSource(experimentCard.id).sourceKey;
      } catch {
        sourceLocation = undefined;
      }

      const isInPlay = sourceLocation === 'playArea' || sourceLocation === 'activeDuration';
      if (!isInPlay) {
        loggerService.debug('[experiment effect] card is not in play; skipping return to pile');
        return;
      }

      // If no Experiment pile exists in this game, Experiment stays where it is.
      const hasBasicPile = (cardEffectArgs.match.config.basicSupply ?? []).some((supply) =>
        supply.name === 'experiment'
      );
      const hasKingdomPile = (cardEffectArgs.match.config.kingdomSupply ?? []).some((supply) =>
        supply.name === 'experiment'
      );
      if (!hasBasicPile && !hasKingdomPile) {
        loggerService.debug('[experiment effect] no Experiment pile in current supply; skipping return');
        return;
      }

      const returnLocation = hasBasicPile ? 'basicSupply' : 'kingdomSupply';
      loggerService.debug(`[experiment effect] returning ${experimentCard} to ${returnLocation}`);
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: experimentCard.id,
        to: { location: returnLocation },
      });
    },
  },
  'flag-bearer': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Flag Bearer grants the Flag artifact to the player that gained it.
        loggerService.debug(`[flag-bearer onGained effect] player ${eventArgs.playerId} taking Flag`);
        await cardEffectArgs.actionService.run('gainArtifact', {
          playerId: eventArgs.playerId,
          artifactKey: renaissanceArtifactKeys.flag,
        });
      },
      onTrashed: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Flag Bearer grants the Flag artifact to the player that trashed it.
        loggerService.debug(`[flag-bearer onTrashed effect] player ${eventArgs.playerId} taking Flag`);
        await cardEffectArgs.actionService.run('gainArtifact', {
          playerId: eventArgs.playerId,
          artifactKey: renaissanceArtifactKeys.flag,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Flag Bearer gives +$2 when played.
      loggerService.debug('[flag-bearer effect] gaining +2 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
    },
  },
  'hideout': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Hideout gives +1 Card and +2 Actions before the mandatory trash.
      loggerService.debug('[hideout effect] drawing 1 card and gaining 2 actions');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', {
        count: 2,
      });

      // Trashing is mandatory; if hand is empty there is no legal card to trash.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[hideout effect] no cards in hand to trash');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[hideout effect] no card selected to trash');
        return;
      }

      const trashedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[hideout effect] trashing ${trashedCard}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Only trashing a Victory card causes a Curse gain.
      if (!trashedCard.type.includes('VICTORY')) {
        loggerService.debug('[hideout effect] trashed card is not a Victory card');
        return;
      }

      const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'curse',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'hideout effect',
      });
      if (!gainedCurseId) {
        loggerService.debug('[hideout effect] no Curse cards in supply');
        return;
      }

      const curseCard = cardEffectArgs.cardLibrary.getCard(gainedCurseId);
      loggerService.debug(`[hideout effect] trashed Victory card, gaining ${curseCard}`);
    },
  },
  'improve': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const improveCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnStatsIndex] ?? [];
      const improvePlayInstance = playedThisTurn
        .filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;

      // Improve gives +$2 immediately when played.
      loggerService.debug('[improve effect] gaining +2 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Register a one-time cleanup trigger for this play instance.
      cardEffectArgs.reactionManager.registerReactionTemplate(
        improveCard,
        'startTurnPhase',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, match }) => {
            if (getTurnPhase(trigger.args.phaseIndex) !== 'cleanup') {
              return false;
            }

            return getCurrentPlayer(match).id === cardEffectArgs.playerId;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            // Improve can only trash Actions currently in play that would be discarded this cleanup.
            const actionCardsInPlay = triggeredArgs.cardSourceController
              .getSource('playArea')
              .filter((cardId) => triggeredArgs.cardLibrary.getCard(cardId).type.includes('ACTION'));

            if (!actionCardsInPlay.length) {
              loggerService.debug('[improve cleanup effect] no Action cards in play to trash');
              return;
            }

            const selectedCardId = await triggeredArgs.actionService.run('selectSingleCard', {
              playerId: cardEffectArgs.playerId,
              prompt: 'You may trash an Action card from play',
              restrict: actionCardsInPlay,
              count: 1,
              optional: true,
            }) as CardId | null;
            if (!selectedCardId) {
              loggerService.debug('[improve cleanup effect] player declined to trash an Action card');
              return;
            }

            const selectedCard = triggeredArgs.cardLibrary.getCard(selectedCardId);
            const { cost } = triggeredArgs.cardPriceController.applyRules(selectedCard, {
              playerId: cardEffectArgs.playerId,
            });

            loggerService.debug(`[improve cleanup effect] trashing ${selectedCard}`);
            await triggeredArgs.actionService.run('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedCardId,
            });

            // If a card was trashed, gaining exactly $1 more is mandatory when possible.
            const gainCandidates = triggeredArgs.findCardService.findCards([
              { location: ['basicSupply', 'kingdomSupply'] },
              {
                playerId: cardEffectArgs.playerId,
                kind: 'exact',
                amount: {
                  treasure: cost.treasure + 1,
                  potion: cost.potion,
                  debt: cost.debt,
                },
              },
            ]);

            if (!gainCandidates.length) {
              loggerService.debug('[improve cleanup effect] no cards costing exactly $1 more');
              return;
            }

            const gainCardId = await triggeredArgs.actionService.run('selectSingleCard', {
              playerId: cardEffectArgs.playerId,
              prompt: `Gain a card costing exactly $1 more than ${selectedCard.cardName}`,
              restrict: gainCandidates.map((card) => card.id),
              count: 1,
            }) as CardId | null;
            if (!gainCardId) {
              loggerService.warn('[improve cleanup effect] no card selected to gain');
              return;
            }

            const gainedCard = triggeredArgs.cardLibrary.getCard(gainCardId);
            loggerService.debug(`[improve cleanup effect] gaining ${gainedCard}`);
            await triggeredArgs.actionService.run('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: gainCardId,
              to: { location: 'playerDiscard' },
            });
          },
        },
        { idSuffix: `cleanup-upgrade:${improvePlayInstance}` },
      );
    },
  },
  'lackeys': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Gaining Lackeys grants +2 Villagers to the player that gained it.
        loggerService.debug(`[lackeys onGained effect] player ${eventArgs.playerId} gaining 2 Villagers`);
        await cardEffectArgs.actionService.run('gainVillager', {
          playerId: eventArgs.playerId,
          count: 2,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Playing Lackeys grants +2 Cards.
      loggerService.debug('[lackeys effect] drawing 2 cards');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
    },
  },
  'mountain-village': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Mountain Village grants +2 Actions.
      loggerService.debug('[mountain-village effect] gaining 2 actions');
      await cardEffectArgs.actionService.run('gainAction', {
        count: 2,
      });

      // If discard has cards, player must take one into hand.
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      if (discard.length) {
        loggerService.debug(`[mountain-village effect] selecting card from discard (${discard.length} card(s))`);
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose a card from your discard pile to put into your hand',
          restrict: discard,
          count: 1,
        }) as CardId | null;
        if (!selectedCardId) {
          loggerService.warn('[mountain-village effect] no card selected from discard');
          return;
        }

        loggerService.debug(`[mountain-village effect] moving card ${selectedCardId} from discard to hand`);
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: selectedCardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' },
        });
        return;
      }

      // If discard is empty, draw one card.
      loggerService.debug('[mountain-village effect] discard empty, drawing 1 card');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
    },
  },
  'old-witch': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Old Witch grants +3 Cards first.
      loggerService.debug('[old-witch effect] drawing 3 cards');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });

      // Attack each other non-immune player in turn order.
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((id) => !isPlayerImmune(cardEffectArgs.reactionContext, id));

      loggerService.debug(`[old-witch effect] targets ${targetPlayerIds.join(', ')}`);

      for (const targetPlayerId of targetPlayerIds) {
        // Gain a Curse if available.
        const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'curse',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'old-witch effect',
        });
        if (gainedCurseId) {
          const curseCard = cardEffectArgs.cardLibrary.getCard(gainedCurseId);
          loggerService.debug(`[old-witch effect] player ${targetPlayerId} gaining ${curseCard}`);
        } else {
          loggerService.debug('[old-witch effect] no Curse in supply to gain');
        }

        // Then they may trash a Curse from hand (still allowed if Curse pile is empty).
        const targetHand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        const curseInHandIds = targetHand.filter((cardId) =>
          cardEffectArgs.cardLibrary.getCard(cardId).cardKey === 'curse'
        );
        if (!curseInHandIds.length) {
          loggerService.debug(`[old-witch effect] player ${targetPlayerId} has no Curse in hand to trash`);
          continue;
        }

        loggerService.debug(`[old-witch effect] player ${targetPlayerId} may trash a Curse from hand`);
        const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
          playerId: targetPlayerId,
          prompt: 'Trash a Curse from your hand?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
        }) as { action?: number } | null;

        if (promptResult?.action !== 2) {
          loggerService.debug(`[old-witch effect] player ${targetPlayerId} declined to trash a Curse`);
          continue;
        }

        const curseToTrashId = curseInHandIds[0];
        const curseToTrash = cardEffectArgs.cardLibrary.getCard(curseToTrashId);
        loggerService.debug(`[old-witch effect] player ${targetPlayerId} trashing ${curseToTrash}`);
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: targetPlayerId,
          cardId: curseToTrashId,
        });
      }
    },
  },
  'patron': {
    registerLifeCycleMethods: () => ({
      onRevealed: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Patron only grants Coffers when revealed during an Action phase.
        const turnPhase = getTurnPhase(cardEffectArgs.match.turnPhaseIndex);
        if (turnPhase !== 'action') {
          loggerService.debug(`[patron onRevealed effect] reveal in ${turnPhase} phase; no Coffers granted`);
          return;
        }

        loggerService.debug(`[patron onRevealed effect] player ${eventArgs.playerId} gaining 1 Coffer`);
        await cardEffectArgs.actionService.run('gainCoffer', {
          playerId: eventArgs.playerId,
          count: 1,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Patron grants +1 Villager and +$2 when played.
      loggerService.debug('[patron effect] gaining 1 Villager and 2 treasure');
      await cardEffectArgs.actionService.run('gainVillager', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainTreasure', {
        count: 2,
      });
    },
  },
  'priest': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const priestCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnStatsIndex] ?? [];
      const priestPlayInstance = playedThisTurn
        .filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;

      // Priest gives +$2 immediately when played.
      loggerService.debug('[priest effect] gaining 2 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', {
        count: 2,
      });

      // Priest requires trashing a card from hand if possible.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[priest effect] no cards in hand to trash');
      } else {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Trash a card from your hand',
          restrict: hand,
          count: 1,
        }) as CardId | null;
        if (!selectedCardId) {
          loggerService.warn('[priest effect] no card selected to trash');
        } else {
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
          loggerService.debug(`[priest effect] trashing ${selectedCard}`);
          await cardEffectArgs.actionService.run('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
          });
        }
      }

      // For the rest of this turn, each card trashed by this player grants +$2.
      const trashBonusTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate(
        priestCard,
        'cardTrashed',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug('[priest cardTrashed effect] gaining 2 treasure from trash trigger');
            await triggeredArgs.actionService.run('gainTreasure', {
              count: 2,
            });
          },
        },
        { idSuffix: `trash-bonus:${priestPlayInstance}` },
      );

      // Remove this Priest's trash bonus at end of turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(
        priestCard,
        'endTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug('[priest endTurn effect] removing trash bonus trigger');
            triggeredArgs.reactionManager.unregisterTrigger(trashBonusTriggerId);
          },
        },
        { idSuffix: `cleanup-trash-bonus:${priestPlayInstance}` },
      );
    },
  },
  'recruiter': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Recruiter gives +2 Cards.
      loggerService.debug('[recruiter effect] drawing 2 cards');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      // Recruiter requires trashing a card from hand if possible.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[recruiter effect] no cards in hand to trash');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[recruiter effect] no card selected to trash');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      });
      const villagersToGain = Math.max(0, cost.treasure ?? 0);

      loggerService.debug(`[recruiter effect] trashing ${selectedCard}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      if (!villagersToGain) {
        loggerService.debug('[recruiter effect] trashed card has no coin cost, gaining 0 Villagers');
        return;
      }

      loggerService.debug(`[recruiter effect] gaining ${villagersToGain} Villagers`);
      await cardEffectArgs.actionService.run('gainVillager', {
        playerId: cardEffectArgs.playerId,
        count: villagersToGain,
      });
    },
  },
  'research': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const researchCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnStatsIndex] ?? [];
      const researchPlayInstance = playedThisTurn
        .filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;

      // Research gives +1 Action.
      loggerService.debug('[research effect] gaining 1 action');
      await cardEffectArgs.actionService.run('gainAction', {
        count: 1,
      });

      // Research requires trashing a card from hand if possible.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[research effect] no cards in hand to trash');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[research effect] no card selected to trash');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      });
      const setAsideCount = Math.max(0, cost.treasure ?? 0);

      loggerService.debug(`[research effect] trashing ${selectedCard}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Set aside cards from the top of deck equal to trashed card's coin cost.
      const setAsideCardIds: CardId[] = [];
      for (let index = 0; index < setAsideCount; index++) {
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (!deck.length) {
          loggerService.debug('[research effect] deck empty, shuffling discard');
          await cardEffectArgs.actionService.run('shuffleDeck', {
            playerId: cardEffectArgs.playerId,
          });
        }

        const updatedDeck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (!updatedDeck.length) {
          loggerService.debug('[research effect] no cards left to set aside');
          break;
        }

        const topCardId = updatedDeck.slice(-1)[0];
        setAsideCardIds.push(topCardId);
        loggerService.debug(`[research effect] setting aside card ${topCardId} face down`);
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: topCardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'set-aside' },
          facing: 'back',
        });
      }

      loggerService.debug(`[research effect] set aside ${setAsideCardIds.length} card(s)`);

      // Keep Research through cleanup and return set-aside cards to hand next turn.
      cardEffectArgs.registerDurationEffect(
        researchCard,
        {
          id: `research:${cardEffectArgs.cardId}:startTurn:${researchPlayInstance}`,
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug('[research startTurn effect] returning Research to play area');
            await triggeredArgs.actionService.run('moveCard', {
              cardId: researchCard.id,
              to: { location: 'playArea' },
            });

            for (const setAsideCardId of setAsideCardIds) {
              const setAside = triggeredArgs.cardSourceController.getSource('set-aside', cardEffectArgs.playerId);
              if (!setAside.includes(setAsideCardId)) {
                loggerService.debug(`[research startTurn effect] set-aside card ${setAsideCardId} is no longer set aside`);
                continue;
              }

              loggerService.debug(`[research startTurn effect] moving set-aside card ${setAsideCardId} to hand`);
              await triggeredArgs.actionService.run('moveCard', {
                cardId: setAsideCardId,
                toPlayerId: cardEffectArgs.playerId,
                to: { location: 'playerHand' },
              });
            }
          },
        },
      );
    },
  },
  'scepter': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const scepterCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnStatsIndex] ?? [];
      const scepterPlayInstance = playedThisTurn
        .filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;

      // Scepter can replay a non-Command Action played this turn and still in play.
      const playedThisTurnSet = new Set(playedThisTurn);
      const uniquePlayedActionIds = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) => playedThisTurnSet.has(card.id))
        .filter((card) => card.type.includes('ACTION') && !card.type.includes('COMMAND'))
        .map((card) => card.id);

      // If no replay target exists, Scepter must take +$2.
      if (!uniquePlayedActionIds.length) {
        loggerService.debug('[scepter effect] no eligible Action card to replay, gaining 2 treasure');
        await cardEffectArgs.actionService.run('gainTreasure', {
          count: 2,
        });
        return;
      }

      const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose one',
        actionButtons: [
          { label: '+$2', action: 1 },
          { label: 'REPLAY ACTION', action: 2 },
        ],
      }) as { action?: number } | null;

      if (promptResult?.action !== 2) {
        loggerService.debug('[scepter effect] player chose +2 treasure');
        await cardEffectArgs.actionService.run('gainTreasure', {
          count: 2,
        });
        return;
      }

      const selectedActionId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose an Action card to replay',
        restrict: uniquePlayedActionIds,
        count: 1,
      }) as CardId | null;
      if (!selectedActionId) {
        loggerService.warn('[scepter effect] no Action selected to replay, gaining 2 treasure');
        await cardEffectArgs.actionService.run('gainTreasure', {
          count: 2,
        });
        return;
      }

      const selectedActionCard = cardEffectArgs.cardLibrary.getCard(selectedActionId);
      loggerService.debug(`[scepter effect] replaying ${selectedActionCard}`);
      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedActionId,
        overrides: {
          actionCost: 0,
          moveCard: false,
        },
      });

      // When replaying a Duration card that stays in play, keep Scepter in play as well.
      if (!selectedActionCard.type.includes('DURATION')) {
        return;
      }

      const isReplayedCardInPlay = () =>
        cardEffectArgs.findCardService.getCardsInPlay().some((card) => card.id === selectedActionCard.id);

      if (!isReplayedCardInPlay()) {
        loggerService.debug('[scepter effect] replayed Duration is not in play, no duration hold needed');
        return;
      }

      loggerService.debug('[scepter effect] replayed Duration is in play, registering duration hold');

      // Move Scepter to activeDuration at cleanup if the replayed Duration is still in play.
      cardEffectArgs.reactionManager.registerSystemTemplate(
        scepterCard,
        'startTurnPhase',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => {
            if (getTurnPhase(trigger.args.phaseIndex) !== 'cleanup') {
              return false;
            }

            const currentPlayerId = getCurrentPlayer(cardEffectArgs.match).id;
            if (currentPlayerId !== cardEffectArgs.playerId) {
              return false;
            }

            return isReplayedCardInPlay();
          },
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug('[scepter duration effect] moving Scepter to activeDuration');
            await triggeredArgs.actionService.run('moveCard', {
              cardId: scepterCard.id,
              to: { location: 'activeDuration' },
            });
          },
        },
        { idSuffix: `duration-cleanup:${scepterPlayInstance}` },
      );

      let durationHoldTriggerId = '';
      durationHoldTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate(
        scepterCard,
        'startTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, cardSourceController }) => {
            if (trigger.args.playerId !== cardEffectArgs.playerId) {
              return false;
            }

            return cardSourceController.getSource('activeDuration').includes(scepterCard.id);
          },
          triggeredEffectFn: async (triggeredArgs) => {
            if (isReplayedCardInPlay()) {
              loggerService.debug('[scepter duration effect] replayed Duration still in play; keeping Scepter active');
              return;
            }

            loggerService.debug('[scepter duration effect] replayed Duration left play; returning Scepter to play area');
            await triggeredArgs.actionService.run('moveCard', {
              cardId: scepterCard.id,
              to: { location: 'playArea' },
            });
            triggeredArgs.reactionManager.unregisterTrigger(durationHoldTriggerId);
          },
        },
        { idSuffix: `duration-hold:${scepterPlayInstance}` },
      );
    },
  },
  'scholar': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Scholar discards the entire hand first.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      loggerService.debug(`[scholar effect] discarding ${hand.length} card(s) from hand`);
      for (const cardId of [...hand]) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      // Then it draws 7 cards.
      loggerService.debug('[scholar effect] drawing 7 cards');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 7,
      });
    },
  },
  'sculptor': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Sculptor gains a card to hand costing up to $4.
      const gainableCards = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
      ]);

      if (!gainableCards.length) {
        loggerService.debug('[sculptor effect] no cards in supply costing up to 4');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card to your hand',
        restrict: gainableCards.map((card) => card.id),
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[sculptor effect] no card selected to gain');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[sculptor effect] gaining ${selectedCard} to hand`);
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerHand' },
      });

      // If the gained card is a Treasure, gain +1 Villager.
      if (!selectedCard.type.includes('TREASURE')) {
        return;
      }

      loggerService.debug('[sculptor effect] gained Treasure, gaining 1 Villager');
      await cardEffectArgs.actionService.run('gainVillager', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
    },
  },
  'seer': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Seer first gives +1 Card and +1 Action.
      loggerService.debug('[seer effect] drawing 1 card and gaining 1 action');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Reveal up to the top 3 cards of deck, shuffling if needed.
      const revealedCardIds: CardId[] = [];
      for (let index = 0; index < 3; index++) {
        let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (!deck.length) {
          loggerService.debug('[seer effect] deck empty, shuffling discard');
          await cardEffectArgs.actionService.run('shuffleDeck', {
            playerId: cardEffectArgs.playerId,
          });
          deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        }

        if (!deck.length) {
          loggerService.debug('[seer effect] no cards left to reveal');
          break;
        }

        const topCardId = deck.slice(-1)[0];
        const topCard = cardEffectArgs.cardLibrary.getCard(topCardId);
        loggerService.debug(`[seer effect] revealing ${topCard}`);
        await cardEffectArgs.actionService.run('revealCard', {
          cardId: topCardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });
        revealedCardIds.push(topCardId);
      }

      if (!revealedCardIds.length) {
        return;
      }

      const cardsToHand: CardId[] = [];
      const cardsToReturn: CardId[] = [];

      // Split revealed cards by current cost: exactly coin-cost from $2 to $4, no debt/potion.
      for (const revealedCardId of revealedCardIds) {
        const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
        const { cost } = cardEffectArgs.cardPriceController.applyRules(revealedCard, {
          playerId: cardEffectArgs.playerId,
        });

        const hasDebt = (cost.debt ?? 0) > 0;
        const hasPotion = (cost.potion ?? 0) > 0;
        const inRange = !hasDebt &&
          !hasPotion &&
          compareCardCosts(cost, { treasure: 2 }) >= 0 &&
          compareCardCosts(cost, { treasure: 4 }) <= 0;

        if (inRange) {
          cardsToHand.push(revealedCardId);
          continue;
        }
        cardsToReturn.push(revealedCardId);
      }

      // Put qualifying cards into hand.
      for (const cardId of cardsToHand) {
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        loggerService.debug(`[seer effect] moving ${card} to hand`);
        await cardEffectArgs.actionService.run('moveCard', {
          cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' },
        });
      }

      if (!cardsToReturn.length) {
        return;
      }

      // Put non-qualifying cards back on deck in player-chosen order.
      let orderedCardsToReturn = [...cardsToReturn];
      if (cardsToReturn.length > 1) {
        const reorderResult = await cardEffectArgs.actionService.run('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Put the rest back on top of your deck in any order',
          actionButtons: [{ label: 'DONE', action: 1 }],
          content: {
            type: 'rearrange',
            cardIds: cardsToReturn,
          },
        }) as { result?: CardId[] } | null;

        if (Array.isArray(reorderResult?.result) && reorderResult.result.length === cardsToReturn.length) {
          orderedCardsToReturn = reorderResult.result;
        }
      }

      for (const cardId of orderedCardsToReturn) {
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        loggerService.debug(`[seer effect] returning ${card} to top of deck`);
        await cardEffectArgs.actionService.run('moveCard', {
          cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'silk-merchant': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Silk Merchant grants +1 Coffer and +1 Villager when gained.
        loggerService.debug(`[silk-merchant onGained effect] player ${eventArgs.playerId} gaining 1 Coffer and 1 Villager`);
        await cardEffectArgs.actionService.run('gainCoffer', {
          playerId: eventArgs.playerId,
          count: 1,
        });
        await cardEffectArgs.actionService.run('gainVillager', {
          playerId: eventArgs.playerId,
          count: 1,
        });
      },
      onTrashed: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Silk Merchant grants +1 Coffer and +1 Villager to the player who trashed it.
        loggerService.debug(`[silk-merchant onTrashed effect] player ${eventArgs.playerId} gaining 1 Coffer and 1 Villager`);
        await cardEffectArgs.actionService.run('gainCoffer', {
          playerId: eventArgs.playerId,
          count: 1,
        });
        await cardEffectArgs.actionService.run('gainVillager', {
          playerId: eventArgs.playerId,
          count: 1,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Silk Merchant gives +2 Cards and +1 Buy on play.
      loggerService.debug('[silk-merchant effect] drawing 2 cards and gaining 1 buy');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
    },
  },
  'spices': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Spices grants +2 Coffers when gained.
        loggerService.debug(`[spices onGained effect] player ${eventArgs.playerId} gaining 2 Coffers`);
        await cardEffectArgs.actionService.run('gainCoffer', {
          playerId: eventArgs.playerId,
          count: 2,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Spices gives +$2 and +1 Buy on play.
      loggerService.debug('[spices effect] gaining 2 treasure and 1 buy');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
    },
  },
  'swashbuckler': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Swashbuckler gives +3 Cards first.
      loggerService.debug('[swashbuckler effect] drawing 3 cards');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });

      // Additional rewards only happen if discard pile has at least one card.
      const discardPile = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      if (!discardPile.length) {
        loggerService.debug('[swashbuckler effect] discard pile empty, skipping Coffers and Treasure Chest');
        return;
      }

      loggerService.debug('[swashbuckler effect] discard pile has cards, gaining 1 Coffer');
      await cardEffectArgs.actionService.run('gainCoffer', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });

      // If player has at least 4 Coffers after the gain, take Treasure Chest.
      const cofferCount = cardEffectArgs.match.coffers[cardEffectArgs.playerId] ?? 0;
      if (cofferCount < 4) {
        loggerService.debug(`[swashbuckler effect] player has ${cofferCount} Coffers, not taking Treasure Chest`);
        return;
      }

      loggerService.debug('[swashbuckler effect] player has at least 4 Coffers, taking Treasure Chest');
      await cardEffectArgs.actionService.run('gainArtifact', {
        playerId: cardEffectArgs.playerId,
        artifactKey: renaissanceArtifactKeys.treasureChest,
      });
    },
  },
  'treasurer': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Treasurer gives +$3 on play.
      loggerService.debug('[treasurer effect] gaining 3 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });

      const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose one',
        actionButtons: [
          { label: 'TRASH TREASURE FROM HAND', action: 1 },
          { label: 'GAIN TREASURE FROM TRASH', action: 2 },
          { label: 'TAKE THE KEY', action: 3 },
        ],
      }) as { action?: number } | null;

      const selectedAction = promptResult?.action ?? 1;

      if (selectedAction === 1) {
        // Option 1: trash a Treasure from hand.
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const treasureIdsInHand = hand.filter((cardId) =>
          cardEffectArgs.cardLibrary.getCard(cardId).type.includes('TREASURE')
        );
        if (!treasureIdsInHand.length) {
          loggerService.debug('[treasurer effect] no Treasure in hand to trash');
          return;
        }

        const selectedTreasureId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Trash a Treasure from your hand',
          restrict: treasureIdsInHand,
          count: 1,
        }) as CardId | null;
        if (!selectedTreasureId) {
          loggerService.warn('[treasurer effect] no Treasure selected to trash');
          return;
        }

        const selectedTreasure = cardEffectArgs.cardLibrary.getCard(selectedTreasureId);
        loggerService.debug(`[treasurer effect] trashing ${selectedTreasure}`);
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedTreasureId,
        });
        return;
      }

      if (selectedAction === 2) {
        // Option 2: gain a Treasure from trash to hand.
        const treasureIdsInTrash = cardEffectArgs.cardSourceController.getSource('trash')
          .filter((cardId) => cardEffectArgs.cardLibrary.getCard(cardId).type.includes('TREASURE'));
        if (!treasureIdsInTrash.length) {
          loggerService.debug('[treasurer effect] no Treasure in trash to gain');
          return;
        }

        const selectedTreasureId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Gain a Treasure from the trash to your hand',
          restrict: treasureIdsInTrash,
          count: 1,
        }) as CardId | null;
        if (!selectedTreasureId) {
          loggerService.warn('[treasurer effect] no Treasure selected to gain');
          return;
        }

        const selectedTreasure = cardEffectArgs.cardLibrary.getCard(selectedTreasureId);
        loggerService.debug(`[treasurer effect] gaining ${selectedTreasure} from trash to hand`);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedTreasureId,
          to: { location: 'playerHand' },
        });
        return;
      }

      // Option 3: take the Key artifact.
      loggerService.debug('[treasurer effect] taking the Key artifact');
      await cardEffectArgs.actionService.run('gainArtifact', {
        playerId: cardEffectArgs.playerId,
        artifactKey: renaissanceArtifactKeys.key,
      });
    },
  },
  'villain': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Villain grants +2 Coffers.
      loggerService.debug('[villain effect] gaining 2 Coffers');
      await cardEffectArgs.actionService.run('gainCoffer', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      // Attack each other non-immune player in turn order.
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((id) => !isPlayerImmune(cardEffectArgs.reactionContext, id));

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        if (hand.length < 5) {
          loggerService.debug(`[villain effect] player ${targetPlayerId} has fewer than 5 cards, skipping`);
          continue;
        }

        // Find cards in hand currently costing $2 or more.
        const discardableIds = hand.filter((cardId) => {
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
            playerId: targetPlayerId,
          });
          return (cost.treasure ?? 0) >= 2;
        });

        // If no eligible discard exists, reveal hand.
        if (!discardableIds.length) {
          loggerService.debug(`[villain effect] player ${targetPlayerId} cannot discard, revealing hand`);
          for (const cardId of hand) {
            await cardEffectArgs.actionService.run('revealCard', {
              playerId: targetPlayerId,
              cardId,
            });
          }
          continue;
        }

        const selectedDiscardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: targetPlayerId,
          prompt: 'Discard a card costing $2 or more',
          restrict: discardableIds,
          count: 1,
        });

        const resolvedDiscardId = selectedDiscardId ?? discardableIds[0];
        const selectedDiscardCard = cardEffectArgs.cardLibrary.getCard(resolvedDiscardId);
        loggerService.debug(`[villain effect] player ${targetPlayerId} discarding ${selectedDiscardCard}`);
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: targetPlayerId,
          cardId: resolvedDiscardId,
        });
      }
    },
  },
};

export default expansion;
