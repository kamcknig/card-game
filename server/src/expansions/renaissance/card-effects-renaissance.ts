import { Card, CardId } from 'shared/types/index.ts';
import { CardExpansionModule } from '@server-types/index.ts';

// Renaissance card effects module (artifacts handled separately).
const expansion: CardExpansionModule = {
  'border-guard': {
    registerEffects: () => async (cardEffectArgs) => {
      // Border Guard grants +1 Action on play.
      console.debug('[border-guard effect] gaining 1 action');
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      // Resolve whether the player currently owns the Lantern artifact.
      const artifacts = cardEffectArgs.match.artifacts;
      const ownedArtifacts = artifacts?.byPlayer?.[cardEffectArgs.playerId] ?? [];
      const lantern = artifacts?.cards?.find((candidate) => candidate.cardKey === 'lantern');
      const hasLantern = !!lantern && ownedArtifacts.includes(lantern.id);
      const revealCount = hasLantern ? 3 : 2;

      console.debug(`[border-guard effect] revealing ${revealCount} card(s) (lantern: ${hasLantern})`);

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const revealedCards: Card[] = [];

      // Reveal the top N cards, shuffling if needed.
      for (let index = 0; index < revealCount; index++) {
        if (deck.length < 1) {
          console.debug('[border-guard effect] deck empty, shuffling discard');
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          if (deck.length < 1) {
            console.debug('[border-guard effect] no cards to reveal after shuffling');
            break;
          }
        }

        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        revealedCards.push(card);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });
      }

      if (!revealedCards.length) {
        console.debug('[border-guard effect] no cards revealed');
        return;
      }

      // Prompt the player to choose one revealed card to put into hand.
      const revealedIds = revealedCards.map((card) => card.id);
      const selectedIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card to put into your hand',
        restrict: revealedIds,
        count: 1,
      }) as CardId[];

      const chosenId = selectedIds[0] ?? revealedIds[0];
      console.debug(`[border-guard effect] moving chosen card ${chosenId} to hand`);
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: chosenId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerHand' },
      });

      // Discard the remaining revealed cards.
      for (const card of revealedCards) {
        if (card.id === chosenId) continue;
        console.debug(`[border-guard effect] discarding revealed card ${card}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
      }

      // Only award artifacts when the full reveal count was met and all were Actions.
      if (revealedCards.length !== revealCount) {
        console.debug('[border-guard effect] revealed fewer than required, skipping artifact');
        return;
      }
      const allActions = revealedCards.every((card) => card.type.includes('ACTION'));
      if (!allActions) {
        console.debug('[border-guard effect] revealed cards not all actions, skipping artifact');
        return;
      }

      // Determine which artifacts are available to take.
      const horn = artifacts?.cards?.find((candidate) => candidate.cardKey === 'horn');
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
        console.debug('[border-guard effect] no artifacts available to take');
        return;
      }

      if (availableArtifacts.length === 1) {
        const selectedArtifact = availableArtifacts[0];
        console.debug(`[border-guard effect] gaining artifact ${selectedArtifact.artifactId}`);
        await cardEffectArgs.runGameActionDelegate('gainArtifact', {
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
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Take an Artifact?',
        actionButtons,
      }) as { action: number };

      const selectedArtifact = availableArtifacts[result.action - 1];
      if (!selectedArtifact) {
        console.warn('[border-guard effect] no artifact found to gain');
        return;
      }

      console.debug(`[border-guard effect] gaining artifact ${selectedArtifact.artifactId}`);
      await cardEffectArgs.runGameActionDelegate('gainArtifact', {
        playerId: cardEffectArgs.playerId,
        artifactId: selectedArtifact.artifactId,
      });
    },
  },
  'acting-troupe': {
    registerEffects: () => async (cardEffectArgs) => {
      const actingTroupeCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Acting Troupe always grants +4 Villagers even if the trash step later cannot happen.
      console.debug('[acting-troupe effect] granting +4 Villagers');
      await cardEffectArgs.runGameActionDelegate('gainVillager', {
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
        console.debug(
          `[acting-troupe effect] skipping trash for ${actingTroupeCard}; source location is ${sourceLocation ?? 'unknown'}`,
        );
        return;
      }

      console.debug(`[acting-troupe effect] trashing ${actingTroupeCard}`);
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: actingTroupeCard.id,
      });
    },
  },
  'cargo-ship': {
    registerEffects: () => async (cardEffectArgs) => {
      const cargoShipCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Build a per-play identifier so replaying Cargo Ship in one turn doesn't collide trigger IDs.
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[cardEffectArgs.match.turnNumber] ?? [];
      const cargoShipPlayInstance = playedThisTurn
        .filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;
      const cardGainedTriggerIdSuffix = `card-gained:${cargoShipPlayInstance}`;

      // Cargo Ship gives +$2 immediately when played.
      console.debug('[cargo-ship effect] gaining +2 treasure');
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

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

            console.debug(`[cargo-ship cardGained effect] gained ${gainedCard}; prompting set-aside choice`);
            const promptResult = await triggeredArgs.runGameActionDelegate('userPrompt', {
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
              console.debug('[cargo-ship cardGained effect] player declined set-aside');
              return;
            }

            hasSetAsideCard = true;
            setAsideCardId = gainedCardId;

            console.debug(`[cargo-ship cardGained effect] setting aside ${gainedCard}`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: gainedCardId,
              toPlayerId: cardEffectArgs.playerId,
              to: { location: 'set-aside' },
              facing: 'front',
            });

            // This play of Cargo Ship can only set aside one gained card.
            triggeredArgs.reactionManager.unregisterTrigger(cardGainedTriggerId);

            // If Cargo Ship is not in play, the set-aside card remains set aside for the rest of the game.
            if (!isCargoShipInPlay()) {
              console.debug(
                '[cargo-ship cardGained effect] Cargo Ship is no longer in play; set-aside card will stay set aside',
              );
              return;
            }

            console.debug('[cargo-ship cardGained effect] registering next-turn retrieval');

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
                await startTurnArgs.runGameActionDelegate('moveCard', {
                  cardId: cargoShipCard.id,
                  to: { location: 'playArea' },
                });

                if (setAsideCardId === undefined) {
                  console.debug('[cargo-ship startTurn effect] no card was set aside');
                  return;
                }

                const setAsideCards = startTurnArgs.cardSourceController.getSource(
                  'set-aside',
                  cardEffectArgs.playerId,
                );
                if (!setAsideCards.includes(setAsideCardId)) {
                  console.debug(
                    `[cargo-ship startTurn effect] set-aside card ${setAsideCardId} no longer in set-aside zone`,
                  );
                  return;
                }

                const cardToMove = startTurnArgs.cardLibrary.getCard(setAsideCardId);
                console.debug(`[cargo-ship startTurn effect] moving ${cardToMove} to hand`);
                await startTurnArgs.runGameActionDelegate('moveCard', {
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
          console.debug('[cargo-ship endTurn effect] removing gain listener for this play');
          triggeredArgs.reactionManager.unregisterTrigger(cardGainedTriggerId);
        },
      }, { idSuffix: `cleanup-gain-listener:${cargoShipPlayInstance}` });
    },
  },
  'ducat': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        // Ducat lets you optionally trash one Copper from hand when gained.
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', eventArgs.playerId);
        const copperInHandIds = hand.filter((cardId) => cardEffectArgs.cardLibrary.getCard(cardId).cardKey === 'copper');
        if (!copperInHandIds.length) {
          console.debug('[ducat onGained effect] no Copper in hand to trash');
          return;
        }

        console.debug(`[ducat onGained effect] prompting whether to trash Copper from ${copperInHandIds.length} card(s)`);
        const promptResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: eventArgs.playerId,
          prompt: 'Trash a Copper from your hand?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
        }) as { action?: number } | null;

        if (promptResult?.action !== 2) {
          console.debug('[ducat onGained effect] player declined to trash Copper');
          return;
        }

        const selectedCopperId = copperInHandIds[0];
        const selectedCopper = cardEffectArgs.cardLibrary.getCard(selectedCopperId);
        console.debug(`[ducat onGained effect] trashing ${selectedCopper}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: eventArgs.playerId,
          cardId: selectedCopperId,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      // Ducat grants +1 Coffer and +1 Buy when played.
      console.debug('[ducat effect] gaining +1 Coffer and +1 Buy');
      await cardEffectArgs.runGameActionDelegate('gainCoffer', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.runGameActionDelegate('gainBuy', {
        count: 1,
      });
    },
  },
  'experiment': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        // Experiment gains one additional copy from supply without chaining further onGained effects.
        const experimentCardsInSupply = cardEffectArgs.findCards([
          { location: ['kingdomSupply', 'basicSupply'] },
          { cardKeys: 'experiment' },
        ]);

        if (!experimentCardsInSupply.length) {
          console.debug('[experiment onGained effect] no Experiment in supply to gain');
          return;
        }

        const experimentToGain = experimentCardsInSupply.slice(-1)[0];
        console.debug(`[experiment onGained effect] gaining additional ${experimentToGain}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: eventArgs.playerId,
          cardId: experimentToGain.id,
          to: { location: 'playerDiscard' },
        }, {
          loggingContext: { source: eventArgs.cardId },
          suppressLifeCycle: { events: ['onGained'] },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const experimentCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Experiment gives +2 Cards and +1 Action every time it is played.
      console.debug('[experiment effect] drawing 2 cards and gaining 1 action');
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      }, {
        loggingContext: { source: cardEffectArgs.cardId },
      });
      await cardEffectArgs.runGameActionDelegate('gainAction', {
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
        console.debug('[experiment effect] card is not in play; skipping return to pile');
        return;
      }

      // If no Experiment pile exists in this game, Experiment stays where it is.
      const hasBasicPile = (cardEffectArgs.match.config.basicSupply ?? []).some((supply) => supply.name === 'experiment');
      const hasKingdomPile = (cardEffectArgs.match.config.kingdomSupply ?? []).some((supply) =>
        supply.name === 'experiment'
      );
      if (!hasBasicPile && !hasKingdomPile) {
        console.debug('[experiment effect] no Experiment pile in current supply; skipping return');
        return;
      }

      const returnLocation = hasBasicPile ? 'basicSupply' : 'kingdomSupply';
      console.debug(`[experiment effect] returning ${experimentCard} to ${returnLocation}`);
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: experimentCard.id,
        to: { location: returnLocation },
      });
    },
  },
};

export default expansion;
