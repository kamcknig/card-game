import { DiscardCardEffect } from '../../core/effects/effect-types/discard-card.ts';
import { GainBuyEffect } from '../../core/effects/effect-types/gain-buy.ts';
import { GainCardEffect } from '../../core/effects/effect-types/gain-card.ts';
import { GainTreasureEffect } from '../../core/effects/effect-types/gain-treasure.ts';
import { UserPromptEffect } from '../../core/effects/effect-types/user-prompt.ts';
import { ModifyCostEffect } from '../../core/effects/effect-types/modify-cost.ts';
import { DrawCardEffect } from '../../core/effects/effect-types/draw-card.ts';
import { GainActionEffect } from '../../core/effects/effect-types/gain-action.ts';
import { RevealCardEffect } from '../../core/effects/effect-types/reveal-card.ts';
import { SelectCardEffect } from '../../core/effects/effect-types/select-card.ts';
import { MoveCardEffect } from '../../core/effects/effect-types/move-card.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { TrashCardEffect } from '../../core/effects/effect-types/trash-card.ts';
import { ActionButtons, Card, CardId, CardKey, PlayerId } from 'shared/shared-types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { ShuffleDeckEffect } from '../../core/effects/effect-types/shuffle-card.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { CardExpansionModule } from '../../types.ts';

