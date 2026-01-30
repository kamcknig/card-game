import { Container, Graphics, Text } from 'pixi.js';
import { cardStore } from '../../../state/card-state';
import { Card, CardType, Match, TokenDefinition, TokenId, TokenInstance } from 'shared/shared-types';
import { atom, computed } from 'nanostores';
import { CARD_HEIGHT, CARD_WIDTH, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { PhaseStatus } from './phase-status';
import { AppButton, createAppButton } from '../../../core/create-app-button';
import { currentPlayerTurnIdStore, turnPhaseStore } from '../../../state/turn-state';
import { CardStackView } from './card-stack';
import { List } from '@pixi/ui';
import { awaitingServerLockReleaseStore } from '../../../state/interactive-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { getCardSourceStore } from '../../../state/card-source-store';
import { matchStore } from '../../../state/match-state';
import { tokenDefinitionStore } from '../../../state/token-definition-state';
import { TokenBadgeView } from './token-badge-view';
import { getTokenShortLabel } from './token-utils';

export class PlayerHandView extends Container {
  private readonly _phaseStatus: PhaseStatus;
  private readonly _nextPhaseButton: AppButton = createAppButton({ text: 'NEXT' });
  private readonly _playAllTreasuresButton: AppButton = createAppButton(
    {
      text: 'PLAY ALL\nTREASURE',
      style: { align: 'center', fill: '#fff4e6', fontSize: 24 }
    },
    {
      color: '#c1aa1f'
    }
  );

  private readonly _cleanup: (() => void)[] = [];
  private readonly _background: Graphics = new Graphics({ label: 'background' });
  private readonly _cardList: List = new List({ type: 'horizontal', elementsMargin: STANDARD_GAP });
  private readonly _availableTokenTray: List = new List({ type: 'horizontal', elementsMargin: Math.floor(STANDARD_GAP * 0.5) });
  private readonly _activeTokenTray: List = new List({ type: 'horizontal', elementsMargin: Math.floor(STANDARD_GAP * 0.5) });
  private readonly _availableTokenLabel: Text = new Text({
    text: 'Available Tokens',
    style: { fill: '#ffffff', fontSize: 12 }
  });
  private readonly _activeTokenLabel: Text = new Text({
    text: 'Active Tokens',
    style: { fill: '#ffffff', fontSize: 12 }
  });

  constructor(
    private playerId: number,
    private readonly _socketService: SocketService,
  ) {
    super();

    this._phaseStatus = new PhaseStatus(this._socketService);

    this._cardList.label = `cardList`;
    this._cardList.elementsMargin = STANDARD_GAP;
    this._cardList.x = STANDARD_GAP;

    this.label = `player-hand-${this.playerId}`;

    this.addChild(this._background);
    this.addChild(this._phaseStatus);
    this.addChild(this._availableTokenLabel);
    this.addChild(this._availableTokenTray);
    this.addChild(this._activeTokenLabel);
    this.addChild(this._activeTokenTray);
    this.addChild(this._cardList);
    this.addChild(this._nextPhaseButton.button);

    this._background.y = this._phaseStatus.y + this._phaseStatus.height;
    this._cardList.y = this._background.y + STANDARD_GAP;

    this._background.clear();
    this._background.roundRect(0, 0, (CARD_WIDTH + STANDARD_GAP) * 6, CARD_HEIGHT + STANDARD_GAP * 6, 5);
    this._background.fill({ color: 0, alpha: .6 });

    this._cleanup.push(computed(
      [currentPlayerTurnIdStore, awaitingServerLockReleaseStore],
      (currentPlayerTurnId, waitingServerLockRelease) => currentPlayerTurnId === playerId && !waitingServerLockRelease
    ).subscribe(visible => {
      this._nextPhaseButton.button.visible = visible
    }));

    this._cleanup.push(
      computed(
        [awaitingServerLockReleaseStore, turnPhaseStore, currentPlayerTurnIdStore, getCardSourceStore('playerHand', playerId), cardStore],
        // Emit a new object so visibility updates when any dependency changes.
        (waiting, phase, currentPlayerTurnId, hand, cardsById) => ({
          waiting,
          phase,
          currentPlayerTurnId,
          hand,
          cardsById
        })
      ).subscribe(this.updatePlayAllTreasureVisibility)
    );

    this._cleanup.push(turnPhaseStore.subscribe((phase) => {
      switch (phase) {
        case 'action':
          this._nextPhaseButton.text('END ACTIONS');
          break;
        case 'buy':
          this._nextPhaseButton.text('END BUYS');
          break;
      }
      this.updateButtonLayout();
    }));
    this.addChild(this._nextPhaseButton.button);

    this._playAllTreasuresButton.button.label = 'playAllTreasureButton';
    this._playAllTreasuresButton.button.visible = false;
    this._playAllTreasuresButton.button.on('pointerdown', () => {
      this.emit('playAllTreasure');
    });
    this.addChild(this._playAllTreasuresButton.button);

    this.updatePlayAllTreasureVisibility();
    this.updateButtonLayout();

    this._cleanup.push(getCardSourceStore('playerHand', playerId).subscribe(this.drawHand));
    this._cleanup.push(
      computed(
        [matchStore, tokenDefinitionStore],
        (match, tokenDefinitions) => ({ match, tokenDefinitions })
      ).subscribe(({ match, tokenDefinitions }) => this.drawTokenTray(match, tokenDefinitions))
    );
    this._nextPhaseButton.button.on('pointerdown', () => {
      this.emit('nextPhase');
    });
    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(c => c());
    this._nextPhaseButton.button.off('pointerdown');
    this._playAllTreasuresButton.button.off('pointerdown');
    this.off('removed');
  }
  
  // Renders any unplaced tokens owned by this player in the token tray.
  private drawTokenTray(match: Match | null, tokenDefinitions: Record<TokenId, TokenDefinition>) {
    this._availableTokenTray.removeChildren();
    this._activeTokenTray.removeChildren();
    
    if (!match) {
      this.updateHandLayout();
      return;
    }
    
    const playerColor = match.players.find(player => player.id === this.playerId)?.color ?? '#ffffff';
    const tokens = Object.values(match.tokens ?? {})
      .filter(token => token.ownerId === this.playerId) as TokenInstance[];
    const availableTokens = tokens.filter(token => token.location.type === 'playerAvailable');
    const activeTokens = tokens.filter(token => token.location.type === 'player');
    
    availableTokens
      .sort((a, b) => a.tokenId.localeCompare(b.tokenId))
      .forEach(token => {
        const definition = tokenDefinitions[token.tokenId];
        const label = getTokenShortLabel(token.tokenId, definition);
        const badge = new TokenBadgeView({
          size: 35,
          labelText: label,
          color: this.parseColor(playerColor),
        });
        this._availableTokenTray.addChild(badge);
      });
    
    activeTokens
      .sort((a, b) => a.tokenId.localeCompare(b.tokenId))
      .forEach(token => {
        const definition = tokenDefinitions[token.tokenId];
        const label = getTokenShortLabel(token.tokenId, definition);
        const badge = new TokenBadgeView({
          size: 35,
          labelText: label,
          color: this.parseColor(playerColor),
        });
        this._activeTokenTray.addChild(badge);
      });
    
    this.updateHandLayout();
  }
  
  // Updates layout so the hand sits below any visible token tray.
  private updateHandLayout() {
    const hasAvailable = this._availableTokenTray.children.length > 0;
    const hasActive = this._activeTokenTray.children.length > 0;
    
    this._availableTokenLabel.visible = hasAvailable;
    this._availableTokenTray.visible = hasAvailable;
    this._activeTokenLabel.visible = hasActive;
    this._activeTokenTray.visible = hasActive;
    
    let y = this._background.y + Math.floor(STANDARD_GAP * 0.5);
    
    if (hasAvailable) {
      this._availableTokenLabel.x = STANDARD_GAP;
      this._availableTokenLabel.y = y;
      y += this._availableTokenLabel.height + Math.floor(STANDARD_GAP * 0.25);
      this._availableTokenTray.x = STANDARD_GAP;
      this._availableTokenTray.y = y;
      y += this._availableTokenTray.height + STANDARD_GAP;
    }
    
    if (hasActive) {
      this._activeTokenLabel.x = STANDARD_GAP;
      this._activeTokenLabel.y = y;
      y += this._activeTokenLabel.height + Math.floor(STANDARD_GAP * 0.25);
      this._activeTokenTray.x = STANDARD_GAP;
      this._activeTokenTray.y = y;
      y += this._activeTokenTray.height + STANDARD_GAP;
    }
    
    this._cardList.y = y;
    
    const minHeight = CARD_HEIGHT + STANDARD_GAP * 4;
    const neededHeight = (this._cardList.y - this._background.y) + CARD_HEIGHT + STANDARD_GAP * 2;
    const height = Math.max(minHeight, neededHeight);
    this._background.clear();
    this._background.roundRect(0, 0, (CARD_WIDTH + STANDARD_GAP) * 6, height, 5);
    this._background.fill({ color: 0, alpha: .6 });
    this.updateButtonLayout();
  }

  // Controls the visibility of the "Play All Treasure" button based on current match state.
  private updatePlayAllTreasureVisibility = (args?: {
    waiting: boolean;
    phase: string | undefined;
    currentPlayerTurnId: number | undefined;
    hand: ReadonlyArray<number>;
    cardsById: Record<number, Card>;
  }) => {
    const waiting = args?.waiting ?? awaitingServerLockReleaseStore.get();
    const turnPhase = (args?.phase ?? turnPhaseStore.get()) as string;
    const currentPlayerTurnId = args?.currentPlayerTurnId ?? currentPlayerTurnIdStore.get();
    const hand = args?.hand ?? getCardSourceStore('playerHand', this.playerId).get();
    const cardsById = args?.cardsById ?? cardStore.get();

    if (
      waiting ||
      turnPhase !== 'buy' ||
      !this.playerId ||
      currentPlayerTurnId !== this.playerId ||
      !hand?.length
    ) {
      this._playAllTreasuresButton.button.visible = false;
      return;
    }

    const hasTreasure = hand.some(cardId => cardsById[cardId]?.type?.includes('TREASURE'));
    this._playAllTreasuresButton.button.visible = hasTreasure;
  };

  // Positions the phase action buttons relative to the background size.
  private updateButtonLayout() {
    const width = this._background.width || (CARD_WIDTH + STANDARD_GAP) * 6;
    const totalHeight = this._background.y + this._background.height;
    const centerY = totalHeight * .5;

    this._nextPhaseButton.button.x = width - this._nextPhaseButton.button.width - STANDARD_GAP;
    this._nextPhaseButton.button.y = Math.floor(centerY + this._nextPhaseButton.button.height * .5 + STANDARD_GAP);

    this._playAllTreasuresButton.button.x = width - this._playAllTreasuresButton.button.width - STANDARD_GAP;
    this._playAllTreasuresButton.button.y = Math.floor(centerY - this._playAllTreasuresButton.button.height * .5 - STANDARD_GAP);
  }
  
  // Parses a hex color string into a numeric color for Pixi.
  private parseColor(color: string): number {
    if (!color) return 0xffffff;
    const normalized = color.replace('#', '');
    return Number.parseInt(normalized, 16);
  }

  private drawHand = (hand: ReadonlyArray<number>) => {
    this._cardList.removeChildren();

    const cardsById = cardStore.get();

    // first reduce the cards by card type, actions, then treasures, then victory cards
    const categoryMap: Record<string, number> = { ACTION: 0, REACTION: 1, TREASURE: 2, VICTORY: 3, OTHER: 4 };
    const categorized = hand.reduce(
      (acc, cardId) => {
        const card = cardsById[cardId];
        // Skip missing card data to avoid crashes from stale IDs.
        if (!card) {
          console.warn(`[player-hand] missing card data for id ${cardId}`);
          return acc;
        }
        const category = Object.keys(categoryMap).find(type => card.type.includes(type as CardType));
        if (category) {
          acc[categoryMap[category]].push(card);
        }
        else {
          acc[4].push(card);
        }
        return acc;
      },
      [[], [], [], [], []] as Card[][]
    );

    // now sort within each type. actions by name, treasure and victory by predefined rankings,
    // then flatten to a single dimensional array. probably better to type this array or something
    // elsewhere later on
    const treasureRankings = ['copper', 'silver', 'gold'];
    const treasureOrderRanking = treasureRankings.reduce(
      (acc, name, index) => ({ ...acc, [name]: index }),
      {} as Record<string, number>
    );

    const victoryRankings = ['estate', 'duchy', 'province'];
    const victoryOrderRanking = victoryRankings.reduce(
      (acc, name, index) => ({ ...acc, [name]: index }),
      {} as Record<string, number>
    );

    const sortedCards = [
      categorized[0].sort((a, b) => a.cardName.localeCompare(b.cardName)), // actions ordered by name
      categorized[1].sort((a, b) => a.cardName.localeCompare(b.cardName)), // reactions ordered by name
      categorized[2].sort((a, b) => {
        const aRank = treasureOrderRanking[a.cardKey] ?? Infinity;
        const bRank = treasureOrderRanking[b.cardKey] ?? Infinity;

        if (aRank !== bRank) {
          return aRank - bRank;
        }

        return a.cardName.localeCompare(b.cardName);
      }),
      categorized[3].sort((a, b) => {
        const aRank = victoryOrderRanking[a.cardKey] ?? Infinity;
        const bRank = victoryOrderRanking[b.cardKey] ?? Infinity;

        if (aRank !== bRank) {
          return aRank - bRank;
        }

        return a.cardName.localeCompare(b.cardName); // sort unknown victories alphabetically
      }),
      categorized[4].sort((a, b) => a.cardName.localeCompare(b.cardName))
    ].flat();

    const cardStackCards = Object.values(
      sortedCards.reduce((acc, card) => {
        acc[card.cardKey] ??= [];
        acc[card.cardKey].push(card);
        return acc;
      }, {} as Record<string, Card[]>)
    );

    for (const cards of cardStackCards) {
      const c = new CardStackView({
        $cardIds: atom(cards.map(c => c.id)),
        cardFacing: 'front',
        showBackground: false,
        scale: .8
      });
      this._cardList.addChild(c);
    }

    this._cardList.elementsMargin = cardStackCards.length > 5 ? -SMALL_CARD_WIDTH * .50 : STANDARD_GAP
  }
}
