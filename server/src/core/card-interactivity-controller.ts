import { ActionService, AppSocket, FindCardService, PromptService } from '@server-types/index.ts';
import { Card, CardId, CardLikeId, CardStats, Match, PlayerId, TurnPhaseOrderValues } from 'shared/types/index.ts';
import { isUndefined } from 'es-toolkit/compat';
import { MatchCardLibrary } from './match-card-library.ts';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { getTurnPhase } from '../utils/get-turn-phase.ts';
import { getCardPileKey } from '../utils/get-card-pile-key.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { findEventInMatch, findProjectInMatch, findWayInMatch } from '@shared/find-card-like-in-match.ts';
import { renaissanceTokenIds } from '@expansions/renaissance/token-ids-renaissance.ts';
import { BuyOptionsResolver, ResolvedBuyOption } from './actions/resolve-buy-options.ts';
import { PlayOptionsResolver } from './actions/resolve-play-options.ts';
import { LoggerService } from './logger-service.ts';

export class CardInteractivityController {
  private _gameOver: boolean = false;
  constructor(
    private readonly cardSourceController: CardSourceController,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly match: Match,
    private readonly socketMap: Map<PlayerId, AppSocket>,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly findCardService: FindCardService,
    private readonly buyOptionsResolver: BuyOptionsResolver,
    private readonly playOptionsResolver: PlayOptionsResolver,
    private readonly actionService: ActionService,
    private readonly promptService: PromptService,
    private readonly loggerService: LoggerService,
  ) {}

  public playerAdded(s: AppSocket | undefined) {
    // Every handler below is async and unawaited by socket.io's emitter — a
    // rejection would otherwise become an unhandled promise rejection that can
    // crash the process. runHandler() catches and logs instead.
    s?.on('cardTapped', (pId, cId) => this.runHandler('cardTapped', () => this.onCardTapped(pId, cId)));
    s?.on('cardTappedAsWay', (pId, cId, wId) =>
      this.runHandler('cardTappedAsWay', () => this.onCardTappedAsWay(pId, cId, wId)),
    );
    s?.on('cardLikeTapped', (pId, cId) => this.runHandler('cardLikeTapped', () => this.onCardLikeTapped(pId, cId)));
    s?.on('playAllTreasure', pId => this.runHandler('playAllTreasure', () => this.onPlayAllTreasure(pId)));
  }

  // Runs an async socket handler and logs (rather than throws) on rejection,
  // so a bug in one handler invocation can never surface as an unhandled
  // promise rejection.
  private runHandler(label: string, fn: () => Promise<void>): void {
    fn().catch(error => {
      this.loggerService.error(`[card interactivity] unhandled error in ${label} handler`);
      this.loggerService.error(error);
    });
  }

  public playerRemoved(socket: AppSocket | undefined) {
    socket?.off('cardTapped');
    socket?.off('cardTappedAsWay');
    socket?.off('cardLikeTapped');
    socket?.off('playAllTreasure');
  }

  public endGame() {
    this.loggerService.log(`[card interactivity] removing socket listeners and marking ended`);
    this.socketMap.forEach(s => {
      s.off('cardTapped');
      s.off('cardTappedAsWay');
      s.off('cardLikeTapped');
      s.off('playAllTreasure');
    });
    this._gameOver = true;
  }

  public checkCardInteractivity(): void {
    if (this._gameOver) {
      this.loggerService.debug(`[card interactivity] game is over, not processing match update`);
      return;
    }

    const match = this.match;
    if (match.players.length < 1) {
      this.loggerService.debug('[card interactivity] no players in match, skipping interactivity recompute');
      match.selectableCards = {};
      return;
    }

    const currentPlayer = match.players[match.currentPlayerTurnIndex];
    if (!currentPlayer) {
      this.loggerService.debug('[card interactivity] current player missing, skipping interactivity recompute');
      match.selectableCards = {};
      return;
    }

    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];
    // Debt prevents buying but should not block treasure play.
    const currentDebt = match.debt?.[currentPlayer.id] ?? 0;

    this.loggerService.debug(
      `[card interactivity] determining selectable cards - phase '${turnPhase}, player ${currentPlayer}', player Index '${match.currentPlayerTurnIndex}'`,
    );

    const selectableCards: number[] = [];

