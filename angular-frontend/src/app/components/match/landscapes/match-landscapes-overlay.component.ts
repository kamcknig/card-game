import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { CardId, CardLike, CardLikeId, PlayerId, TokenInstance } from 'shared/types';
import { SocketService } from '../../../core/socket-service/socket.service';
import { CardLikeComponent } from '../../card-like/card-like.component';
import { matchStore } from '../../../state/match-state';
import { selfPlayerIdStore } from '../../../state/player-state';
import { awaitingServerLockReleaseStore, promptInteractionLockStore, selectedCardStore } from '../../../state/interactive-state';
import { selectableCardStore } from '../../../state/interactive-logic';
import { displayCardDetail } from '../views/modal/display-card-detail';
import {
  LANDSCAPE_CARD_WIDTH_PX,
  LANDSCAPE_MAX_COLUMNS,
} from './landscape-layout.constants';
import {
  SUPPLY_BASIC_PANEL_WIDTH_PX,
  SUPPLY_KINGDOM_PANEL_HEIGHT_PX,
  SUPPLY_PANEL_GAP_PX,
} from '../supply/supply-layout.constants';

type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ProjectCubeTokenViewModel = {
  id: string;
  color: string;
};

type ProjectSinisterBadgeViewModel = {
  id: string;
  color: string;
  label: string;
};

type LandscapeCardViewModel = {
  trackKey: string;
  id: CardLikeId;
  detailImagePath: string;
  selectable: boolean;
  selected: boolean;
  showCost: boolean;
  treasureCost: number;
  potionCost: number;
  debtCost: number;
  cubeTokens: ProjectCubeTokenViewModel[];
  sinisterBadges: ProjectSinisterBadgeViewModel[];
  sunTokenCount: number;
};

const SINISTER_PLOT_TOKEN_ID = 'renaissance:sinister-plot';
const SUN_TOKEN_ID = 'rising-sun:sun';
const CUBE_TOKEN_ID = 'cube-token';

