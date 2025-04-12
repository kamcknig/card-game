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
    'diplomat': {
      onEnterHand: ({ playerId, cardId }) => ({
        registerTriggers: [{
          id: `diplomat-${cardId}`,
          playerId,
          listeningFor: 'cardPlayed',
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
              prompt: 'Confirm discard',
              playerId,
              sourceCardId: trigger.playerId,
              restrict: {
                from: {
                  location: 'playerHands',
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
    'duke': function ({ match, cardLibrary, ownerId }) {
      const duchies = match.playerHands[ownerId]?.concat(
        match.playerDecks[ownerId],
        match.playerDiscards[ownerId],
        match.playArea,
      ).map(cardLibrary.getCard)
        .filter((card) => card.cardKey === 'duchy');
      
      console.log(
        `[DUKE SCORING] player ${
          getPlayerById(match, ownerId)
        } has ${duchies.length} Duchies`,
      );
      
      return duchies.length;
    },
  }),
  registerEffects: () => ({
    'baron': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      // +1 Buy
      // You may discard an Estate for +$4. If you don't, gain an Estate.
      
      console.log(`[BARON EFFECT] gaining 1 buy...`);
      
      yield new GainBuyEffect({
        count: 1,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
      
      const hand = match.playerHands[triggerPlayerId];
      
      const handEstateIdx = hand.findLast((cId) =>
        cardLibrary.getCard(cId).cardKey === 'estate'
      );
      
      const supplyEstateIdx = match.supply.findLast((cId) =>
        cardLibrary.getCard(cId).cardKey === 'estate'
      );
      
      if (!handEstateIdx) {
        console.log(`[BARON EFFECT] player has no estates in hand, they gain one`);
        
        if (!supplyEstateIdx) {
          console.log(`[BARON EFFECT] no estates in supply`);
          return;
        }
      } else {
        console.log(`[BARON EFFECT] player has an estate in hand`);
        
        const confirm = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          prompt: 'Discard estate?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'DISCARD', action: 2 },
          ],
        })) as { action: number };
        
        if (confirm.action === 2) {
          console.log(`[BARON EFFECT] player chooses to discard estate, gain 4 treasure`);
          
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
          
          return
        }
      }
      
      if (!supplyEstateIdx) {
        console.log(`[BARON EFFECT] no estate in supply`);
        return;
      }
      
      console.log(`[BARON EFFECT] player not discarding estate, gain ${cardLibrary.getCard(supplyEstateIdx)}...`);
      
      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        cardId: supplyEstateIdx,
        to: { location: 'playerDiscards' },
      });
    },
    'bridge': () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      console.log(`[BRIDGE EFFECT] gaining 1 buy...`);
      
      yield new GainBuyEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      console.log(`[BRIDGE EFFECT] gaining 1 treasure...`);
      
      yield new GainTreasureEffect({
        count: 1,
        sourcePlayerId: triggerPlayerId,
      });
      
      console.log(`[BRIDGE EFFECT] modify cost by -1 of all cards...`);
      
      yield new ModifyCostEffect({
        appliesToCard: 'ALL',
        appliesToPlayer: 'ALL',
        amount: -1,
        sourceCardId: triggerCardId!,
        sourcePlayerId: triggerPlayerId,
        expiresAt: 'TURN_END',
      });
    },
    'conspirator': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
    }) {
      console.log(`[CONSPIRATOR EFFECT] gaining 2 treasure...`);
      
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
      });
      
      const actionCardCount = match.cardsPlayed[triggerPlayerId]?.filter((
        cardId,
      ) => cardLibrary.getCard(cardId).type.includes('ACTION'));
      
      console.log(`[CONSPIRATOR EFFECT] action cards played so far ${actionCardCount}`);
      
      if (actionCardCount?.length >= 3) {
        console.log(`[CONSPIRATOR EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });
        
        console.log(`[CONSPIRATOR EFFECT] gaining 1 action...`);
        
        yield new GainActionEffect({
          count: 1,
          sourcePlayerId: triggerPlayerId,
        });
      }
    },
    'courtier': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      const hand = match.playerHands[triggerPlayerId];
      
      if (!hand.length) {
        console.log(`[COURTIER EFFECT] no cards in hand`);
        return;
      }
      
      console.log(`[COURTIER EFFECT] prompting user to reveal a card...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Reveal card',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
        playerId: triggerPlayerId,
        restrict: {
          from: { location: 'playerHands' },
        },
      })) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[COURTIER EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
      
      yield new RevealCardEffect({
        cardId,
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      
      let cardTypeCount = cardLibrary.getCard(cardId).type.length;
      
      console.log(`[COURTIER EFFECT] card has ${cardTypeCount} types`);
      
      cardTypeCount = Math.min(cardTypeCount, 4);
      
      console.log(`[COURTIER EFFECT] final choice count ${cardTypeCount}`);
      
      const choices = [
        { label: '+1 Action', action: 1 },
        { label: '+1 Buy', action: 2 },
        { label: '+3 Treasure', action: 3 },
        { label: 'Gain a gold', action: 4 },
      ];
      
      for (let i = 0; i < cardTypeCount; i++) {
        console.log(`[COURTIER EFFECT] prompting user to select an action...`);
        
        const result = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          prompt: 'Choose one',
          sourcePlayerId: triggerPlayerId,
          actionButtons: choices,
        })) as { action: number };
        
        const resultAction = result.action;
        
        console.log(`[COURTIER EFFECT] player chose '${choices.find(c => c.action === resultAction)?.label}'`);
        
        const idx = choices.findIndex((c) => c.action === resultAction);
        choices.splice(idx, 1);
        
        switch (resultAction) {
          case 1:
            console.log(`[COURTIER EFFECT] gaining 1 action...`);
            yield new GainActionEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
            });
            break;
          case 2:
            console.log(`[COURTIER EFFECT] gaining 1 buy...`);
            yield new GainBuyEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
            });
            break;
          case 3:
            console.log(`[COURTIER EFFECT] gaining 1 treasure...`);
            yield new GainTreasureEffect({
              count: 3,
              sourcePlayerId: triggerPlayerId,
            });
            break;
          case 4: {
            const goldCardId = match.supply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'gold');
            
            if (!goldCardId) {
              console.log(`[COURTIER EFFECT] no gold in supply...`);
              break;
            }
            
            console.log(`[COURTIER EFFECT] gaining ${cardLibrary.getCard(goldCardId)}...`);
            yield new GainCardEffect({
              cardId: goldCardId,
              playerId: triggerPlayerId,
              to: {
                location: 'playerDiscards',
              },
              sourcePlayerId: triggerPlayerId,
            });
            break;
          }
        }
      }
    },
    'courtyard': () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
      cardLibrary
    }) {
      for (let i = 0; i < 3; i++) {
        console.log(`[COURTYARD EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });
      }
      
      const hand = match.playerHands[triggerPlayerId];
      
      if (!hand.length) {
        console.log(`[COURTYARD EFFECT] no cards in hand`);
        return;
      }
      
      console.log(`[COURTYARD EFFECT] prompting user to put card onto deck...`);
      
      const result = (yield new SelectCardEffect({
        prompt: 'Top deck',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
        playerId: triggerPlayerId,
        restrict: {
          from: { location: 'playerHands' },
        },
      })) as number[];
      
      const cardId = result[0];
      
      console.log(`[COURTYARD EFFECT] moving ${cardLibrary.getCard(cardId)} to top of deck...`);
      
      yield new MoveCardEffect({
        cardId,
        toPlayerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        to: { location: 'playerDecks' },
      });
    },
    'diplomat': () => function* ({
      match,
      triggerPlayerId,
    }) {
      for (let i = 0; i < 2; i++) {
        console.log(`[DIPLOMAT EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });
      }
      
      const cardCount = match.playerHands[triggerPlayerId].length;
      if (cardCount <= 5) {
        console.log(`[DIPLOMAT EFFECT] gaining 2 actions...`);
        
        yield new GainActionEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      } else {
        console.log(`[DIPLOMAT EFFECT] player has more than ${cardCount} cards in hand, can't perform diplomat`,);
      }
    },
    // deno-lint-ignore require-yield
    'duke': () => function* () {
      console.log(`[DUKE EFFECT] duke has no effects`);
    },
    'farm': () => function* ({
      triggerPlayerId,
    }) {
      console.log(`[FARM EFFECT] gaining 2 treasure...`);
      
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
      });
    },
    'ironworks': () => function* ({
      cardLibrary,
      triggerPlayerId,
    }) {
      console.log(`[IRONWORKS EFFECT] prompting user to choose card costing up to 4...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Choose card',
        count: 1,
        restrict: {
          cost: {
            amount: 4,
            kind: 'upTo',
          },
          from: { location: ['supply', 'kingdom'] },
        },
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      })) as number[];
      
      console.log(`[IRONWORKS EFFECT] gaining ${cardLibrary.getCard(cardIds[0])}...`);
      
      yield new GainCardEffect({
        cardId: cardIds[0],
        playerId: triggerPlayerId,
        to: { location: 'playerDiscards' },
        sourcePlayerId: triggerPlayerId,
      });
      
      const card = cardLibrary.getCard(cardIds[0]);
      
      if (card.type.includes('ACTION')) {
        console.log(`[IRONWORKS EFFECT] card is an action, gaining 1 action...`);
        
        yield new GainActionEffect({
          count: 1,
          sourcePlayerId: triggerPlayerId,
        });
      }
      
      if (card.type.includes('TREASURE')) {
        console.log(`[IRONWORKS EFFECT] card is a treasure, gaining 1 treasure...`);
        
        yield new GainTreasureEffect({
          count: 1,
          sourcePlayerId: triggerPlayerId,
        });
      }
      
      if (card.type.includes('VICTORY')) {
        console.log(`[IRONWORKS EFFECT] card is a victory, drawing card...`);
        
        yield new DrawCardEffect({
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
        });
      }
    },
    'lurker': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
    }) {
      console.log(`[LURKER EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      let result = { action: 1 };
      
      const actionButtons: ActionButtons = [
        { action: 1, label: 'TRASH CARD' },
        { action: 2, label: 'GAIN CARD' }
      ];
      
      result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        prompt: 'Trash Action card from supply, or gain Action card from trash?',
        actionButtons,
        sourcePlayerId: triggerPlayerId,
      })) as { action: number };
      
      console.log(`[LURKER EFFECT] user choose action ${actionButtons.find((a) => a.action === result.action)?.label}`);
      
      if (result.action === 1) {
        console.log(`[LURKER EFFECT] prompting user to select card to trash...`);
        
        const result = (yield new SelectCardEffect({
          prompt: 'Confirm trash',
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          count: 1,
          restrict: {
            card: { type: 'ACTION' },
            from: { location: ['kingdom', 'supply'] },
          },
        })) as number[];
        
        const cardId = result[0];
        
        console.log(`[LURKER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        
        yield new TrashCardEffect({
          cardId,
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });
      } else {
        const actionCardIds = match.trash.filter(cardId => cardLibrary.getCard(cardId).type.includes('ACTION'));
        
        if (!actionCardIds.length) {
          console.log(`[LURKER EFFECT] trash has no action cards`);
          return;
        }
        
        console.log(`[LURKER EFFECT] prompting user to select action card to gain...`);
        
        const result = (yield new UserPromptEffect({
          prompt: 'Choose card to gain',
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          content: {
            type: 'select',
            selectCount: 1,
            cardIds: actionCardIds,
          },
        })) as { result: number[] };
        
        const cardId = result.result[0];
        
        console.log(`[LURKER EFFECT] gaining ${cardLibrary.getCard(cardId)}...`);
        
        yield new GainCardEffect({
          cardId,
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          to: { location: 'playerDiscards' },
        });
      }
    },
    'masquerade': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
    }) {
      for (let i = 0; i < 2; i++) {
        console.log(`[MASQUERADE EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });
      }
      
      const targets = findOrderedEffectTargets(triggerPlayerId, 'ALL', match)
        .filter((playerId) => match.playerHands[playerId].length > 0);
      
      console.log(`[MASQUERADE EFFECT] targets in order ${targets.map(t => getPlayerById(match, t)).join(',')}`);
      
      const playerCardMap = new Map<PlayerId, CardId>();
      
      for (const playerId of targets) {
        console.log(`[LURKER EFFECT] prompting ${getPlayerById(match, playerId)} to choose a card...`);
        
        const cardIds = (yield new SelectCardEffect({
          prompt: 'Confirm pass',
          sourcePlayerId: triggerPlayerId,
          playerId,
          count: 1,
          restrict: {
            from: { location: 'playerHands' },
          },
        })) as number[];
        
        playerCardMap.set(playerId, cardIds[0]);
        
        console.log(`[MASQUERADE EFFECT] ${getPlayerById(match, playerId)} chose ${cardLibrary.getCard(cardIds[0])}`);
      }
      
      for (let i = 0; i < targets.length; i++) {
        const cardId = playerCardMap.get(targets[i]);
        const playerId = targets[(i + 1) % targets.length];
        
        console.log(`[MASQUERADE EFFECT] moving ${cardLibrary.getCard(cardId!)} to ${getPlayerById(match, playerId!)}`);
        
        yield new MoveCardEffect({
          cardId: cardId!,
          toPlayerId: playerId!,
          sourcePlayerId: triggerPlayerId,
          to: { location: 'playerHands' },
        });
      }
      
      console.log(`[MASQUERADE EFFECT] prompting user to trash card from hand...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        count: {
          kind: 'upTo',
          count: 1,
        },
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: {location: 'playerHands' },
        },
      })) as number[];
      
      console.log(`[MASQUERADE EFFECT] player chose ${cardIds.length ? cardLibrary.getCard(cardIds[0]) : 'not to trash'}`);
      
      if (cardIds[0]) {
        console.log(`[MASQUERADE EFFECT] trashing ${cardLibrary.getCard(cardIds[0])}...`);
        
        yield new TrashCardEffect({
          cardId: cardIds[0],
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
        });
      }
    },
    'mill': () => function* ({
      triggerPlayerId,
      match,
      cardLibrary
    }) {
      console.log(`[MILL EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      
      console.log(`[MILL EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      if (match.playerHands[triggerPlayerId].length < 2) {
        console.log(`[MILL EFFECT] player has less than 2 cards in hand`);
        return;
      }
      
      console.log(`[MILL EFFECT] prompting user to select cards to discard`);
      
      const results = (yield new SelectCardEffect({
        prompt: 'Confirm discard',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: { location: 'playerHands' },
        },
        count: 2,
      })) as number[];
      
      for (const cardId of results) {
        console.log(`[MILL EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
        
        yield new DiscardCardEffect({
          cardId,
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
        });
      }
      
      console.log(`[MILL EFFECT] gaining 2 treasure...`);
      
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
      });
    },
    'mining-village': () => function* ({
      triggerPlayerId,
      triggerCardId,
      cardLibrary
    }) {
      console.log(`[MINING VILLAGE EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      
      console.log(`[MINING VILLAGE EFFECT] gaining 2 actions`);
      
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId });
      
      console.log(`[MINING VILLAGE EFFECT] prompting user to trash mining village or not`);
      const results = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        actionButtons: [
          { action: 1, label: 'NO' },
          { action: 2, label: 'YES' },
        ],
        prompt: 'Trash Mining Village?',
      })) as { action: number };
      
      if (results.action === 2) {
        console.log(`[MINING VILLAGE EFFECT] trashing ${cardLibrary.getCard(triggerCardId!)}...`);
        
        yield new TrashCardEffect({
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId: triggerCardId!,
        });
        
        console.log(`[MINING VILLAGE EFFECT] gaining 2 treasure...`);
        
        yield new GainTreasureEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      } else {
        console.log(`[MINING VILLAGE EFFECT] player chose not to trash mining village`);
      }
    },
    'minion': () => function* ({
      match,
      triggerPlayerId,
      reactionContext,
      cardLibrary
    }) {
      console.log(`[MINION EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      console.log(`[MINION EFFECT] prompting user to gain treasure or discard hand...`);
      
      const results = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        actionButtons: [
          { action: 1, label: '+2 Treasure' },
          { action: 2, label: 'Discard hand' },
        ],
      })) as { action: number };
      
      if (results.action === 1) {
        console.log(`[MINION EFFECT] gaining 2 treasure...`);
        
        yield new GainTreasureEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      } else {
        const targets = findOrderedEffectTargets(triggerPlayerId, 'ALL', match)
          .filter((playerId) => {
            const handCount = match.playerHands[playerId].length;
            return playerId === triggerPlayerId ||
              (handCount >= 5 && reactionContext?.[playerId]?.result !== 'immunity');
          });
        
        for (const playerId of targets) {
          const player = getPlayerById(match, playerId);
          const hand = match.playerHands[playerId];
          const l = hand.length;
          for (let i = l - 1; i >= 0; i--) {
            const cardId = hand[i];
            
            console.log(`[MINION EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);
            
            yield new DiscardCardEffect({
              cardId,
              playerId,
              sourcePlayerId: triggerPlayerId,
            });
          }
          
          for (let i = 0; i < 4; i++) {
            console.log(`[MINION EFFECT] ${player} drawing card...`);
            
            yield new DrawCardEffect({
              playerId,
              sourcePlayerId: triggerPlayerId,
            });
          }
        }
      }
    },
    'nobles': () => function* ({
      triggerPlayerId,
    }) {
      console.log(`[NOBLES EFFECT] prompting user to select actions or treasure`);
      
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        actionButtons: [
          { action: 1, label: '+3 Cards' },
          { action: 2, label: '+2 Actions' },
        ],
        prompt: 'Choose one',
      })) as { action: number };
      
      console.log(`[NOBLES EFFECT] player chose ${result.action}`);
      
      if (result.action === 1) {
        for (let i = 0; i < 3; i++) {
          console.log(`[NOBLES EFFECT] drawing card...`);
          
          yield new DrawCardEffect({
            playerId: triggerPlayerId,
            sourcePlayerId: triggerPlayerId,
          });
        }
      } else {
        console.log(`[NOBLES EFFECT] gaining 2 actions`);
        yield new GainActionEffect({
          count: 2,
          sourcePlayerId: triggerPlayerId,
        });
      }
    },
    'patrol': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      for (let i = 0; i < 3; i++) {
        console.log(`[PATROL EFFECT] drawing card`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      const revealedCardIds: number[] = [];
      
      const deck = match.playerDecks[triggerPlayerId];
      const discard = match.playerDiscards[triggerPlayerId];
      
      console.log(`[PATROL EFFECT] original num to reveal 4`);
      
      const numToReveal = Math.min(4, deck.length + discard.length);
      
      console.log(`[PATROL EFFECT] final num to reveal ${numToReveal}`);
      
      if (numToReveal === 0) {
        console.log(`[PATROL EFFECT] no cards to reveal`);
        return;
      }
      
      if (deck.length < numToReveal) {
        console.log(`[PATROL EFFECT] not enough cards in deck, shuffling`);
        yield new ShuffleDeckEffect({
          playerId: triggerPlayerId
        });
      }
      
      for (let i = 0; i < numToReveal; i++) {
        const cardId = deck[deck.length - 1 - i];
        revealedCardIds.push(cardId);
      }
      
      for (const cardId of revealedCardIds) {
        console.log(`[PATROL EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
        
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
          if (card.type.includes('VICTORY') || card.cardKey === 'curse') {
            prev[0].push(card);
          } else {
            prev[1].push(card);
          }
          return prev;
        }, [[], []] as Card[][]);
      
      for (const card of victoryCards) {
        console.log(`[PATROL EFFECT] moving ${card} to hand...`);
        
        yield new MoveCardEffect({
          cardId: card.id,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: { location: 'playerHands' },
        });
      }
      
      if (nonVictoryCards.length < 2) {
        console.log(`[PATROL EFFECT] non-victory card count is ${nonVictoryCards.length}, no need to rearrange`);
        return;
      }
      
      console.log(`[PATROL EFFECT] prompting user to rearrange cards...`);
      
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        prompt: 'Choose order to put back on deck',
        content: {
          type: 'rearrange',
          cardIds: nonVictoryCards.map((card) => card.id),
        },
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
      })) as { action: number; result: number[] };
      
      for (const cardId of result.result ?? nonVictoryCards.map((card) => card.id)) {
        console.log(`[PATROL EFFECT] top-decking ${cardLibrary.getCard(cardId)}...`);
        
        yield new MoveCardEffect({
          cardId,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: { location: 'playerDecks' },
        });
      }
    },
    'pawn': () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      const actions = [
        { action: 1, label: '+1 Card' },
        { action: 2, label: '+1 Action' },
        { action: 3, label: '+1 Buy' },
        { action: 4, label: '+1 Treasure' },
      ];
      
      for (let i = 0; i < 2; i++) {
        console.log(`[PAWN EFFECT] prompting user to choose...`);
        
        const result = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          actionButtons: actions,
          prompt: 'Choose one',
        })) as { action: number };
        
        switch (result.action) {
          case 1:
            console.log(`[PAWN EFFECT] drawing card...`);
            yield new DrawCardEffect({
              playerId: triggerPlayerId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
            });
            break;
          case 2:
            console.log(`[PAWN EFFECT] gaining 1 action...`);
            yield new GainActionEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
            });
            break;
          case 3:
            console.log(`[PAWN EFFECT] gaining 1 buy...`);
            yield new GainBuyEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
            });
            break;
          case 4:
            console.log(`[PAWN EFFECT] gaining 1 treasure...`);
            yield new GainTreasureEffect({
              count: 1,
              sourcePlayerId: triggerPlayerId,
            });
            break;
        }
        
        actions.splice(actions.findIndex((a) => a.action === result.action), 1);
      }
    },
    'replace': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      if (match.playerHands[triggerPlayerId].length === 0) {
        console.log(`[REPLACE EFFECT] no cards in hand to trash...`);
        return;
      }
      
      console.log(`[REPLACE EFFECT] prompting user to trash card...`);
      
      let result = (yield new SelectCardEffect({
        prompt: 'Trash card',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: { location: 'playerHands' },
        },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];
      
      let cardId = result[0];
      
      console.log(`[REPLACE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
      
      yield new TrashCardEffect({
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId,
        sourceCardId: triggerCardId,
      });
      
      let card = cardLibrary.getCard(cardId);
      const cost = card.cost.treasure + 2;
      
      console.log(`[REPLACE EFFECT] prompting user to gain a card costing up to ${cost}...`);
      
      result = (yield new SelectCardEffect({
        prompt: 'Gain card',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: { location: ['kingdom', 'supply']},
          cost: {
            kind: 'upTo',
            amount: cost,
          },
        },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];
      
      cardId = result[0];
      card = cardLibrary.getCard(cardId);
      
      const location = card.type.some((t) => ['ACTION', 'TREASURE'].includes(t))
        ? 'playerDecks'
        : 'playerDiscards';
      
      console.log(`[REPLACE EFFECT] gaining ${cardLibrary.getCard(cardId)} to ${location}...`);
      
      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId!,
        cardId,
        to: { location },
      });
      
      if (card.type.includes('VICTORY')) {
        console.log(`[REPLACE EFFECT] card is a victory card`);
        const targets = findOrderedEffectTargets(
          triggerPlayerId,
          'ALL_OTHER',
          match,
        ).filter((id) => reactionContext?.[id]?.result !== 'immunity');
        for (const targetId of targets) {
          const curseCardId = match.supply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'curse');
          
          if (!curseCardId) {
            console.log(`[REPLACE EFFECT] no curse cards in supply`);
            break;
          }
          
          console.log(`[REPLACE EFFECT] ${getPlayerById(match, targetId)} gaining ${cardLibrary.getCard(curseCardId)}`);
          
          yield new GainCardEffect({
            playerId: targetId,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId!,
            cardId: curseCardId,
            to: { location: 'playerDiscards' },
          });
        }
      }
    },
    'secret-passage': () => function* ({
      match,
      triggerPlayerId,
      cardLibrary,
      triggerCardId,
    }) {
      for (let i = 0; i < 2; i++) {
        console.log(`[SECRET PASSAGE EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      console.log(`[SECRET PASSAGE EFFECT] gaining 1 action`);
      
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      if (match.playerHands[triggerPlayerId].length === 0) {
        console.log(`[SECRET PASSAGE EFFECT] player has no cards in hand`);
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] prompting user to select card from hand`);
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Choose card',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];
      
      const cardId = cardIds?.[0];
      
      if (!cardId) {
        console.warn(`[SECRET PASSAGE EFFECT] player selected card, but result doesn't have it`);
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] player chose ${cardLibrary.getCard(cardId)}`);
      
      if (match.playerDecks[triggerPlayerId].length === 0) {
        console.log(`[SECRET PASSAGE EFFECT] player has no cards in deck, so just putting card on deck`);
        yield new MoveCardEffect({
          cardId,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: { location: 'playerDecks' },
        });
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] prompting user to select location in deck`);
      
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
        prompt: 'Position card',
        content: {
          type: 'blind-rearrange',
          cardIds: match.playerDecks[triggerPlayerId],
        },
      })) as { action: number; result: number };
      
      const idx = result.result;
      
      console.log(`[SECRET PASSAGE EFFECT] moving card to deck at position ${idx}...`);
      
      yield new MoveCardEffect({
        cardId,
        toPlayerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        to: {
          location: 'playerDecks',
          index: idx,
        },
      });
    },
    'shanty-town': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      console.log(`[SHANTY TOWN EFFECT] gaining 2 actions...`);
      
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId });
      
      const hand = match.playerHands[triggerPlayerId];
      
      for (const cardId of hand) {
        console.log(`[SHANTY TOWN EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
        
        yield new RevealCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          cardId,
          playerId: triggerPlayerId,
        });
      }
      
      if (!hand.some((cardId) => cardLibrary.getCard(cardId).type.includes('ACTION'))) {
        for (let i = 0; i < 2; i++) {
          console.log(`[SHANTY TOWN EFFECT] drawing card...`);
          
          yield new DrawCardEffect({
            playerId: triggerPlayerId,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
          });
        }
      } else {
        console.log(`[SHANTY TOWN EFFECT] player has actions, not drawing cards`);
      }
    },
    'steward': () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
      cardLibrary
    }) {
      console.log(`[STEWARD EFFECT] prompting user to choose cards, treasure, or trashing cards`);
      
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        actionButtons: [
          { action: 1, label: '+2 Card' },
          { action: 2, label: '+2 Treasure' },
          { action: 3, label: 'Trash 2 cards' },
        ],
        prompt: 'Choose one',
      })) as { action: number };
      
      switch (result.action) {
        case 1:
          for (let i = 0; i < 2; i++) {
            console.log(`[STEWARD EFFECT] drawing card...`);
            yield new DrawCardEffect({
              playerId: triggerPlayerId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
            });
          }
          break;
        case 2:
          console.log(`[STEWARD EFFECT] gaining 2 treasure...`);
          yield new GainTreasureEffect({
            count: 2,
            sourcePlayerId: triggerPlayerId,
          });
          break;
        case 3: {
          if (match.playerHands[triggerPlayerId].length === 0) {
            console.log(`[STEWARD EFFECT] no cards in hand to trash`);
            break;
          }
          
          const count = Math.min(2, match.playerHands[triggerPlayerId].length);
          
          console.log(`[STEWARD EFFECT] prompting user to trash ${count} cards...`);
          
          const cardIds = (yield new SelectCardEffect({
            prompt: 'Confirm trash',
            playerId: triggerPlayerId,
            sourcePlayerId: triggerPlayerId,
            restrict: { from: { location: 'playerHands' } },
            count,
            sourceCardId: triggerCardId,
          })) as number[];
          
          for (const cardId of cardIds) {
            console.log(`[STEWARD EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
            
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
    'swindler': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      console.log(`[SWINDLER EFFECT] gaining 2 treasure...`);
      
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
      });
      
      const targets = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter(id => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[SWINDLER EFFECT] targets in order ${targets.map(id => getPlayerById(match, id)).join(',')}`);
      
      for (const target of targets) {
        let deck = match.playerDecks[target];
        
        if (deck.length === 0) {
          console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} as no cards, shuffling`);
          yield new ShuffleDeckEffect({
            playerId: target
          });
          deck = match.playerDecks[target];
          
          if (deck.length === 0) {
            console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} still has no cards`);
            continue;
          }
        }
        
        let cardId = deck.slice(-1)?.[0];
        
        console.log(`[SWINDLER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        
        yield new TrashCardEffect({
          sourcePlayerId: triggerPlayerId,
          playerId: target,
          cardId: cardId,
          sourceCardId: triggerCardId!,
        });
        
        const card = cardLibrary.getCard(cardId);
        const cost = card.cost.treasure;
        
        if (match.supply.concat(match.kingdom).map(cardLibrary.getCard).filter(card => card.cost.treasure === cost).length === 0) {
          console.log(`[SWINDLER EFFECT] no cards in supply that cost ${cost}`);
          continue;
        }
        
        console.log(`[SWINDLER EFFECT] prompting user to select card costing ${cost}...`);

        const cardIds = (yield new SelectCardEffect({
          prompt: 'Choose card',
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          restrict: {
            from: { location: ['supply', 'kingdom'] },
            cost,
          },
          count: 1,
          sourceCardId: triggerCardId,
        })) as number[];
        cardId = cardIds[0];
        
        console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} gaining ${cardLibrary.getCard(cardId)}...`);
        
        yield new GainCardEffect({
          playerId: target,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId!,
          cardId,
          to: { location: 'playerDiscards' },
        });
      }
    },
    'torturer': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      for (let i = 0; i < 3; i++) {
        console.log(`[TORTURER EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      const targets = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[TORTURER EFFECT] targets ${targets.map(id => getPlayerById(match, id)).join(',')}`);
      
      // Each other player either discards 2 cards or gains a Curse to their hand,
      // their choice. (They may pick an option they can't do.)",
      for (const target of targets) {
        const player = getPlayerById(match, target);
        console.log(`[TORTURER EFFECT] prompting ${player} to choose to discard or gain curse to hand...`);
        
        const result = (yield new UserPromptEffect({
          playerId: target,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          actionButtons: [
            { action: 1, label: 'DISCARD' },
            { action: 2, label: 'GAIN CURSE' },
          ],
          prompt: 'Choose one',
        })) as { action: number; };
        
        if (result.action === 1) {
          console.log(`[TORTURER EFFECT] prompting ${player} to discard 2 cards...`);
          
          const cardIds = (yield new SelectCardEffect({
            prompt: 'Confirm discard',
            playerId: target,
            sourcePlayerId: triggerPlayerId,
            restrict: { from: { location: 'playerHands' } },
            count: Math.min(2, match.playerHands[target].length),
            sourceCardId: triggerCardId,
            autoSelect: match.playerHands[target].length <= 2
          })) as number[];
          
          for (const cardId of cardIds) {
            console.log(`[TORTURER EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);
            
            yield new DiscardCardEffect({
              cardId,
              playerId: target,
              sourcePlayerId: triggerPlayerId,
            });
          }
        } else {
          const curseCardId = match.supply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'curse');
          if (!curseCardId) {
            console.log(`[TORTURER EFFECT] no curse card in supply`);
            continue;
          }
          
          const card = cardLibrary.getCard(curseCardId);
          
          console.log(`[TORTURER EFFECT] gaining ${card}...`);
          
          yield new GainCardEffect({
            playerId: target,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId!,
            cardId: card.id,
            to: { location: 'playerHands' },
          });
        }
      }
    },
    'trading-post': () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
      cardLibrary,
    }) {
      const count = Math.min(2, match.playerHands[triggerPlayerId].length);
      
      if (count === 0) {
        console.log(`[TRADING POST EFFECT] no cards to trash`);
        return;
      }
      
      console.log(`[TRADING POST EFFECT] prompting user to trash ${count} cards...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm trash',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: { from: { location: 'playerHands' } },
        count,
        sourceCardId: triggerCardId,
      })) as number[];
      
      for (const cardId of cardIds) {
        console.log(`[TRADING POST EFFECT] trashing card ${cardLibrary.getCard(cardId)}`);
        
        yield new TrashCardEffect({
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId,
          sourceCardId: triggerCardId!,
        });
      }
      
      if (cardIds.length === 2) {
        const silverCardId = match.supply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'silver');
        if (!silverCardId) {
          console.log(`[TRADING POST EFFECT] no silver in supply`);
          return;
        }
        
        const card = cardLibrary.getCard(silverCardId);
        
        console.log(`[TRADING POST EFFECT] gaining ${card}...`);
        
        yield new GainCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId!,
          cardId: silverCardId,
          to: { location: 'playerHands' },
        });
      } else {
        console.log(`[TRADING POST EFFECT] player trashed ${cardIds.length}, so no treasure gained`);
      }
    },
    'upgrade': () => function* ({
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      match
    }) {
      console.log(`[UPGRADE EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
      
      console.log(`[UPGRADE EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      if (match.playerHands[triggerPlayerId].length === 0) {
        console.log(`[UPGRADE EFFECT] no cards in hand`);
        return;
      }
      
      console.log(`[UPGRADE EFFECT] prompting user to trash card from hand...`);
      
      let cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm trash',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];
      
      const card = cardLibrary.getCard(cardIds[0]);
      
      console.log(`[UPGRADE EFFECT] trashing ${card}...`);
      
      yield new TrashCardEffect({
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId: card.id,
        sourceCardId: triggerCardId!
      });
      
      const cost = card.cost.treasure + 1;
      
      if (!match.supply.concat(match.kingdom).map(cardLibrary.getCard).some(card => card.cost.treasure === cost)) {
        console.log(`[UPGRADE EFFECT] no cards in supply costing ${cost}`);
        return;
      }
      
      console.log(`[UPGRADE EFFECT] prompting user to select card costing ${cost}...`);
      
      cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost,
        },
        count: 1,
        sourceCardId: triggerCardId,
      })) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[UPGRADE EFFECT] gaining ${cardLibrary.getCard(cardId)} to hand...`);
      
      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId!,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
    'wishing-well': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId
    }) {
      console.log(`[WISHING WELL EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId
      });
      
      console.log(`[WISHING WELL EFFECT] gaining 1 action...`)
      
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      // Name a card, then reveal the top card of your deck. If you named it, put it into your hand."
      console.log(`[WISHING WELL EFFECT] prompting user to name a card...`);
      
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        content: { type: 'name-card' },
        prompt: 'Name a card',
      })) as { action: number, result: CardKey };
      
      const cardKey: CardKey = result.result;
      
      console.log(`[WISHING WELL EFFECT] player named '${cardKey}'`);
      
      if (match.playerDecks[triggerPlayerId].length === 0) {
        console.log(`[WISHING WELL EFFECT] shuffling player's deck...`);
        
        yield new ShuffleDeckEffect({
          playerId: triggerPlayerId
        });
      }
      
      const cardId = match.playerDecks[triggerPlayerId].slice(-1)[0];
      
      console.log(`[WISHING WELL EFFECT] revealing card ${cardLibrary.getCard(cardId)}...`);
      
      yield new RevealCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId,
        playerId: triggerPlayerId,
      });
      
      const card = cardLibrary.getCard(cardId);
      if (card.cardKey === cardKey) {
        console.log(`[WISHING WELL EFFECT] moving ${card} to hand`);
        
        yield new MoveCardEffect({
          cardId,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: { location: 'playerHands' }
        })
      }
    },
  }),
};

export default expansionModule;