    const hand = this.cardSourceController
      .getSource('playerHand', currentPlayer.id)
      .map(id => this.cardLibrary.getCard(id));
    // Turn history index uniquely identifies the active turn, even when turn numbers repeat.
    const currentTurnHistoryIndex = match.stats.turns.length - 1;

    if (turnPhase === 'buy' && match.playerBuys > 0) {
      const pileKeysAdded: string[] = [];
      // Only offer buys if the player has no debt tokens.
      if (currentDebt === 0) {
        // Supply lookups return full card data for purchase checks.
        const supply: Card[] = this.findCardService.findCards({ location: ['basicSupply', 'kingdomSupply'] });

        // a loop going backwards through the supply and kingdoms. we only mark the last one as selectable (this should
        // be the top of any pile). a bit hacky to assume that.
        for (let i = supply.length - 1; i >= 0; i--) {
          const card = supply[i];
          const pileKey = getCardPileKey(card);
          // Split piles expose only one visible top card for interactivity.
          if (pileKeysAdded.includes(pileKey)) {
            continue;
          }
          pileKeysAdded.push(pileKey);

          const topSupplyCard = this.findCardService.findTopSupplyCardForPileKey({
            pileKey,
            from: ['basicSupply', 'kingdomSupply'],
          });
          if (!topSupplyCard) {
            continue;
          }

          // Include cards if any legal purchase path exists (standard or alternate).
          const buyOptions = this.buyOptionsResolver.resolveBuyOptions({
            cardId: topSupplyCard,
            playerId: currentPlayer.id,
          });

          if (buyOptions.options.length > 0) {
            selectableCards.push(topSupplyCard.id);
          }
        }
      }

      // loop over the player's hand; in the buy phase, one can play treasure as long as you haven't already
      // bought a card
      if (
        !Object.values<CardStats>(match.stats.cardsBought)
          .concat(Object.values(match.stats.cardLikesBought))
          .some(stats => stats.playerId === currentPlayer.id && stats.turnHistoryIndex === currentTurnHistoryIndex)
      ) {
        for (const card of hand) {
          if (card.type.includes('TREASURE')) {
            selectableCards.push(card.id);
          }
        }
      }

      // Only offer event buys if the player has no debt tokens.
      if (currentDebt === 0) {
        const events = this.match.events;
        for (const event of events) {
          const { restricted, cost } = this.cardPriceController.applyRules(event, {
            playerId: currentPlayer.id,
          });

          if (!restricted && cost.treasure <= this.match.playerTreasure) {
            selectableCards.push(event.id);
          }
        }

        // Projects are purchased for their printed cost and require available cube tokens.
        const cubeTokenId = renaissanceTokenIds.cube;
        const tokens = Object.values(this.match.tokens ?? {});
        const hasAvailableCube = tokens.some(
          token =>
            token.tokenId === cubeTokenId &&
            token.ownerId === currentPlayer.id &&
            token.location.type === 'playerAvailable' &&
            token.location.playerId === currentPlayer.id,
        );

        if (hasAvailableCube) {
          const projects = this.match.projects ?? [];
          for (const project of projects) {
            const alreadyOwned = tokens.some(
              token =>
                token.tokenId === cubeTokenId &&
                token.ownerId === currentPlayer.id &&
                token.location.type === 'cardLike' &&
                token.location.cardLikeId === project.id,
            );
            if (alreadyOwned) {
              continue;
            }

            const cost = project.cost.treasure ?? 0;
            if (cost <= this.match.playerTreasure) {
              selectableCards.push(project.id);
            }
          }
        }
      }
    } else if (turnPhase === 'action') {
      // Use a set to avoid duplicates when cards can be discovered through multiple action-play paths.
      const selectableCardIdSet = new Set<CardId>();

      for (const card of hand) {
        const canPlayResult = this.playOptionsResolver.resolveCanPlay({
          cardId: card,
          playerId: currentPlayer.id,
          phase: turnPhase,
        });
        if (canPlayResult.canPlay) {
          if (!selectableCardIdSet.has(card.id)) {
            selectableCards.push(card.id);
            selectableCardIdSet.add(card.id);
          }
          continue;
        }

        if (canPlayResult.reasons.length > 0) {
          this.loggerService.debug(
            `[card interactivity] ${currentPlayer} cannot play ${card}: ${canPlayResult.reasons.join('; ')}`,
          );
        }
      }

      // Shadow rule: while in Action phase, Action+Shadow cards in deck are playable "as if in hand".
      const shadowActionCardsInDeck = this.cardSourceController
        .getSource('playerDeck', currentPlayer.id)
        .map(id => this.cardLibrary.getCard(id))
        .filter(card => card.type.includes('ACTION') && card.type.includes('SHADOW'));
      this.loggerService.debug(
        `[card interactivity] ${currentPlayer} has ${shadowActionCardsInDeck.length} Shadow Action card(s) in deck`,
      );

      let shadowCardsAddedToSelectable = 0;
      for (const shadowCard of shadowActionCardsInDeck) {
        const canPlayResult = this.playOptionsResolver.resolveCanPlay({
          cardId: shadowCard,
          playerId: currentPlayer.id,
          phase: turnPhase,
        });

        if (canPlayResult.canPlay) {
          if (!selectableCardIdSet.has(shadowCard.id)) {
            selectableCards.push(shadowCard.id);
            selectableCardIdSet.add(shadowCard.id);
            shadowCardsAddedToSelectable++;
          }
          continue;
        }

        if (canPlayResult.reasons.length > 0) {
          this.loggerService.debug(
            `[card interactivity] ${currentPlayer} cannot play deck Shadow ${shadowCard}: ${canPlayResult.reasons.join('; ')}`,
          );
        }
      }

      this.loggerService.debug(
        `[card interactivity] added ${shadowCardsAddedToSelectable} deck Shadow card(s) to action-phase selectable list`,
      );
    } else if (turnPhase === 'night') {
      // Allow playing any Night cards during the Night phase.
      for (const card of hand) {
        if (card.type.includes('NIGHT')) {
          selectableCards.push(card.id);
        }
      }
      this.loggerService.debug(`[card interactivity] night phase selectable count ${selectableCards.length}`);
    }