@Component({
  selector: 'app-match-landscapes-overlay',
  imports: [
    CardLikeComponent,
  ],
  templateUrl: './match-landscapes-overlay.component.html',
  styleUrl: './match-landscapes-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchLandscapesOverlayComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);

  scoreRect = input<RectLike | null>(null);
  visible = input(false);

  private readonly _match = toSignal(this._nanoStores.useStore(matchStore), {
    initialValue: matchStore.get(),
  });

  private readonly _selfPlayerId = toSignal(this._nanoStores.useStore(selfPlayerIdStore), {
    initialValue: selfPlayerIdStore.get(),
  });

  private readonly _selectableCards = toSignal(this._nanoStores.useStore(selectableCardStore), {
    initialValue: selectableCardStore.get(),
  });

  private readonly _selectedCards = toSignal(this._nanoStores.useStore(selectedCardStore), {
    initialValue: selectedCardStore.get(),
  });

  private readonly _awaitingServerLockRelease = toSignal(this._nanoStores.useStore(awaitingServerLockReleaseStore), {
    initialValue: awaitingServerLockReleaseStore.get(),
  });

  private readonly _promptInteractionLocked = toSignal(this._nanoStores.useStore(promptInteractionLockStore), {
    initialValue: promptInteractionLockStore.get(),
  });

  readonly panelLayout = computed(() => {
    const rect = this.scoreRect();
    const basicLeft = SUPPLY_PANEL_GAP_PX;
    const kingdomLeft = Math.max((rect?.x ?? 0) + (rect?.width ?? 0), basicLeft + SUPPLY_BASIC_PANEL_WIDTH_PX) + SUPPLY_PANEL_GAP_PX;
    const kingdomTop = SUPPLY_PANEL_GAP_PX;
    return {
      left: kingdomLeft,
      top: kingdomTop + SUPPLY_KINGDOM_PANEL_HEIGHT_PX + SUPPLY_PANEL_GAP_PX,
    };
  });

  // Landscape cards keep the legacy board order.
  readonly landscapes = computed(() => {
    const match = this._match();
    if (!match) {
      return [];
    }

    const selectableCards = new Set(this._selectableCards() ?? []);
    const selectedCards = new Set(this._selectedCards() ?? []);
    const tokens = Object.values(match.tokens ?? {}) as TokenInstance[];
    const playerColorMap = new Map(match.players.map((player) => [player.id, player.color]));

    const results: LandscapeCardViewModel[] = [];
    for (const event of match.events) {
      results.push(this.buildLandscapeModel(event, 'event', selectableCards, selectedCards, tokens, playerColorMap));
    }
    for (const landmark of match.landmarks) {
      results.push(this.buildLandscapeModel(landmark, 'landmark', selectableCards, selectedCards, tokens, playerColorMap));
    }
    for (const project of match.projects) {
      results.push(this.buildLandscapeModel(project, 'project', selectableCards, selectedCards, tokens, playerColorMap));
    }
    for (const way of match.ways) {
      results.push(this.buildLandscapeModel(way, 'way', selectableCards, selectedCards, tokens, playerColorMap));
    }
    for (const prophecy of match.prophecies) {
      results.push(this.buildLandscapeModel(prophecy, 'prophecy', selectableCards, selectedCards, tokens, playerColorMap));
    }

    return results;
  });

  readonly hasLandscapes = computed(() => this.landscapes().length > 0);

  readonly columns = computed(() => {
    const count = this.landscapes().length;
    if (count < 1) {
      return 1;
    }
    return Math.max(1, Math.min(LANDSCAPE_MAX_COLUMNS, count));
  });

  readonly landscapeCardWidthPx = LANDSCAPE_CARD_WIDTH_PX;

  // Handles card-like taps using the shared client lock flow.
  onLandscapeClick(landscape: LandscapeCardViewModel, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (
      !landscape.selectable
      || this._awaitingServerLockRelease()
      || this._promptInteractionLocked()
    ) {
      return;
    }

    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return;
    }

    this.emitCardLikeTapWithLock(selfPlayerId, landscape.id, () => {
      this._socketService.emit('cardLikeTapped', selfPlayerId, landscape.id);
    });
  }

  // Uses the existing detail dialog behavior for landscape art.
  onLandscapeContextMenu(landscape: LandscapeCardViewModel, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    void displayCardDetail({ detailImagePath: landscape.detailImagePath });
  }

  // Reuses standard tap lock semantics for card-like interactions.
  private emitCardLikeTapWithLock(selfPlayerId: PlayerId, cardLikeId: CardLikeId, emitTap: () => void): void {
    awaitingServerLockReleaseStore.set(true);
    const updated = (finishedPlayerId: PlayerId, finishedCardId?: CardId) => {
      if (finishedPlayerId !== selfPlayerId || finishedCardId !== cardLikeId) {
        return;
      }
      this._socketService.off('cardTappedComplete', updated);
      awaitingServerLockReleaseStore.set(false);
    };
    this._socketService.on('cardTappedComplete', updated);
    emitTap();
  }

  private buildLandscapeModel(
    cardLike: CardLike,
    kind: 'event' | 'landmark' | 'project' | 'way' | 'prophecy',
    selectableCards: Set<number>,
    selectedCards: Set<number>,
    tokens: TokenInstance[],
    playerColorMap: Map<number, string>,
  ): LandscapeCardViewModel {
    const showCost = kind === 'event' || kind === 'project';
    const cubeTokens = kind === 'project'
      ? this.buildProjectCubeTokens(cardLike.id, tokens, playerColorMap)
      : [];
    const sinisterBadges = kind === 'project'
      ? this.buildProjectSinisterBadges(cardLike.id, tokens, playerColorMap)
      : [];
    const sunTokenCount = kind === 'prophecy'
      ? this.getSunTokenCount(cardLike.id, tokens)
      : 0;

    return {
      trackKey: `${kind}:${cardLike.cardKey}:${cardLike.id}`,
      id: cardLike.id,
      detailImagePath: cardLike.detailImagePath,
      selectable: selectableCards.has(cardLike.id),
      selected: selectedCards.has(cardLike.id),
      showCost,
      treasureCost: cardLike.cost?.treasure ?? 0,
      potionCost: cardLike.cost?.potion ?? 0,
      debtCost: cardLike.cost?.debt ?? 0,
      cubeTokens,
      sinisterBadges,
      sunTokenCount,
    };
  }

  // Preserves deterministic cube ordering by owner id then token id.
  private buildProjectCubeTokens(
    projectId: CardLikeId,
    tokens: readonly TokenInstance[],
    playerColorMap: Map<number, string>,
  ): ProjectCubeTokenViewModel[] {
    return [...tokens]
      .filter((token) =>
        token.tokenId === CUBE_TOKEN_ID
        && token.location.type === 'cardLike'
        && token.location.cardLikeId === projectId
      )
      .sort((left, right) => {
        const ownerDiff = (left.ownerId ?? -1) - (right.ownerId ?? -1);
        if (ownerDiff !== 0) {
          return ownerDiff;
        }
        return left.id.localeCompare(right.id);
      })
      .map((token) => ({
        id: token.id,
        color: playerColorMap.get(token.ownerId ?? -1) ?? '#ffffff',
      }));
  }

  // Groups Sinister Plot counters by owner to match legacy rendering.
  private buildProjectSinisterBadges(
    projectId: CardLikeId,
    tokens: readonly TokenInstance[],
    playerColorMap: Map<number, string>,
  ): ProjectSinisterBadgeViewModel[] {
    const countsByOwner = new Map<number, number>();
    for (const token of tokens) {
      if (
        token.tokenId !== SINISTER_PLOT_TOKEN_ID
        || token.location.type !== 'cardLike'
        || token.location.cardLikeId !== projectId
        || token.ownerId === undefined
      ) {
        continue;
      }
      countsByOwner.set(token.ownerId, (countsByOwner.get(token.ownerId) ?? 0) + 1);
    }

    return [...countsByOwner.entries()]
      .filter(([, count]) => count > 0)
      .sort((left, right) => left[0] - right[0])
      .map(([ownerId, count]) => ({
        id: `${ownerId}:${count}`,
        color: playerColorMap.get(ownerId) ?? '#ffffff',
        label: `S${count}`,
      }));
  }

  // Matches legacy Sun token behavior where zero/undefined counters still count as one token.
  private getSunTokenCount(
    prophecyId: CardLikeId,
    tokens: readonly TokenInstance[],
  ): number {
    return tokens
      .filter((token) =>
        token.tokenId === SUN_TOKEN_ID
        && token.location.type === 'cardLike'
        && token.location.cardLikeId === prophecyId
      )
      .reduce((total, token) => total + (token.counters && token.counters > 0 ? token.counters : 1), 0);
  }
}
