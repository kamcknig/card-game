import { DiscardCardEffect } from '../../core/effects/discard-card.ts';
import { GainBuyEffect } from '../../core/effects/gain-buy.ts';
import { GainCardEffect } from '../../core/effects/gain-card.ts';
import { GainTreasureEffect } from '../../core/effects/gain-treasure.ts';
import { UserPromptEffect } from '../../core/effects/user-prompt.ts';
import { ModifyCostEffect } from '../../core/effects/modify-cost.ts';
import { DrawCardEffect } from '../../core/effects/draw-card.ts';
import { GainActionEffect } from '../../core/effects/gain-action.ts';
import { RevealCardEffect } from '../../core/effects/reveal-card.ts';
import { SelectCardEffect } from '../../core/effects/select-card.ts';
import { MoveCardEffect } from '../../core/effects/move-card.ts';
import { CardExpansionModule } from '../card-expansion-module.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { TrashCardEffect } from '../../core/effects/trash-card.ts';
import { ActionButtons, Card, CardId, CardKey, PlayerId } from 'shared/shared-types.ts';
import { findOrderedEffectTargets } from '../../utils/find-ordered-effect-targets.ts';
import { ShuffleDeckEffect } from '../../core/effects/shuffle-card.ts';

const expansionModule: CardExpansionModule = {
  registerCardLifeCycles: () => ({
    "diplomat": {
      onEnterHand: ({ playerId, cardId }) => ({
        registerTriggers: [{
          id: `diplomat-${cardId}`,
          playerId,
          listeningFor: "cardPlayed",
          condition: ({ match, trigger }) => match.playerHands[playerId].length >= 5 && trigger.playerId !== playerId,
          generatorFn: function* ({ trigger, reaction }) {
            const sourceId = reaction.getSourceId();

            yield new RevealCardEffect({
              sourceCardId: trigger.cardId,
              sourcePlayerId: trigger.playerId,
              cardId: sourceId,
              playerId: reaction.playerId,
            });

            yield new DrawCardEffect({
              playerId,
              sourceCardId: trigger.cardId,
              sourcePlayerId: trigger.playerId,
            });
            yield new DrawCardEffect({
              playerId,
              sourceCardId: trigger.cardId,
              sourcePlayerId: trigger.playerId,
            });
            const cardIds = (yield new SelectCardEffect({
              prompt: "Confirm discard",
              playerId,
              sourceCardId: trigger.playerId,
              restrict: {
                from: {
                  location: "playerHands",
                },
              },
              count: 3,
              sourcePlayerId: trigger.playerId,
            })) as number[];

            for (const cardId of cardIds) {
              yield new DiscardCardEffect({
                playerId,
                sourcePlayerId: trigger.playerId,
                cardId,
              });
            }
          },
        }],
      }),
      onLeaveHand: ({ cardId }) => ({
        unregisterTriggers: [`diplomat-${cardId}`],
      }),
    },
  }),
  registerScoringFunctions: () => ({
    "duke": function ({ match, cardLibrary, ownerId }) {
      const duchies = match.playerHands[ownerId]?.concat(
        match.playerDecks[ownerId],
        match.playerDiscards[ownerId],
        match.playArea,
      ).map(cardLibrary.getCard)
        .filter((card) => card.cardKey === "duchy");

      console.log(
        `[DUKE SCORING] player ${
          getPlayerById(match, ownerId)
        } has ${duchies.length} Duchies`,
      );

      return duchies.length;
    },
  }),
  registerEffects: () => ({
    "baron": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainBuyEffect({
        count: 1,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });

      const hand = match.playerHands[triggerPlayerId];

      const handEstateIdx = hand.findLast((cId) =>
        cardLibrary.getCard(cId).cardKey === "estate"
      );

      const supplyEstateIdx = match.supply.findLast((cId) =>
        cardLibrary.getCard(cId).cardKey === "estate"
      );

      if (!handEstateIdx) {
        console.log(
          `[BARON EFFECT] player has no estates in hand, they gain one`,
        );

        if (!supplyEstateIdx) {
          console.log(`[BARON EFFECT] no estates in supply`);
          return;
        }

        yield new GainCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId!,
          cardId: supplyEstateIdx,
          to: { location: "playerDiscards" },
        });
        return;
      }

      console.log(`[BARON EFFECT] player has an estate in hand`);

      const confirm = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        prompt: "Discard estate?",
        actionButtons: [
          { label: "NO", action: 1 },
          { label: "DISCARD", action: 2 },
        ],
      })) as { action: number };

      if (confirm.action === 2) {
        console.log(
          `[BARON EFFECT] player chooses to discard estate, gain 4 treasure`,
        );

        yield new DiscardCardEffect({
          cardId: handEstateIdx,
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
        });

        yield new GainTreasureEffect({
          count: 4,
          sourcePlayerId: triggerPlayerId,
        });
      } else if (supplyEstateIdx) {
        console.log(
          `[BARON EFFECT] player not discarding estate, gaining one`,
        );

        yield new GainCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          cardId: supplyEstateIdx,
          to: {
            location: "playerDiscards",
          },
        });
      } else {
        console.log(`[BARON EFFECT] no estate in supply`);
      }
    },
    "bridge": () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainBuyEffect({ count: 1, sourcePlayerId: triggerPlayerId });

      yield new GainTreasureEffect({
        count: 1,
        sourcePlayerId: triggerPlayerId,
      });

      yield new ModifyCostEffect({
        appliesToCard: "ALL",
        appliesToPlayer: "ALL",
        amount: -1,
        sourceCardId: triggerCardId!,
        sourcePlayerId: triggerPlayerId,
        expiresAt: "TURN_END",
      });
    },
    "conspirator": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
    }) {
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
      });

      const actionCardCount = match.cardsPlayed[triggerPlayerId]?.filter((
        cardId,
      ) => cardLibrary.getCard(cardId).type.includes("ACTION"));

      console.log(
        `[CONSPIRATOR EFFECT] action cards played so far ${actionCardCount}`,
      );
      if (actionCardCount?.length >= 3) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });

        yield new GainActionEffect({
          count: 1,
          sourcePlayerId: triggerPlayerId,
        });
      }
    },
    "courtier": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      const cardIds = (yield new SelectCardEffect({
        prompt: "Reveal card",
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
        playerId: triggerPlayerId,
        restrict: {
          from: {
            location: "playerHands",
          },
        },
      })) as number[];

      const cardId = cardIds[0];

      yield new RevealCardEffect({
        cardId,
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });

      const cardTypeCount = cardLibrary.getCard(cardId).type.length;
      console.log(`[COURTIER EFFECT] card has ${cardTypeCount} types`);

      const choices = [
        { label: "+1 Action", action: 1 },
        { label: "+1 Buy", action: 2 },
        { label: "+3 Treasure", action: 3 },
        { label: "Gain a gold", action: 4 },
      ];

      for (let i = 0; i < cardTypeCount; i++) {
        const result = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          prompt: "Choose one",
          sourcePlayerId: triggerPlayerId,
          actionButtons: choices,
        })) as { action: number };

        const resultAction = result.action;

        console.log(`[COURTIER EFFECT] player chose ${resultAction}`);

        const idx = choices.findIndex((c) => c.action === resultAction);
        choices.splice(idx, 1);

        switch (resultAction) {
          case 1:
            yield new GainActionEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
              triggerImmediateUpdate: true,
            });
            break;
          case 2:
            yield new GainBuyEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
              triggerImmediateUpdate: true,
            });
            break;
          case 3:
            yield new GainTreasureEffect({
              count: 3,
              sourcePlayerId: triggerPlayerId,
              triggerImmediateUpdate: true,
            });
            break;
          case 4:
            for (let i = match.supply.length - 1; i >= 0; i--) {
              const card = cardLibrary.getCard(match.supply[i]);
              if (card.cardKey === "gold") {
                yield new GainCardEffect({
                  cardId: card.id,
                  playerId: triggerPlayerId,
                  to: {
                    location: "playerDiscards",
                  },
                  sourcePlayerId: triggerPlayerId,
                });
                break;
              }
            }
            break;
        }
      }
    },
    "courtyard": () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });

      const result = (yield new SelectCardEffect({
        prompt: "Top deck",
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
        playerId: triggerPlayerId,
        restrict: {
          from: {
            location: "playerHands",
          },
        },
      })) as number[];

      const cardId = result[0];

      yield new MoveCardEffect({
        cardId,
        toPlayerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        to: {
          location: "playerDecks",
        },
      });
    },
    "diplomat": () => function* ({
      match,
      triggerPlayerId,
    }) {
      for (let i = 0; i < 2; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });
      }

      if (match.playerHands[triggerPlayerId].length <= 5) {
        yield new GainActionEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      } else {
        console.log(
          `[DIPLOMAT EFFECT] player has more than 5 cards in hand, can't perform diplomat`,
        );
      }
    },
    /*"duke": () => function* () {},*/
    "farm": () => function* ({
      triggerPlayerId,
    }) {
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
      });
    },
    "ironworks": () => function* ({
      cardLibrary,
      triggerPlayerId,
    }) {
      const cardIds = (yield new SelectCardEffect({
        prompt: "Choose card",
        count: 1,
        restrict: {
          cost: {
            amount: 4,
            kind: "upTo",
          },
          from: {
            location: ["supply", "kingdom"],
          },
        },
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      })) as number[];

      yield new GainCardEffect({
        cardId: cardIds[0],
        playerId: triggerPlayerId,
        to: {
          location: "playerDiscards",
        },
        sourcePlayerId: triggerPlayerId,
      });

      const card = cardLibrary.getCard(cardIds[0]);

      if (card.type.includes("ACTION")) {
        yield new GainActionEffect({
          count: 1,
          sourcePlayerId: triggerPlayerId,
        });
      }

      if (card.type.includes("TREASURE")) {
        yield new GainTreasureEffect({
          count: 1,
          sourcePlayerId: triggerPlayerId,
        });
      }

      if (card.type.includes("VICTORY")) {
        yield new DrawCardEffect({
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
        });
      }
    },
    "lurker": () => function* ({
      match,
      triggerPlayerId,
    }) {
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });

      let result = { action: 1 };

      const actionButtons: ActionButtons = [
        { action: 1, label: "TRASH CARD" },
      ];

      if (match.trash.length > 0) {
        actionButtons.push({ action: 2, label: "GAIN CARD" });

        result = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          prompt: "Trash action from supply, or gain Action card from trash?",
          actionButtons,
          sourcePlayerId: triggerPlayerId,
        })) as { action: number };
      } else {
        console.log(`[LURKER EFFECT] no cards in trash to select`);
      }

      console.log(
        `[LURKER EFFECT] user choose action ${
          actionButtons.find((a) => a.action === result.action)?.label
        }`,
      );

      if (result.action === 1) {
        const result = (yield new SelectCardEffect({
          prompt: "Confirm trash",
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          count: 1,
          restrict: {
            from: {
              location: ["kingdom", "supply"],
            },
          },
        })) as number[];
        const cardId = result[0];
        yield new TrashCardEffect({
          cardId,
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });
      } else {
        let result;
        if (match.trash.length > 1) {
          result = (yield new UserPromptEffect({
            prompt: "Choose card to gain",
            playerId: triggerPlayerId,
            sourcePlayerId: triggerPlayerId,
            content: {
              type: 'select',
              selectCount: 1,
              cardIds: match.trash,
            },
          })) as { result: number[] };
        } else {
          console.debug(`[LURKER EFFECT] trash only has one card, gaining it automatically`);
          result = { result: match.trash };
        }
        
        const cardId = result.result[0];
        yield new GainCardEffect({
          cardId,
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          to: {
            location: "playerDiscards",
          },
        });
      }
    },
    "masquerade": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
    }) {
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });

      const targets = findOrderedEffectTargets(triggerPlayerId, "ALL", match)
        .filter((playerId) => match.playerHands[playerId].length > 0);

      const playerCardMap = new Map<PlayerId, CardId>();
      for (const playerId of targets) {
        const cardIds = (yield new SelectCardEffect({
          prompt: "Confirm pass",
          sourcePlayerId: triggerPlayerId,
          playerId,
          count: 1,
          restrict: {
            from: {
              location: "playerHands",
            },
          },
        })) as number[];
        playerCardMap.set(playerId, cardIds[0]);
        console.log(
          `[MASQUERADE EFFECT] ${getPlayerById(match, playerId)} chose ${
            cardLibrary.getCard(cardIds[0])
          }`,
        );
      }

      for (let i = 0; i < targets.length; i++) {
        yield new MoveCardEffect({
          cardId: playerCardMap.get(targets[i])!,
          toPlayerId: targets[(i + 1) % targets.length],
          sourcePlayerId: triggerPlayerId,
          to: {
            location: "playerHands",
          },
        });
      }

      const cardIds = (yield new SelectCardEffect({
        prompt: "Cancel trash",
        validPrompt: "Confirm trash",
        count: {
          kind: "upTo",
          count: 1,
        },
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: {
            location: "playerHands",
          },
        },
      })) as number[];
      console.log(
        `[MASQUERADE EFFECT] player chose ${
          cardIds.length ? cardLibrary.getCard(cardIds[0]) : "not to trash"
        }`,
      );

      if (cardIds[0]) {
        yield new TrashCardEffect({
          cardId: cardIds[0],
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
        });
      }
    },
    "mill": () => function* ({
      triggerPlayerId,
    }) {
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });

      const results = (yield new SelectCardEffect({
        prompt: "Cancel discard",
        validPrompt: "Confirm discard",
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: {
            location: "playerHands",
          },
        },
        count: {
          kind: "upTo",
          count: 2,
        },
      })) as number[];

      for (const cardId of results) {
        yield new DiscardCardEffect({
          cardId,
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
        });
      }

      if (results.length === 2) {
        yield new GainTreasureEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      }
    },
    "mining-village": () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId });
      const results = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        actionButtons: [
          { action: 1, label: "NO" },
          { action: 2, label: "YES" },
        ],
        prompt: "Trash Mining Village?",
      })) as { action: number };
      if (results.action === 2) {
        yield new TrashCardEffect({
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId: triggerCardId!,
        });
        yield new GainTreasureEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      } else {
        console.log(
          `[MINING VILLAGE EFFECT] player chose not to trash mining village`,
        );
      }
    },
    "minion": () => function* ({
      match,
      triggerPlayerId,
      reactionContext,
    }) {
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      const results = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        actionButtons: [
          { action: 1, label: "+2 Treasure" },
          { action: 2, label: "Discard hand" },
        ],
      })) as { action: number };

      if (results.action === 1) {
        yield new GainTreasureEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      } else {
        const targets = findOrderedEffectTargets(triggerPlayerId, "ALL", match)
          .filter((playerId) => {
            const handCount = match.playerHands[playerId].length;
            console.log(
              `[MINION EFFECT HANDLER] ${
                getPlayerById(match, playerId)
              } has ${handCount} cards in hand`,
            );
            return playerId === triggerPlayerId ||
              (handCount >= 5 && reactionContext?.[playerId]?.result !== "immunity");
          });

        for (const playerId of targets) {
          const hand = match.playerHands[playerId];
          const l = hand.length;
          for (let i = l - 1; i >= 0; i--) {
            const cardId = hand[i];
            yield new DiscardCardEffect({
              cardId,
              playerId,
              sourcePlayerId: triggerPlayerId,
            });
          }
          for (let i = 0; i < 4; i++) {
            yield new DrawCardEffect({
              playerId,
              sourcePlayerId: triggerPlayerId,
            });
          }
        }
      }
    },
    "nobles": () => function* ({
      triggerPlayerId,
    }) {
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        actionButtons: [
          { action: 1, label: "+3 Cards" },
          { action: 2, label: "+2 Actions" },
        ],
        prompt: "Choose one",
      })) as { action: number };

      console.log(`[NOBLES EFFECT] player chose ${result.action}`);

      if (result.action === 1) {
        for (let i = 0; i < 3; i++) {
          yield new DrawCardEffect({
            playerId: triggerPlayerId,
            sourcePlayerId: triggerPlayerId,
          });
        }
      } else {
        yield new GainActionEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      }
    },
    "patrol": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      for (let i = 0; i < 3; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }

      const revealedCardIds: number[] = [];
      const deck = match.playerDecks[triggerPlayerId];
      for (let i = 0; i < Math.min(4, deck.length); i++) {
        const cardId = deck[deck.length - 1 - i];

        if (!cardId) {
          console.log(`[PATROL EFFECT] no card to reveal`);
          break;
        }

        revealedCardIds.push(cardId);
      }

      for (const cardId of revealedCardIds) {
        yield new RevealCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          cardId,
          playerId: triggerPlayerId,
        });
      }

      const [victoryCards, nonVictoryCards] = revealedCardIds
        .map(cardLibrary.getCard)
        .reduce((prev, card) => {
          if (card.type.includes("VICTORY") || card.cardKey === "curse") {
            prev[0].push(card);
          } else {
            prev[1].push(card);
          }
          return prev;
        }, [[], []] as Card[][]);

      for (const card of victoryCards) {
        yield new MoveCardEffect({
          cardId: card.id,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: {
            location: "playerHands",
          },
        });
      }

      if (nonVictoryCards.length < 2) {
        console.log(
          `[PATROL EFFECT] non-victory card count is ${nonVictoryCards.length}, no need to rearrange`,
        );
        return;
      }

      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        prompt: "Choose order to put back on deck",
        content: {
          type: 'rearrange',
          cardIds: nonVictoryCards.map((card) => card.id),
        },
        actionButtons: [
          { action: 1, label: "DONE" },
        ],
      })) as { action: number; result: number[] };

      for (
        const cardId of result.result ?? nonVictoryCards.map((card) => card.id)
      ) {
        yield new MoveCardEffect({
          cardId,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: {
            location: "playerDecks",
          },
        });
      }
    },
    "pawn": () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      const actions = [
        { action: 1, label: "+1 Card" },
        { action: 2, label: "+1 Action" },
        { action: 3, label: "+1 Buy" },
        { action: 4, label: "+1 Treasure" },
      ];

      for (let i = 0; i < 2; i++) {
        const result = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          actionButtons: actions,
          prompt: "Choose one",
        })) as { action: number };

        switch (result.action) {
          case 1:
            yield new DrawCardEffect({
              playerId: triggerPlayerId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
            });
            break;
          case 2:
            yield new GainActionEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
              triggerImmediateUpdate: true,
            });
            break;
          case 3:
            yield new GainBuyEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
              triggerImmediateUpdate: true,
            });
            break;
          case 4:
            yield new GainTreasureEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
              triggerImmediateUpdate: true,
            });
            break;
        }

        actions.splice(actions.findIndex((a) => a.action === result.action), 1);
      }
    },
    "replace": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      let result = (yield new SelectCardEffect({
        prompt: "Trash card",
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: {
            location: "playerHands",
          },
        },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];

      let cardId = result[0];

      yield new TrashCardEffect({
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId,
        sourceCardId: triggerCardId,
      });

      let card = cardLibrary.getCard(cardId);

      result = (yield new SelectCardEffect({
        prompt: "Gain card",
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: {
            location: ["kingdom", "supply"],
          },
          cost: {
            kind: "upTo",
            amount: card.cost.treasure + 2,
          },
        },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];

      cardId = result[0];
      card = cardLibrary.getCard(cardId);

      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId!,
        cardId,
        to: {
          location: card.type.some((t) => ["ACTION", "TREASURE"].includes(t))
            ? "playerDecks"
            : "playerDiscards",
        },
      });

      if (card.type.includes("VICTORY")) {
        const targets = findOrderedEffectTargets(
          triggerPlayerId,
          "ALL_OTHER",
          match,
        ).filter((id) => reactionContext?.[id]?.result !== "immunity");
        for (const targetId of targets) {
          for (let i = match.supply.length - 1; i >= 0; i--) {
            const potentialCard = cardLibrary.getCard(match.supply[i]);
            if (potentialCard.cardKey !== "curse") continue;
            yield new GainCardEffect({
              playerId: targetId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId!,
              cardId: potentialCard.id,
              to: { location: "playerDiscards" },
            });
            break;
          }
        }
      }
    },
    "secret-passage": () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
    }) {
      for (let i = 0; i < 2; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }

      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });

      if (match.playerHands[triggerPlayerId].length === 0) {
        console.log(`[SECRET PASSAGE EFFECT] player has no cards in hand`);
        return;
      }

      const cardIds = (yield new SelectCardEffect({
        prompt: "Choose card",
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: { from: { location: "playerHands" } },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];

      const cardId = cardIds?.[0];

      if (!cardId) {
        console.warn(
          `[SECRET PASSAGE EFFECT] player selected card, but result doesn't have it`,
        );
        return;
      }

      if (match.playerDecks[triggerPlayerId].length === 0) {
        console.log(
          `[SECRET PASSAGE EFFECT] player has no cards in deck, so just putting card on deck`,
        );
        yield new MoveCardEffect({
          cardId,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: {
            location: "playerDecks",
          },
        });
        return;
      }

      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        actionButtons: [
          { action: 1, label: "DONE" },
        ],
        prompt: "Position card",
        content: {
          type: 'blind-rearrange',
          cardIds: match.playerDecks[triggerPlayerId],
        },
      })) as { action: number; result: number };

      const idx = result.result;
      yield new MoveCardEffect({
        cardId,
        toPlayerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        to: {
          location: "playerDecks",
          index: idx,
        },
      });
    },
    "shanty-town": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId });

      const hand = match.playerHands[triggerPlayerId];

      for (const cardId of hand) {
        yield new RevealCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          cardId,
          playerId: triggerPlayerId,
        });
      }

      if (
        !hand.some((cardId) =>
          cardLibrary.getCard(cardId).type.includes("ACTION")
        )
      ) {
        for (let i = 0; i < 2; i++) {
          yield new DrawCardEffect({
            playerId: triggerPlayerId,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
          });
        }
      }
    },
    "steward": () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
    }) {
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        actionButtons: [
          { action: 1, label: "+2 Card" },
          { action: 2, label: "+2 Treasure" },
          { action: 3, label: "Trash 2 cards" },
        ],
        prompt: "Choose on",
      })) as { action: number };

      switch (result.action) {
        case 1:
          for (let i = 0; i < 2; i++) {
            yield new DrawCardEffect({
              playerId: triggerPlayerId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
            });
          }
          break;
        case 2:
          yield new GainTreasureEffect({
            count: 2,
            sourcePlayerId: triggerPlayerId,
          });
          break;
        case 3: {
          const cardIds = (yield new SelectCardEffect({
            prompt: "Confirm trash",
            playerId: triggerPlayerId,
            sourcePlayerId: triggerPlayerId,
            restrict: { from: { location: "playerHands" } },
            count: Math.min(2, match.playerHands[triggerPlayerId].length),
            sourceCardId: triggerCardId,
          })) as number[];

          for (const cardId of cardIds) {
            yield new TrashCardEffect({
              sourcePlayerId: triggerPlayerId,
              playerId: triggerPlayerId,
              cardId,
              sourceCardId: triggerCardId!,
            });
          }
          break;
        }
      }
    },
    "swindler": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
      });

      const targets = findOrderedEffectTargets(
        triggerPlayerId,
        "ALL_OTHER",
        match,
      ).filter((id) => reactionContext?.[id]?.result !== "immunity");
      for (const target of targets) {
        let cardId = match.playerDecks[target].slice(-1)?.[0];
        if (!cardId) continue;
        yield new TrashCardEffect({
          sourcePlayerId: triggerPlayerId,
          playerId: target,
          cardId: cardId,
          sourceCardId: triggerCardId!,
        });
        const card = cardLibrary.getCard(cardId);
        const cardIds = (yield new SelectCardEffect({
          prompt: "Choose card",
          validPrompt: "",
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          restrict: {
            from: { location: ["supply", "kingdom"] },
            cost: card.cost.treasure,
          },
          count: 1,
          sourceCardId: triggerCardId,
        })) as number[];
        cardId = cardIds[0];
        if (!cardId) {
          return;
        }
        yield new GainCardEffect({
          playerId: target,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId!,
          cardId,
          to: { location: "playerDiscards" },
        });
      }
    },
    "torturer": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      for (let i = 0; i < 3; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }

      const targets = findOrderedEffectTargets(
        triggerPlayerId,
        "ALL_OTHER",
        match,
      ).filter((id) => reactionContext?.[id]?.result !== "immunity");
      
      // Each other player either discards 2 cards or gains a Curse to their hand,
      // their choice. (They may pick an option they can't do.)",
      for (const target of targets) {
        const result = (yield new UserPromptEffect({
          playerId: target,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          actionButtons: [
            { action: 1, label: "DISCARD" },
            { action: 2, label: "GAIN CURSE" },
          ],
          prompt: "Choose one",
        })) as { action: number; };

        if (result.action === 1) {
          const cardIds = (yield new SelectCardEffect({
            prompt: "Confirm discard",
            playerId: target,
            sourcePlayerId: triggerPlayerId,
            restrict: { from: { location: "playerHands" } },
            count: Math.min(2, match.playerHands[target].length),
            sourceCardId: triggerCardId,
            autoSelect: match.playerHands[target].length <= 2
          })) as number[];

          for (const cardId of cardIds) {
            yield new DiscardCardEffect({
              cardId,
              playerId: target,
              sourcePlayerId: triggerPlayerId,
            });
          }
        } else {
          for (let i = match.supply.length - 1; i >= 0; i--) {
            const cardId = match.supply[i];
            const card = cardLibrary.getCard(cardId);
            if (card.cardKey !== 'curse') continue;
            yield new GainCardEffect({
              playerId: target,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId!,
              cardId: cardId,
              to: { location: 'playerHands' },
            });
          }
        }
      }
    },
    "trading-post": () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
      cardLibrary,
    }) {
      const cardIds = (yield new SelectCardEffect({
        prompt: "Confirm trash",
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: { from: { location: "playerHands" } },
        count: Math.min(2, match.playerDecks[triggerPlayerId].length),
        sourceCardId: triggerCardId,
      })) as number[];

      for (const cardId of cardIds) {
        yield new TrashCardEffect({
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId,
          sourceCardId: triggerCardId!,
        });
      }

      if (cardIds.length === 2) {
        for (let i = match.supply.length - 1; i >= 0; i--) {
          const card = cardLibrary.getCard(match.supply[i]);
          if (card.cardKey === "silver") {
            yield new GainCardEffect({
              playerId: triggerPlayerId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId!,
              cardId: card.id,
              to: { location: "playerHands" },
            });
            break;
          }
        }
      } else {
        console.log(
          `[TRADING POST EFFECT] player trashed ${cardIds.length}, so no treasure gained`,
        );
      }
    },
    "upgrade": () => function* ({
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });

      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });

      const cardIds = (yield new SelectCardEffect({
        prompt: "Confirm trash",
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: { from: { location: "playerHands" } },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];

      if (cardIds.length === 0) {
        console.log(`[UPGRADE EFFECT] player trashed no cards`);
        return;
      }

      const card = cardLibrary.getCard(cardIds[0]);

      yield new SelectCardEffect({
        prompt: "Gain card",
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: { location: ["supply", "kingdom"] },
          cost: card.cost.treasure + 1,
        },
        count: 1,
        sourceCardId: triggerCardId,
      });
    },
    "wishing-well": () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId
    }) {
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId
      });
      
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      // Name a card, then reveal the top card of your deck. If you named it, put it into your hand."
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        content: {
          type: 'name-card'
        },
        prompt: 'Name a card',
      })) as { action: number, result: CardKey };
      
      const cardKey: CardKey = result.result;
      
      if (match.playerDecks[triggerPlayerId].length === 0) {
        console.log(`[WISHING WELL EFFECT] shuffling player's deck`)
        yield new ShuffleDeckEffect({
          playerId: triggerPlayerId
        });
      }
      
      const cardId = match.playerDecks[triggerPlayerId].slice(-1)[0];
      
      yield new RevealCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId,
        playerId: triggerPlayerId,
      });
      
      if (cardLibrary.getCard(cardId).cardKey === cardKey) {
        yield new MoveCardEffect({
          cardId,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: {
            location: 'playerHands',
          }
        })
      }
    },
  }),
};

export default expansionModule;
