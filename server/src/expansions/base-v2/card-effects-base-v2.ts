import { findOrderedEffectTargets } from '../../utils/find-ordered-effect-targets.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { DiscardCardEffect } from '../../core/effects/discard-card.ts';
import { DrawCardEffect } from '../../core/effects/draw-card.ts';
import { GainActionEffect } from '../../core/effects/gain-action.ts';
import { GainBuyEffect } from '../../core/effects/gain-buy.ts';
import { GainCardEffect } from '../../core/effects/gain-card.ts';
import { GainTreasureEffect } from '../../core/effects/gain-treasure.ts';
import { MoveCardEffect } from '../../core/effects/move-card.ts';
import { RevealCardEffect } from '../../core/effects/reveal-card.ts';
import { SelectCardEffect } from '../../core/effects/select-card.ts';
import { ShuffleDeckEffect } from '../../core/effects/shuffle-card.ts';
import { TrashCardEffect } from '../../core/effects/trash-card.ts';
import { UserPromptEffect } from '../../core/effects/user-prompt.ts';
import { CardExpansionModule } from '../card-expansion-module.ts';
import { InvokeGameActionGeneratorEffect } from '../../core/effects/invoke-game-action-generator-effect.ts';

const expansionModule: CardExpansionModule = {
  registerCardLifeCycles: () => ({
    'merchant': {
      onEnterPlay: ({ playerId, cardId }) => {
        const id = `merchant-${cardId}`;
        return {
          registerTriggers: [{
            id,
            playerId,
            once: true,
            condition: ({ cardLibrary, trigger }) => {
              const card = cardLibrary.getCard(trigger.cardId);
              return card.cardKey === 'silver' && trigger.playerId === playerId;
            },
            listeningFor: 'cardPlayed',
            generatorFn: function* () {
              yield new GainTreasureEffect({
                sourceCardId: cardId,
                sourcePlayerId: playerId,
                count: 1,
              });
            },
          }],
        };
      },
      onLeavePlay: ({ cardId }) => {
        return {
          unregisterTriggers: [`merchant-${cardId}`],
        };
      },
    },
    'moat': {
      onEnterHand: ({ playerId, cardId }) => {
        return {
          registerTriggers: [{
            id: `moat-${cardId}`,
            playerId,
            multipleUse: false,
            listeningFor: 'cardPlayed',
            condition: ({ cardLibrary, trigger }) => {
              return cardLibrary.getCard(trigger.cardId).type.includes(
                'ATTACK',
              ) && trigger.playerId !== playerId;
            },
            generatorFn: function* ({ trigger, reaction }) {
              const sourceId = reaction.getSourceId();
              
              yield new RevealCardEffect({
                sourceCardId: trigger.cardId,
                sourcePlayerId: trigger.playerId,
                cardId: sourceId,
                playerId: reaction.playerId,
              });
              
              return 'immunity';
            },
          }],
        };
      },
      onLeaveHand: ({ cardId }) => {
        return {
          unregisterTriggers: [`moat-${cardId}`],
        };
      },
    },
  }),
  registerScoringFunctions: () => ({
    'gardens': function ({ match, ownerId }) {
      const cards = match
        .playerHands[ownerId]
        .concat(match.playerDecks[ownerId])
        .concat(match.playerDiscards[ownerId])
        .concat(match.playArea);
      
      return Math.floor(cards.length / 10);
    },
  }),
  registerEffects: () => ({
    'artisan': () => function* ({ cardLibrary, triggerPlayerId, triggerCardId }) {
      console.log(`[ARTISAN EFFECT] choosing card to gain...`);
      //Gain a card to your hand costing up to 5 Treasure.
      //Put a card from your hand onto your deck.
      
      let results = (yield new SelectCardEffect({
        prompt: 'Choose card to gain',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerPlayerId,
        restrict: {
          from: {
            location: ['supply', 'kingdom'],
          },
          cost: {
            kind: 'upTo',
            amount: 5,
          },
        },
      })) as number[];
      
      let selectedCardId = results[0];
      
      console.log(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);
      
      console.log(`[ARTISAN EFFECT] gaining card to hand...`);
      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId: selectedCardId,
        to: {
          location: 'playerHands',
        },
      });
      
      console.log(`[ARTISAN EFFECT] choosing card to put on deck...`);
      
      results = (yield new SelectCardEffect({
        prompt: 'Confirm top-deck card',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        restrict: {
          from: {
            location: 'playerHands',
          },
        },
      })) as number[];
      
      selectedCardId = results[0];
      
      console.log(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);
      
      console.log(`[ARTISAN EFFECT] moving card to deck...`);
      
      yield new MoveCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        toPlayerId: triggerPlayerId,
        cardId: selectedCardId,
        to: {
          location: 'playerDecks',
        },
      });
    },
    'bandit': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext
    }) {
      //Gain a Gold. Each other player reveals the top 2 cards of their deck,
      // trashes a revealed Treasure other than Copper, and discards the rest.
      
      const goldCardId = match.supply.find((c) =>
        cardLibrary.getCard(c).cardKey === 'gold'
      );
      
      if (goldCardId) {
        console.log(`[BANDIT EFFECT] gaining a gold to discard...`);
        
        const goldCard = cardLibrary.getCard(goldCardId);
        
        yield new GainCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId: goldCard.id,
          to: {
            location: 'playerDiscards',
          },
        });
      } else {
        console.log(`[BANDIT EFFECT] no gold in supply`);
      }
      
      const targetPlayerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[BANDIT EFFECT] targets ${targetPlayerIds}`);
      
      for (const targetPlayerId of targetPlayerIds) {
        let playerDeck = match.playerDecks[targetPlayerId];
        let playerDiscard = match.playerDiscards[targetPlayerId];
        
        let numToReveal = 2;
        const totalCards = playerDiscard.length + playerDeck.length;
        
        numToReveal = Math.min(numToReveal, totalCards);
        
        if (numToReveal === 0) {
          console.log(`[BANDIT EFFECT] player has no cards to reveal`);
          continue;
        }
        
        if (playerDeck.length < numToReveal) {
          console.log(`[BANDIT EFFECT] not enough cards in deck, shuffling...`);
          
          yield new ShuffleDeckEffect({
            playerId: targetPlayerId,
          });
          
          playerDeck = match.playerDecks[targetPlayerId];
          playerDiscard = match.playerDiscards[targetPlayerId];
        }
        
        const cardIdsToReveal = playerDeck.slice(-numToReveal);
        
        for (const cardId of cardIdsToReveal) {
          console.log(`[BANDIT EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
          
          yield new RevealCardEffect({
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            playerId: targetPlayerId,
            cardId,
          });
        }
        
        const possibleCardIdsToTrash = cardIdsToReveal.filter((cardId) => {
          const card = cardLibrary.getCard(cardId);
          return card.cardKey !== 'copper' && card.type.includes('TREASURE');
        });
        
        let cardIdTrashed: number;
        if (possibleCardIdsToTrash.length > 0) {
          console.log(`[BANDIT EFFECT] cards that can be trashed ${possibleCardIdsToTrash.map(
            (cardId) => cardLibrary.getCard(cardId))}`
          );
          
          // they get a choice if there is more than one to trash and they aren't the same
          const giveChoice = possibleCardIdsToTrash.length > 1 &&
            (cardLibrary.getCard(possibleCardIdsToTrash[0]).cardKey !== (cardLibrary.getCard(possibleCardIdsToTrash[1]).cardKey));
          
          if (giveChoice) {
            console.log(`[BANDIT EFFECT] prompt user to select card to trash...`);
            
            const results = (yield new UserPromptEffect({
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
              playerId: targetPlayerId,
              prompt: 'Choose a treasure to trash',
              content: {
                type: 'select',
                cardIds: possibleCardIdsToTrash,
                selectCount: 1,
              },
            })) as { result: number[] };
            
            cardIdTrashed = results?.result?.[0];
          } else {
            cardIdTrashed = possibleCardIdsToTrash[0];
            console.log(`[BANDIT EFFECT] not giving player choice, auto trashing ${cardLibrary.getCard(cardIdTrashed)}`);
          }
          
          console.log(`[BANDIT EFFECT] player chose ${cardLibrary.getCard(cardIdTrashed)}`);
          
          console.log(`[BANDIT EFFECT] trashing card...`);
          
          yield new TrashCardEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: targetPlayerId,
            cardId: cardIdTrashed,
          });
        } else {
          console.log(`[BANDIT EFFECT] no possible cards to trash`);
        }
        
        const cardIdsToDiscard =
          cardIdsToReveal.filter(cardId => !possibleCardIdsToTrash.includes(cardId))
            .concat(possibleCardIdsToTrash.filter(id => id !== cardIdTrashed));
        
        
        if (cardIdsToDiscard.length > 0) {
          console.log(`[BANDIT EFFECT] cards that will be discarded ${cardIdsToDiscard.map(
            (cardId) => cardLibrary.getCard(cardId))}`);
          
          for (const cardId of cardIdsToDiscard) {
            console.log(`[BANDIT EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
            
            yield new DiscardCardEffect({
              playerId: targetPlayerId,
              sourceCardId: triggerCardId,
              sourcePlayerId: triggerPlayerId,
              cardId,
            });
          }
        } else {
          console.log(`[BANDIT EFFECT] no cards to discard`);
        }
      }
    },
    'bureaucrat': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
      reactionContext
    }) {
      // Gain a Silver onto your deck. Each other player reveals a Victory card
      // from their hand and puts it onto their deck (or reveals a hand with no Victory cards).
      const silverCardId = match.supply.find((c) =>
        cardLibrary.getCard(c).cardKey === 'silver');
      
      if (!silverCardId) {
        console.log('[BUREAUCRAT EFFECT] no silver in supply');
      } else {
        console.log(`[BUREAUCRAT EFFECT] gaining silver to deck...`);
        
        yield new GainCardEffect({
          playerId: triggerPlayerId,
          cardId: silverCardId,
          to: { location: 'playerDecks' },
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
        });
      }
      
      const targetPlayerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[BUREAUCRAT EFFECT] targeting ${targetPlayerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const targetPlayerId of targetPlayerIds) {
        let cardIdsToReveal = match.playerHands[targetPlayerId].filter((c) =>
          cardLibrary.getCard(c).type.includes('VICTORY')
        );
        
        if (cardIdsToReveal.length === 0) {
          console.log(`[BUREAUCRAT EFFECT] ${getPlayerById(match, targetPlayerId)} has no victory cards, revealing all`);
          
          cardIdsToReveal = match.playerHands[targetPlayerId];
          
          for (const cardId of cardIdsToReveal) {
            console.log(`[BUREAUCRAT EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
            
            yield new RevealCardEffect({
              playerId: targetPlayerId,
              cardId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
            });
          }
        } else {
          
          let cardIdToReveal: number;
          
          if (cardIdsToReveal.length === 1 || (cardLibrary.getCard(cardIdsToReveal[0]).cardKey === cardLibrary.getCard(cardIdsToReveal[1]).cardKey)) {
            console.log(`[BUREAUCRAT EFFECT] only one card to reveal or cards are the same, auto selecting`);
            cardIdToReveal = cardIdsToReveal[0];
          } else {
            console.log(`[BUREAUCRAT EFFECT] prompting user to select card to reveal...`);
            
            const cardIds = (yield new SelectCardEffect({
              prompt: 'Reveal victory card',
              playerId: targetPlayerId,
              count: 1,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
              restrict: {
                from: { location: 'playerHands' },
                card: { type: 'VICTORY' },
              },
            })) as number[];
            cardIdToReveal = cardIds[0];
          }
          
          console.log(`[BUREAUCRAT EFFECT] revealing ${cardLibrary.getCard(cardIdToReveal)}...`);
          
          yield new RevealCardEffect({
            playerId: targetPlayerId,
            cardId: cardIdToReveal,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
          });
          
          console.log(`[BUREAUCRAT EFFECT] moving card to deck`);
          
          yield new MoveCardEffect({
            toPlayerId: targetPlayerId,
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            cardId: cardIdToReveal,
            to: { location: 'playerDecks' },
          });
        }
      }
    },
    'cellar': () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
      cardLibrary
    }) {
      console.log(`[CELLAR EFFECT] gaining action...`);
      yield new GainActionEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      
      const hasCards = match.playerHands[triggerPlayerId].length > 0;
      
      if (!hasCards) {
        console.log('[CELLAR EFFECT] player has no cards to choose from');
        return;
      }
      
      console.log(`[CELLAR EFFECT] prompting user to select cards to discard...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel discard',
        validPrompt: 'Confirm discard',
        playerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        count: { kind: 'upTo', count: match.playerHands[triggerPlayerId].length },
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      console.log(`[CELLAR EFFECT] user selected ${cardIds.length} cards`);
      
      if (!cardIds.length) {
        return;
      }
      
      for (const cardId of cardIds) {
        console.log(`[CELLAR EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
        
        yield new DiscardCardEffect({
          cardId,
          playerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
        });
      }
      
      for (let i = 0; i < (cardIds as number[]).length; i++) {
        console.log(`[CELLAR EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
    },
    'chapel': () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
      cardLibrary
    }) {
      const hand = match.playerHands[triggerPlayerId];
      
      if (!hand.length) {
        console.log(`[CHAPEL EFFECT] player has no cards in hand`);
        return;
      }
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: { kind: 'upTo', count: 4 },
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      if (cardIds?.length > 0) {
        console.log('[CHAPEL EFFECT] no cards selected');
        return;
      }
      
      for (const cardId of cardIds) {
        console.log(`[CELLAR EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        
        yield new TrashCardEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          playerId: triggerPlayerId,
          cardId,
        });
      }
    },
    'council-room': () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
    }) {
      for (let i = 0; i < 4; i++) {
        console.log(`[COUNCIL ROOM EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      console.log(`[COUNCIL ROOM EFFECT] gaining buy...`);
      yield new GainBuyEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      
      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      );
      
      console.log(`[COUNCIL ROOM EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const playerId of playerIds) {
        console.log(`[COUNCIL EFFECT] ${getPlayerById(match, playerId)} drawing card...`);
        
        yield new DrawCardEffect({ playerId, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      }
    },
    'festival': () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      console.log(`[FESTIVAL EFFECT] gaining 2 actions...`);
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      
      console.log(`[FESTIVAL EFFECT] gaining 1 buy...`);
      yield new GainBuyEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      
      console.log(`[FESTIVAL EFFECT] gaining 2 treasure...`);
      yield new GainTreasureEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
    },
    // deno-lint-ignore require-yield
    'gardens': () => function* () {
      console.log(`[GARDENS EFFECT] garden has no effects`);
    },
    'harbinger': () => function* ({
      match,
      triggerPlayerId,
      triggerCardId,
      cardLibrary
    }) {
      // +1 Card
      // +1 Action
      // Look through your discard pile. You may put a card from it onto your deck.
      console.log(`[HARBINGER EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
      });
      
      console.log(`[HARBINGER EFFECT] drawing 1 action...`);
      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      
      if (match.playerDiscards[triggerPlayerId].length === 0) {
        console.log('[HARBINGER EFFECT] player has no cards in discard');
        return;
      }
      
      console.log(`[HARBINGER EFFECT] prompting user to select card from discard...`);
      
      const results = (yield new UserPromptEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        prompt: 'Choose card to put on deck?',
        actionButtons: [{ label: 'CANCEL', action: 2 }],
        content: {
          type: 'select',
          cardIds: match.playerDiscards[triggerPlayerId],
          selectCount: 1
        },
      })) as { action: number, result: number[] };
      
      if (results.action === 2) {
        console.log('[HARBINGER EFFECT] no card selected');
        return;
      }
      
      const selectedId = results?.result?.[0];
      
      if (selectedId) {
        console.log(`[HARBINGER EFFECT] card selected: ${cardLibrary.getCard(selectedId)}`);
        
        console.log(`[HARBINGER EFFECT] moving card to deck...`);
        
        yield new MoveCardEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          cardId: selectedId,
          toPlayerId: triggerPlayerId,
          to: { location: 'playerDecks' }
        });
      } else {
        console.log('[HARBINGER EFFECT] no card selected');
      }
    },
    'laboratory': () => function* ({
      triggerPlayerId, triggerCardId,
    }) {
      for (let i = 0; i < 2; i++) {
        console.log(`[LABORATORY EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      console.log(`[LABORATORY EFFECT] gaining 1 action...`);
      yield new GainActionEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
    },
    'library': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      // Draw until you have 7 cards in hand, skipping any Action cards
      // you choose to; set those aside, discarding them afterward.
      const setAside: number[] = [];
      
      let hand = match.playerHands[triggerPlayerId];
      let deck = match.playerDecks[triggerPlayerId];
      let discard = match.playerDiscards[triggerPlayerId];
      
      console.log(`[LIBRARY EFFECT] hand size is ${hand.length}`);
      
      // total hand size should be 7 when done. because i'm drawing to hand and not really
      // placing them in an 'aside' area, the total hand size should be 7 plus the set aside cards.
      // we also make sure the deck+discard length is great enough to be able to draw a card.
      while (hand.length < 7 + setAside.length && (deck.length + discard.length > 0)) {
        console.log(`[LIBRARY EFFECT] drawing card...`);
        
        const results = (yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId
        })) as { result: number };
        
        const cardId = results.result;
        const card = cardLibrary.getCard(cardId);
        
        if (card.type.includes('ACTION')) {
          console.log(`[LIBRARY EFFECT] ${card} is an action prompting user to set aside...`);
          
          const shouldSetAside = (yield new UserPromptEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: triggerPlayerId,
            prompt: `You drew ${card.cardName}. Set it aside (skip putting it in your hand)?`,
            actionButtons: [{ label: 'KEEP', action: 1 }, { label: 'SET ASIDE', action: 2 }],
          })) as { action: number };
          
          if (shouldSetAside.action === 2) {
            console.log(`[LIBRARY EFFECT] setting card aside`);
            setAside.push(cardId);
          } else {
            console.log('[LIBRARY EFFECT] keeping card in hand');
          }
          
          hand = match.playerHands[triggerPlayerId];
          deck = match.playerDecks[triggerPlayerId];
          discard = match.playerDiscards[triggerPlayerId];
        } else {
          console.log(`[LIBRARY EFFECT] card was not an action, keeping in hand`);
        }
      }
      
      if (setAside.length === 0) {
        console.log(`[LIBRARY EFFECT] no set aside cards, done`);
        return;
      }
      
      for (const cardId of setAside) {
        console.log(`[LIBRARY EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
        
        yield new DiscardCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          cardId,
          playerId: triggerPlayerId,
        });
      }
    },
    'market': () => function* ({
      triggerPlayerId, triggerCardId,
    }) {
      console.log(`[MARKET EFFECT] drawing card...`);
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
      
      console.log(`[MARKET EFFECT] gaining 1 action...`);
      yield new GainActionEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      
      console.log(`[MARKET EFFECT] gaining 1 buy...`);
      yield new GainBuyEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      
      console.log(`[MARKET EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
    },
    'merchant': () => function* ({
      triggerPlayerId, triggerCardId,
    }) {
      console.log(`[MERCHANT EFFECT] drawing card...`);
      yield new DrawCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
      });
      
      console.log(`[MERCHANT EFFECT] gaining 1 action...`);
      yield new GainActionEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });
    },
    'militia': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
      reactionContext
    }) {
      console.log(`[MILITIA EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 2 });
      
      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[MILITIA EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const playerId of playerIds) {
        const handCount = match.playerHands[playerId].length;
        
        console.log(`[MILITIA EFFECT] ${getPlayerById(match, playerId)} has ${handCount} cards in hand`);
        if (handCount <= 3) {
          continue;
        }
        
        const selectCount = handCount - 3;
        console.log(`[MILITIA EFFECT] prompting user to select ${selectCount} hands`);
        
        const cardIds = (yield new SelectCardEffect({
          prompt: 'Confirm discard',
          playerId,
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          count: selectCount,
          restrict: {
            from: { location: 'playerHands' }
          },
        })) as number[];
        
        console.log(`[MILITIA EFFECT] ${getPlayerById(match, playerId)} chose ${cardIds.map(
          (id) => cardLibrary.getCard(id))} to discard`);
        
        for (const cardId of cardIds) {
          console.log(`[MILITIA EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
          
          yield new DiscardCardEffect({
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            cardId,
            playerId,
          });
        }
      }
    },
    'mine': () => function* ({ match, cardLibrary, triggerPlayerId, triggerCardId }) {
      // You may trash a Treasure from your hand. Gain a Treasure to
      // your hand costing up to 3 Treasure more than it.
      const hand = match.playerHands[triggerPlayerId];
      
      const hasTreasureCards = hand.some(
        (c) => cardLibrary.getCard(c).type.includes('TREASURE'));
      
      if (!hasTreasureCards) {
        console.log(`[MINE EFFECT] player has no treasure cards in hand`);
        return;
      }
      
      console.log(`[MINE EFFECT] prompting player to trash a treasure`);
      
      let cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: { kind: 'upTo', count: 1 },
        restrict: {
          from: { location: 'playerHands' },
          card: { type: ['TREASURE'] },
        },
      })) as number[];
      
      let cardId = cardIds?.[0];
      
      if (!cardId) {
        console.log(`[MINE EFFECT] player selected no card`);
        return;
      }
      
      console.log(`[MINE EFFECT] player selected ${cardLibrary.getCard(cardId)}`);
      
      console.log(`[MINE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
      
      yield new TrashCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        cardId,
      });
      
      let card = cardLibrary.getCard(cardId);
      
      const costRestriction = card.cost.treasure + 3;
      
      console.log(`[MINE EFFECT] prompting user to select treasure costing up to ${costRestriction}`);
      cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm gain card',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          card: { type: ['TREASURE'] },
          cost: { kind: 'upTo', amount: costRestriction },
        },
      })) as number[];
      
      cardId = cardIds?.[0];
      
      if (!cardId) {
        console.log(`[MINE EFFECT] no card selected`);
        return;
      }
      
      card = cardLibrary.getCard(cardId);
      
      console.log(`[MINE EFFECT] player selected ${card}`);
      
      console.log(`[MINE EFFECT] gaining card to hand`);
      
      yield new GainCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId,
        to: { location: 'playerHands' },
      });
    },
    'moat': () => function* ({ triggerPlayerId, triggerCardId }) {
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
    },
    'moneylender': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      const hand = match.playerHands[triggerPlayerId];
      
      const hasCopper = hand.some((c) =>
        cardLibrary.getCard(c).cardKey === 'copper');
      
      if (!hasCopper) {
        console.log(`[MONEYLENDER EFFECT] player has no copper in hand`);
        return;
      }
      
      console.log(`[MONEYLENDER EFFECT] prompting user to trash a copper`);
      
      const result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        actionButtons: [
          { action: 1, label: `DON'T TRASH` }, { action: 2, label: 'TRASH' }
        ],
        prompt: 'Trash a copper?'
      })) as { action: number, cardIds: number[] };
      
      if (result.action === 1) {
        console.log(`[MONEYLENDER EFFECT] player chose not to trash`);
        return;
      }
      
      const card = hand.map(cardLibrary.getCard).find(c => c.cardKey === 'copper');
      
      if (!card) {
        console.warn(`[MONEYLENDER EFFECT] no copper in hand`);
        return;
      }
      
      console.log(`[MONEYLENDER EFFECT] trashing ${card}...`);
      
      yield new TrashCardEffect({
        playerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId: card.id
      });
      
      console.log(`[MONEYLENDER EFFECT] gaining 3 treasure...`);
      
      yield new GainTreasureEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 3,
      });
    },
    'poacher': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      console.log(`[POACHER EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
      });
      
      console.log(`[POACHER EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });
      
      console.log(`[POACHER EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });
      
      const allSupplyCardKeys = match.config.supplyCardKeys.concat(
        match.config.kingdomCardKeys,
      );
      
      console.log(`[POACHER EFFECT] original supply card piles ${allSupplyCardKeys}`);
      
      const remainingSupplyCardKeys =
        match.supply
          .concat(match.kingdom)
          .map((id) => cardLibrary.getCard(id).cardKey)
          .reduce((prev, cardKey) => {
            if (prev.includes(cardKey)) {
              return prev;
            }
            return prev.concat(cardKey);
          }, [] as string[]);
      
      console.log(`[POACHER EFFECT] remaining supply card piles ${remainingSupplyCardKeys}`);
      
      const emptyPileCount = allSupplyCardKeys.length - remainingSupplyCardKeys.length;
      
      console.log(`[POACHER EFFECT] number of empty supply piles ${emptyPileCount}`);
      
      if (emptyPileCount === 0) {
        return;
      }
      
      const hand = match.playerHands[triggerPlayerId];
      
      if (hand.length === 0) {
        console.log(`[POACHER EFFECT] no cards in hand to discard`);
        return;
      }
      
      let numToDiscard = Math.min(hand.length, emptyPileCount);
      
      console.log(`[POACHER EFFECT] number of cards to discard ${numToDiscard}`);
      
      if (hand.length < emptyPileCount) {
        numToDiscard = Math.min(hand.length, emptyPileCount);
        console.log(`[POACHER EFFECT] not enough cards in hand changing number to discard to ${numToDiscard}`);
      }
      
      console.log(`[POACHER EFFECT] prompting user to discard cards...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm discard',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: numToDiscard,
        restrict: {
          from: { location: 'playerHands' }
        },
      })) as number[];
      
      for (const cardId of cardIds) {
        console.log(`[POACHER EFFECT] discarding card ${cardLibrary.getCard(cardId)}...`);
        
        yield new DiscardCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId,
        });
      }
    },
    'remodel': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      if (match.playerHands[triggerPlayerId].length === 0) {
        console.log(`[REMODEL EFFECT] player has no cards in hand`);
        return;
      }
      
      let cardIds = (yield new SelectCardEffect({
        prompt: 'Trash card',
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        count: 1,
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      let cardId = cardIds[0];
      const card = cardLibrary.getCard(cardId);
      
      console.log(`[REMODEL EFFECT] trashing card ${card}...`);
      
      yield new TrashCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId,
      });
      
      const costRestriction = card.cost.treasure + 2;
      
      console.log(`[REMODEL EFFECT] prompting user to select card costing up to ${costRestriction}...`);
      
      cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: 1,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: costRestriction },
        },
      })) as number[];
      
      cardId = cardIds[0];
      
      console.log(`[REMODEL EFFECT] gaining ${cardLibrary.getCard(cardId)} to discard...`);
      
      yield new GainCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
    'sentry': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      // +1 Card
      // +1 Action
      // Look at the top 2 cards of your deck. Trash and/or discard any number of
      // them. Put the rest back on top in any order.
      console.log(`[SENTRY EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
      });
      
      console.log(`[SENTRY EFFECT] gaining 1 action...`);
      
      yield new GainActionEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });
      
      let deck = match.playerDecks[triggerPlayerId];
      const discard = match.playerDiscards[triggerPlayerId];
      
      let numToLookAt = 2;
      
      console.log(`[SENTRY EFFECT] number of cards to look at ${numToLookAt}`);
      
      if (deck.length + discard.length < numToLookAt) {
        numToLookAt = Math.min(2, deck.length + discard.length);
        console.log(`[SENTRY EFFECT] not enough cards, number of cards to look at is now ${numToLookAt}`);
      }
      
      if (numToLookAt === 0) {
        console.log(`[SENTRY EFFECT] player does not have enough cards`);
        return;
      }
      
      if (deck.length < 2) {
        console.debug(`[SENTRY EFFECT] player has ${deck.length} cards in deck, shuffling deck`);
        yield new ShuffleDeckEffect({
          playerId: triggerPlayerId
        });
        
        deck = match.playerDecks[triggerPlayerId];
      }
      
      const cardsToLookAtIds = deck.slice(-numToLookAt);
      
      console.debug(`[SENTRY EFFECT] looking at cards ${cardsToLookAtIds.map(
        (id) => cardLibrary.getCard(id))}`);
      
      console.log(`[SENTRY EFFECT] prompting user to trash cards...`);
      
      let result = (yield new UserPromptEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        prompt: 'Choose card/s to trash?',
        actionButtons: [{ label: `DON'T TRASH`, action: 2 }, { label: 'TRASH', action: 1 }],
        content: {
          type: 'select',
          cardIds: cardsToLookAtIds,
          selectCount: {
            kind: 'upTo',
            count: cardsToLookAtIds.length,
          },
        },
      })) as { action: number; result: number[] };
      
      const cardIdsToTrash = result?.result ?? [];
      
      if (result.action === 1) {
        console.debug(`[SENTRY EFFECT] player selected ${cardIdsToTrash.map(
          (id) => cardLibrary.getCard(id))} to trash`);
        
        for (const cardId of cardIdsToTrash) {
          console.log(`[SENTRY EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
          
          yield new TrashCardEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: triggerPlayerId,
            cardId: cardId,
          });
        }
      } else {
        console.debug(`[SENTRY EFFECT] player chose not to trash anything`);
      }
      
      const possibleCardsToDiscard = cardsToLookAtIds.filter((id) =>
        !cardIdsToTrash.includes(id)
      );
      
      if (possibleCardsToDiscard.length === 0) {
        console.debug(`[SENTRY EFFECT] all cards trashed or not more to discard`);
        return;
      }
      
      result = (yield new UserPromptEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        prompt: 'Choose card/s to discard?',
        actionButtons: [{ label: `DON'T DISCARD`, action: 2 }, { label: 'DISCARD', action: 1 }],
        content: {
          type: 'select',
          cardIds: possibleCardsToDiscard,
          selectCount: {
            kind: 'upTo',
            count: possibleCardsToDiscard.length,
          },
        },
      })) as { action: number; result: number[] };
      
      let cardsToDiscard: number[] = [];
      if (result.action === 2) {
        console.debug(`[SENTRY EFFECT] player chose not to discard`);
      } else {
        cardsToDiscard = result?.result ?? [];
        
        console.debug(`[SENTRY EFFECT] player chose ${cardsToDiscard.map(
          (id) => cardLibrary.getCard(id))} to discard`);
        
        for (const selectedCardId of cardsToDiscard) {
          console.log(`[SENTRY EFFECT] discarding ${cardLibrary.getCard(selectedCardId)}`);
          
          yield new DiscardCardEffect({
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            playerId: triggerPlayerId,
            cardId: selectedCardId,
          });
        }
      }
      
      const remainingCardIds = cardsToLookAtIds
        .filter(id => !cardIdsToTrash.includes(id) && !cardsToDiscard.includes(id));
      
      if (remainingCardIds.length <= 1) {
        console.debug(`[SENTRY EFFECT] not enough cards to rearrange`);
        return;
      }
      
      console.debug(`[SENTRY EFFECT] prompting user to rearrange cards...`);
      
      result = (yield new UserPromptEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        prompt: 'rearrange cards',
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
        content: {
          type: 'rearrange',
          cardIds: remainingCardIds
        }
      })) as { action: number, result: number[] };
      
      const cardIds = result.result;
      
      for (const cardId of cardIds) {
        console.log(`[SENTRY EFFECT] putting ${cardLibrary.getCard(cardId)} on top of deck...`);
        
        yield new MoveCardEffect({
          cardId,
          toPlayerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          to: { location: 'playerDecks' }
        });
      }
    },
    'smithy': () => function* ({
      triggerPlayerId, triggerCardId,
    }) {
      for (let i = 0; i < 3; i++) {
        console.log(`[SMITHY EFFECT] drawing card...`);
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
    },
    'throne-room': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      console.log(`[THRONE ROOM EFFECT] prompting user to select action card from hand...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel',
        validPrompt: 'Confirm',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: { kind: 'upTo', count: 1 },
        restrict: {
          from: { location: 'playerHands' },
          card: { type: ['ACTION'] },
        },
      })) as number[];
      
      const cardId = cardIds?.[0];
      
      if (!cardId) {
        console.debug(`[THRONE ROOM EFFECT] player chose no cards`);
        return;
      }
      
      console.log(`[THRONE ROOM EFFECT] player selected ${cardLibrary.getCard(cardId)}`);
      
      for (let i = 0; i < 2; i++) {
        console.log(`[THRONE ROOM EFFECT] running generator...`);
        
        yield new InvokeGameActionGeneratorEffect({
          gameAction: 'playCard',
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId!,
          context: {
            match,
            cardLibrary,
            triggerPlayerId,
            triggerCardId: cardId
          },
          overrides: {
            actionCost: 0,
            moveCard: false,
            playCard: false,
          }
        });
      }
    },
    'vassal': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      console.log(`[VASSAL EFFECT] gain 2 treasure...`);
      
      yield new GainTreasureEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 2,
      });
      
      let playerDeck = match.playerDecks[triggerPlayerId];
      
      if (playerDeck.length === 0) {
        console.debug(`[VASSAL EFFECT] not enough cards in deck, shuffling`);
        yield new ShuffleDeckEffect({
          playerId: triggerPlayerId,
        });
        playerDeck = match.playerDecks[triggerPlayerId];
      }
      
      const cardToDiscardId = playerDeck.slice(-1)?.[0];
      
      if (!cardToDiscardId) {
        console.debug('[VASSAL EFFECT] no cards to discard...');
        return;
      }
      
      console.log(`[VASSAL EFFECT] discarding ${cardLibrary.getCard(cardToDiscardId)}...`);
      
      yield new DiscardCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId: cardToDiscardId,
      });
      
      const card = cardLibrary.getCard(cardToDiscardId);
      
      if (!card.type.includes('ACTION')) {
        console.debug(`[VASSAL EFFECT] card is not an action, done processing`);
        return;
      }
      
      console.log(`[VASSAL EFFECT] prompting user to play card or not...`);
      
      const confirm = (yield new UserPromptEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        prompt: `Play card ${card.cardName}?`,
        actionButtons: [{ label: 'NO', action: 1 }, { label: 'PLAY', action: 2 }],
      })) as { action: number };
      
      if (confirm.action !== 2) {
        console.debug(`[VASSAL EFFECT] player chose not to play card`);
        return;
      }
      
      console.log(`[VASSAL EFFECT] invoking game action generator...`);
      
      yield new InvokeGameActionGeneratorEffect({
        gameAction: 'playCard',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId!,
        context: {
          match,
          cardLibrary,
          triggerPlayerId,
          triggerCardId: card.id
        },
        overrides: {
          actionCost: 0,
        }
      });
    },
    'village': () => function* ({
      triggerPlayerId, triggerCardId,
    }) {
      console.log(`[VILLAGE EFFECT] gaining 2 actions...`);
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      
      console.log(`[VILLAGE EFFECT] drawing card...`);
      
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
    },
    'witch': () => function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
      reactionContext
    }) {
      for (let i = 0; i < 2; i++) {
        console.log(`[WITCH EFFECT] drawing card...`);
        
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.debug(`[WITCH EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const playerId of playerIds) {
        const supply = match.supply;
        const l = supply.length;
        for (let i = l - 1; i >= 0; i--) {
          if (cardLibrary.getCard(supply[i]).cardKey === 'curse') {
            console.log(`[WITCH EFFECT] gaining card...`);
            
            yield new GainCardEffect({
              playerId,
              cardId: supply[i],
              to: { location: 'playerDiscards' },
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
            });
            break;
          }
          
          console.debug('[WITCH EFFECT] no curses found in supply');
        }
      }
    },
    'workshop': () => function* ({
      triggerPlayerId,
      triggerCardId,
      cardLibrary
    }) {
      console.log(`[WORKSHOP EFFECT] prompting player to select card to gain...`);
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: 1,
        restrict: {
          cost: { kind: 'upTo', amount: 4 },
          from: { location: ['supply', 'kingdom'] },
        },
      })) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[WORKSHOP EFFECT] gaining card ${cardLibrary.getCard(cardId)}`)
      
      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
  }),
};

export default expansionModule;