const expansionModule: CardExpansionModule = {
  registerCardLifeCycles: () => ({
    'diplomat': {
      onEnterHand: ({ playerId, cardId }) => ({
        registerTriggeredEvents: [{
          id: `diplomat:${cardId}:onEnterHand`,
          playerId,
          listeningFor: 'cardPlayed',
          condition: ({ match, trigger, cardLibrary }) => {
            return cardLibrary.getCard(trigger.cardId!).type.includes('ATTACK') &&
              match.playerHands[playerId].length >= 5 &&
              trigger.playerId !== playerId
          },
          triggeredEffectFn: function* ({ reaction }) {
            const sourceId = reaction.getSourceId();
            
            yield new RevealCardEffect({
              cardId: sourceId,
              playerId: reaction.playerId,
            });
            
            yield new DrawCardEffect({
              playerId,
            });
            yield new DrawCardEffect({
              playerId,
            });
            const cardIds = (yield new SelectCardEffect({
              prompt: 'Confirm discard',
              playerId,
              restrict: {
                from: { location: 'playerHands' },
              },
              count: 3,
            })) as number[];
            
            for (const cardId of cardIds) {
              yield new DiscardCardEffect({
                playerId,
                cardId,
              });
            }
          },
        }],
      }),
      onLeaveHand: ({ cardId }) => ({
        unregisterTriggeredEvents: [`diplomat:${cardId}:onEnterHand`],
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
  registerEffects: {
    'baron': ({ match, cardLibrary }) => function* (arg) {
      // +1 Buy
      // You may discard an Estate for +$4. If you don't, gain an Estate.
      
      console.log(`[BARON EFFECT] gaining 1 buy...`);
      
      yield new GainBuyEffect({
        count: 1,
      });
      
      const hand = match.playerHands[arg.playerId];
      
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
      }
      else {
        console.log(`[BARON EFFECT] player has an estate in hand`);
        
        const confirm = (yield new UserPromptEffect({
          playerId: arg.playerId,
          prompt: 'Discard estate?',
          actionButtons: [
            { label: `DON'T DISCARD`, action: 1 },
            { label: 'DISCARD', action: 2 },
          ],
        })) as { action: number };
        
        if (confirm.action === 2) {
          console.log(`[BARON EFFECT] player chooses to discard estate, gain 4 treasure`);
          
          yield new DiscardCardEffect({
            cardId: handEstateIdx,
            playerId: arg.playerId,
          });
          
          yield new GainTreasureEffect({
            count: 4,
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
        playerId: arg.playerId,
        cardId: supplyEstateIdx,
        to: { location: 'playerDiscards' },
      });
    },
    'bridge': () => function* () {
      console.log(`[BRIDGE EFFECT] gaining 1 buy...`);
      
      yield new GainBuyEffect({ count: 1 });
      
      console.log(`[BRIDGE EFFECT] gaining 1 treasure...`);
      
      yield new GainTreasureEffect({
        count: 1,
      });
      
      console.log(`[BRIDGE EFFECT] modify cost by -1 of all cards...`);
      
      yield new ModifyCostEffect({
        appliesToCard: 'ALL',
        appliesToPlayer: 'ALL',
        amount: -1,
        expiresAt: 'TURN_END',
      });
    },
    'conspirator': ({ matchStats, match, cardLibrary }) => function* (arg) {
      console.log(`[CONSPIRATOR EFFECT] gaining 2 treasure...`);
      
      yield new GainTreasureEffect({
        count: 2,
      });
      
      // we want those cards played on the player's turn that are actions and played by THAT player
      const actionCardCount =
        matchStats.cardsPlayedByTurn[match.turnNumber][arg.playerId]
          ?.filter(cardId =>
            cardLibrary.getCard(cardId).type.includes('ACTION')
            && matchStats.playedCardsInfo[cardId].playerId === arg.playerId);
      
      console.log(`[CONSPIRATOR EFFECT] action cards played so far ${actionCardCount.length}`);
      
      if (actionCardCount?.length >= 3) {
        console.log(`[CONSPIRATOR EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: arg.playerId,
        });
        
        console.log(`[CONSPIRATOR EFFECT] gaining 1 action...`);
        
        yield new GainActionEffect({
          count: 1,
        });
      }
    },
    'courtier': ({ match, cardLibrary }) => function* (arg) {
      const hand = match.playerHands[arg.playerId];
      
      if (!hand.length) {
        console.log(`[COURTIER EFFECT] no cards in hand`);
        return;
      }
      
      console.log(`[COURTIER EFFECT] prompting user to reveal a card...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Reveal card',
        count: 1,
        playerId: arg.playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
      })) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[COURTIER EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
      
      yield new RevealCardEffect({
        cardId,
        playerId: arg.playerId,
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
          playerId: arg.playerId,
          prompt: 'Choose one',
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
            });
            break;
          case 2:
            console.log(`[COURTIER EFFECT] gaining 1 buy...`);
            yield new GainBuyEffect({
              count: 1,
            });
            break;
          case 3:
            console.log(`[COURTIER EFFECT] gaining 1 treasure...`);
            yield new GainTreasureEffect({
              count: 3,
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
              playerId: arg.playerId,
              to: {
                location: 'playerDiscards',
              },
            });
            break;
          }
        }
      }
    },
    'courtyard': ({ match, cardLibrary }) => function* (arg) {
      for (let i = 0; i < 3; i++) {
        console.log(`[COURTYARD EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: arg.playerId,
        });
      }
      
      const hand = match.playerHands[arg.playerId];
      
      if (!hand.length) {
        console.log(`[COURTYARD EFFECT] no cards in hand`);
        return;
      }
      
      console.log(`[COURTYARD EFFECT] prompting user to put card onto deck...`);
      
      const result = (yield new SelectCardEffect({
        prompt: 'Top deck',
        count: 1,
        playerId: arg.playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
      })) as number[];
      
      const cardId = result[0];
      
      console.log(`[COURTYARD EFFECT] moving ${cardLibrary.getCard(cardId)} to top of deck...`);
      
      yield new MoveCardEffect({
        cardId,
        toPlayerId: arg.playerId,
        to: { location: 'playerDecks' },
      });
    },
    'diplomat': ({ match }) => function* (arg) {
      for (let i = 0; i < 2; i++) {
        console.log(`[DIPLOMAT EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: arg.playerId,
        });
      }
      
      const cardCount = match.playerHands[arg.playerId].length;
      if (cardCount <= 5) {
        console.log(`[DIPLOMAT EFFECT] gaining 2 actions...`);
        
        yield new GainActionEffect({
          count: 2,
        });
      }
      else {
        console.log(`[DIPLOMAT EFFECT] player has more than ${cardCount} cards in hand, can't perform diplomat`,);
      }
    },
    // deno-lint-ignore require-yield
    'duke': () => function* () {
      console.log(`[DUKE EFFECT] duke has no effects`);
    },
    'farm': () => function* () {
      console.log(`[FARM EFFECT] gaining 2 treasure...`);
      
      yield new GainTreasureEffect({
        count: 2,
      });
    },
    'ironworks': ({ cardLibrary }) => function* (arg) {
      console.log(`[IRONWORKS EFFECT] prompting user to choose card costing up to 4...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Choose card',
        count: 1,
        restrict: {
          cost: { amount: 4, kind: 'upTo' },
          from: { location: ['supply', 'kingdom'] },
        },
        playerId: arg.playerId,
      })) as number[];
      
      console.log(`[IRONWORKS EFFECT] gaining ${cardLibrary.getCard(cardIds[0])}...`);
      
      yield new GainCardEffect({
        cardId: cardIds[0],
        playerId: arg.playerId,
        to: { location: 'playerDiscards' },
      });
      
      const card = cardLibrary.getCard(cardIds[0]);
      
      if (card.type.includes('ACTION')) {
        console.log(`[IRONWORKS EFFECT] card is an action, gaining 1 action...`);
        
        yield new GainActionEffect({
          count: 1,
        });
      }
      
      if (card.type.includes('TREASURE')) {
        console.log(`[IRONWORKS EFFECT] card is a treasure, gaining 1 treasure...`);
        
        yield new GainTreasureEffect({
          count: 1,
        });
      }
      
      if (card.type.includes('VICTORY')) {
        console.log(`[IRONWORKS EFFECT] card is a victory, drawing card...`);
        
        yield new DrawCardEffect({
          playerId: arg.playerId,
        });
      }
    },
    'lurker': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[LURKER EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({ count: 1 });
      
      let result = { action: 1 };
      
      const actionButtons: ActionButtons = [
        { action: 1, label: 'TRASH CARD' },
        { action: 2, label: 'GAIN CARD' }
      ];
      
      result = (yield new UserPromptEffect({
        playerId: arg.playerId,
        prompt: 'Trash Action card from supply, or gain Action card from trash?',
        actionButtons,
      })) as { action: number };
      
      console.log(`[LURKER EFFECT] user choose action ${actionButtons.find((a) => a.action === result.action)?.label}`);
      
      if (result.action === 1) {
        console.log(`[LURKER EFFECT] prompting user to select card to trash...`);
        
        const result = (yield new SelectCardEffect({
          prompt: 'Confirm trash',
          playerId: arg.playerId,
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
          playerId: arg.playerId,
        });
        
        return;
      }
      
      const actionCardIds = match.trash.filter(cardId => cardLibrary.getCard(cardId).type.includes('ACTION'));
      
      if (!actionCardIds.length) {
        console.log(`[LURKER EFFECT] trash has no action cards`);
        return;
      }
      
      if (!match.trash.some(cId => cardLibrary.getCard(cId).type.includes('ACTION'))) {
        console.log(`[LURKER EFFECT] no action cards in trash, skipping gaining`);
        return;
      }
      
      let cardId: CardId;
      if (match.trash.length === 1) {
        console.log(`[LURKER EFFECT] only one card in trash, gaining automatically`);
        cardId = match.trash[0];
      }
      else {
        console.log(`[LURKER EFFECT] prompting user to select action card to gain...`);
        
        const chooseCardResult = (yield new UserPromptEffect({
          prompt: 'Choose card to gain',
          playerId: arg.playerId,
          content: {
            type: 'select',
            selectCount: 1,
            cardIds: actionCardIds,
          },
        })) as { result: number[] };
        
        cardId = chooseCardResult.result[0];
      }
      
      console.log(`[LURKER EFFECT] gaining ${cardLibrary.getCard(cardId)}...`);
      
      yield new GainCardEffect({
        cardId,
        playerId: arg.playerId,
        to: { location: 'playerDiscards' },
      });
    },
    'masquerade': ({ match, cardLibrary }) => function* (arg) {
      for (let i = 0; i < 2; i++) {
        console.log(`[MASQUERADE EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: arg.playerId,
        });
      }
      
      const targets = findOrderedTargets({
        startingPlayerId: arg.playerId,
        appliesTo: 'ALL',
        match
      }).filter((playerId) => match.playerHands[playerId].length > 0);
      
      console.log(`[MASQUERADE EFFECT] targets in order ${targets.map(t => getPlayerById(match, t)).join(',')}`);
      
      const playerCardMap = new Map<PlayerId, CardId>();
      
      for (const playerId of targets) {
        console.log(`[LURKER EFFECT] prompting ${getPlayerById(match, playerId)} to choose a card...`);
        
        const cardIds = (yield new SelectCardEffect({
          prompt: 'Confirm pass',
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
          to: { location: 'playerHands' },
        });
      }
      
      console.log(`[MASQUERADE EFFECT] prompting user to trash card from hand...`);
      
      const cardIds = (yield new SelectCardEffect({
        optional: true,
        prompt: 'Confirm trash',
        count: 1,
        playerId: arg.playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
      })) as number[];
      
      console.log(`[MASQUERADE EFFECT] player chose ${cardIds.length ? cardLibrary.getCard(cardIds[0]) : 'not to trash'}`);
      
      if (cardIds[0]) {
        console.log(`[MASQUERADE EFFECT] trashing ${cardLibrary.getCard(cardIds[0])}...`);
        
        yield new TrashCardEffect({
          cardId: cardIds[0],
          playerId: arg.playerId,
        });
      }
    },
    'mill': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[MILL EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: arg.playerId,
      });
      
      console.log(`[MILL EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({ count: 1 });
      
      if (match.playerHands[arg.playerId].length === 0) {
        console.log(`[MILL EFFECT] player has no cards in hand`);
        return;
      }
      
      console.log(`[MILL EFFECT] prompting user to select cards to discard`);
      
      const results = (yield new SelectCardEffect({
        optional: true,
        prompt: 'Confirm discard',
        playerId: arg.playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
        count: Math.min(2, match.playerHands[arg.playerId].length),
      })) as number[];
      
      for (const cardId of results) {
        console.log(`[MILL EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
        
        yield new DiscardCardEffect({
          cardId,
          playerId: arg.playerId,
        });
      }
      
      console.log(`[MILL EFFECT] gaining 2 treasure...`);
      
      if (results.length == 2) {
        yield new GainTreasureEffect({
          count: 2,
        });
      }
    },
    'mining-village': ({ cardLibrary }) => function* (arg) {
      console.log(`[MINING VILLAGE EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: arg.playerId,
      });
      
      console.log(`[MINING VILLAGE EFFECT] gaining 2 actions`);
      
      yield new GainActionEffect({ count: 2 });
      
      console.log(`[MINING VILLAGE EFFECT] prompting user to trash mining village or not`);
      const results = (yield new UserPromptEffect({
        playerId: arg.playerId,
        actionButtons: [
          { action: 1, label: `DON'T TRASH` },
          { action: 2, label: 'TRASH' },
        ],
        prompt: 'Trash Mining Village?',
      })) as { action: number };
      
      if (results.action === 2) {
        console.log(`[MINING VILLAGE EFFECT] trashing ${cardLibrary.getCard(arg.cardId)}...`);
        
        yield new TrashCardEffect({
          playerId: arg.playerId,
          cardId: arg.cardId,
        });
        
        console.log(`[MINING VILLAGE EFFECT] gaining 2 treasure...`);
        
        yield new GainTreasureEffect({
          count: 2,
        });
      }
      else {
        console.log(`[MINING VILLAGE EFFECT] player chose not to trash mining village`);
      }
    },
    'minion': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[MINION EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({ count: 1 });
      
      console.log(`[MINION EFFECT] prompting user to gain treasure or discard hand...`);
      
      const results = (yield new UserPromptEffect({
        playerId: arg.playerId,
        actionButtons: [
          { action: 1, label: '+2 Treasure' },
          { action: 2, label: 'Discard hand' },
        ],
      })) as { action: number };
      
      if (results.action === 1) {
        console.log(`[MINION EFFECT] gaining 2 treasure...`);
        
        yield new GainTreasureEffect({
          count: 2,
        });
      }
      else {
        const targets = findOrderedTargets({
          startingPlayerId: arg.playerId,
          appliesTo: 'ALL',
          match
        }).filter((playerId) => {
          const handCount = match.playerHands[playerId].length;
          return playerId === arg.playerId ||
            (handCount >= 5 && arg.reactionContext?.[playerId]?.result !== 'immunity');
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
            });
          }
          
          for (let i = 0; i < 4; i++) {
            console.log(`[MINION EFFECT] ${player} drawing card...`);
            
            yield new DrawCardEffect({
              playerId,
            });
          }
        }
      }
    },
    'nobles': () => function* (arg) {
      console.log(`[NOBLES EFFECT] prompting user to select actions or treasure`);
      
      const result = (yield new UserPromptEffect({
        playerId: arg.playerId,
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
            playerId: arg.playerId,
          });
        }
      }
      else {
        console.log(`[NOBLES EFFECT] gaining 2 actions`);
        yield new GainActionEffect({
          count: 2,
        });
      }
    },
    'patrol': ({ match, cardLibrary }) => function* (arg) {
      for (let i = 0; i < 3; i++) {
        console.log(`[PATROL EFFECT] drawing card`);
        
        yield new DrawCardEffect({
          playerId: arg.playerId,
        });
      }
      
      const deck = match.playerDecks[arg.playerId];
      const discard = match.playerDiscards[arg.playerId];
      
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
          playerId: arg.playerId
        });
      }
      
      const revealedCardIds: number[] = match.playerDecks[arg.playerId].slice(-numToReveal);
      
      for (const cardId of revealedCardIds) {
        console.log(`[PATROL EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
        
        yield new RevealCardEffect({
          cardId,
          playerId: arg.playerId,
          moveToRevealed: true,
        });
      }
      
      const [victoryCards, nonVictoryCards] = revealedCardIds
        .map(cardLibrary.getCard)
        .reduce((prev, card) => {
          if (card.type.includes('VICTORY') || card.cardKey === 'curse') {
            prev[0].push(card);
          }
          else {
            prev[1].push(card);
          }
          return prev;
        }, [[], []] as Card[][]);
      
      for (const card of victoryCards) {
        console.log(`[PATROL EFFECT] moving ${card} to hand...`);
        
        yield new MoveCardEffect({
          cardId: card.id,
          toPlayerId: arg.playerId,
          to: { location: 'playerHands' },
        });
      }
      
      if (nonVictoryCards.length < 2) {
        if (nonVictoryCards.length === 1) {
          console.log(`[PATROL EFFECT] non-victory card count is ${nonVictoryCards.length}, no need to rearrange`);
          yield new MoveCardEffect({
            cardId: nonVictoryCards[0].id,
            to: { location: 'playerDecks' }
          })
        }
        
        return;
      }
      
      console.log(`[PATROL EFFECT] prompting user to rearrange cards...`);
      
      const result = (yield new UserPromptEffect({
        playerId: arg.playerId,
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
          toPlayerId: arg.playerId,
          to: { location: 'playerDecks' },
        });
      }
    },
    'pawn': () => function* (arg) {
      const actions = [
        { action: 1, label: '+1 Card' },
        { action: 2, label: '+1 Action' },
        { action: 3, label: '+1 Buy' },
        { action: 4, label: '+1 Treasure' },
      ];
      
      for (let i = 0; i < 2; i++) {
        console.log(`[PAWN EFFECT] prompting user to choose...`);
        
        const result = (yield new UserPromptEffect({
          playerId: arg.playerId,
          actionButtons: actions,
          prompt: 'Choose one',
        })) as { action: number };
        
        switch (result.action) {
          case 1:
            console.log(`[PAWN EFFECT] drawing card...`);
            yield new DrawCardEffect({
              playerId: arg.playerId,
            });
            break;
          case 2:
            console.log(`[PAWN EFFECT] gaining 1 action...`);
            yield new GainActionEffect({
              count: 1,
            });
            break;
          case 3:
            console.log(`[PAWN EFFECT] gaining 1 buy...`);
            yield new GainBuyEffect({
              count: 1,
            });
            break;
          case 4:
            console.log(`[PAWN EFFECT] gaining 1 treasure...`);
            yield new GainTreasureEffect({
              count: 1,
            });
            break;
        }
        
        actions.splice(actions.findIndex((a) => a.action === result.action), 1);
      }
    },
    'replace': ({ match, cardLibrary }) => function* (arg) {
      if (match.playerHands[arg.playerId].length === 0) {
        console.log(`[REPLACE EFFECT] no cards in hand to trash...`);
        return;
      }
      
      console.log(`[REPLACE EFFECT] prompting user to trash card...`);
      
      let result = (yield new SelectCardEffect({
        prompt: 'Trash card',
        playerId: arg.playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
        count: 1,
      })) as number[];
      
      let cardId = result[0];
      
      console.log(`[REPLACE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
      
      yield new TrashCardEffect({
        playerId: arg.playerId,
        cardId,
      });
      
      const cost = getEffectiveCardCost(
        arg.playerId,
        cardId,
        match,
        cardLibrary
      ) + 2;
      
      console.log(`[REPLACE EFFECT] prompting user to gain a card costing up to ${cost}...`);
      
      result = (yield new SelectCardEffect({
        prompt: 'Gain card',
        playerId: arg.playerId,
        restrict: {
          from: { location: ['kingdom', 'supply'] },
          cost: {
            kind: 'upTo',
            amount: cost,
          },
        },
        count: 1,
      })) as number[];
      
      cardId = result[0];
      const card = cardLibrary.getCard(cardId);
      
      const location = card.type.some((t) => ['ACTION', 'TREASURE'].includes(t))
        ? 'playerDecks'
        : 'playerDiscards';
      
      console.log(`[REPLACE EFFECT] gaining ${cardLibrary.getCard(cardId)} to ${location}...`);
      
      yield new GainCardEffect({
        playerId: arg.playerId,
        cardId,
        to: { location },
      });
      
      if (card.type.includes('VICTORY')) {
        console.log(`[REPLACE EFFECT] card is a victory card`);
        const targets = findOrderedTargets({
          startingPlayerId: arg.playerId,
          appliesTo: 'ALL_OTHER',
          match,
        }).filter((id) => arg.reactionContext?.[id]?.result !== 'immunity');
        
        for (const targetId of targets) {
          const curseCardId = match.supply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'curse');
          
          if (!curseCardId) {
            console.log(`[REPLACE EFFECT] no curse cards in supply`);
            break;
          }
          
          console.log(`[REPLACE EFFECT] ${getPlayerById(match, targetId)} gaining ${cardLibrary.getCard(curseCardId)}`);
          
          yield new GainCardEffect({
            playerId: targetId,
            cardId: curseCardId,
            to: { location: 'playerDiscards' },
          });
        }
      }
    },
    'secret-passage': ({ match, cardLibrary }) => function* (arg) {
      for (let i = 0; i < 2; i++) {
        console.log(`[SECRET PASSAGE EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: arg.playerId,
        });
      }
      
      console.log(`[SECRET PASSAGE EFFECT] gaining 1 action`);
      
      yield new GainActionEffect({ count: 1 });
      
      if (match.playerHands[arg.playerId].length === 0) {
        console.log(`[SECRET PASSAGE EFFECT] player has no cards in hand`);
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] prompting user to select card from hand`);
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Choose card',
        playerId: arg.playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      })) as number[];
      
      const cardId = cardIds?.[0];
      
      if (!cardId) {
        console.warn(`[SECRET PASSAGE EFFECT] player selected card, but result doesn't have it`);
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] player chose ${cardLibrary.getCard(cardId)}`);
      
      if (match.playerDecks[arg.playerId].length === 0) {
        console.log(`[SECRET PASSAGE EFFECT] player has no cards in deck, so just putting card on deck`);
        yield new MoveCardEffect({
          cardId,
          toPlayerId: arg.playerId,
          to: { location: 'playerDecks' },
        });
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] prompting user to select location in deck`);
      
      const result = (yield new UserPromptEffect({
        playerId: arg.playerId,
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
        prompt: 'Position card',
        content: {
          type: 'blind-rearrange',
          cardIds: match.playerDecks[arg.playerId],
        },
      })) as { action: number; result: number };
      
      const idx = result.result;
      
      console.log(`[SECRET PASSAGE EFFECT] moving card to deck at position ${idx}...`);
      
      yield new MoveCardEffect({
        cardId,
        toPlayerId: arg.playerId,
        to: {
          location: 'playerDecks',
          index: idx,
        },
      });
    },
    'shanty-town': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[SHANTY TOWN EFFECT] gaining 2 actions...`);
      
      yield new GainActionEffect({ count: 2 });
      
      const hand = match.playerHands[arg.playerId];
      
      for (const cardId of hand) {
        console.log(`[SHANTY TOWN EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
        
        yield new RevealCardEffect({
          cardId,
          playerId: arg.playerId,
        });
      }
      
      if (!hand.some((cardId) => cardLibrary.getCard(cardId).type.includes('ACTION'))) {
        for (let i = 0; i < 2; i++) {
          console.log(`[SHANTY TOWN EFFECT] drawing card...`);
          
          yield new DrawCardEffect({
            playerId: arg.playerId,
          });
        }
      }
      else {
        console.log(`[SHANTY TOWN EFFECT] player has actions, not drawing cards`);
      }
    },
    'steward': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[STEWARD EFFECT] prompting user to choose cards, treasure, or trashing cards`);
      
      const result = (yield new UserPromptEffect({
        playerId: arg.playerId,
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
              playerId: arg.playerId,
            });
          }
          break;
        case 2:
          console.log(`[STEWARD EFFECT] gaining 2 treasure...`);
          yield new GainTreasureEffect({
            count: 2,
          });
          break;
        case 3: {
          if (match.playerHands[arg.playerId].length === 0) {
            console.log(`[STEWARD EFFECT] no cards in hand to trash`);
            break;
          }
          
          const count = Math.min(2, match.playerHands[arg.playerId].length);
          
          console.log(`[STEWARD EFFECT] prompting user to trash ${count} cards...`);
          
          const cardIds = (yield new SelectCardEffect({
            prompt: 'Confirm trash',
            playerId: arg.playerId,
            restrict: { from: { location: 'playerHands' } },
            count,
          })) as number[];
          
          for (const cardId of cardIds) {
            console.log(`[STEWARD EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
            
            yield new TrashCardEffect({
              playerId: arg.playerId,
              cardId,
            });
          }
          break;
        }
      }
    },
    'swindler': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[SWINDLER EFFECT] gaining 2 treasure...`);
      
      yield new GainTreasureEffect({
        count: 2,
      });
      
      const targets = findOrderedTargets({
        startingPlayerId: arg.playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter(id => arg.reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[SWINDLER EFFECT] targets in order ${targets.map(id => getPlayerById(match, id)).join(',')}`);
      
      for (const target of targets) {
        const deck = match.playerDecks[target];
        
        if (deck.length === 0) {
          console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} as no cards, shuffling`);
          yield new ShuffleDeckEffect({
            playerId: target
          });
          
          if (deck.length === 0) {
            console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} still has no cards`);
            continue;
          }
        }
        
        let cardId = deck.slice(-1)?.[0];
        
        console.log(`[SWINDLER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        
        yield new TrashCardEffect({
          playerId: target,
          cardId: cardId,
        });
        
        const cost = getEffectiveCardCost(target, cardId, match, cardLibrary);
        
        console.log(`[SWINDLER EFFECT] prompting user to select card costing ${cost}...`);
        
        const cardIds = (yield new SelectCardEffect({
          prompt: 'Choose card',
          playerId: arg.playerId,
          restrict: {
            from: { location: ['supply', 'kingdom'] },
            cost,
          },
          count: 1,
        })) as number[];
        cardId = cardIds[0];
        
        console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} gaining ${cardLibrary.getCard(cardId)}...`);
        
        yield new GainCardEffect({
          playerId: target,
          cardId,
          to: { location: 'playerDiscards' },
        });
      }
    },
    'torturer': ({ match, cardLibrary }) => function* (arg) {
      for (let i = 0; i < 3; i++) {
        console.log(`[TORTURER EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: arg.playerId,
        });
      }
      
      const targets = findOrderedTargets({
        startingPlayerId: arg.playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => arg.reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[TORTURER EFFECT] targets ${targets.map(id => getPlayerById(match, id)).join(',')}`);
      
      // Each other player either discards 2 cards or gains a Curse to their hand,
      // their choice. (They may pick an option they can't do.)",
      for (const target of targets) {
        const player = getPlayerById(match, target);
        console.log(`[TORTURER EFFECT] prompting ${player} to choose to discard or gain curse to hand...`);
        
        const result = (yield new UserPromptEffect({
          playerId: target,
          actionButtons: [
            { action: 1, label: 'DISCARD' },
            { action: 2, label: 'GAIN CURSE' },
          ],
          prompt: 'Choose one',
        })) as { action: number; };
        
        if (result.action === 1) {
          console.log(`[TORTURER EFFECT] prompting ${player} to discard 2 cards...`);
          
          const cardIds = match.playerHands[target].length < 2 ?
            match.playerHands[target] :
            (yield new SelectCardEffect({
              prompt: 'Confirm discard',
              playerId: target,
              restrict: { from: { location: 'playerHands' } },
              count: Math.min(2, match.playerHands[target].length)
            })) as number[];
          
          for (const cardId of cardIds) {
            console.log(`[TORTURER EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);
            
            yield new DiscardCardEffect({
              cardId,
              playerId: target,
            });
          }
          
          return
        }
        
        const curseCardId = match.supply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'curse');
        if (!curseCardId) {
          console.log(`[TORTURER EFFECT] no curse card in supply`);
          continue;
        }
        
        const card = cardLibrary.getCard(curseCardId);
        
        console.log(`[TORTURER EFFECT] gaining ${card}...`);
        
        yield new GainCardEffect({
          playerId: target,
          cardId: card.id,
          to: { location: 'playerHands' },
        });
      }
    },
    'trading-post': ({ match, cardLibrary }) => function* (arg) {
      const count = Math.min(2, match.playerHands[arg.playerId].length);
      
      if (count === 0) {
        console.log(`[TRADING POST EFFECT] no cards to trash`);
        return;
      }
      
      console.log(`[TRADING POST EFFECT] prompting user to trash ${count} cards...`);
      
      const cardIds = count < 2 ?
        match.playerHands[arg.playerId] :
        (yield new SelectCardEffect({
          prompt: 'Confirm trash',
          playerId: arg.playerId,
          restrict: { from: { location: 'playerHands' } },
          count,
        })) as number[];
      
      for (const cardId of cardIds) {
        console.log(`[TRADING POST EFFECT] trashing card ${cardLibrary.getCard(cardId)}`);
        
        yield new TrashCardEffect({
          playerId: arg.playerId,
          cardId,
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
          playerId: arg.playerId,
          cardId: silverCardId,
          to: { location: 'playerHands' },
        });
      }
      else {
        console.log(`[TRADING POST EFFECT] player trashed ${cardIds.length}, so no treasure gained`);
      }
    },
    'upgrade': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[UPGRADE EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: arg.playerId,
      });
      
      console.log(`[UPGRADE EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({ count: 1 });
      
      if (match.playerHands[arg.playerId].length === 0) {
        console.log(`[UPGRADE EFFECT] no cards in hand`);
        return;
      }
      
      if (match.playerHands[arg.playerId].length === 0) {
        console.log(`[UPGRADE EFFECT] no cards in hand, can't trash`);
        return;
      }
      
      console.log(`[UPGRADE EFFECT] prompting user to trash card from hand...`);
      
      let cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm trash',
        playerId: arg.playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      })) as number[];
      
      const card = cardLibrary.getCard(cardIds[0]);
      
      console.log(`[UPGRADE EFFECT] trashing ${card}...`);
      
      yield new TrashCardEffect({
        playerId: arg.playerId,
        cardId: card.id,
      });
      
      const cost = getEffectiveCardCost(
        arg.playerId,
        card.id,
        match,
        cardLibrary
      ) + 1;
      
      console.log(`[UPGRADE EFFECT] prompting user to select card costing ${cost}...`);
      
      cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        playerId: arg.playerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost,
        },
        count: 1,
      })) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[UPGRADE EFFECT] gaining ${cardLibrary.getCard(cardId)} to hand...`);
      
      yield new GainCardEffect({
        playerId: arg.playerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
    'wishing-well': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[WISHING WELL EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: arg.playerId,
      });
      
      console.log(`[WISHING WELL EFFECT] gaining 1 action...`)
      
      yield new GainActionEffect({ count: 1 });
      
      // Name a card, then reveal the top card of your deck. If you named it, put it into your hand."
      console.log(`[WISHING WELL EFFECT] prompting user to name a card...`);
      
      const result = (yield new UserPromptEffect({
        playerId: arg.playerId,
        content: { type: 'name-card' },
        prompt: 'Name a card',
      })) as { action: number, result: CardKey };
      
      const cardKey: CardKey = result.result;
      
      console.log(`[WISHING WELL EFFECT] player named '${cardKey}'`);
      
      if (match.playerDecks[arg.playerId].length === 0) {
        console.log(`[WISHING WELL EFFECT] shuffling player's deck...`);
        
        yield new ShuffleDeckEffect({
          playerId: arg.playerId
        });
      }
      
      const cardId = match.playerDecks[arg.playerId].slice(-1)[0];
      
      console.log(`[WISHING WELL EFFECT] revealing card ${cardLibrary.getCard(cardId)}...`);
      
      yield new RevealCardEffect({
        cardId,
        playerId: arg.playerId,
      });
      
      const card = cardLibrary.getCard(cardId);
      if (card.cardKey === cardKey) {
        console.log(`[WISHING WELL EFFECT] moving ${card} to hand`);
        
        yield new MoveCardEffect({
          cardId,
          toPlayerId: arg.playerId,
          to: { location: 'playerHands' }
        })
      }
    },
  }
};

export default expansionModule;
