import { ActionService, AppSocket, FindCardService } from '@server-types/index.ts';
import { Card, CardId, CardLikeId, CardStats, Match, PlayerId, TurnPhaseOrderValues } from 'shared/types/index.ts';
import { isUndefined } from 'es-toolkit/compat';
import { MatchCardLibrary } from './match-card-library.ts';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { getTurnPhase } from '../utils/get-turn-phase.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { findEventInMatch, findProjectInMatch } from '@shared/find-card-like-in-match.ts';
import { renaissanceTokenIds } from '@expansions/renaissance/token-ids-renaissance.ts';
import { BuyOptionsResolver, ResolvedBuyOption } from './actions/resolve-buy-options.ts';

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
    private readonly actionService: ActionService,
  ) {
    this.socketMap.forEach((s) => {
      s.on('cardTapped', (pId, cId) => this.onCardTapped(pId, cId));
      s.on('cardLikeTapped', (pId, cId) => this.onCardLikeTapped(pId, cId));
      s.on('playAllTreasure', async (pId) => await this.onPlayAllTreasure(pId));
    });
  }

  public playerAdded(s: AppSocket | undefined) {
    s?.on('cardTapped', (pId, cId) => this.onCardTapped(pId, cId));
    s?.on('cardLikeTapped', (pId, cId) => this.onCardLikeTapped(pId, cId));
    s?.on('playAllTreasure', async (pId) => await this.onPlayAllTreasure(pId));
  }

  public playerRemoved(socket: AppSocket | undefined) {
    socket?.off('cardTapped');
    socket?.off('cardLikeTapped');
    socket?.off('playAllTreasure');
  }

  public endGame() {
    console.log(`[card interactivity] removing socket listeners and marking ended`);
    this.socketMap.forEach((s) => {
      s.off('cardTapped');
      s.off('cardLikeTapped');
      s.off('playAllTreasure');
    });
    this._gameOver = true;
  }

  public checkCardInteractivity(): void {
    if (this._gameOver) {
      console.debug(`[card interactivity] game is over, not processing match update`);
      return;
    }

    const match = this.match;

    const currentPlayer = match.players[match.currentPlayerTurnIndex];
    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];
    // Debt prevents buying but should not block treasure play.
    const currentDebt = match.debt?.[currentPlayer.id] ?? 0;

    console.debug(
      `[card interactivity] determining selectable cards - phase '${turnPhase}, player ${currentPlayer}', player Index '${match.currentPlayerTurnIndex}'`,
    );

    const selectableCards: number[] = [];

    const hand = this.cardSourceController.getSource('playerHand', currentPlayer.id)
      .map((id) => this.cardLibrary.getCard(id));
    // Turn history index uniquely identifies the active turn, even when turn numbers repeat.
    const currentTurnHistoryIndex = match.stats.turns.length - 1;

    if (turnPhase === 'buy' && match.playerBuys > 0) {
      const cardKeysAdded: string[] = [];
      // Only offer buys if the player has no debt tokens.
      if (currentDebt === 0) {
        // Supply lookups return full card data for purchase checks.
        const supply: Card[] = this.findCardService.findCards({ location: ['basicSupply', 'kingdomSupply'] });

        // a loop going backwards through the supply and kingdom. we only mark the last one as selectable (this should
        // be the top of any pile). a bit hacky to assume that.
        for (let i = supply.length - 1; i >= 0; i--) {
          const card = supply[i];
          // we already marked this type of card as selectable based on cost
          if (cardKeysAdded.includes(card.cardKey)) {
            continue;
          }

          // Include cards if any legal purchase path exists (standard or alternate).
          const buyOptions = this.buyOptionsResolver.resolveBuyOptions({
            cardId: card,
            playerId: currentPlayer.id,
          });

          if (buyOptions.options.length > 0) {
            selectableCards.push(card.id);
            cardKeysAdded.push(card.cardKey);
          }
        }
      }

      // loop over the player's hand; in the buy phase, one can play treasure as long as you haven't already
      // bought a card
      if (
        !Object.values<CardStats>(match.stats.cardsBought).concat(Object.values(match.stats.cardLikesBought))
          .some((stats) =>
            stats.playerId === currentPlayer.id &&
            stats.turnHistoryIndex === currentTurnHistoryIndex
          )
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
        const hasAvailableCube = tokens.some((token) =>
          token.tokenId === cubeTokenId &&
          token.ownerId === currentPlayer.id &&
          token.location.type === 'playerAvailable' &&
          token.location.playerId === currentPlayer.id
        );

        if (hasAvailableCube) {
          const projects = this.match.projects ?? [];
          for (const project of projects) {
            const alreadyOwned = tokens.some((token) =>
              token.tokenId === cubeTokenId &&
              token.ownerId === currentPlayer.id &&
              token.location.type === 'cardLike' &&
              token.location.cardLikeId === project.id
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
      for (const card of hand) {
        if (card.type.includes('ACTION') && match.playerActions > 0) {
          selectableCards.push(card.id);
        }
      }
    } else if (turnPhase === 'night') {
      // Allow playing any Night cards during the Night phase.
      for (const card of hand) {
        if (card.type.includes('NIGHT')) {
          selectableCards.push(card.id);
        }
      }
      console.debug(`[card interactivity] night phase selectable count ${selectableCards.length}`);
    }

    match.selectableCards = match.players.reduce((prev, { id }) => {
      prev[id] = id === currentPlayer.id ? selectableCards : [];
      return prev;
    }, {} as Record<PlayerId, CardId[]>);

    console.debug(`[card interactivity] selectable cards`);

    for (const key of Object.keys(match.selectableCards)) {
      const tmp = match.selectableCards[+key]?.concat() ?? [];
      const p = getPlayerById(match, +key);
      console.debug(`${p} can select ${tmp.length} cards`);
    }
  }

  private async onPlayAllTreasure(playerId: PlayerId) {
    console.info('[card interactivity] playing all treasures for current player');

    if (this._gameOver) {
      console.debug(`[card interactivity] game is over, not playing treasures`);
      return;
    }

    const player = getPlayerById(this.match, playerId);

    if (isUndefined(player)) {
      console.warn(`[card interactivity] could not find current player`);
      return;
    }

    const hand = this.cardSourceController.getSource('playerHand', player.id);
    const treasureCards = hand.filter((e) => this.cardLibrary.getCard(e).type.includes('TREASURE'));
    console.debug(`[card interactivity] ${player} has ${treasureCards.length} treasure cards in hand`);
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
      throw new Error('could not find player');
    }

    console.info(`[card interactivity] ${player} tapped card-like ${cardId}`);

    if (this._gameOver) {
      console.debug(`[card interactivity] game is over, not processing card-like tap`);
      return;
    }

    const phase = getTurnPhase(this.match.turnPhaseIndex);

    if (phase === 'buy') {
      // Block buying events while the player has debt tokens.
      if ((this.match.debt?.[playerId] ?? 0) > 0) {
        console.debug(`[card interactivity] ${player} has debt, blocking card-like buy`);
        return;
      }
      console.info(`[card interactivity] ${player} tapped card-like ${cardId} in phase ${phase}, processing`);

      const event = findEventInMatch(this.match, cardId);
      if (event) {
        await this.actionService.run('buyEvent', { playerId, cardLikeId: cardId });
      } else {
        const project = findProjectInMatch(this.match, cardId);
        if (project) {
          await this.actionService.run('buyProject', { playerId, cardLikeId: cardId });
        } else {
          console.debug(`[card interactivity] ${player} tapped non-buyable card-like ${cardId}`);
        }
      }
    } else {
      console.debug(`[card interactivity] ${player} tapped card-like ${cardId} in phase ${phase}, not processing`);
    }

    await this.actionService.run('checkForRemainingPlayerActions');

    this.socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
  }

  private async onCardTapped(playerId: PlayerId, cardId: CardId) {
    const player = getPlayerById(this.match, playerId);

    if (!player) {
      throw new Error('could not find player');
    }

    console.info(`[card interactivity] pl${player} tapped card ${this.cardLibrary.getCard(cardId)}`);

    if (this._gameOver) {
      console.debug(`[card interactivity] game is over, not processing card tap`);
      return;
    }

    const phase = getTurnPhase(this.match.turnPhaseIndex);

    if (phase === 'buy') {
      let overpay = { inTreasure: 0, inCoffer: 0 };

      const hand = this.cardSourceController.getSource('playerHand', playerId);

      if (hand.includes(cardId)) {
        const card = this.cardLibrary.getCard(cardId);
        if (!card.type.includes('TREASURE')) {
          console.debug(`[card interactivity] tapped non-treasure hand card ${card} during buy phase`);
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
          console.debug(`[card interactivity] ${player} has debt, blocking buy`);
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
          console.debug(`[card interactivity] no legal buy options for ${card}`);
          return;
        }

        let selectedBuyOption: ResolvedBuyOption | undefined = options[0];
        if (options.length > 1) {
          // Let the user choose the payment method when multiple paths are legal.
          const buyOptionPrompt = await this.actionService.run('userPrompt', {
            playerId,
            prompt: `Choose how to buy ${card.cardName}`,
            actionButtons: options.map((option, index) => ({ label: option.label, action: index + 1 })),
          }) as { action?: number };
          if (buyOptionPrompt.action === undefined || buyOptionPrompt.action < 1) {
            console.debug(`[card interactivity] buy option prompt cancelled`);
            return;
          }
          selectedBuyOption = options[buyOptionPrompt.action - 1];
        }

        if (!selectedBuyOption) {
          console.debug(`[card interactivity] selected buy option missing`);
          return;
        }

        if (selectedBuyOption.kind === 'standard' && card.tags?.includes('overpay')) {
          if (this.match.playerTreasure > cost.treasure) {
            const result = await this.actionService.run('userPrompt', {
              prompt: 'Overpay?',
              actionButtons: [{ label: 'DONE', action: 1 }],
              playerId: playerId,
              content: { type: 'overpay', cost: cost.treasure },
            }) as { action: number; result: { inTreasure: number; inCoffer: number } };
            overpay = result.result;
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
      await this.actionService.run('playCard', { playerId, cardId });
    } else if (phase === 'night') {
      // Night phase allows playing Night cards from hand without action cost.
      const hand = this.cardSourceController.getSource('playerHand', playerId);
      if (hand.includes(cardId)) {
        const card = this.cardLibrary.getCard(cardId);
        if (card.type.includes('NIGHT')) {
          await this.actionService.run('playCard', { playerId, cardId });
          console.debug(`[card interactivity] played night card ${card}`);
        } else {
          console.debug(`[card interactivity] tapped non-night card ${card} during night phase`);
        }
      } else {
        console.debug(`[card interactivity] tapped card ${cardId} not in hand during night phase`);
      }
    }

    await this.actionService.run('checkForRemainingPlayerActions');

    this.socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
  }
}
