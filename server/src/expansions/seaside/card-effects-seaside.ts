import { GainTreasureEffect } from '../../core/effects/effect-types/gain-treasure.ts';
import { GainBuyEffect } from '../../core/effects/effect-types/gain-buy.ts';
import { DrawCardEffect } from '../../core/effects/effect-types/draw-card.ts';
import { GainActionEffect } from '../../core/effects/effect-types/gain-action.ts';
import { SelectCardEffect } from '../../core/effects/effect-types/select-card.ts';
import { GainCardEffect } from '../../core/effects/effect-types/gain-card.ts';
import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { DiscardCardEffect } from '../../core/effects/effect-types/discard-card.ts';
import { RevealCardEffect } from '../../core/effects/effect-types/reveal-card.ts';
import { MoveCardEffect } from '../../core/effects/effect-types/move-card.ts';
import { UserPromptEffect } from '../../core/effects/effect-types/user-prompt.ts';
import { ShuffleDeckEffect } from '../../core/effects/effect-types/shuffle-card.ts';
import { TrashCardEffect } from '../../core/effects/effect-types/trash-card.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { getPlayerStartingFrom } from '../../utils/get-player-starting-from.ts';
import { Card, CardId } from 'shared/shared-types.ts';

const expansion: CardExpansionModule = {
  registerCardLifeCycles: () => ({
    'astrolabe': {
      onCardPlayed: ({ playerId, cardId }) => {
        const id = `astrolabe-${cardId}`;
        return {
          registerTriggeredEvents: [{
            id,
            playerId,
            listeningFor: 'startTurn',
            compulsory: true,
            once: true,
            condition: (args) => {
              const { trigger } = args;
              return trigger.playerId === playerId;
            },
            generatorFn: function* () {
              console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 treasure...`);
              yield new GainTreasureEffect({ count: 1 });
              
              console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 buy...`);
              yield new GainBuyEffect({ count: 1 });
            }
          }]
        }
      }
    },
  }),
  registerScoringFunctions: () => ({}),
  registerEffects: {
    'astrolabe': () => function* () {
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({ count: 1 });
      
      console.log(`[SEASON EFFECT] gaining 1 buy...`);
      yield new GainBuyEffect({ count: 1 });
    },
    'bazaar': () => function* (arg) {
      console.log(`[SEASON EFFECT] drawing 1 card...`);
      yield new DrawCardEffect({
        playerId: arg.playerId,
      });
      
      console.log(`[SEASON EFFECT] gaining 2 actions...`);
      yield new GainActionEffect({ count: 2 });
      
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({ count: 1 });
    },
    'blockade': ({ cardLibrary }) => function* (arg) {
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        validPrompt: '',
        playerId: arg.playerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: 4 },
        },
        count: 1,
      })) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[BLOCKADE EFFECT] selected card ${cardLibrary.getCard(cardId)}`);
      
      yield new GainCardEffect({
        playerId: arg.playerId,
        cardId,
        to: { location: 'set-aside' },
      });
    },
    'cutpurse': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[CUTPURSE EFFECT] gaining 2 treasure...`);
      yield new GainTreasureEffect({ count: 2, });
      
      const targetIds = findOrderedTargets({
        startingPlayerId: arg.playerId,
        appliesTo: 'ALL_OTHER',
        match
      }).filter((id) => arg.reactionContext?.[id]?.result !== 'immunity');
      
      for (const targetId of targetIds) {
        const hand = match.playerHands[targetId];
        const copperId = hand.find(cardId => cardLibrary.getCard(cardId).cardKey === 'copper');
        if (copperId) {
          console.log(`[CUTPURSE EFFECT] discarding copper...`);
          yield new DiscardCardEffect({
            cardId: copperId,
            playerId: targetId
          });
          continue;
        }
        
        console.log(`[CUTPURSE EFFECT] revealing hand...`);
        for (const cardId of hand) {
          yield new RevealCardEffect({
            cardId,
            playerId: targetId,
          });
        }
      }
    },
    'island': () => function* (arg) {
      console.log(`[ISLAND EFFECT] prompting user to select card...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Choose card',
        validPrompt: '',
        playerId: arg.playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      })) as number[];
      
      console.log(`[ISLAND EFFECT] moving island to island mat...`);
      
      yield new MoveCardEffect({
        cardId: arg.cardId,
        to: {
          location: 'island',
        },
        toPlayerId: arg.playerId
      });
      
      const cardId = cardIds[0];
      
      console.log(`[ISLAND EFFECT] moving selected card to island mat...`);
      
      if (cardId) {
        yield new MoveCardEffect({
          cardId: cardId,
          to: {
            location: 'island',
          },
          toPlayerId: arg.playerId
        })
      }
    },
    'lookout': ({ match }) => function* (arg) {
      console.log(`[LOOKOUT EFFECT] gaining 1 action...`);
      yield new GainActionEffect({ count: 1 });
      
      const deck = match.playerDecks[arg.playerId];
      
      if (deck.length < 3) {
        console.log(`[LOOKOUT EFFECT] deck has less than 3 cards, shuffling...`);
        yield new ShuffleDeckEffect({
          playerId: arg.playerId
        });
        
        if (deck.length === 0) {
          console.log(`[LOOKOUT EFFECT] no cards in deck...`);
          return;
        }
      }
      
      const cardIdsToLookAt = deck.slice(Math.max(-3, -deck.length));
      
      console.log(`[LOOKOUT EFFECT] moving cards to look at zone...`);
      for (const cardId of cardIdsToLookAt) {
        yield new MoveCardEffect({
          cardId: cardId,
          to: {
            location: 'look-at',
          }
        })
      }
      
      console.log(`[LOOKOUT EFFECT] prompting user to select one to trash..`);
      let result = (yield new UserPromptEffect({
        playerId: arg.playerId,
        prompt: 'Choose one to trash',
        content: {
          type: 'select',
          cardIds: cardIdsToLookAt,
          selectCount: 1
        }
      })) as { action: number, result: number[] };
      
      let cardId = result.result[0];
      
      console.log(`[LOOKOUT EFFECT] trashing selected card..`);
      yield new TrashCardEffect({
        playerId: arg.playerId,
        cardId,
      });
      
      cardIdsToLookAt.splice(cardIdsToLookAt.indexOf(cardId), 1);
      
      if (cardIdsToLookAt.length === 0) {
        console.log(`[LOOKOUT EFFECT] not enough cards to continue..`);
        return;
      }
      
      console.log(`[LOOKOUT EFFECT] prompting user to select one to discard..`);
      result = (yield new UserPromptEffect({
        playerId: arg.playerId,
        prompt: 'Choose one to discard',
        content: {
          type: 'select',
          cardIds: cardIdsToLookAt,
          selectCount: 1
        }
      })) as { action: number, result: number[] };
      
      cardId = result.result[0];
      
      console.log(`[LOOKOUT EFFECT] discarding selected card...`);
      yield new DiscardCardEffect({
        cardId,
        playerId: arg.playerId
      });
      
      cardIdsToLookAt.splice(cardIdsToLookAt.indexOf(cardId), 1);
      
      if (cardIdsToLookAt.length === 0) {
        console.log(`[LOOKOUT EFFECT] not enough cards to continue...`);
        return;
      }
      
      cardId = cardIdsToLookAt[0];
      
      console.log(`[LOOKOUT EFFECT] putting last card back on deck...`);
      yield new MoveCardEffect({
        cardId: cardId,
        to: {
          location: 'playerDecks',
        },
        toPlayerId: arg.playerId
      })
    },
    'native-village': ({ match }) => function* (arg) {
      console.log(`[NATIVE VILLAGE EFFECT] gaining 2 actions...`);
      yield new GainActionEffect({ count: 2 });
      
      console.log(`[NATIVE VILLAGE EFFECT] prompting user to choose...`);
      
      const result = (yield new UserPromptEffect({
        playerId: arg.playerId,
        actionButtons: [
          { label: 'Put top card on mat', action: 1 },
          { label: 'Take cards from mat', action: 2 }
        ]
      })) as { action: number };
      
      if (result.action === 1) {
        const deck = match.playerDecks[arg.playerId];
        
        if (deck.length === 0) {
          console.log(`[NATIVE VILLAGE EFFECT] shuffling deck...`);
          yield new ShuffleDeckEffect({
            playerId: arg.playerId
          });
        }
        
        const cardId = deck.slice(-1)[0];
        
        if (!cardId) {
          console.log(`[NATIVE VILLAGE EFFECT] no cards in deck...`);
          return;
        }
        
        console.log(`[NATIVE VILLAGE EFFECT] moving card to native village mat...`);
        yield new MoveCardEffect({
          cardId,
          toPlayerId: arg.playerId,
          to: {
            location: 'native-village',
          }
        });
        
        return;
      }
      
      const matCardIds = match.mats['native-village'][arg.playerId].concat();
      
      console.log(`[NATIVE VILLAGE EFFECT] moving ${matCardIds.length} cards from native village mat to hand...`);
      for (const cardId of matCardIds) {
        yield new MoveCardEffect({
          cardId: cardId,
          toPlayerId: arg.playerId,
          to: { location: 'playerHands' }
        });
      }
    },
    'salvager': ({ match, cardLibrary }) => function* (arg) {
      console.log(`[SALVAGER EFFECT] gaining 1 buy...`);
      yield new GainBuyEffect({ count: 1 });
      
      console.log(`[SALVAGER EFFECT] prompting user to select a card from hand...`);
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Trash card',
        playerId: arg.playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      })) as number[];
      
      const cardId = cardIds[0];
      
      if (!cardId) {
        console.log(`[SALVAGER EFFECT] no card selected...`);
        return;
      }
      
      const effectiveCost = getEffectiveCardCost(arg.playerId, cardId, match, cardLibrary);
      
      console.log(`[SALVAGER EFFECT] gaining ${effectiveCost} buy...`);
      yield new GainTreasureEffect({ count: effectiveCost });
    },
    'sea-chart': ({ matchStats, match, cardLibrary }) => function* (arg) {
      console.log(`[SEA CHART EFFECT] drawing 1 card...`);
      yield new DrawCardEffect({
        playerId: arg.playerId
      });
      
      console.log(`[SEA CHART EFFECT] gaining 1 action...`);
      yield new GainActionEffect({ count: 1 });
      
      const deck = match.playerDecks[arg.playerId];
      
      if (deck.length === 0) {
        console.log(`[SEA CHART EFFECT] shuffling deck...`);
        yield new ShuffleDeckEffect({
          playerId: arg.playerId
        });
        
        if (deck.length === 0) {
          console.log(`[SEA CHART EFFECT] no cards in deck...`);
          return;
        }
      }
      
      const cardId = deck.slice(-1)[0];
      const card = cardLibrary.getCard(cardId);
      
      console.log(`[SEA CHART EFFECT] revealing card...`);
      yield new RevealCardEffect({
        cardId,
        playerId: arg.playerId,
        moveToRevealed: true
      });
      
      const copyInPlay = matchStats.cardsPlayed[match.turnNumber][arg.playerId]
        .find(cardId => cardLibrary.getCard(cardId).cardKey === card.cardKey);
      
      console.log(`[SEA CHART EFFECT] ${copyInPlay ? 'copy is in play' : 'no copy in play'}...`);
      
      console.log(`[SEA CHART EFFECT] moving card to ${copyInPlay ? 'playerHands' : 'playerDecks'}...`);
      
      yield new MoveCardEffect({
        cardId,
        toPlayerId: arg.playerId,
        to: {
          location: copyInPlay ? 'playerHands' : 'playerDecks'
        }
      });
    },
    'smugglers': ({matchStats, match, cardLibrary}) => function* (arg) {
      const previousPlayer = getPlayerStartingFrom({
        startFromIdx: match.currentPlayerTurnIndex,
        match,
        distance: -1
      });
      
      console.log(`[SMUGGLERS EFFECT] looking at ${previousPlayer} cards played`);
      
      let cardIds = matchStats.cardsGained[match.turnNumber - 1][previousPlayer.id].filter(cardId => {
        const cost = getEffectiveCardCost(
          arg.playerId,
          cardId,
          match,
          cardLibrary
        );
        return cost <= 6;
      });
      
      console.log(`[SMUGGLERS EFFECT] found ${cardIds.length} costing up to 6 that were played`);
      
      const inSupply = (card: Card) =>
        match.supply.concat(match.kingdom).find(id => cardLibrary.getCard(id).cardKey === card.cardKey);
      
      cardIds = cardIds.map(cardLibrary.getCard).map(inSupply).filter(id => id !== undefined);
      
      console.log(`[SMUGGLERS EFFECT] found ${cardIds.length} available cards in supply to choose from`);
      
      if (!cardIds.length) {
        return;
      }
      
      console.log(`[SMUGGLERS EFFECT] prompting user to select a card...`);
      
      const result = (yield new UserPromptEffect({
        playerId: arg.playerId,
        prompt: 'Choose a card to gain',
        content: {
          type: 'select',
          selectCount: 1,
          cardIds
        },
      })) as { action: number, result: CardId[] };
      
      const cardId = result.result[0];
      
      if (!cardId) {
        console.warn(`[SMUGGLERS EFFECT] no card selected`);
        return;
      }
      
      console.log(`[SMUGGLERS EFFECT] gaining card...`);
      
      yield new GainCardEffect({
        playerId: arg.playerId,
        cardId: cardId,
        to: { location: 'playerDiscards' },
      });
    },
    'treasure-map': ({match, matchStats, cardLibrary}) => function* (arg) {
      console.log(`[TREASURE MAP EFFECT] trashing played treasure map...`);
      yield new TrashCardEffect({
        playerId: arg.playerId,
        cardId: arg.cardId,
      });
      
      const hand = match.playerHands[arg.playerId];
      const inHand = hand.find(cardId => cardLibrary.getCard(cardId).cardKey === 'treasure-map');
      
      console.log(`[TREASURE MAP EFFECT] ${inHand ? 'another treasure map is in hand' : 'no other treasure map in hand'}...`);
      
      if (!inHand) {
        return;
      }
      
      console.log(`[TREASURE MAP EFFECT] trashing treasure map from hand...`);
      
      yield new TrashCardEffect({
        playerId: arg.playerId,
        cardId: inHand,
      });
      
      if (matchStats.trashedCards[match.turnNumber][arg.playerId]
        .filter(cardId => cardLibrary.getCard(cardId).cardKey === 'treasure-map').length >= 2) {
        const goldCardIds = match.supply.filter(cardId => cardLibrary.getCard(cardId).cardKey === 'gold');
        for (let i = 0; i < Math.min(goldCardIds.length, 4); i++) {
          yield new GainCardEffect({
            playerId: arg.playerId,
            cardId: goldCardIds[i],
            to: { location: 'playerDecks' },
          });
        }
      }
    },
    'warehouse': ({match}) => function* (arg) {
      console.log(`[WAREHOUSE EFFECT] drawing 3 cards...`);
      for (let i = 0; i < 3; i++) {
        yield new DrawCardEffect({
          playerId: arg.playerId
        });
      }
      
      console.log(`[WAREHOUSE EFFECT] gaining 1 actions...`);
      yield new GainActionEffect({ count: 1 });
      
      const count = Math.min(3, match.playerHands[arg.playerId].length);
      
      console.log(`[WAREHOUSE EFFECT] prompting user to select ${count} cards...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Discard cards',
        playerId: arg.playerId,
        restrict: { from: { location: 'playerHands' } },
        count,
      })) as number[];
      
      console.log(`[WAREHOUSE EFFECT] discarding cards...`);
      
      for (const cardId of cardIds) {
        yield new DiscardCardEffect({
          cardId,
          playerId: arg.playerId
        });
      }
    }
  }
}

export default expansion;