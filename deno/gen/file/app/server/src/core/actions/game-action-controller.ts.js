import { Card, TurnPhaseOrderValues } from 'shared/shared-types.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { ReactionTrigger } from '../../types.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
export class GameActionController {
  _cardSourceController;
  _findCards;
  cardPriceRuleController;
  cardEffectFunctionMap;
  eventEffectFunctionMap;
  match;
  cardLibrary;
  logManager;
  socketMap;
  reactionManager;
  runGameActionDelegate;
  interactivityController;
  customActionHandlers;
  customCardEffectHandlers;
  constructor(_cardSourceController, _findCards, cardPriceRuleController, cardEffectFunctionMap, eventEffectFunctionMap, match, cardLibrary, logManager, socketMap, reactionManager, runGameActionDelegate, interactivityController){
    this._cardSourceController = _cardSourceController;
    this._findCards = _findCards;
    this.cardPriceRuleController = cardPriceRuleController;
    this.cardEffectFunctionMap = cardEffectFunctionMap;
    this.eventEffectFunctionMap = eventEffectFunctionMap;
    this.match = match;
    this.cardLibrary = cardLibrary;
    this.logManager = logManager;
    this.socketMap = socketMap;
    this.reactionManager = reactionManager;
    this.runGameActionDelegate = runGameActionDelegate;
    this.interactivityController = interactivityController;
    this.customActionHandlers = {};
    this.customCardEffectHandlers = {};
  }
  registerCardEffect(cardKey, tag, fn) {
    this.customCardEffectHandlers[tag] ??= {};
    if (this.customCardEffectHandlers[tag][cardKey]) {
      console.warn(`[action controller] effect for ${cardKey} in ${tag} already exists, overwriting it`);
    }
    this.customCardEffectHandlers[tag][cardKey] = fn;
  }
  async invokeAction(action, ...args) {
    const handler = this[action] ?? this.customActionHandlers[action];
    if (!handler) {
      throw new Error(`No handler registered for action: ${action}`);
    }
    return await handler.bind(this)(...args);
  }
  async gainPotion(args) {
    console.log(`[gainPotion action] gaining ${args.count} potions`);
    this.match.playerPotions += args.count;
    this.match.playerPotions = Math.max(0, this.match.playerPotions);
    console.log(`[gainPotion action] setting player potions to ${this.match.playerPotions}`);
  }
  async gainBuy(args, context) {
    console.log(`[gainBuy action] gaining ${args.count} buys`);
    this.match.playerBuys += args.count;
    this.match.playerBuys = Math.max(this.match.playerBuys, 0);
    this.logManager.addLogEntry({
      type: 'gainBuy',
      count: args.count,
      playerId: getCurrentPlayer(this.match).id,
      source: context?.loggingContext?.source
    });
    console.log(`[gainBuy action] setting player guys to ${this.match.playerBuys}`);
  }
  async moveCard(args) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    if (Array.isArray(args.to.location)) {
      throw new Error(`[moveCard action] cannot move card to multiple locations`);
    }
    let oldSource = null;
    try {
      oldSource = this._cardSourceController.findCardSource(cardId);
    } catch (e) {
      console.warn(`[moveCard action] could not find source for ${card}`);
    }
    const newSource = this._cardSourceController.getSource(args.to.location, args.toPlayerId);
    if (!newSource) {
      throw new Error(`[moveCard action] could not find source for ${card}`);
    }
    oldSource?.source.splice(oldSource?.index, 1);
    switch(oldSource?.sourceKey){
      case 'playerHand':
        await this.reactionManager.runCardLifecycleEvent('onLeaveHand', {
          playerId: args.toPlayerId,
          cardId
        });
        break;
      case 'playArea':
      case 'activeDuration':
        if (args.to.location === 'playArea' || args.to.location === 'activeDuration') break;
        await this.reactionManager.runCardLifecycleEvent('onLeavePlay', {
          cardId
        });
    }
    newSource.push(cardId);
    switch(args.to.location){
      case 'playerHand':
        await this.reactionManager.runCardLifecycleEvent('onEnterHand', {
          playerId: args.toPlayerId,
          cardId
        });
        break;
    }
    console.log(`[moveCard action] moved ${card} from ${oldSource?.sourceKey} to ${args.to.location}`);
    return oldSource ? {
      location: oldSource?.sourceKey,
      playerId: oldSource?.playerId
    } : undefined;
  }
  async gainAction(args, context) {
    console.log(`[gainAction action] gaining ${args.count} actions`);
    this.match.playerActions += args.count;
    this.match.playerActions = Math.max(0, this.match.playerActions);
    this.logManager.addLogEntry({
      type: 'gainAction',
      playerId: getCurrentPlayer(this.match).id,
      count: args.count,
      source: context?.loggingContext?.source
    });
    console.log(`[gainAction action] setting player actions to ${args.count}`);
  }
  async gainCard(args, context) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    const previousLocation = await this.moveCard({
      cardId,
      to: args.to,
      toPlayerId: args.playerId
    });
    this.match.stats.cardsGainedByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardsGainedByTurn[this.match.turnNumber].push(cardId);
    this.match.stats.cardsGained[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: args.playerId
    };
    card.owner = args.playerId;
    console.log(`[gainCard action] ${getPlayerById(this.match, args.playerId)} gained ${card}`);
    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: cardId,
      type: 'gainCard',
      source: context?.loggingContext?.source
    });
    const trigger = new ReactionTrigger('cardGained', {
      cardId: cardId,
      playerId: args.playerId,
      bought: context?.bought,
      previousLocation
    });
    this.logManager.enter();
    await this.reactionManager.runTrigger({
      trigger
    });
    this.logManager.exit();
    const suppress = context?.suppressLifecycle;
    const skipOnGain = suppress && (suppress.events?.includes('onGained') || suppress.events === undefined);
    if (!skipOnGain) {
      await this.reactionManager.runCardLifecycleEvent('onGained', {
        playerId: args.playerId,
        cardId,
        bought: context?.bought ?? false
      });
    } else {
      console.log('[gainCard action] lifecycle onGained event suppressed');
    }
    await this.reactionManager.runGameLifecycleEvent('onCardGained', {
      cardId: cardId,
      playerId: args.playerId,
      match: this.match
    });
  }
  async userPrompt(args) {
    const { playerId } = args;
    const signalId = `userPrompt:${playerId}:${Date.now()}`;
    const socket = this.socketMap.get(playerId);
    if (!socket) {
      console.log(`[userPrompt] No socket for player ${playerId}`);
      return null;
    }
    const currentPlayerId = getCurrentPlayer(this.match).id;
    if (playerId !== currentPlayerId) {
      this.socketMap.forEach((socket, id)=>{
        if (id !== playerId) {
          socket.emit('waitingForPlayer', playerId);
        }
      });
    }
    return new Promise((resolve)=>{
      const onInput = (incomingSignalId, response)=>{
        if (incomingSignalId !== signalId) return;
        socket.off('userInputReceived', onInput);
        if (playerId !== currentPlayerId) {
          this.socketMap.forEach((socket, id)=>{
            if (id !== playerId) {
              socket.emit('doneWaitingForPlayer', playerId);
            }
          });
        }
        resolve(response);
      };
      socket.on('userInputReceived', onInput);
      socket.emit('userPrompt', signalId, args);
    });
  }
  async selectCard(args) {
    args.count ??= 1;
    let selectableCardIds = [];
    const { count, playerId, restrict } = args;
    if (Array.isArray(restrict) && typeof restrict[0] === 'number') {
      console.log(`[selectCard action] restricted to set of cards ${restrict}`);
      selectableCardIds = restrict;
    } else if (restrict !== undefined) {
      selectableCardIds = this._findCards(restrict).map((card)=>card.id);
    }
    console.log(`[selectCard action] found ${selectableCardIds.length} selectable cards`);
    if (selectableCardIds?.length === 0) {
      console.log(`[selectCard action] found no cards within restricted set ${restrict}`);
      return [];
    }
    // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
    // because the player would be forced to select hem all anyway
    if (typeof count === 'number' && !args.optional) {
      console.log(`[selectCard action] selection count is an exact count ${count} checking if user has that many cards`);
      if (selectableCardIds.length <= count) {
        console.log('[selectCard action] user does not have enough, or has exactly the amount of cards to select from, selecting all automatically');
        return selectableCardIds;
      }
    }
    const socket = this.socketMap.get(playerId);
    if (!socket) {
      console.log(`[selectCard action] no socket found for ${getPlayerById(this.match, playerId)}, skipping`);
      return [];
    }
    const signalId = `selectCard:${playerId}:${Date.now()}`;
    const currentPlayerId = getCurrentPlayer(this.match).id;
    if (playerId !== currentPlayerId) {
      this.socketMap.forEach((socket, id)=>{
        if (id !== playerId) {
          socket.emit('waitingForPlayer', playerId);
        }
      });
    }
    return new Promise((resolve)=>{
      const onInput = (incomingSignalId, cardIds)=>{
        if (incomingSignalId !== signalId) return;
        socket.off('userInputReceived', onInput);
        // ✅ Clear "waiting" if needed
        if (playerId !== currentPlayerId) {
          this.socketMap.forEach((socket, id)=>{
            if (id !== playerId) {
              socket.emit('doneWaitingForPlayer', playerId);
            }
          });
        }
        if (!Array.isArray(cardIds)) {
          console.warn(`[selectCard action] received invalid cardIds ${cardIds}`);
        }
        resolve(Array.isArray(cardIds) ? cardIds : []);
      };
      socket.on('userInputReceived', onInput);
      socket.emit('selectCard', signalId, {
        ...args,
        selectableCardIds
      });
    });
  }
  async trashCard(args, context) {
    const oldLocation = await this.moveCard({
      cardId: args.cardId,
      to: {
        location: 'trash'
      }
    });
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    this.match.stats.trashedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: getCurrentPlayer(this.match).id
    };
    this.match.stats.trashedCardsByTurn[this.match.turnNumber] ??= [];
    this.match.stats.trashedCardsByTurn[this.match.turnNumber].push(cardId);
    console.log(`[trashCard action] trashed ${card}`);
    const trigger = {
      eventType: 'cardTrashed',
      args: {
        playerId: args.playerId,
        cardId: card.id,
        previousLocation: oldLocation
      }
    };
    await this.reactionManager.runTrigger({
      trigger
    });
    await this.reactionManager.runCardLifecycleEvent('onTrashed', {
      cardId: cardId,
      playerId: args.playerId,
      previousLocation: oldLocation
    });
    card.owner = null;
    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: cardId,
      type: 'trashCard',
      source: context?.loggingContext?.source
    });
  }
  async gainVictoryToken(args, context) {
    console.log(`[gainVictoryToken action] player ${args.playerId} gained ${args.count} victory tokens`);
    this.match.playerVictoryTokens ??= {};
    this.match.playerVictoryTokens[args.playerId] ??= 0;
    const newCount = this.match.playerVictoryTokens[args.playerId] + args.count;
    this.match.playerVictoryTokens[args.playerId] = newCount;
    console.log(`[gainVictoryToken action] player ${args.playerId} new victory token count ${newCount}`);
  }
  async gainCoffer(args, context) {
    console.log(`[gainCoffer action] player ${args.playerId} gained ${args.count} coffers`);
    this.match.coffers[args.playerId] ??= 0;
    this.match.coffers[args.playerId] += args.count ?? 1;
    this.match.coffers[args.playerId] = Math.max(0, this.match.coffers[args.playerId]);
    console.log(`[gainCoffer action] player ${args.playerId} now has ${this.match.coffers[args.playerId]} coffers`);
  }
  async exchangeCoffer(args, context) {
    console.log(`[exchangeCoffer action] player ${args.playerId} exchanged ${args.count} coffers`);
    this.match.coffers[args.playerId] -= args.count;
    this.match.playerTreasure += args.count;
  }
  async buyCard(args) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    if (args.overpay?.inCoffer) {
      console.log(`[buyCard action] player ${args.playerId} overpaid ${args.overpay.inCoffer} coffers, exchanging for treasure`);
      await this.exchangeCoffer({
        playerId: args.playerId,
        count: args.overpay.inCoffer
      });
    }
    console.log(`[buyCard action] reducing player ${args.playerId} treasure by card cost ${args.cardCost.treasure} treasure`);
    this.match.playerTreasure -= args.cardCost.treasure;
    if (args.cardCost.potion !== undefined) {
      console.log(`[buyCard action] reducing player ${args.playerId} potions by card cost ${args.cardCost.potion} potions`);
      this.match.playerPotions -= args.cardCost.potion;
    }
    console.log(`[buyCard action] reducing player ${args.playerId} buys by 1`);
    this.match.playerBuys--;
    console.log(`[buyCard action] adding bought stats to match`);
    this.match.stats.cardsBoughtByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardsBoughtByTurn[this.match.turnNumber].push(cardId);
    this.match.stats.cardsBought[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: args.playerId,
      cost: args.cardCost.treasure,
      paid: args.cardCost.treasure + (args.overpay?.inTreasure ?? 0) + (args.overpay?.inCoffer ?? 0)
    };
    console.log(`[buyCard action] gaining card to discard pile`);
    await this.gainCard({
      playerId: args.playerId,
      cardId,
      to: {
        location: 'playerDiscard'
      }
    }, {
      bought: true,
      overpay: args.overpay ?? 0
    });
  }
  async buyCardLike(args) {
    const event = this.match.events.find((e)=>e.id === args.cardLikeId);
    if (!event) {
      console.warn(`[buyCardLike action] could not find event ${args.cardLikeId}`);
      return;
    }
    console.log(`[buyCardLike action] buying ${event}`);
    const cost = event.cost.treasure;
    this.match.playerTreasure -= cost;
    console.log(`[buyCardLike action] reducing player ${args.playerId} treasure ${cost} to ${this.match.playerTreasure}`);
    this.match.playerBuys--;
    console.log(`[buyCardLike action] reducing player ${args.playerId} buys by 1 to ${this.match.playerBuys}`);
    this.match.stats.cardLikesBoughtByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardLikesBoughtByTurn[this.match.turnNumber].push(args.cardLikeId);
    this.match.stats.cardLikesBought[args.cardLikeId] = {
      playerId: args.playerId,
      turnNumber: this.match.turnNumber,
      turnPhase: getTurnPhase(this.match.turnPhaseIndex)
    };
    const effectFn = this.eventEffectFunctionMap[event.cardKey];
    if (effectFn) {
      console.log(`[buyCardLike action] running effect for ${event}`);
      this.logManager.enter();
      await effectFn({
        cardSourceController: this._cardSourceController,
        cardPriceController: this.cardPriceRuleController,
        reactionManager: this.reactionManager,
        runGameActionDelegate: this.runGameActionDelegate,
        cardId: args.cardLikeId,
        playerId: args.playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext: {},
        findCards: this._findCards
      });
      this.logManager.exit();
    }
  }
  async revealCard(args, context) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    console.log(`[revealCard action] ${getPlayerById(this.match, args.playerId)} revealing ${card}`);
    const cardId = card.id;
    if (args.moveToSetAside) {
      console.log(`[revealCard action] moving card to 'revealed' zone`);
      await this.moveCard({
        cardId: cardId,
        toPlayerId: args.playerId,
        to: {
          location: 'set-aside'
        }
      });
    }
    this.logManager.addLogEntry({
      type: 'revealCard',
      cardId: cardId,
      playerId: args.playerId,
      source: context?.loggingContext?.source
    });
  }
  async checkForRemainingPlayerActions() {
    const match = this.match;
    const currentPlayer = getCurrentPlayer(match);
    const turnPhase = getTurnPhase(match.turnPhaseIndex);
    console.log(`[checkForRemainingPlayerActions action] phase: ${turnPhase} for ${currentPlayer} turn ${match.turnNumber}`);
    this.interactivityController.checkCardInteractivity();
    if (turnPhase === 'action') {
      const hasActions = match.playerActions > 0;
      const hasActionCards = this._findCards({
        location: 'playerHand',
        playerId: currentPlayer.id
      }).some((cardId)=>cardId.type.includes('ACTION'));
      if (!hasActions || !hasActionCards) {
        console.log('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
      }
    }
    if (turnPhase === 'buy') {
      const hasBuys = match.playerBuys > 0;
      console.log(`[checkForRemainingPlayerActions action] ${currentPlayer} as ${hasBuys} buys remaining`);
      if (!hasBuys) {
        console.log('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
      }
    }
    if (turnPhase === 'cleanup') {
      await this.nextPhase();
    }
  }
  async discardCard(args, context) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    console.log(`[discardCard action] discarding ${card} from ${getPlayerById(this.match, args.playerId)}`);
    const oldLocation = await this.moveCard({
      cardId,
      to: {
        location: 'playerDiscard'
      },
      toPlayerId: args.playerId
    });
    if (!oldLocation) {
      throw new Error(`[discardCard action] could not find card ${cardId} in player ${args.playerId}'s discard pile`);
    }
    this.logManager.addLogEntry({
      type: 'discard',
      playerId: args.playerId,
      cardId,
      source: context?.loggingContext?.source
    });
    const r = new ReactionTrigger('discardCard', {
      previousLocation: oldLocation,
      playerId: args.playerId,
      cardId
    });
    this.logManager.enter();
    await this.reactionManager.runTrigger({
      trigger: r
    });
    this.logManager.exit();
    await this.reactionManager.runCardLifecycleEvent('onDiscarded', {
      cardId: cardId,
      playerId: args.playerId,
      previousLocation: oldLocation
    });
  }
  async nextPhase() {
    const match = this.match;
    let currentPlayer = getCurrentPlayer(match);
    const trigger = new ReactionTrigger('endTurnPhase', {
      phaseIndex: match.turnPhaseIndex,
      playerId: currentPlayer.id
    });
    await this.reactionManager.runTrigger({
      trigger
    });
    match.turnPhaseIndex = match.turnPhaseIndex + 1;
    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;
      match.turnNumber++;
    }
    const newPhase = getTurnPhase(match.turnPhaseIndex);
    console.log(`[nextPhase action] entering phase: ${newPhase} for turn ${match.turnNumber}`);
    switch(newPhase){
      case 'action':
        {
          match.playerActions = 1;
          match.playerBuys = 1;
          match.playerTreasure = 0;
          match.playerPotions = 0;
          match.currentPlayerTurnIndex++;
          if (match.currentPlayerTurnIndex >= match.players.length) {
            match.currentPlayerTurnIndex = 0;
            match.roundNumber++;
            this.logManager.addLogEntry({
              root: true,
              type: 'newTurn',
              turn: Math.floor(match.turnNumber / match.players.length) + 1
            });
          }
          this.logManager.addLogEntry({
            type: 'newPlayerTurn',
            turn: Math.floor(match.turnNumber / match.players.length) + 1,
            playerId: match.players[match.currentPlayerTurnIndex].id
          });
          currentPlayer = getCurrentPlayer(match);
          console.log(`[nextPhase action] new round: ${match.roundNumber}, turn ${match.turnNumber} for ${currentPlayer}`);
          const startTurnTrigger = new ReactionTrigger('startTurn', {
            playerId: match.players[match.currentPlayerTurnIndex].id,
            turnNumber: match.turnNumber
          });
          await this.reactionManager.runTrigger({
            trigger: startTurnTrigger
          });
          const startPhaseTrigger = new ReactionTrigger('startTurnPhase', {
            phaseIndex: match.turnPhaseIndex
          });
          await this.reactionManager.runTrigger({
            trigger: startPhaseTrigger
          });
          break;
        }
      case 'buy':
        {
          const startPhaseTrigger = new ReactionTrigger('startTurnPhase', {
            phaseIndex: match.turnPhaseIndex
          });
          await this.reactionManager.runTrigger({
            trigger: startPhaseTrigger
          });
          break;
        }
      case 'cleanup':
        {
          const startPhaseTrigger = new ReactionTrigger('startTurnPhase', {
            phaseIndex: match.turnPhaseIndex
          });
          await this.reactionManager.runTrigger({
            trigger: startPhaseTrigger
          });
          const cardsToDiscard = this._findCards({
            location: 'playArea'
          }).concat(this._findCards({
            location: 'playerHand',
            playerId: currentPlayer.id
          }));
          for (const cardId of cardsToDiscard){
            await this.discardCard({
              cardId,
              playerId: currentPlayer.id
            });
          }
          for(let i = 0; i < 5; i++){
            console.log(`[nextPhase action] drawing card...`);
            await this.drawCard({
              playerId: currentPlayer.id
            });
          }
          await this.endTurn();
          break;
        }
    }
    await this.checkForRemainingPlayerActions();
  }
  async endTurn() {
    console.log('[endTurn action] removing overrides');
    const trigger = new ReactionTrigger('endTurn');
    await this.reactionManager.runTrigger({
      trigger
    });
  }
  async gainTreasure(args, context) {
    console.log(`[gainTreasure action] gaining ${args.count} treasure`);
    this.match.playerTreasure += args.count;
    this.match.playerTreasure = Math.max(0, this.match.playerTreasure);
    if (!context?.loggingContext?.suppress) {
      this.logManager.addLogEntry({
        type: 'gainTreasure',
        playerId: getCurrentPlayer(this.match).id,
        count: args.count,
        source: context?.loggingContext?.source
      });
    }
  }
  // Single, focused implementation of drawCard
  async drawCard(args, context) {
    const { playerId, count } = args;
    console.log(`[drawCard action] player ${playerId} drawing ${count} card(s)`);
    const deck = this._cardSourceController.getSource('playerDeck', playerId);
    const drawnCardIds = [];
    for(let i = 0; i < (count ?? 1); i++){
      if (deck.length < 1) {
        console.log(`[drawCard action] Shuffling discard pile`);
        await this.shuffleDeck({
          playerId
        });
        if (deck.length < 1) {
          console.log(`[drawCard action] No cards left in deck, returning null`);
          return drawnCardIds.length > 0 ? drawnCardIds : null;
        }
      }
      const drawnCardId = deck.slice(-1)[0];
      drawnCardIds.push(drawnCardId);
      await this.moveCard({
        cardId: drawnCardId,
        toPlayerId: playerId,
        to: {
          location: 'playerHand'
        }
      });
      this.logManager.addLogEntry({
        type: 'draw',
        playerId,
        cardId: drawnCardId,
        source: context?.loggingContext?.source
      });
      console.log(`[drawCard action] Drew card ${drawnCardId}`);
    }
    return drawnCardIds;
  }
  async playCard(args, context) {
    const { playerId } = args;
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    if (args.overrides?.moveCard === undefined || args.overrides.moveCard) {
      await this.moveCard({
        cardId: cardId,
        to: {
          location: 'playArea'
        }
      });
    }
    if (card.type.includes('ACTION') && args.overrides?.actionCost !== 0) {
      this.match.playerActions -= args.overrides?.actionCost ?? 1;
      console.log(`[playCard action] Reducing player's action count to ${this.match.playerActions}`);
    }
    this.match.stats.playedCardsByTurn[this.match.turnNumber] ??= [];
    this.match.stats.playedCardsByTurn[this.match.turnNumber].push(cardId);
    this.match.stats.playedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: playerId
    };
    console.log(`[playCard action] ${getPlayerById(this.match, playerId)} played card ${card}`);
    this.logManager.addLogEntry({
      type: 'cardPlayed',
      cardId,
      playerId,
      source: context?.loggingContext?.source
    });
    // find any reactions for the cardPlayed event type
    const cardPlayedTrigger = new ReactionTrigger('cardPlayed', {
      playerId,
      cardId
    });
    // handle reactions for the card played
    let reactionContext = {};
    this.logManager.enter();
    await this.reactionManager.runTrigger({
      trigger: cardPlayedTrigger,
      reactionContext
    });
    this.logManager.exit();
    // now add any triggered effects from the card played
    await this.reactionManager.runCardLifecycleEvent('onCardPlayed', {
      playerId: args.playerId,
      cardId
    });
    // run the effects of the card played, note passing in the reaction context collected from running the trigger
    // above - e.g., could provide immunity to an attack card played
    let effectFn = this.cardEffectFunctionMap[card.cardKey];
    if (effectFn) {
      this.logManager.enter();
      await effectFn({
        cardSourceController: this._cardSourceController,
        cardPriceController: this.cardPriceRuleController,
        reactionManager: this.reactionManager,
        runGameActionDelegate: this.runGameActionDelegate,
        cardId,
        playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext,
        findCards: this._findCards
      });
      this.logManager.exit();
    }
    for (const expansion of Object.keys(this.customCardEffectHandlers)){
      const effects = this.customCardEffectHandlers[expansion];
      effectFn = effects[card.cardKey];
      if (effectFn) {
        this.logManager.enter();
        await effectFn({
          cardSourceController: this._cardSourceController,
          cardPriceController: this.cardPriceRuleController,
          reactionManager: this.reactionManager,
          runGameActionDelegate: this.runGameActionDelegate,
          cardId,
          playerId,
          match: this.match,
          cardLibrary: this.cardLibrary,
          reactionContext,
          findCards: this._findCards
        });
        this.logManager.exit();
      }
    }
    const afterCardPlayedTrigger = new ReactionTrigger('afterCardPlayed', {
      playerId,
      cardId
    });
    // handle reactions for the card played
    reactionContext = {};
    this.logManager.enter();
    await this.reactionManager.runTrigger({
      trigger: afterCardPlayedTrigger,
      reactionContext
    });
    this.logManager.exit();
  }
  // Helper method to shuffle a player's deck
  async shuffleDeck(args, context) {
    const { playerId } = args;
    console.log(`[shuffleDeck action] shuffling deck`);
    const deck = this._cardSourceController.getSource('playerDeck', playerId);
    const discard = this._cardSourceController.getSource('playerDiscard', playerId);
    fisherYatesShuffle(discard, true);
    deck.unshift(...discard);
    discard.length = 0;
    this.logManager.addLogEntry({
      type: 'shuffleDeck',
      playerId: args.playerId,
      source: context?.loggingContext?.source
    });
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvY29yZS9hY3Rpb25zL2dhbWUtYWN0aW9uLWNvbnRyb2xsZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ2FyZCxcbiAgQ2FyZENvc3QsXG4gIENhcmRJZCxcbiAgQ2FyZEtleSxcbiAgQ2FyZExpa2VJZCxcbiAgQ2FyZExvY2F0aW9uLFxuICBDYXJkTG9jYXRpb25TcGVjLFxuICBNYXRjaCxcbiAgUGxheWVySWQsXG4gIFNlbGVjdEFjdGlvbkNhcmRBcmdzLFxuICBUdXJuUGhhc2VPcmRlclZhbHVlcyxcbiAgVXNlclByb21wdEFjdGlvbkFyZ3Ncbn0gZnJvbSAnc2hhcmVkL3NoYXJlZC10eXBlcy50cyc7XG5pbXBvcnQgeyBNYXRjaENhcmRMaWJyYXJ5IH0gZnJvbSAnLi4vbWF0Y2gtY2FyZC1saWJyYXJ5LnRzJztcbmltcG9ydCB7IExvZ01hbmFnZXIgfSBmcm9tICcuLi9sb2ctbWFuYWdlci50cyc7XG5pbXBvcnQgeyBnZXRDdXJyZW50UGxheWVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LWN1cnJlbnQtcGxheWVyLnRzJztcbmltcG9ydCB7XG4gIEFwcFNvY2tldCxcbiAgQmFzZUdhbWVBY3Rpb25EZWZpbml0aW9uTWFwLFxuICBDYXJkRWZmZWN0Rm4sXG4gIENhcmRFZmZlY3RGdW5jdGlvbk1hcCxcbiAgRmluZENhcmRzRm4sXG4gIEZpbmRDYXJkc0ZuSW5wdXQsXG4gIEdhbWVBY3Rpb25Db250ZXh0LFxuICBHYW1lQWN0aW9uQ29udGV4dE1hcCxcbiAgR2FtZUFjdGlvbkRlZmluaXRpb25NYXAsXG4gIEdhbWVBY3Rpb25PdmVycmlkZXMsXG4gIEdhbWVBY3Rpb25SZXR1cm5UeXBlTWFwLFxuICBHYW1lQWN0aW9ucyxcbiAgUmVhY3Rpb25UcmlnZ2VyLFxuICBSdW5HYW1lQWN0aW9uRGVsZWdhdGUsXG59IGZyb20gJy4uLy4uL3R5cGVzLnRzJztcbmltcG9ydCB7IGdldFBsYXllckJ5SWQgfSBmcm9tICcuLi8uLi91dGlscy9nZXQtcGxheWVyLWJ5LWlkLnRzJztcbmltcG9ydCB7IFJlYWN0aW9uTWFuYWdlciB9IGZyb20gJy4uL3JlYWN0aW9ucy9yZWFjdGlvbi1tYW5hZ2VyLnRzJztcbmltcG9ydCB7IENhcmRJbnRlcmFjdGl2aXR5Q29udHJvbGxlciB9IGZyb20gJy4uL2NhcmQtaW50ZXJhY3Rpdml0eS1jb250cm9sbGVyLnRzJztcbmltcG9ydCB7IENhcmRQcmljZVJ1bGVzQ29udHJvbGxlciB9IGZyb20gJy4uL2NhcmQtcHJpY2UtcnVsZXMtY29udHJvbGxlci50cyc7XG5pbXBvcnQgeyBDYXJkU291cmNlQ29udHJvbGxlciB9IGZyb20gJy4uL2NhcmQtc291cmNlLWNvbnRyb2xsZXIudHMnO1xuaW1wb3J0IHsgZ2V0VHVyblBoYXNlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LXR1cm4tcGhhc2UudHMnO1xuaW1wb3J0IHsgZmlzaGVyWWF0ZXNTaHVmZmxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZmlzaGVyLXlhdGVzLXNodWZmbGVyLnRzJztcblxuZXhwb3J0IGNsYXNzIEdhbWVBY3Rpb25Db250cm9sbGVyIGltcGxlbWVudHMgQmFzZUdhbWVBY3Rpb25EZWZpbml0aW9uTWFwIHtcbiAgcHJpdmF0ZSBjdXN0b21BY3Rpb25IYW5kbGVyczogUGFydGlhbDxHYW1lQWN0aW9uRGVmaW5pdGlvbk1hcD4gPSB7fTtcbiAgcHJpdmF0ZSBjdXN0b21DYXJkRWZmZWN0SGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxDYXJkS2V5LCBDYXJkRWZmZWN0Rm4+PiA9IHt9O1xuICBcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBfY2FyZFNvdXJjZUNvbnRyb2xsZXI6IENhcmRTb3VyY2VDb250cm9sbGVyLFxuICAgIHByaXZhdGUgX2ZpbmRDYXJkczogRmluZENhcmRzRm4sXG4gICAgcHJpdmF0ZSBjYXJkUHJpY2VSdWxlQ29udHJvbGxlcjogQ2FyZFByaWNlUnVsZXNDb250cm9sbGVyLFxuICAgIHByaXZhdGUgY2FyZEVmZmVjdEZ1bmN0aW9uTWFwOiBDYXJkRWZmZWN0RnVuY3Rpb25NYXAsXG4gICAgcHJpdmF0ZSBldmVudEVmZmVjdEZ1bmN0aW9uTWFwOiBDYXJkRWZmZWN0RnVuY3Rpb25NYXAsXG4gICAgcHJpdmF0ZSBtYXRjaDogTWF0Y2gsXG4gICAgcHJpdmF0ZSBjYXJkTGlicmFyeTogTWF0Y2hDYXJkTGlicmFyeSxcbiAgICBwcml2YXRlIGxvZ01hbmFnZXI6IExvZ01hbmFnZXIsXG4gICAgcHJpdmF0ZSBzb2NrZXRNYXA6IE1hcDxQbGF5ZXJJZCwgQXBwU29ja2V0PixcbiAgICBwcml2YXRlIHJlYWN0aW9uTWFuYWdlcjogUmVhY3Rpb25NYW5hZ2VyLFxuICAgIHByaXZhdGUgcnVuR2FtZUFjdGlvbkRlbGVnYXRlOiBSdW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgcHJpdmF0ZSByZWFkb25seSBpbnRlcmFjdGl2aXR5Q29udHJvbGxlcjogQ2FyZEludGVyYWN0aXZpdHlDb250cm9sbGVyLFxuICApIHtcbiAgfVxuICBcbiAgcHVibGljIHJlZ2lzdGVyQ2FyZEVmZmVjdChjYXJkS2V5OiBDYXJkS2V5LCB0YWc6IHN0cmluZywgZm46IENhcmRFZmZlY3RGbikge1xuICAgIHRoaXMuY3VzdG9tQ2FyZEVmZmVjdEhhbmRsZXJzW3RhZ10gPz89IHt9O1xuICAgIFxuICAgIGlmICh0aGlzLmN1c3RvbUNhcmRFZmZlY3RIYW5kbGVyc1t0YWddW2NhcmRLZXldKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFthY3Rpb24gY29udHJvbGxlcl0gZWZmZWN0IGZvciAke2NhcmRLZXl9IGluICR7dGFnfSBhbHJlYWR5IGV4aXN0cywgb3ZlcndyaXRpbmcgaXRgKTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5jdXN0b21DYXJkRWZmZWN0SGFuZGxlcnNbdGFnXVtjYXJkS2V5XSA9IGZuO1xuICB9XG4gIFxuICBwdWJsaWMgYXN5bmMgaW52b2tlQWN0aW9uPEsgZXh0ZW5kcyBHYW1lQWN0aW9ucz4oXG4gICAgYWN0aW9uOiBLLFxuICAgIC4uLmFyZ3M6IFBhcmFtZXRlcnM8R2FtZUFjdGlvbkRlZmluaXRpb25NYXBbS10+XG4gICk6IFByb21pc2U8R2FtZUFjdGlvblJldHVyblR5cGVNYXBbS10+IHtcbiAgICBjb25zdCBoYW5kbGVyID0gKHRoaXMgYXMgYW55KVthY3Rpb25dID8/IHRoaXMuY3VzdG9tQWN0aW9uSGFuZGxlcnNbYWN0aW9uXTtcbiAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gaGFuZGxlciByZWdpc3RlcmVkIGZvciBhY3Rpb246ICR7YWN0aW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gYXdhaXQgaGFuZGxlci5iaW5kKHRoaXMpKC4uLmFyZ3MpO1xuICB9XG4gIFxuICBhc3luYyBnYWluUG90aW9uKGFyZ3M6IHsgY291bnQ6IG51bWJlciB9KSB7XG4gICAgY29uc29sZS5sb2coYFtnYWluUG90aW9uIGFjdGlvbl0gZ2FpbmluZyAke2FyZ3MuY291bnR9IHBvdGlvbnNgKTtcbiAgICB0aGlzLm1hdGNoLnBsYXllclBvdGlvbnMgKz0gYXJncy5jb3VudDtcbiAgICB0aGlzLm1hdGNoLnBsYXllclBvdGlvbnMgPSBNYXRoLm1heCgwLCB0aGlzLm1hdGNoLnBsYXllclBvdGlvbnMpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbZ2FpblBvdGlvbiBhY3Rpb25dIHNldHRpbmcgcGxheWVyIHBvdGlvbnMgdG8gJHt0aGlzLm1hdGNoLnBsYXllclBvdGlvbnN9YCk7XG4gIH1cbiAgXG4gIGFzeW5jIGdhaW5CdXkoYXJnczogeyBjb3VudDogbnVtYmVyIH0sIGNvbnRleHQ/OiBHYW1lQWN0aW9uQ29udGV4dCkge1xuICAgIGNvbnNvbGUubG9nKGBbZ2FpbkJ1eSBhY3Rpb25dIGdhaW5pbmcgJHthcmdzLmNvdW50fSBidXlzYCk7XG4gICAgdGhpcy5tYXRjaC5wbGF5ZXJCdXlzICs9IGFyZ3MuY291bnQ7XG4gICAgdGhpcy5tYXRjaC5wbGF5ZXJCdXlzID0gTWF0aC5tYXgodGhpcy5tYXRjaC5wbGF5ZXJCdXlzLCAwKTtcbiAgICBcbiAgICB0aGlzLmxvZ01hbmFnZXIuYWRkTG9nRW50cnkoe1xuICAgICAgdHlwZTogJ2dhaW5CdXknLFxuICAgICAgY291bnQ6IGFyZ3MuY291bnQsXG4gICAgICBwbGF5ZXJJZDogZ2V0Q3VycmVudFBsYXllcih0aGlzLm1hdGNoKS5pZCxcbiAgICAgIHNvdXJjZTogY29udGV4dD8ubG9nZ2luZ0NvbnRleHQ/LnNvdXJjZSxcbiAgICB9KTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW2dhaW5CdXkgYWN0aW9uXSBzZXR0aW5nIHBsYXllciBndXlzIHRvICR7dGhpcy5tYXRjaC5wbGF5ZXJCdXlzfWApO1xuICB9XG4gIFxuICBhc3luYyBtb3ZlQ2FyZChhcmdzOiB7IHRvUGxheWVySWQ/OiBQbGF5ZXJJZCwgY2FyZElkOiBDYXJkSWQgfCBDYXJkLCB0bzogQ2FyZExvY2F0aW9uU3BlYyB9KSB7XG4gICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZElkIGluc3RhbmNlb2YgQ2FyZCA/IGFyZ3MuY2FyZElkIDogdGhpcy5jYXJkTGlicmFyeS5nZXRDYXJkKGFyZ3MuY2FyZElkKTtcbiAgICBjb25zdCBjYXJkSWQgPSBjYXJkLmlkO1xuICAgIFxuICAgIGlmIChBcnJheS5pc0FycmF5KGFyZ3MudG8ubG9jYXRpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFttb3ZlQ2FyZCBhY3Rpb25dIGNhbm5vdCBtb3ZlIGNhcmQgdG8gbXVsdGlwbGUgbG9jYXRpb25zYCk7XG4gICAgfVxuICAgIFxuICAgIGxldCBvbGRTb3VyY2U6IHsgc291cmNlS2V5OiBDYXJkTG9jYXRpb247IHNvdXJjZTogQ2FyZElkW107IGluZGV4OiBudW1iZXI7IHBsYXllcklkPzogUGxheWVySWQ7IH0gfCBudWxsID0gbnVsbDtcbiAgICBcbiAgICB0cnkge1xuICAgICAgb2xkU291cmNlID0gdGhpcy5fY2FyZFNvdXJjZUNvbnRyb2xsZXIuZmluZENhcmRTb3VyY2UoY2FyZElkKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFttb3ZlQ2FyZCBhY3Rpb25dIGNvdWxkIG5vdCBmaW5kIHNvdXJjZSBmb3IgJHtjYXJkfWApO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBuZXdTb3VyY2UgPSB0aGlzLl9jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoYXJncy50by5sb2NhdGlvbiwgYXJncy50b1BsYXllcklkKTtcbiAgICBcbiAgICBpZiAoIW5ld1NvdXJjZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBbbW92ZUNhcmQgYWN0aW9uXSBjb3VsZCBub3QgZmluZCBzb3VyY2UgZm9yICR7Y2FyZH1gKTtcbiAgICB9XG4gICAgXG4gICAgb2xkU291cmNlPy5zb3VyY2Uuc3BsaWNlKG9sZFNvdXJjZT8uaW5kZXgsIDEpO1xuICAgIFxuICAgIHN3aXRjaCAob2xkU291cmNlPy5zb3VyY2VLZXkpIHtcbiAgICAgIGNhc2UgJ3BsYXllckhhbmQnOlxuICAgICAgICBhd2FpdCB0aGlzLnJlYWN0aW9uTWFuYWdlci5ydW5DYXJkTGlmZWN5Y2xlRXZlbnQoJ29uTGVhdmVIYW5kJywge1xuICAgICAgICAgIHBsYXllcklkOiBhcmdzLnRvUGxheWVySWQhLFxuICAgICAgICAgIGNhcmRJZFxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdwbGF5QXJlYSc6XG4gICAgICBjYXNlICdhY3RpdmVEdXJhdGlvbic6XG4gICAgICAgIGlmIChhcmdzLnRvLmxvY2F0aW9uID09PSAncGxheUFyZWEnIHx8IGFyZ3MudG8ubG9jYXRpb24gPT09ICdhY3RpdmVEdXJhdGlvbicpIGJyZWFrO1xuICAgICAgICBhd2FpdCB0aGlzLnJlYWN0aW9uTWFuYWdlci5ydW5DYXJkTGlmZWN5Y2xlRXZlbnQoJ29uTGVhdmVQbGF5JywgeyBjYXJkSWQgfSk7XG4gICAgfVxuICAgIFxuICAgIG5ld1NvdXJjZS5wdXNoKGNhcmRJZCk7XG4gICAgXG4gICAgc3dpdGNoIChhcmdzLnRvLmxvY2F0aW9uKSB7XG4gICAgICBjYXNlICdwbGF5ZXJIYW5kJzpcbiAgICAgICAgYXdhaXQgdGhpcy5yZWFjdGlvbk1hbmFnZXIucnVuQ2FyZExpZmVjeWNsZUV2ZW50KCdvbkVudGVySGFuZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogYXJncy50b1BsYXllcklkISxcbiAgICAgICAgICBjYXJkSWRcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW21vdmVDYXJkIGFjdGlvbl0gbW92ZWQgJHtjYXJkfSBmcm9tICR7b2xkU291cmNlPy5zb3VyY2VLZXl9IHRvICR7YXJncy50by5sb2NhdGlvbn1gKTtcbiAgICBcbiAgICByZXR1cm4gb2xkU291cmNlID8geyBsb2NhdGlvbjogb2xkU291cmNlPy5zb3VyY2VLZXkhLCBwbGF5ZXJJZDogb2xkU291cmNlPy5wbGF5ZXJJZCB9IDogdW5kZWZpbmVkO1xuICB9XG4gIFxuICBhc3luYyBnYWluQWN0aW9uKGFyZ3M6IHsgY291bnQ6IG51bWJlciB9LCBjb250ZXh0PzogR2FtZUFjdGlvbkNvbnRleHQpIHtcbiAgICBjb25zb2xlLmxvZyhgW2dhaW5BY3Rpb24gYWN0aW9uXSBnYWluaW5nICR7YXJncy5jb3VudH0gYWN0aW9uc2ApO1xuICAgIFxuICAgIHRoaXMubWF0Y2gucGxheWVyQWN0aW9ucyArPSBhcmdzLmNvdW50O1xuICAgIHRoaXMubWF0Y2gucGxheWVyQWN0aW9ucyA9IE1hdGgubWF4KDAsIHRoaXMubWF0Y2gucGxheWVyQWN0aW9ucyk7XG4gICAgXG4gICAgdGhpcy5sb2dNYW5hZ2VyLmFkZExvZ0VudHJ5KHtcbiAgICAgIHR5cGU6ICdnYWluQWN0aW9uJyxcbiAgICAgIHBsYXllcklkOiBnZXRDdXJyZW50UGxheWVyKHRoaXMubWF0Y2gpLmlkLFxuICAgICAgY291bnQ6IGFyZ3MuY291bnQsXG4gICAgICBzb3VyY2U6IGNvbnRleHQ/LmxvZ2dpbmdDb250ZXh0Py5zb3VyY2UsXG4gICAgfSlcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW2dhaW5BY3Rpb24gYWN0aW9uXSBzZXR0aW5nIHBsYXllciBhY3Rpb25zIHRvICR7YXJncy5jb3VudH1gKTtcbiAgfVxuICBcbiAgYXN5bmMgZ2FpbkNhcmQoYXJnczoge1xuICAgIHBsYXllcklkOiBQbGF5ZXJJZCxcbiAgICBjYXJkSWQ6IENhcmRJZCB8IENhcmQsXG4gICAgdG86IENhcmRMb2NhdGlvblNwZWNcbiAgfSwgY29udGV4dD86IEdhbWVBY3Rpb25Db250ZXh0TWFwWydnYWluQ2FyZCddKSB7XG4gICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZElkIGluc3RhbmNlb2YgQ2FyZCA/IGFyZ3MuY2FyZElkIDogdGhpcy5jYXJkTGlicmFyeS5nZXRDYXJkKGFyZ3MuY2FyZElkKTtcbiAgICBjb25zdCBjYXJkSWQgPSBjYXJkLmlkO1xuICAgIFxuICAgIGNvbnN0IHByZXZpb3VzTG9jYXRpb24gPSBhd2FpdCB0aGlzLm1vdmVDYXJkKHtcbiAgICAgIGNhcmRJZCxcbiAgICAgIHRvOiBhcmdzLnRvLFxuICAgICAgdG9QbGF5ZXJJZDogYXJncy5wbGF5ZXJJZFxuICAgIH0pO1xuICAgIFxuICAgIHRoaXMubWF0Y2guc3RhdHMuY2FyZHNHYWluZWRCeVR1cm5bdGhpcy5tYXRjaC50dXJuTnVtYmVyXSA/Pz0gW107XG4gICAgdGhpcy5tYXRjaC5zdGF0cy5jYXJkc0dhaW5lZEJ5VHVyblt0aGlzLm1hdGNoLnR1cm5OdW1iZXJdIS5wdXNoKGNhcmRJZCk7XG4gICAgXG4gICAgdGhpcy5tYXRjaC5zdGF0cy5jYXJkc0dhaW5lZFtjYXJkSWRdID0ge1xuICAgICAgdHVyblBoYXNlOiBnZXRUdXJuUGhhc2UodGhpcy5tYXRjaC50dXJuUGhhc2VJbmRleCksXG4gICAgICB0dXJuTnVtYmVyOiB0aGlzLm1hdGNoLnR1cm5OdW1iZXIsXG4gICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZFxuICAgIH07XG4gICAgXG4gICAgY2FyZC5vd25lciA9IGFyZ3MucGxheWVySWQ7XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtnYWluQ2FyZCBhY3Rpb25dICR7Z2V0UGxheWVyQnlJZCh0aGlzLm1hdGNoLCBhcmdzLnBsYXllcklkKX0gZ2FpbmVkICR7Y2FyZH1gKTtcbiAgICBcbiAgICB0aGlzLmxvZ01hbmFnZXIuYWRkTG9nRW50cnkoe1xuICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgIHR5cGU6ICdnYWluQ2FyZCcsXG4gICAgICBzb3VyY2U6IGNvbnRleHQ/LmxvZ2dpbmdDb250ZXh0Py5zb3VyY2UsXG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgdHJpZ2dlciA9IG5ldyBSZWFjdGlvblRyaWdnZXIoJ2NhcmRHYWluZWQnLCB7XG4gICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgYm91Z2h0OiBjb250ZXh0Py5ib3VnaHQsXG4gICAgICBwcmV2aW91c0xvY2F0aW9uXG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5sb2dNYW5hZ2VyLmVudGVyKCk7XG4gICAgYXdhaXQgdGhpcy5yZWFjdGlvbk1hbmFnZXIucnVuVHJpZ2dlcih7IHRyaWdnZXIgfSk7XG4gICAgdGhpcy5sb2dNYW5hZ2VyLmV4aXQoKTtcbiAgICBcbiAgICBjb25zdCBzdXBwcmVzcyA9IGNvbnRleHQ/LnN1cHByZXNzTGlmZWN5Y2xlO1xuICAgIGNvbnN0IHNraXBPbkdhaW4gPVxuICAgICAgc3VwcHJlc3MgJiZcbiAgICAgIChzdXBwcmVzcy5ldmVudHM/LmluY2x1ZGVzKCdvbkdhaW5lZCcpIHx8IHN1cHByZXNzLmV2ZW50cyA9PT0gdW5kZWZpbmVkKTtcbiAgICBcbiAgICBpZiAoIXNraXBPbkdhaW4pIHtcbiAgICAgIGF3YWl0IHRoaXMucmVhY3Rpb25NYW5hZ2VyLnJ1bkNhcmRMaWZlY3ljbGVFdmVudCgnb25HYWluZWQnLCB7XG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQsXG4gICAgICAgIGJvdWdodDogY29udGV4dD8uYm91Z2h0ID8/IGZhbHNlXG4gICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygnW2dhaW5DYXJkIGFjdGlvbl0gbGlmZWN5Y2xlIG9uR2FpbmVkIGV2ZW50IHN1cHByZXNzZWQnKTtcbiAgICB9XG4gICAgXG4gICAgYXdhaXQgdGhpcy5yZWFjdGlvbk1hbmFnZXIucnVuR2FtZUxpZmVjeWNsZUV2ZW50KCdvbkNhcmRHYWluZWQnLCB7XG4gICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgbWF0Y2g6IHRoaXMubWF0Y2hcbiAgICB9KTtcbiAgfVxuICBcbiAgYXN5bmMgdXNlclByb21wdChhcmdzOiBVc2VyUHJvbXB0QWN0aW9uQXJncykge1xuICAgIGNvbnN0IHsgcGxheWVySWQgfSA9IGFyZ3M7XG4gICAgXG4gICAgY29uc3Qgc2lnbmFsSWQgPSBgdXNlclByb21wdDoke3BsYXllcklkfToke0RhdGUubm93KCl9YDtcbiAgICBcbiAgICBjb25zdCBzb2NrZXQgPSB0aGlzLnNvY2tldE1hcC5nZXQocGxheWVySWQpO1xuICAgIGlmICghc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW3VzZXJQcm9tcHRdIE5vIHNvY2tldCBmb3IgcGxheWVyICR7cGxheWVySWR9YCk7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICBcbiAgICBjb25zdCBjdXJyZW50UGxheWVySWQgPSBnZXRDdXJyZW50UGxheWVyKHRoaXMubWF0Y2gpLmlkO1xuICAgIFxuICAgIGlmIChwbGF5ZXJJZCAhPT0gY3VycmVudFBsYXllcklkKSB7XG4gICAgICB0aGlzLnNvY2tldE1hcC5mb3JFYWNoKChzb2NrZXQsIGlkKSA9PiB7XG4gICAgICAgIGlmIChpZCAhPT0gcGxheWVySWQpIHtcbiAgICAgICAgICBzb2NrZXQuZW1pdCgnd2FpdGluZ0ZvclBsYXllcicsIHBsYXllcklkKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgY29uc3Qgb25JbnB1dCA9IChpbmNvbWluZ1NpZ25hbElkOiBzdHJpbmcsIHJlc3BvbnNlOiB1bmtub3duKSA9PiB7XG4gICAgICAgIGlmIChpbmNvbWluZ1NpZ25hbElkICE9PSBzaWduYWxJZCkgcmV0dXJuO1xuICAgICAgICBcbiAgICAgICAgc29ja2V0Lm9mZigndXNlcklucHV0UmVjZWl2ZWQnLCBvbklucHV0KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChwbGF5ZXJJZCAhPT0gY3VycmVudFBsYXllcklkKSB7XG4gICAgICAgICAgdGhpcy5zb2NrZXRNYXAuZm9yRWFjaCgoc29ja2V0LCBpZCkgPT4ge1xuICAgICAgICAgICAgaWYgKGlkICE9PSBwbGF5ZXJJZCkge1xuICAgICAgICAgICAgICBzb2NrZXQuZW1pdCgnZG9uZVdhaXRpbmdGb3JQbGF5ZXInLCBwbGF5ZXJJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgc29ja2V0Lm9uKCd1c2VySW5wdXRSZWNlaXZlZCcsIG9uSW5wdXQpO1xuICAgICAgc29ja2V0LmVtaXQoJ3VzZXJQcm9tcHQnLCBzaWduYWxJZCwgYXJncyk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIGFzeW5jIHNlbGVjdENhcmQoYXJnczogU2VsZWN0QWN0aW9uQ2FyZEFyZ3MpIHtcbiAgICBhcmdzLmNvdW50ID8/PSAxO1xuICAgIFxuICAgIGxldCBzZWxlY3RhYmxlQ2FyZElkczogQ2FyZElkW10gPSBbXTtcbiAgICBcbiAgICBjb25zdCB7IGNvdW50LCBwbGF5ZXJJZCwgcmVzdHJpY3QgfSA9IGFyZ3M7XG4gICAgXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdHJpY3QpICYmIHR5cGVvZiByZXN0cmljdFswXSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc2VsZWN0Q2FyZCBhY3Rpb25dIHJlc3RyaWN0ZWQgdG8gc2V0IG9mIGNhcmRzICR7cmVzdHJpY3R9YCk7XG4gICAgICBzZWxlY3RhYmxlQ2FyZElkcyA9IHJlc3RyaWN0IGFzIENhcmRJZFtdO1xuICAgIH1cbiAgICBlbHNlIGlmIChyZXN0cmljdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBzZWxlY3RhYmxlQ2FyZElkcyA9IHRoaXMuX2ZpbmRDYXJkcyhyZXN0cmljdCBhcyBGaW5kQ2FyZHNGbklucHV0KS5tYXAoY2FyZCA9PiBjYXJkLmlkKTtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtzZWxlY3RDYXJkIGFjdGlvbl0gZm91bmQgJHtzZWxlY3RhYmxlQ2FyZElkcy5sZW5ndGh9IHNlbGVjdGFibGUgY2FyZHNgKTtcbiAgICBcbiAgICBpZiAoc2VsZWN0YWJsZUNhcmRJZHM/Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc29sZS5sb2coYFtzZWxlY3RDYXJkIGFjdGlvbl0gZm91bmQgbm8gY2FyZHMgd2l0aGluIHJlc3RyaWN0ZWQgc2V0ICR7cmVzdHJpY3R9YCk7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIFxuICAgIC8vIGlmIHRoZXJlIGFyZW4ndCBlbm91Z2ggY2FyZHMsIGRlcGVuZGluZyBvbiB0aGUgc2VsZWN0aW9uIHR5cGUsIHdlIG1pZ2h0IHNpbXBseSBpbXBsaWNpdGx5IHNlbGVjdCBjYXJkc1xuICAgIC8vIGJlY2F1c2UgdGhlIHBsYXllciB3b3VsZCBiZSBmb3JjZWQgdG8gc2VsZWN0IGhlbSBhbGwgYW55d2F5XG4gICAgaWYgKHR5cGVvZiBjb3VudCA9PT0gJ251bWJlcicgJiYgIWFyZ3Mub3B0aW9uYWwpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc2VsZWN0Q2FyZCBhY3Rpb25dIHNlbGVjdGlvbiBjb3VudCBpcyBhbiBleGFjdCBjb3VudCAke2NvdW50fSBjaGVja2luZyBpZiB1c2VyIGhhcyB0aGF0IG1hbnkgY2FyZHNgKTtcbiAgICAgIFxuICAgICAgaWYgKHNlbGVjdGFibGVDYXJkSWRzLmxlbmd0aCA8PSBjb3VudCkge1xuICAgICAgICBjb25zb2xlLmxvZygnW3NlbGVjdENhcmQgYWN0aW9uXSB1c2VyIGRvZXMgbm90IGhhdmUgZW5vdWdoLCBvciBoYXMgZXhhY3RseSB0aGUgYW1vdW50IG9mIGNhcmRzIHRvIHNlbGVjdCBmcm9tLCBzZWxlY3RpbmcgYWxsIGF1dG9tYXRpY2FsbHknKTtcbiAgICAgICAgcmV0dXJuIHNlbGVjdGFibGVDYXJkSWRzO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBjb25zdCBzb2NrZXQgPSB0aGlzLnNvY2tldE1hcC5nZXQocGxheWVySWQpO1xuICAgIFxuICAgIGlmICghc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW3NlbGVjdENhcmQgYWN0aW9uXSBubyBzb2NrZXQgZm91bmQgZm9yICR7Z2V0UGxheWVyQnlJZCh0aGlzLm1hdGNoLCBwbGF5ZXJJZCl9LCBza2lwcGluZ2ApO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBzaWduYWxJZCA9IGBzZWxlY3RDYXJkOiR7cGxheWVySWR9OiR7RGF0ZS5ub3coKX1gO1xuICAgIGNvbnN0IGN1cnJlbnRQbGF5ZXJJZCA9IGdldEN1cnJlbnRQbGF5ZXIodGhpcy5tYXRjaCkuaWQ7XG4gICAgXG4gICAgaWYgKHBsYXllcklkICE9PSBjdXJyZW50UGxheWVySWQpIHtcbiAgICAgIHRoaXMuc29ja2V0TWFwLmZvckVhY2goKHNvY2tldCwgaWQpID0+IHtcbiAgICAgICAgaWYgKGlkICE9PSBwbGF5ZXJJZCkge1xuICAgICAgICAgIHNvY2tldC5lbWl0KCd3YWl0aW5nRm9yUGxheWVyJywgcGxheWVySWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPENhcmRJZFtdPigocmVzb2x2ZSkgPT4ge1xuICAgICAgY29uc3Qgb25JbnB1dCA9IChpbmNvbWluZ1NpZ25hbElkOiBzdHJpbmcsIGNhcmRJZHM6IHVua25vd24pID0+IHtcbiAgICAgICAgaWYgKGluY29taW5nU2lnbmFsSWQgIT09IHNpZ25hbElkKSByZXR1cm47XG4gICAgICAgIFxuICAgICAgICBzb2NrZXQub2ZmKCd1c2VySW5wdXRSZWNlaXZlZCcsIG9uSW5wdXQpO1xuICAgICAgICBcbiAgICAgICAgLy8g4pyFIENsZWFyIFwid2FpdGluZ1wiIGlmIG5lZWRlZFxuICAgICAgICBpZiAocGxheWVySWQgIT09IGN1cnJlbnRQbGF5ZXJJZCkge1xuICAgICAgICAgIHRoaXMuc29ja2V0TWFwLmZvckVhY2goKHNvY2tldCwgaWQpID0+IHtcbiAgICAgICAgICAgIGlmIChpZCAhPT0gcGxheWVySWQpIHtcbiAgICAgICAgICAgICAgc29ja2V0LmVtaXQoJ2RvbmVXYWl0aW5nRm9yUGxheWVyJywgcGxheWVySWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoY2FyZElkcykpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtzZWxlY3RDYXJkIGFjdGlvbl0gcmVjZWl2ZWQgaW52YWxpZCBjYXJkSWRzICR7Y2FyZElkc31gKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmVzb2x2ZShBcnJheS5pc0FycmF5KGNhcmRJZHMpID8gY2FyZElkcyA6IFtdKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIHNvY2tldC5vbigndXNlcklucHV0UmVjZWl2ZWQnLCBvbklucHV0KTtcbiAgICAgIHNvY2tldC5lbWl0KCdzZWxlY3RDYXJkJywgc2lnbmFsSWQsIHsgLi4uYXJncywgc2VsZWN0YWJsZUNhcmRJZHMgfSk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIGFzeW5jIHRyYXNoQ2FyZChhcmdzOiB7IGNhcmRJZDogQ2FyZElkIHwgQ2FyZCwgcGxheWVySWQ6IFBsYXllcklkIH0sIGNvbnRleHQ/OiBHYW1lQWN0aW9uQ29udGV4dCkge1xuICAgIGNvbnN0IG9sZExvY2F0aW9uID0gYXdhaXQgdGhpcy5tb3ZlQ2FyZCh7XG4gICAgICBjYXJkSWQ6IGFyZ3MuY2FyZElkLFxuICAgICAgdG86IHsgbG9jYXRpb246ICd0cmFzaCcgfVxuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IGNhcmQgPSBhcmdzLmNhcmRJZCBpbnN0YW5jZW9mIENhcmQgPyBhcmdzLmNhcmRJZCA6IHRoaXMuY2FyZExpYnJhcnkuZ2V0Q2FyZChhcmdzLmNhcmRJZCk7XG4gICAgY29uc3QgY2FyZElkID0gY2FyZC5pZDtcbiAgICBcbiAgICB0aGlzLm1hdGNoLnN0YXRzLnRyYXNoZWRDYXJkc1tjYXJkSWRdID0ge1xuICAgICAgdHVyblBoYXNlOiBnZXRUdXJuUGhhc2UodGhpcy5tYXRjaC50dXJuUGhhc2VJbmRleCksXG4gICAgICB0dXJuTnVtYmVyOiB0aGlzLm1hdGNoLnR1cm5OdW1iZXIsXG4gICAgICBwbGF5ZXJJZDogZ2V0Q3VycmVudFBsYXllcih0aGlzLm1hdGNoKS5pZFxuICAgIH07XG4gICAgXG4gICAgdGhpcy5tYXRjaC5zdGF0cy50cmFzaGVkQ2FyZHNCeVR1cm5bdGhpcy5tYXRjaC50dXJuTnVtYmVyXSA/Pz0gW107XG4gICAgdGhpcy5tYXRjaC5zdGF0cy50cmFzaGVkQ2FyZHNCeVR1cm5bdGhpcy5tYXRjaC50dXJuTnVtYmVyXSEucHVzaChjYXJkSWQpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbdHJhc2hDYXJkIGFjdGlvbl0gdHJhc2hlZCAke2NhcmR9YCk7XG4gICAgXG4gICAgY29uc3QgdHJpZ2dlcjogUmVhY3Rpb25UcmlnZ2VyID0ge1xuICAgICAgZXZlbnRUeXBlOiAnY2FyZFRyYXNoZWQnLFxuICAgICAgYXJnczoge1xuICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICBwcmV2aW91c0xvY2F0aW9uOiBvbGRMb2NhdGlvblxuICAgICAgfVxuICAgIH1cbiAgICBhd2FpdCB0aGlzLnJlYWN0aW9uTWFuYWdlci5ydW5UcmlnZ2VyKHsgdHJpZ2dlciB9KTtcbiAgICBcbiAgICBhd2FpdCB0aGlzLnJlYWN0aW9uTWFuYWdlci5ydW5DYXJkTGlmZWN5Y2xlRXZlbnQoJ29uVHJhc2hlZCcsIHtcbiAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICBwcmV2aW91c0xvY2F0aW9uOiBvbGRMb2NhdGlvblxuICAgIH0pO1xuICAgIFxuICAgIGNhcmQub3duZXIgPSBudWxsO1xuICAgIHRoaXMubG9nTWFuYWdlci5hZGRMb2dFbnRyeSh7XG4gICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgdHlwZTogJ3RyYXNoQ2FyZCcsXG4gICAgICBzb3VyY2U6IGNvbnRleHQ/LmxvZ2dpbmdDb250ZXh0Py5zb3VyY2UsXG4gICAgfSk7XG4gIH1cbiAgXG4gIGFzeW5jIGdhaW5WaWN0b3J5VG9rZW4oYXJnczogeyBwbGF5ZXJJZDogUGxheWVySWQsIGNvdW50OiBudW1iZXIgfSwgY29udGV4dD86IEdhbWVBY3Rpb25Db250ZXh0KSB7XG4gICAgY29uc29sZS5sb2coYFtnYWluVmljdG9yeVRva2VuIGFjdGlvbl0gcGxheWVyICR7YXJncy5wbGF5ZXJJZH0gZ2FpbmVkICR7YXJncy5jb3VudH0gdmljdG9yeSB0b2tlbnNgKTtcbiAgICB0aGlzLm1hdGNoLnBsYXllclZpY3RvcnlUb2tlbnMgPz89IHt9O1xuICAgIHRoaXMubWF0Y2gucGxheWVyVmljdG9yeVRva2Vuc1thcmdzLnBsYXllcklkXSA/Pz0gMDtcbiAgICBjb25zdCBuZXdDb3VudCA9IHRoaXMubWF0Y2gucGxheWVyVmljdG9yeVRva2Vuc1thcmdzLnBsYXllcklkXSArIGFyZ3MuY291bnQ7XG4gICAgdGhpcy5tYXRjaC5wbGF5ZXJWaWN0b3J5VG9rZW5zW2FyZ3MucGxheWVySWRdID0gbmV3Q291bnQ7XG4gICAgY29uc29sZS5sb2coYFtnYWluVmljdG9yeVRva2VuIGFjdGlvbl0gcGxheWVyICR7YXJncy5wbGF5ZXJJZH0gbmV3IHZpY3RvcnkgdG9rZW4gY291bnQgJHtuZXdDb3VudH1gKTtcbiAgfVxuICBcbiAgYXN5bmMgZ2FpbkNvZmZlcihhcmdzOiB7IHBsYXllcklkOiBQbGF5ZXJJZCwgY291bnQ/OiBudW1iZXI7IH0sIGNvbnRleHQ/OiBHYW1lQWN0aW9uQ29udGV4dCkge1xuICAgIGNvbnNvbGUubG9nKGBbZ2FpbkNvZmZlciBhY3Rpb25dIHBsYXllciAke2FyZ3MucGxheWVySWR9IGdhaW5lZCAke2FyZ3MuY291bnR9IGNvZmZlcnNgKTtcbiAgICB0aGlzLm1hdGNoLmNvZmZlcnNbYXJncy5wbGF5ZXJJZF0gPz89IDA7XG4gICAgdGhpcy5tYXRjaC5jb2ZmZXJzW2FyZ3MucGxheWVySWRdICs9IGFyZ3MuY291bnQgPz8gMTtcbiAgICB0aGlzLm1hdGNoLmNvZmZlcnNbYXJncy5wbGF5ZXJJZF0gPSBNYXRoLm1heCgwLCB0aGlzLm1hdGNoLmNvZmZlcnNbYXJncy5wbGF5ZXJJZF0pO1xuICAgIGNvbnNvbGUubG9nKGBbZ2FpbkNvZmZlciBhY3Rpb25dIHBsYXllciAke2FyZ3MucGxheWVySWR9IG5vdyBoYXMgJHt0aGlzLm1hdGNoLmNvZmZlcnNbYXJncy5wbGF5ZXJJZF19IGNvZmZlcnNgKTtcbiAgfVxuICBcbiAgYXN5bmMgZXhjaGFuZ2VDb2ZmZXIoYXJnczogeyBwbGF5ZXJJZDogUGxheWVySWQsIGNvdW50OiBudW1iZXI7IH0sIGNvbnRleHQ/OiBHYW1lQWN0aW9uQ29udGV4dCkge1xuICAgIGNvbnNvbGUubG9nKGBbZXhjaGFuZ2VDb2ZmZXIgYWN0aW9uXSBwbGF5ZXIgJHthcmdzLnBsYXllcklkfSBleGNoYW5nZWQgJHthcmdzLmNvdW50fSBjb2ZmZXJzYCk7XG4gICAgdGhpcy5tYXRjaC5jb2ZmZXJzW2FyZ3MucGxheWVySWRdIC09IGFyZ3MuY291bnQ7XG4gICAgdGhpcy5tYXRjaC5wbGF5ZXJUcmVhc3VyZSArPSBhcmdzLmNvdW50O1xuICB9O1xuICBcbiAgYXN5bmMgYnV5Q2FyZChhcmdzOiB7XG4gICAgY2FyZElkOiBDYXJkSWQgfCBDYXJkO1xuICAgIHBsYXllcklkOiBQbGF5ZXJJZDtcbiAgICBvdmVycGF5PzogeyBpblRyZWFzdXJlOiBudW1iZXI7IGluQ29mZmVyOiBudW1iZXI7IH07XG4gICAgY2FyZENvc3Q6IENhcmRDb3N0O1xuICB9KSB7XG4gICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZElkIGluc3RhbmNlb2YgQ2FyZCA/IGFyZ3MuY2FyZElkIDogdGhpcy5jYXJkTGlicmFyeS5nZXRDYXJkKGFyZ3MuY2FyZElkKTtcbiAgICBjb25zdCBjYXJkSWQgPSBjYXJkLmlkO1xuICAgIFxuICAgIGlmIChhcmdzLm92ZXJwYXk/LmluQ29mZmVyKSB7XG4gICAgICBjb25zb2xlLmxvZyhgW2J1eUNhcmQgYWN0aW9uXSBwbGF5ZXIgJHthcmdzLnBsYXllcklkfSBvdmVycGFpZCAke2FyZ3Mub3ZlcnBheS5pbkNvZmZlcn0gY29mZmVycywgZXhjaGFuZ2luZyBmb3IgdHJlYXN1cmVgKTtcbiAgICAgIFxuICAgICAgYXdhaXQgdGhpcy5leGNoYW5nZUNvZmZlcih7XG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBjb3VudDogYXJncy5vdmVycGF5LmluQ29mZmVyXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtidXlDYXJkIGFjdGlvbl0gcmVkdWNpbmcgcGxheWVyICR7YXJncy5wbGF5ZXJJZH0gdHJlYXN1cmUgYnkgY2FyZCBjb3N0ICR7YXJncy5jYXJkQ29zdC50cmVhc3VyZX0gdHJlYXN1cmVgKTtcbiAgICBcbiAgICB0aGlzLm1hdGNoLnBsYXllclRyZWFzdXJlIC09IGFyZ3MuY2FyZENvc3QudHJlYXN1cmU7XG4gICAgXG4gICAgaWYgKGFyZ3MuY2FyZENvc3QucG90aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbYnV5Q2FyZCBhY3Rpb25dIHJlZHVjaW5nIHBsYXllciAke2FyZ3MucGxheWVySWR9IHBvdGlvbnMgYnkgY2FyZCBjb3N0ICR7YXJncy5jYXJkQ29zdC5wb3Rpb259IHBvdGlvbnNgKTtcbiAgICAgIHRoaXMubWF0Y2gucGxheWVyUG90aW9ucyAtPSBhcmdzLmNhcmRDb3N0LnBvdGlvbjtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtidXlDYXJkIGFjdGlvbl0gcmVkdWNpbmcgcGxheWVyICR7YXJncy5wbGF5ZXJJZH0gYnV5cyBieSAxYCk7XG4gICAgXG4gICAgdGhpcy5tYXRjaC5wbGF5ZXJCdXlzLS07XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtidXlDYXJkIGFjdGlvbl0gYWRkaW5nIGJvdWdodCBzdGF0cyB0byBtYXRjaGApO1xuICAgIFxuICAgIHRoaXMubWF0Y2guc3RhdHMuY2FyZHNCb3VnaHRCeVR1cm5bdGhpcy5tYXRjaC50dXJuTnVtYmVyXSA/Pz0gW107XG4gICAgdGhpcy5tYXRjaC5zdGF0cy5jYXJkc0JvdWdodEJ5VHVyblt0aGlzLm1hdGNoLnR1cm5OdW1iZXJdIS5wdXNoKGNhcmRJZCk7XG4gICAgXG4gICAgdGhpcy5tYXRjaC5zdGF0cy5jYXJkc0JvdWdodFtjYXJkSWRdID0ge1xuICAgICAgdHVyblBoYXNlOiBnZXRUdXJuUGhhc2UodGhpcy5tYXRjaC50dXJuUGhhc2VJbmRleCksXG4gICAgICB0dXJuTnVtYmVyOiB0aGlzLm1hdGNoLnR1cm5OdW1iZXIsXG4gICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgIGNvc3Q6IGFyZ3MuY2FyZENvc3QudHJlYXN1cmUsXG4gICAgICBwYWlkOiBhcmdzLmNhcmRDb3N0LnRyZWFzdXJlICsgKGFyZ3Mub3ZlcnBheT8uaW5UcmVhc3VyZSA/PyAwKSArIChhcmdzLm92ZXJwYXk/LmluQ29mZmVyID8/IDApXG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbYnV5Q2FyZCBhY3Rpb25dIGdhaW5pbmcgY2FyZCB0byBkaXNjYXJkIHBpbGVgKTtcbiAgICBcbiAgICBhd2FpdCB0aGlzLmdhaW5DYXJkKHtcbiAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgY2FyZElkLFxuICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgfSwgeyBib3VnaHQ6IHRydWUsIG92ZXJwYXk6IGFyZ3Mub3ZlcnBheSA/PyAwIH0pO1xuICB9XG4gIFxuICBhc3luYyBidXlDYXJkTGlrZShhcmdzOiB7XG4gICAgY2FyZExpa2VJZDogQ2FyZExpa2VJZDtcbiAgICBwbGF5ZXJJZDogUGxheWVySWQ7XG4gIH0pIHtcbiAgICBjb25zdCBldmVudCA9IHRoaXMubWF0Y2guZXZlbnRzLmZpbmQoZSA9PiBlLmlkID09PSBhcmdzLmNhcmRMaWtlSWQpO1xuICAgIFxuICAgIGlmICghZXZlbnQpIHtcbiAgICAgIGNvbnNvbGUud2FybihgW2J1eUNhcmRMaWtlIGFjdGlvbl0gY291bGQgbm90IGZpbmQgZXZlbnQgJHthcmdzLmNhcmRMaWtlSWR9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbYnV5Q2FyZExpa2UgYWN0aW9uXSBidXlpbmcgJHtldmVudH1gKTtcbiAgICBcbiAgICBjb25zdCBjb3N0ID0gZXZlbnQuY29zdC50cmVhc3VyZTtcbiAgICBcbiAgICB0aGlzLm1hdGNoLnBsYXllclRyZWFzdXJlIC09IGNvc3Q7XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtidXlDYXJkTGlrZSBhY3Rpb25dIHJlZHVjaW5nIHBsYXllciAke2FyZ3MucGxheWVySWR9IHRyZWFzdXJlICR7Y29zdH0gdG8gJHt0aGlzLm1hdGNoLnBsYXllclRyZWFzdXJlfWApO1xuICAgIFxuICAgIHRoaXMubWF0Y2gucGxheWVyQnV5cy0tO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbYnV5Q2FyZExpa2UgYWN0aW9uXSByZWR1Y2luZyBwbGF5ZXIgJHthcmdzLnBsYXllcklkfSBidXlzIGJ5IDEgdG8gJHt0aGlzLm1hdGNoLnBsYXllckJ1eXN9YCk7XG4gICAgXG4gICAgdGhpcy5tYXRjaC5zdGF0cy5jYXJkTGlrZXNCb3VnaHRCeVR1cm5bdGhpcy5tYXRjaC50dXJuTnVtYmVyXSA/Pz0gW107XG4gICAgdGhpcy5tYXRjaC5zdGF0cy5jYXJkTGlrZXNCb3VnaHRCeVR1cm5bdGhpcy5tYXRjaC50dXJuTnVtYmVyXSEucHVzaChhcmdzLmNhcmRMaWtlSWQpO1xuICAgIFxuICAgIHRoaXMubWF0Y2guc3RhdHMuY2FyZExpa2VzQm91Z2h0W2FyZ3MuY2FyZExpa2VJZF0gPSB7XG4gICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgIHR1cm5OdW1iZXI6IHRoaXMubWF0Y2gudHVybk51bWJlcixcbiAgICAgIHR1cm5QaGFzZTogZ2V0VHVyblBoYXNlKHRoaXMubWF0Y2gudHVyblBoYXNlSW5kZXgpXG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGVmZmVjdEZuID0gdGhpcy5ldmVudEVmZmVjdEZ1bmN0aW9uTWFwW2V2ZW50LmNhcmRLZXldO1xuICAgIFxuICAgIGlmIChlZmZlY3RGbikge1xuICAgICAgY29uc29sZS5sb2coYFtidXlDYXJkTGlrZSBhY3Rpb25dIHJ1bm5pbmcgZWZmZWN0IGZvciAke2V2ZW50fWApO1xuICAgICAgXG4gICAgICB0aGlzLmxvZ01hbmFnZXIuZW50ZXIoKTtcbiAgICAgIFxuICAgICAgYXdhaXQgZWZmZWN0Rm4oe1xuICAgICAgICBjYXJkU291cmNlQ29udHJvbGxlcjogdGhpcy5fY2FyZFNvdXJjZUNvbnRyb2xsZXIsXG4gICAgICAgIGNhcmRQcmljZUNvbnRyb2xsZXI6IHRoaXMuY2FyZFByaWNlUnVsZUNvbnRyb2xsZXIsXG4gICAgICAgIHJlYWN0aW9uTWFuYWdlcjogdGhpcy5yZWFjdGlvbk1hbmFnZXIsXG4gICAgICAgIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZTogdGhpcy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgICAgIGNhcmRJZDogYXJncy5jYXJkTGlrZUlkLFxuICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgbWF0Y2g6IHRoaXMubWF0Y2gsXG4gICAgICAgIGNhcmRMaWJyYXJ5OiB0aGlzLmNhcmRMaWJyYXJ5LFxuICAgICAgICByZWFjdGlvbkNvbnRleHQ6IHt9LFxuICAgICAgICBmaW5kQ2FyZHM6IHRoaXMuX2ZpbmRDYXJkc1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHRoaXMubG9nTWFuYWdlci5leGl0KCk7XG4gICAgfVxuICB9XG4gIFxuICBhc3luYyByZXZlYWxDYXJkKGFyZ3M6IHtcbiAgICBjYXJkSWQ6IENhcmRJZCB8IENhcmQsXG4gICAgcGxheWVySWQ6IFBsYXllcklkLFxuICAgIG1vdmVUb1NldEFzaWRlPzogYm9vbGVhblxuICB9LCBjb250ZXh0PzogR2FtZUFjdGlvbkNvbnRleHQpIHtcbiAgICBjb25zdCBjYXJkID0gYXJncy5jYXJkSWQgaW5zdGFuY2VvZiBDYXJkID8gYXJncy5jYXJkSWQgOiB0aGlzLmNhcmRMaWJyYXJ5LmdldENhcmQoYXJncy5jYXJkSWQpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbcmV2ZWFsQ2FyZCBhY3Rpb25dICR7Z2V0UGxheWVyQnlJZCh0aGlzLm1hdGNoLCBhcmdzLnBsYXllcklkKX0gcmV2ZWFsaW5nICR7Y2FyZH1gKTtcbiAgICBcbiAgICBjb25zdCBjYXJkSWQgPSBjYXJkLmlkO1xuICAgIFxuICAgIGlmIChhcmdzLm1vdmVUb1NldEFzaWRlKSB7XG4gICAgICBjb25zb2xlLmxvZyhgW3JldmVhbENhcmQgYWN0aW9uXSBtb3ZpbmcgY2FyZCB0byAncmV2ZWFsZWQnIHpvbmVgKTtcbiAgICAgIFxuICAgICAgYXdhaXQgdGhpcy5tb3ZlQ2FyZCh7XG4gICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICB0b1BsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3NldC1hc2lkZScgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHRoaXMubG9nTWFuYWdlci5hZGRMb2dFbnRyeSh7XG4gICAgICB0eXBlOiAncmV2ZWFsQ2FyZCcsXG4gICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgc291cmNlOiBjb250ZXh0Py5sb2dnaW5nQ29udGV4dD8uc291cmNlLFxuICAgIH0pO1xuICB9XG4gIFxuICBhc3luYyBjaGVja0ZvclJlbWFpbmluZ1BsYXllckFjdGlvbnMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbWF0Y2ggPSB0aGlzLm1hdGNoO1xuICAgIGNvbnN0IGN1cnJlbnRQbGF5ZXIgPSBnZXRDdXJyZW50UGxheWVyKG1hdGNoKTtcbiAgICBjb25zdCB0dXJuUGhhc2UgPSBnZXRUdXJuUGhhc2UobWF0Y2gudHVyblBoYXNlSW5kZXgpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbY2hlY2tGb3JSZW1haW5pbmdQbGF5ZXJBY3Rpb25zIGFjdGlvbl0gcGhhc2U6ICR7dHVyblBoYXNlfSBmb3IgJHtjdXJyZW50UGxheWVyfSB0dXJuICR7bWF0Y2gudHVybk51bWJlcn1gKTtcbiAgICBcbiAgICB0aGlzLmludGVyYWN0aXZpdHlDb250cm9sbGVyLmNoZWNrQ2FyZEludGVyYWN0aXZpdHkoKTtcbiAgICBcbiAgICBpZiAodHVyblBoYXNlID09PSAnYWN0aW9uJykge1xuICAgICAgY29uc3QgaGFzQWN0aW9ucyA9IG1hdGNoLnBsYXllckFjdGlvbnMgPiAwO1xuICAgICAgY29uc3QgaGFzQWN0aW9uQ2FyZHMgPSB0aGlzLl9maW5kQ2FyZHMoeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnLCBwbGF5ZXJJZDogY3VycmVudFBsYXllci5pZCB9KVxuICAgICAgICAuc29tZShjYXJkSWQgPT4gY2FyZElkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKTtcbiAgICAgIFxuICAgICAgaWYgKCFoYXNBY3Rpb25zIHx8ICFoYXNBY3Rpb25DYXJkcykge1xuICAgICAgICBjb25zb2xlLmxvZygnW2NoZWNrRm9yUmVtYWluaW5nUGxheWVyQWN0aW9ucyBhY3Rpb25dIHNraXBwaW5nIHRvIG5leHQgcGhhc2UnKTtcbiAgICAgICAgYXdhaXQgdGhpcy5uZXh0UGhhc2UoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKHR1cm5QaGFzZSA9PT0gJ2J1eScpIHtcbiAgICAgIGNvbnN0IGhhc0J1eXMgPSBtYXRjaC5wbGF5ZXJCdXlzID4gMDtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtjaGVja0ZvclJlbWFpbmluZ1BsYXllckFjdGlvbnMgYWN0aW9uXSAke2N1cnJlbnRQbGF5ZXJ9IGFzICR7aGFzQnV5c30gYnV5cyByZW1haW5pbmdgKTtcbiAgICAgIFxuICAgICAgaWYgKCFoYXNCdXlzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbY2hlY2tGb3JSZW1haW5pbmdQbGF5ZXJBY3Rpb25zIGFjdGlvbl0gc2tpcHBpbmcgdG8gbmV4dCBwaGFzZScpO1xuICAgICAgICBhd2FpdCB0aGlzLm5leHRQaGFzZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAodHVyblBoYXNlID09PSAnY2xlYW51cCcpIHtcbiAgICAgIGF3YWl0IHRoaXMubmV4dFBoYXNlKCk7XG4gICAgfVxuICB9XG4gIFxuICBcbiAgYXN5bmMgZGlzY2FyZENhcmQoYXJnczogeyBjYXJkSWQ6IENhcmRJZCB8IENhcmQsIHBsYXllcklkOiBQbGF5ZXJJZCB9LCBjb250ZXh0PzogR2FtZUFjdGlvbkNvbnRleHQpIHtcbiAgICBjb25zdCBjYXJkID0gYXJncy5jYXJkSWQgaW5zdGFuY2VvZiBDYXJkID8gYXJncy5jYXJkSWQgOiB0aGlzLmNhcmRMaWJyYXJ5LmdldENhcmQoYXJncy5jYXJkSWQpO1xuICAgIGNvbnN0IGNhcmRJZCA9IGNhcmQuaWQ7XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtkaXNjYXJkQ2FyZCBhY3Rpb25dIGRpc2NhcmRpbmcgJHtjYXJkfSBmcm9tICR7Z2V0UGxheWVyQnlJZCh0aGlzLm1hdGNoLCBhcmdzLnBsYXllcklkKX1gKTtcbiAgICBcbiAgICBjb25zdCBvbGRMb2NhdGlvbiA9IGF3YWl0IHRoaXMubW92ZUNhcmQoe1xuICAgICAgY2FyZElkLFxuICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9LFxuICAgICAgdG9QbGF5ZXJJZDogYXJncy5wbGF5ZXJJZFxuICAgIH0pO1xuICAgIFxuICAgIGlmICghb2xkTG9jYXRpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW2Rpc2NhcmRDYXJkIGFjdGlvbl0gY291bGQgbm90IGZpbmQgY2FyZCAke2NhcmRJZH0gaW4gcGxheWVyICR7YXJncy5wbGF5ZXJJZH0ncyBkaXNjYXJkIHBpbGVgKTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5sb2dNYW5hZ2VyLmFkZExvZ0VudHJ5KHtcbiAgICAgIHR5cGU6ICdkaXNjYXJkJyxcbiAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgY2FyZElkLFxuICAgICAgc291cmNlOiBjb250ZXh0Py5sb2dnaW5nQ29udGV4dD8uc291cmNlLFxuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IHIgPSBuZXcgUmVhY3Rpb25UcmlnZ2VyKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgIHByZXZpb3VzTG9jYXRpb246IG9sZExvY2F0aW9uLFxuICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICBjYXJkSWRcbiAgICB9KTtcbiAgICBcbiAgICB0aGlzLmxvZ01hbmFnZXIuZW50ZXIoKTtcbiAgICBhd2FpdCB0aGlzLnJlYWN0aW9uTWFuYWdlci5ydW5UcmlnZ2VyKHsgdHJpZ2dlcjogciB9KTtcbiAgICB0aGlzLmxvZ01hbmFnZXIuZXhpdCgpO1xuICAgIFxuICAgIGF3YWl0IHRoaXMucmVhY3Rpb25NYW5hZ2VyLnJ1bkNhcmRMaWZlY3ljbGVFdmVudCgnb25EaXNjYXJkZWQnLCB7XG4gICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgcHJldmlvdXNMb2NhdGlvbjogb2xkTG9jYXRpb25cbiAgICB9KTtcbiAgfVxuICBcbiAgYXN5bmMgbmV4dFBoYXNlKCkge1xuICAgIGNvbnN0IG1hdGNoID0gdGhpcy5tYXRjaDtcbiAgICBcbiAgICBsZXQgY3VycmVudFBsYXllciA9IGdldEN1cnJlbnRQbGF5ZXIobWF0Y2gpO1xuICAgIFxuICAgIGNvbnN0IHRyaWdnZXIgPSBuZXcgUmVhY3Rpb25UcmlnZ2VyKCdlbmRUdXJuUGhhc2UnLCB7XG4gICAgICBwaGFzZUluZGV4OiBtYXRjaC50dXJuUGhhc2VJbmRleCxcbiAgICAgIHBsYXllcklkOiBjdXJyZW50UGxheWVyLmlkXG4gICAgfSk7XG4gICAgYXdhaXQgdGhpcy5yZWFjdGlvbk1hbmFnZXIucnVuVHJpZ2dlcih7IHRyaWdnZXIgfSk7XG4gICAgXG4gICAgbWF0Y2gudHVyblBoYXNlSW5kZXggPSBtYXRjaC50dXJuUGhhc2VJbmRleCArIDE7XG4gICAgXG4gICAgaWYgKG1hdGNoLnR1cm5QaGFzZUluZGV4ID49IFR1cm5QaGFzZU9yZGVyVmFsdWVzLmxlbmd0aCkge1xuICAgICAgbWF0Y2gudHVyblBoYXNlSW5kZXggPSAwO1xuICAgICAgbWF0Y2gudHVybk51bWJlcisrO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBuZXdQaGFzZSA9IGdldFR1cm5QaGFzZShtYXRjaC50dXJuUGhhc2VJbmRleCk7XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtuZXh0UGhhc2UgYWN0aW9uXSBlbnRlcmluZyBwaGFzZTogJHtuZXdQaGFzZX0gZm9yIHR1cm4gJHttYXRjaC50dXJuTnVtYmVyfWApO1xuICAgIFxuICAgIHN3aXRjaCAobmV3UGhhc2UpIHtcbiAgICAgIGNhc2UgJ2FjdGlvbic6IHtcbiAgICAgICAgbWF0Y2gucGxheWVyQWN0aW9ucyA9IDE7XG4gICAgICAgIG1hdGNoLnBsYXllckJ1eXMgPSAxO1xuICAgICAgICBtYXRjaC5wbGF5ZXJUcmVhc3VyZSA9IDA7XG4gICAgICAgIG1hdGNoLnBsYXllclBvdGlvbnMgPSAwO1xuICAgICAgICBtYXRjaC5jdXJyZW50UGxheWVyVHVybkluZGV4Kys7XG4gICAgICAgIFxuICAgICAgICBpZiAobWF0Y2guY3VycmVudFBsYXllclR1cm5JbmRleCA+PSBtYXRjaC5wbGF5ZXJzLmxlbmd0aCkge1xuICAgICAgICAgIG1hdGNoLmN1cnJlbnRQbGF5ZXJUdXJuSW5kZXggPSAwO1xuICAgICAgICAgIG1hdGNoLnJvdW5kTnVtYmVyKys7XG4gICAgICAgICAgXG4gICAgICAgICAgdGhpcy5sb2dNYW5hZ2VyLmFkZExvZ0VudHJ5KHtcbiAgICAgICAgICAgIHJvb3Q6IHRydWUsXG4gICAgICAgICAgICB0eXBlOiAnbmV3VHVybicsXG4gICAgICAgICAgICB0dXJuOiBNYXRoLmZsb29yKG1hdGNoLnR1cm5OdW1iZXIgLyBtYXRjaC5wbGF5ZXJzLmxlbmd0aCkgKyAxLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmxvZ01hbmFnZXIuYWRkTG9nRW50cnkoe1xuICAgICAgICAgIHR5cGU6ICduZXdQbGF5ZXJUdXJuJyxcbiAgICAgICAgICB0dXJuOiBNYXRoLmZsb29yKG1hdGNoLnR1cm5OdW1iZXIgLyBtYXRjaC5wbGF5ZXJzLmxlbmd0aCkgKyAxLFxuICAgICAgICAgIHBsYXllcklkOiBtYXRjaC5wbGF5ZXJzW21hdGNoLmN1cnJlbnRQbGF5ZXJUdXJuSW5kZXhdLmlkXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY3VycmVudFBsYXllciA9IGdldEN1cnJlbnRQbGF5ZXIobWF0Y2gpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtuZXh0UGhhc2UgYWN0aW9uXSBuZXcgcm91bmQ6ICR7bWF0Y2gucm91bmROdW1iZXJ9LCB0dXJuICR7bWF0Y2gudHVybk51bWJlcn0gZm9yICR7Y3VycmVudFBsYXllcn1gKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHN0YXJ0VHVyblRyaWdnZXIgPSBuZXcgUmVhY3Rpb25UcmlnZ2VyKCdzdGFydFR1cm4nLCB7XG4gICAgICAgICAgcGxheWVySWQ6IG1hdGNoLnBsYXllcnNbbWF0Y2guY3VycmVudFBsYXllclR1cm5JbmRleF0uaWQsXG4gICAgICAgICAgdHVybk51bWJlcjogbWF0Y2gudHVybk51bWJlclxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgdGhpcy5yZWFjdGlvbk1hbmFnZXIucnVuVHJpZ2dlcih7IHRyaWdnZXI6IHN0YXJ0VHVyblRyaWdnZXIgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzdGFydFBoYXNlVHJpZ2dlciA9IG5ldyBSZWFjdGlvblRyaWdnZXIoJ3N0YXJ0VHVyblBoYXNlJywgeyBwaGFzZUluZGV4OiBtYXRjaC50dXJuUGhhc2VJbmRleCB9KTtcbiAgICAgICAgYXdhaXQgdGhpcy5yZWFjdGlvbk1hbmFnZXIucnVuVHJpZ2dlcih7IHRyaWdnZXI6IHN0YXJ0UGhhc2VUcmlnZ2VyIH0pO1xuICAgICAgICBcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlICdidXknOiB7XG4gICAgICAgIGNvbnN0IHN0YXJ0UGhhc2VUcmlnZ2VyID0gbmV3IFJlYWN0aW9uVHJpZ2dlcignc3RhcnRUdXJuUGhhc2UnLCB7IHBoYXNlSW5kZXg6IG1hdGNoLnR1cm5QaGFzZUluZGV4IH0pO1xuICAgICAgICBhd2FpdCB0aGlzLnJlYWN0aW9uTWFuYWdlci5ydW5UcmlnZ2VyKHsgdHJpZ2dlcjogc3RhcnRQaGFzZVRyaWdnZXIgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnY2xlYW51cCc6IHtcbiAgICAgICAgY29uc3Qgc3RhcnRQaGFzZVRyaWdnZXIgPSBuZXcgUmVhY3Rpb25UcmlnZ2VyKCdzdGFydFR1cm5QaGFzZScsIHsgcGhhc2VJbmRleDogbWF0Y2gudHVyblBoYXNlSW5kZXggfSk7XG4gICAgICAgIGF3YWl0IHRoaXMucmVhY3Rpb25NYW5hZ2VyLnJ1blRyaWdnZXIoeyB0cmlnZ2VyOiBzdGFydFBoYXNlVHJpZ2dlciB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRzVG9EaXNjYXJkID0gdGhpcy5fZmluZENhcmRzKHsgbG9jYXRpb246ICdwbGF5QXJlYScgfSlcbiAgICAgICAgICAuY29uY2F0KHRoaXMuX2ZpbmRDYXJkcyh7IGxvY2F0aW9uOiAncGxheWVySGFuZCcsIHBsYXllcklkOiBjdXJyZW50UGxheWVyLmlkIH0pKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIGNhcmRzVG9EaXNjYXJkKSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5kaXNjYXJkQ2FyZCh7IGNhcmRJZCwgcGxheWVySWQ6IGN1cnJlbnRQbGF5ZXIuaWQgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNTsgaSsrKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtuZXh0UGhhc2UgYWN0aW9uXSBkcmF3aW5nIGNhcmQuLi5gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0aGlzLmRyYXdDYXJkKHsgcGxheWVySWQ6IGN1cnJlbnRQbGF5ZXIuaWQgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHRoaXMuZW5kVHVybigpO1xuICAgICAgICBcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGF3YWl0IHRoaXMuY2hlY2tGb3JSZW1haW5pbmdQbGF5ZXJBY3Rpb25zKCk7XG4gIH1cbiAgXG4gIGFzeW5jIGVuZFR1cm4oKSB7XG4gICAgY29uc29sZS5sb2coJ1tlbmRUdXJuIGFjdGlvbl0gcmVtb3Zpbmcgb3ZlcnJpZGVzJyk7XG4gICAgXG4gICAgY29uc3QgdHJpZ2dlciA9IG5ldyBSZWFjdGlvblRyaWdnZXIoJ2VuZFR1cm4nLCk7XG4gICAgYXdhaXQgdGhpcy5yZWFjdGlvbk1hbmFnZXIucnVuVHJpZ2dlcih7IHRyaWdnZXIgfSk7XG4gIH1cbiAgXG4gIGFzeW5jIGdhaW5UcmVhc3VyZShhcmdzOiB7IGNvdW50OiBudW1iZXIgfSwgY29udGV4dD86IEdhbWVBY3Rpb25Db250ZXh0KSB7XG4gICAgY29uc29sZS5sb2coYFtnYWluVHJlYXN1cmUgYWN0aW9uXSBnYWluaW5nICR7YXJncy5jb3VudH0gdHJlYXN1cmVgKTtcbiAgICB0aGlzLm1hdGNoLnBsYXllclRyZWFzdXJlICs9IGFyZ3MuY291bnQ7XG4gICAgdGhpcy5tYXRjaC5wbGF5ZXJUcmVhc3VyZSA9IE1hdGgubWF4KDAsIHRoaXMubWF0Y2gucGxheWVyVHJlYXN1cmUpO1xuICAgIFxuICAgIGlmICghY29udGV4dD8ubG9nZ2luZ0NvbnRleHQ/LnN1cHByZXNzKSB7XG4gICAgICB0aGlzLmxvZ01hbmFnZXIuYWRkTG9nRW50cnkoe1xuICAgICAgICB0eXBlOiAnZ2FpblRyZWFzdXJlJyxcbiAgICAgICAgcGxheWVySWQ6IGdldEN1cnJlbnRQbGF5ZXIodGhpcy5tYXRjaCkuaWQsXG4gICAgICAgIGNvdW50OiBhcmdzLmNvdW50LFxuICAgICAgICBzb3VyY2U6IGNvbnRleHQ/LmxvZ2dpbmdDb250ZXh0Py5zb3VyY2UsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIFNpbmdsZSwgZm9jdXNlZCBpbXBsZW1lbnRhdGlvbiBvZiBkcmF3Q2FyZFxuICBhc3luYyBkcmF3Q2FyZChhcmdzOiB7IHBsYXllcklkOiBQbGF5ZXJJZCwgY291bnQ/OiBudW1iZXIgfSwgY29udGV4dD86IEdhbWVBY3Rpb25Db250ZXh0KSB7XG4gICAgY29uc3QgeyBwbGF5ZXJJZCwgY291bnQgfSA9IGFyZ3M7XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtkcmF3Q2FyZCBhY3Rpb25dIHBsYXllciAke3BsYXllcklkfSBkcmF3aW5nICR7Y291bnR9IGNhcmQocylgKTtcbiAgICBcbiAgICBjb25zdCBkZWNrID0gdGhpcy5fY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgcGxheWVySWQpO1xuICAgIGNvbnN0IGRyYXduQ2FyZElkczogQ2FyZElkW10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IChjb3VudCA/PyAxKTsgaSsrKSB7XG4gICAgICBpZiAoZGVjay5sZW5ndGggPCAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZHJhd0NhcmQgYWN0aW9uXSBTaHVmZmxpbmcgZGlzY2FyZCBwaWxlYCk7XG4gICAgICAgIGF3YWl0IHRoaXMuc2h1ZmZsZURlY2soeyBwbGF5ZXJJZCB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChkZWNrLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2RyYXdDYXJkIGFjdGlvbl0gTm8gY2FyZHMgbGVmdCBpbiBkZWNrLCByZXR1cm5pbmcgbnVsbGApO1xuICAgICAgICAgIHJldHVybiBkcmF3bkNhcmRJZHMubGVuZ3RoID4gMCA/IGRyYXduQ2FyZElkcyA6IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgZHJhd25DYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgIGRyYXduQ2FyZElkcy5wdXNoKGRyYXduQ2FyZElkKTtcbiAgICAgIFxuICAgICAgYXdhaXQgdGhpcy5tb3ZlQ2FyZCh7XG4gICAgICAgIGNhcmRJZDogZHJhd25DYXJkSWQsXG4gICAgICAgIHRvUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICB0aGlzLmxvZ01hbmFnZXIuYWRkTG9nRW50cnkoe1xuICAgICAgICB0eXBlOiAnZHJhdycsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IGRyYXduQ2FyZElkLFxuICAgICAgICBzb3VyY2U6IGNvbnRleHQ/LmxvZ2dpbmdDb250ZXh0Py5zb3VyY2UsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtkcmF3Q2FyZCBhY3Rpb25dIERyZXcgY2FyZCAke2RyYXduQ2FyZElkfWApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZHJhd25DYXJkSWRzO1xuICB9XG4gIFxuICBhc3luYyBwbGF5Q2FyZChhcmdzOiB7XG4gICAgcGxheWVySWQ6IFBsYXllcklkLFxuICAgIGNhcmRJZDogQ2FyZElkIHwgQ2FyZCxcbiAgICBvdmVycmlkZXM/OiBHYW1lQWN0aW9uT3ZlcnJpZGVzXG4gIH0sIGNvbnRleHQ/OiBHYW1lQWN0aW9uQ29udGV4dCkge1xuICAgIGNvbnN0IHsgcGxheWVySWQgfSA9IGFyZ3M7XG4gICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZElkIGluc3RhbmNlb2YgQ2FyZCA/IGFyZ3MuY2FyZElkIDogdGhpcy5jYXJkTGlicmFyeS5nZXRDYXJkKGFyZ3MuY2FyZElkKTtcbiAgICBjb25zdCBjYXJkSWQgPSBjYXJkLmlkO1xuICAgIFxuICAgIGlmIChhcmdzLm92ZXJyaWRlcz8ubW92ZUNhcmQgPT09IHVuZGVmaW5lZCB8fCBhcmdzLm92ZXJyaWRlcy5tb3ZlQ2FyZCkge1xuICAgICAgYXdhaXQgdGhpcy5tb3ZlQ2FyZCh7XG4gICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXlBcmVhJyB9LFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpICYmIGFyZ3Mub3ZlcnJpZGVzPy5hY3Rpb25Db3N0ICE9PSAwKSB7XG4gICAgICB0aGlzLm1hdGNoLnBsYXllckFjdGlvbnMgLT0gYXJncy5vdmVycmlkZXM/LmFjdGlvbkNvc3QgPz8gMTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtwbGF5Q2FyZCBhY3Rpb25dIFJlZHVjaW5nIHBsYXllcidzIGFjdGlvbiBjb3VudCB0byAke3RoaXMubWF0Y2gucGxheWVyQWN0aW9uc31gKTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5tYXRjaC5zdGF0cy5wbGF5ZWRDYXJkc0J5VHVyblt0aGlzLm1hdGNoLnR1cm5OdW1iZXJdID8/PSBbXTtcbiAgICB0aGlzLm1hdGNoLnN0YXRzLnBsYXllZENhcmRzQnlUdXJuW3RoaXMubWF0Y2gudHVybk51bWJlcl0hLnB1c2goY2FyZElkKTtcbiAgICB0aGlzLm1hdGNoLnN0YXRzLnBsYXllZENhcmRzW2NhcmRJZF0gPSB7XG4gICAgICB0dXJuUGhhc2U6IGdldFR1cm5QaGFzZSh0aGlzLm1hdGNoLnR1cm5QaGFzZUluZGV4KSxcbiAgICAgIHR1cm5OdW1iZXI6IHRoaXMubWF0Y2gudHVybk51bWJlcixcbiAgICAgIHBsYXllcklkOiBwbGF5ZXJJZCxcbiAgICB9O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbcGxheUNhcmQgYWN0aW9uXSAke2dldFBsYXllckJ5SWQodGhpcy5tYXRjaCwgcGxheWVySWQpfSBwbGF5ZWQgY2FyZCAke2NhcmR9YCk7XG4gICAgXG4gICAgdGhpcy5sb2dNYW5hZ2VyLmFkZExvZ0VudHJ5KHtcbiAgICAgIHR5cGU6ICdjYXJkUGxheWVkJyxcbiAgICAgIGNhcmRJZCxcbiAgICAgIHBsYXllcklkLFxuICAgICAgc291cmNlOiBjb250ZXh0Py5sb2dnaW5nQ29udGV4dD8uc291cmNlLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIGZpbmQgYW55IHJlYWN0aW9ucyBmb3IgdGhlIGNhcmRQbGF5ZWQgZXZlbnQgdHlwZVxuICAgIGNvbnN0IGNhcmRQbGF5ZWRUcmlnZ2VyID0gbmV3IFJlYWN0aW9uVHJpZ2dlcignY2FyZFBsYXllZCcsIHtcbiAgICAgIHBsYXllcklkLFxuICAgICAgY2FyZElkLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIGhhbmRsZSByZWFjdGlvbnMgZm9yIHRoZSBjYXJkIHBsYXllZFxuICAgIGxldCByZWFjdGlvbkNvbnRleHQgPSB7fTtcbiAgICB0aGlzLmxvZ01hbmFnZXIuZW50ZXIoKTtcbiAgICBhd2FpdCB0aGlzLnJlYWN0aW9uTWFuYWdlci5ydW5UcmlnZ2VyKHsgdHJpZ2dlcjogY2FyZFBsYXllZFRyaWdnZXIsIHJlYWN0aW9uQ29udGV4dCB9KTtcbiAgICB0aGlzLmxvZ01hbmFnZXIuZXhpdCgpO1xuICAgIFxuICAgIC8vIG5vdyBhZGQgYW55IHRyaWdnZXJlZCBlZmZlY3RzIGZyb20gdGhlIGNhcmQgcGxheWVkXG4gICAgYXdhaXQgdGhpcy5yZWFjdGlvbk1hbmFnZXIucnVuQ2FyZExpZmVjeWNsZUV2ZW50KCdvbkNhcmRQbGF5ZWQnLCB7IHBsYXllcklkOiBhcmdzLnBsYXllcklkLCBjYXJkSWQgfSk7XG4gICAgXG4gICAgLy8gcnVuIHRoZSBlZmZlY3RzIG9mIHRoZSBjYXJkIHBsYXllZCwgbm90ZSBwYXNzaW5nIGluIHRoZSByZWFjdGlvbiBjb250ZXh0IGNvbGxlY3RlZCBmcm9tIHJ1bm5pbmcgdGhlIHRyaWdnZXJcbiAgICAvLyBhYm92ZSAtIGUuZy4sIGNvdWxkIHByb3ZpZGUgaW1tdW5pdHkgdG8gYW4gYXR0YWNrIGNhcmQgcGxheWVkXG4gICAgbGV0IGVmZmVjdEZuID0gdGhpcy5jYXJkRWZmZWN0RnVuY3Rpb25NYXBbY2FyZC5jYXJkS2V5XTtcbiAgICBpZiAoZWZmZWN0Rm4pIHtcbiAgICAgIHRoaXMubG9nTWFuYWdlci5lbnRlcigpO1xuICAgICAgYXdhaXQgZWZmZWN0Rm4oe1xuICAgICAgICBjYXJkU291cmNlQ29udHJvbGxlcjogdGhpcy5fY2FyZFNvdXJjZUNvbnRyb2xsZXIsXG4gICAgICAgIGNhcmRQcmljZUNvbnRyb2xsZXI6IHRoaXMuY2FyZFByaWNlUnVsZUNvbnRyb2xsZXIsXG4gICAgICAgIHJlYWN0aW9uTWFuYWdlcjogdGhpcy5yZWFjdGlvbk1hbmFnZXIsXG4gICAgICAgIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZTogdGhpcy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgICAgIGNhcmRJZCxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIG1hdGNoOiB0aGlzLm1hdGNoLFxuICAgICAgICBjYXJkTGlicmFyeTogdGhpcy5jYXJkTGlicmFyeSxcbiAgICAgICAgcmVhY3Rpb25Db250ZXh0LFxuICAgICAgICBmaW5kQ2FyZHM6IHRoaXMuX2ZpbmRDYXJkc1xuICAgICAgfSk7XG4gICAgICB0aGlzLmxvZ01hbmFnZXIuZXhpdCgpO1xuICAgIH1cbiAgICBcbiAgICBmb3IgKGNvbnN0IGV4cGFuc2lvbiBvZiBPYmplY3Qua2V5cyh0aGlzLmN1c3RvbUNhcmRFZmZlY3RIYW5kbGVycykpIHtcbiAgICAgIGNvbnN0IGVmZmVjdHMgPSB0aGlzLmN1c3RvbUNhcmRFZmZlY3RIYW5kbGVyc1tleHBhbnNpb25dO1xuICAgICAgZWZmZWN0Rm4gPSBlZmZlY3RzW2NhcmQuY2FyZEtleV07XG4gICAgICBpZiAoZWZmZWN0Rm4pIHtcbiAgICAgICAgdGhpcy5sb2dNYW5hZ2VyLmVudGVyKCk7XG4gICAgICAgIGF3YWl0IGVmZmVjdEZuKHtcbiAgICAgICAgICBjYXJkU291cmNlQ29udHJvbGxlcjogdGhpcy5fY2FyZFNvdXJjZUNvbnRyb2xsZXIsXG4gICAgICAgICAgY2FyZFByaWNlQ29udHJvbGxlcjogdGhpcy5jYXJkUHJpY2VSdWxlQ29udHJvbGxlcixcbiAgICAgICAgICByZWFjdGlvbk1hbmFnZXI6IHRoaXMucmVhY3Rpb25NYW5hZ2VyLFxuICAgICAgICAgIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZTogdGhpcy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgICAgICAgY2FyZElkLFxuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIG1hdGNoOiB0aGlzLm1hdGNoLFxuICAgICAgICAgIGNhcmRMaWJyYXJ5OiB0aGlzLmNhcmRMaWJyYXJ5LFxuICAgICAgICAgIHJlYWN0aW9uQ29udGV4dCxcbiAgICAgICAgICBmaW5kQ2FyZHM6IHRoaXMuX2ZpbmRDYXJkc1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5sb2dNYW5hZ2VyLmV4aXQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgY29uc3QgYWZ0ZXJDYXJkUGxheWVkVHJpZ2dlciA9IG5ldyBSZWFjdGlvblRyaWdnZXIoJ2FmdGVyQ2FyZFBsYXllZCcsIHtcbiAgICAgIHBsYXllcklkLFxuICAgICAgY2FyZElkLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIGhhbmRsZSByZWFjdGlvbnMgZm9yIHRoZSBjYXJkIHBsYXllZFxuICAgIHJlYWN0aW9uQ29udGV4dCA9IHt9O1xuICAgIHRoaXMubG9nTWFuYWdlci5lbnRlcigpO1xuICAgIGF3YWl0IHRoaXMucmVhY3Rpb25NYW5hZ2VyLnJ1blRyaWdnZXIoeyB0cmlnZ2VyOiBhZnRlckNhcmRQbGF5ZWRUcmlnZ2VyLCByZWFjdGlvbkNvbnRleHQgfSk7XG4gICAgdGhpcy5sb2dNYW5hZ2VyLmV4aXQoKTtcbiAgfVxuICBcbiAgLy8gSGVscGVyIG1ldGhvZCB0byBzaHVmZmxlIGEgcGxheWVyJ3MgZGVja1xuICBhc3luYyBzaHVmZmxlRGVjayhhcmdzOiB7IHBsYXllcklkOiBQbGF5ZXJJZCB9LCBjb250ZXh0PzogR2FtZUFjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHBsYXllcklkIH0gPSBhcmdzO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbc2h1ZmZsZURlY2sgYWN0aW9uXSBzaHVmZmxpbmcgZGVja2ApO1xuICAgIFxuICAgIGNvbnN0IGRlY2sgPSB0aGlzLl9jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBwbGF5ZXJJZCk7XG4gICAgY29uc3QgZGlzY2FyZCA9IHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGlzY2FyZCcsIHBsYXllcklkKTtcbiAgICBcbiAgICBmaXNoZXJZYXRlc1NodWZmbGUoZGlzY2FyZCwgdHJ1ZSk7XG4gICAgZGVjay51bnNoaWZ0KC4uLmRpc2NhcmQpO1xuICAgIGRpc2NhcmQubGVuZ3RoID0gMDtcbiAgICBcbiAgICB0aGlzLmxvZ01hbmFnZXIuYWRkTG9nRW50cnkoe1xuICAgICAgdHlwZTogJ3NodWZmbGVEZWNrJyxcbiAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgc291cmNlOiBjb250ZXh0Py5sb2dnaW5nQ29udGV4dD8uc291cmNlLFxuICAgIH0pO1xuICB9XG59Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQ0UsSUFBSSxFQVVKLG9CQUFvQixRQUVmLHlCQUF5QjtBQUdoQyxTQUFTLGdCQUFnQixRQUFRLG9DQUFvQztBQUNyRSxTQWFFLGVBQWUsUUFFVixpQkFBaUI7QUFDeEIsU0FBUyxhQUFhLFFBQVEsa0NBQWtDO0FBS2hFLFNBQVMsWUFBWSxRQUFRLGdDQUFnQztBQUM3RCxTQUFTLGtCQUFrQixRQUFRLHVDQUF1QztBQUUxRSxPQUFPLE1BQU07Ozs7Ozs7Ozs7Ozs7RUFDSCxxQkFBNEQ7RUFDNUQseUJBQTZFO0VBRXJGLFlBQ0UsQUFBUSxxQkFBMkMsRUFDbkQsQUFBUSxVQUF1QixFQUMvQixBQUFRLHVCQUFpRCxFQUN6RCxBQUFRLHFCQUE0QyxFQUNwRCxBQUFRLHNCQUE2QyxFQUNyRCxBQUFRLEtBQVksRUFDcEIsQUFBUSxXQUE2QixFQUNyQyxBQUFRLFVBQXNCLEVBQzlCLEFBQVEsU0FBbUMsRUFDM0MsQUFBUSxlQUFnQyxFQUN4QyxBQUFRLHFCQUE0QyxFQUNwRCxBQUFpQix1QkFBb0QsQ0FDckU7U0FaUSx3QkFBQTtTQUNBLGFBQUE7U0FDQSwwQkFBQTtTQUNBLHdCQUFBO1NBQ0EseUJBQUE7U0FDQSxRQUFBO1NBQ0EsY0FBQTtTQUNBLGFBQUE7U0FDQSxZQUFBO1NBQ0Esa0JBQUE7U0FDQSx3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
// denoCacheMetadata=10585102630747587861,8856366253883067129