    match.selectableCards = match.players.reduce(
      (prev, { id }) => {
        prev[id] = id === currentPlayer.id ? selectableCards : [];
        return prev;
      },
      {} as Record<PlayerId, CardId[]>,
    );

    this.loggerService.debug(`[card interactivity] selectable cards`);

    for (const key of Object.keys(match.selectableCards)) {
      const tmp = match.selectableCards[+key]?.concat() ?? [];
      const p = getPlayerById(match, +key);
      this.loggerService.debug(`${p} can select ${tmp.length} cards`);
    }
  }

  private async onPlayAllTreasure(playerId: PlayerId) {
    this.loggerService.info('[card interactivity] playing all treasures for current player');

    if (this._gameOver) {
      this.loggerService.debug(`[card interactivity] game is over, not playing treasures`);
      return;
    }

    const player = getPlayerById(this.match, playerId);

    if (isUndefined(player)) {
      this.loggerService.warn(`[card interactivity] could not find current player`);
      return;
    }

    const hand = this.cardSourceController.getSource('playerHand', player.id);
    const treasureCards = hand.filter(e => this.cardLibrary.getCard(e).type.includes('TREASURE'));
    this.loggerService.debug(`[card interactivity] ${player} has ${treasureCards.length} treasure cards in hand`);
    if (hand.length === 0 || treasureCards.length === 0) {
      return;
    }

    for (const cardId of treasureCards) {
      await this.actionService.run('playCard', {
        playerId,
        cardId,
        overrides: { actionCost: 0 },
      });
    }

    this.socketMap.get(playerId)?.emit('playAllTreasureComplete');
  }

  private async onCardLikeTapped(playerId: PlayerId, cardId: CardLikeId) {
    const player = getPlayerById(this.match, playerId);

    if (!player) {
      // Stale socket events can arrive after a player leaves or a match is cleared.
      this.loggerService.warn(`[card interactivity] could not find player ${playerId} for landscape tap ${cardId}`);
      return;
    }

    this.loggerService.info(`[card interactivity] ${player} tapped landscape ${cardId}`);

    try {
      if (this._gameOver) {
        this.loggerService.debug(`[card interactivity] game is over, not processing landscape tap`);
        return;
      }

      const phase = getTurnPhase(this.match.turnPhaseIndex);

      if (phase === 'buy') {
        // Block buying events while the player has debt tokens.
        if ((this.match.debt?.[playerId] ?? 0) > 0) {
          this.loggerService.debug(`[card interactivity] ${player} has debt, blocking landscape buy`);
          return;
        }
        this.loggerService.info(
          `[card interactivity] ${player} tapped landscape ${cardId} in phase ${phase}, processing`,
        );

        const event = findEventInMatch(this.match, cardId);
        if (event) {
          await this.actionService.run('buyEvent', { playerId, cardLikeId: cardId });
        } else {
          const project = findProjectInMatch(this.match, cardId);
          if (project) {
            await this.actionService.run('buyProject', { playerId, cardLikeId: cardId });
          } else {
            this.loggerService.debug(`[card interactivity] ${player} tapped non-buyable landscape ${cardId}`);
          }
        }
      } else {
        this.loggerService.debug(
          `[card interactivity] ${player} tapped landscape ${cardId} in phase ${phase}, not processing`,
        );
      }

      await this.actionService.run('checkForRemainingPlayerActions');
    } finally {
      // The client locks input until this arrives; it must fire on every path,
      // including early returns and thrown errors from action handlers.
      this.socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
    }
  }

  private async onCardTapped(playerId: PlayerId, cardId: CardId) {
    const player = getPlayerById(this.match, playerId);

    if (!player) {
      // Stale socket events can arrive after a player leaves or a match is cleared.
      this.loggerService.warn(`[card interactivity] could not find player ${playerId} for card tap ${cardId}`);
      return;
    }

    // Validate cardId before touching it — it is unvalidated client input and
    // getCard() throws for unknown ids, which would otherwise escape this async
    // socket handler as an unhandled rejection and never fire cardTappedComplete,
    // permanently locking the client's supply UI.
    const tappedCard = this.cardLibrary.tryGetCard(cardId);
    if (!tappedCard) {
      this.loggerService.warn(`[card interactivity] ${player} tapped unknown card ${cardId}`);
      this.socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
      return;
    }

    try {
      this.loggerService.info(`[card interactivity] pl${player} tapped card ${tappedCard}`);

      if (this._gameOver) {
        this.loggerService.debug(`[card interactivity] game is over, not processing card tap`);
        return;
      }

      const phase = getTurnPhase(this.match.turnPhaseIndex);

      if (phase === 'buy') {
        let overpay = { inTreasure: 0, inCoffer: 0 };

        const hand = this.cardSourceController.getSource('playerHand', playerId);

        if (hand.includes(cardId)) {
          const card = this.cardLibrary.getCard(cardId);
          if (!card.type.includes('TREASURE')) {
            this.loggerService.debug(`[card interactivity] tapped non-treasure hand card ${card} during buy phase`);
            return;
          }

          await this.actionService.run('playCard', {
            playerId,
            cardId,
            overrides: { actionCost: 0 },
          });
        } else {
          // Block buying cards while the player has debt tokens.
          if ((this.match.debt?.[playerId] ?? 0) > 0) {
            this.loggerService.debug(`[card interactivity] ${player} has debt, blocking buy`);
            return;
          }
          const card = this.cardLibrary.getCard(cardId);
          const resolvedBuyOptions = this.buyOptionsResolver.resolveBuyOptions({
            cardId: card,
            playerId,
          });
          const { cost } = resolvedBuyOptions;
          const { options } = resolvedBuyOptions;

          // Exit if there are currently no legal ways to buy this card.
          if (options.length === 0) {
            this.loggerService.debug(`[card interactivity] no legal buy options for ${card}`);
            return;
          }

          let selectedBuyOption: ResolvedBuyOption | undefined = options[0];
          if (options.length > 1) {
            // Let the user choose the payment method when multiple paths are legal.
            const selectedAction = await this.promptService.requestAction({
              playerId,
              prompt: `Choose how to buy ${card.cardName}`,
              actionButtons: options.map((option, index) => ({ label: option.label, action: index + 1 })),
            });
            if (selectedAction === null || selectedAction < 1) {
              this.loggerService.debug(`[card interactivity] buy option prompt cancelled`);
              return;
            }
            selectedBuyOption = options[selectedAction - 1];
          }

          if (!selectedBuyOption) {
            this.loggerService.debug(`[card interactivity] selected buy option missing`);
            return;
          }

          if (selectedBuyOption.kind === 'standard' && card.tags?.includes('overpay')) {
            if (this.match.playerTreasure > cost.treasure) {
              const result = await this.promptService.requestActionResult<{ inTreasure: number; inCoffer: number }>({
                prompt: 'Overpay?',
                actionButtons: [{ label: 'DONE', action: 1 }],
                playerId: playerId,
                content: { type: 'overpay', cost: cost.treasure },
              });
              if (result?.result) {
                overpay = result.result;
              }
            }
          }

          await this.actionService.run('buyCard', {
            playerId,
            cardId,
            overpay,
            cardCost: cost,
            buyOptionId: selectedBuyOption.id,
          });
        }
      } else if (phase === 'action') {
        const canPlayResult = this.playOptionsResolver.resolveCanPlay({
          cardId,
          playerId,
          phase,
        });
        if (!canPlayResult.canPlay) {
          this.loggerService.debug(
            `[card interactivity] blocked action play for ${canPlayResult.card}: ${canPlayResult.reasons.join('; ')}`,
          );
          return;
        }
        await this.actionService.run('playCard', { playerId, cardId, wayId: null });
      } else if (phase === 'night') {
        // Night phase allows playing Night cards from hand without action cost.
        const hand = this.cardSourceController.getSource('playerHand', playerId);
        if (hand.includes(cardId)) {
          const card = this.cardLibrary.getCard(cardId);
          if (card.type.includes('NIGHT')) {
            await this.actionService.run('playCard', { playerId, cardId });
            this.loggerService.debug(`[card interactivity] played night card ${card}`);
          } else {
            this.loggerService.debug(`[card interactivity] tapped non-night card ${card} during night phase`);
          }
        } else {
          this.loggerService.debug(`[card interactivity] tapped card ${cardId} not in hand during night phase`);
        }
      }

      await this.actionService.run('checkForRemainingPlayerActions');
    } finally {
      // The client locks input until this arrives; it must fire on every path,
      // including early returns and thrown errors from action handlers.
      this.socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
    }
  }

  private async onCardTappedAsWay(playerId: PlayerId, cardId: CardId, wayId: CardLikeId) {
    const player = getPlayerById(this.match, playerId);

    if (!player) {
      // Stale socket events can arrive after a player leaves or a match is cleared.
      this.loggerService.warn(
        `[card interactivity] could not find player ${playerId} for way tap card=${cardId} way=${wayId}`,
      );
      return;
    }

    this.loggerService.info(`[card interactivity] ${player} tapped card ${cardId} as way ${wayId}`);

    try {
      if (this._gameOver) {
        this.loggerService.debug(`[card interactivity] game is over, not processing way card tap`);
        return;
      }

      // Ensure the selected way is active in the current match.
      const way = findWayInMatch(this.match, wayId);
      if (!way) {
        this.loggerService.warn(`[card interactivity] could not find way ${wayId} in active match`);
        return;
      }

      // Require the tapped card to still be in hand and currently selectable.
      const hand = this.cardSourceController.getSource('playerHand', playerId);
      if (!hand.includes(cardId)) {
        this.loggerService.debug(`[card interactivity] ignored way play for card ${cardId} not in hand`);
        return;
      }

      const selectableCards = this.match.selectableCards[playerId] ?? [];
      if (!selectableCards.includes(cardId)) {
        this.loggerService.debug(`[card interactivity] ignored way play for card ${cardId} not selectable`);
        return;
      }

      // Validate cardId before touching it — same rationale as onCardTapped:
      // an unvalidated id must never reach getCard() and throw out of this
      // handler before cardTappedComplete has a chance to fire.
      const card = this.cardLibrary.tryGetCard(cardId);
      if (!card) {
        this.loggerService.warn(`[card interactivity] ${player} tapped unknown card ${cardId} for way play`);
        return;
      }
      if (!card.type.includes('ACTION')) {
        this.loggerService.debug(`[card interactivity] ignored non-action card ${card} for way play`);
        return;
      }

      await this.actionService.run('playCard', {
        playerId,
        cardId,
        wayId,
      });

      await this.actionService.run('checkForRemainingPlayerActions');
    } finally {
      // The client locks input until this arrives; it must fire on every path,
      // including early returns and thrown errors from action handlers.
      this.socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
    }
  }
}
