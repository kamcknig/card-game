import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ArtifactNoId,
  CardNoId,
  EventNoId,
  ExpansionListElement,
  LandmarkNoId,
  MatchConfiguration,
  PlayerId,
  ProjectNoId,
  WayNoId
} from 'shared/types';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, selfPlayerIdStore } from '../../state/player-state';
import { NgClass, NgOptimizedImage, NgStyle } from '@angular/common';
import { expansionListStore } from '../../state/expansion-list-state';
import { matchConfigurationStore } from '../../state/match-state';
import { SocketService } from '../../core/socket-service/socket.service';
import { gameOwnerIdStore, sceneStore } from '../../state/game-state';
import {
  activeLobbyGameIdStore,
  lobbyGamesStore,
  lobbyStatusMessageStore
} from '../../state/lobby-state';
import { PlayerComponent } from './player-name-input/player-name-input.component';
import {
  SearchCatalogKind,
  SelectCardLikeModalComponent,
  SelectableSearchResult
} from './select-card-like-modal/select-card-like-modal.component';
import { SceneContentComponent } from '../scene-content/scene-content.component';

type SelectionModalKind = 'bannedKingdom' | 'kingdom' | 'events' | 'landmarks' | 'artifacts' | 'projects' | 'ways';
type SelectionModalState = {
  kind: SelectionModalKind;
  excludedItems: ({ cardKey: string; } | null)[];
  catalogKind: SearchCatalogKind;
  imageSize: 'half' | 'full';
  filterBasicCards: boolean;
};

@Component({
  selector: 'app-match-configuration',
  imports: [
    NgOptimizedImage,
    NgClass,
    PlayerComponent,
    SelectCardLikeModalComponent,
    SceneContentComponent,
    NgStyle
  ],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchConfigurationComponent {
  private readonly _nanoStoreService = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);

  // Tracks active modal type and settings for a single reusable search dialog.
  readonly activeSelectionModal = signal<SelectionModalState | undefined>(undefined);

  // Store-backed signals for template state.
  readonly playerIds = toSignal(this._nanoStoreService.useStore(playerIdStore), {
    initialValue: playerIdStore.get()
  });
  readonly expansionList = toSignal(this._nanoStoreService.useStore(expansionListStore), {
    initialValue: expansionListStore.get()
  });
  readonly matchConfiguration = toSignal(this._nanoStoreService.useStore(matchConfigurationStore), {
    initialValue: matchConfigurationStore.get()
  });
  readonly activeLobbyGameId = toSignal(this._nanoStoreService.useStore(activeLobbyGameIdStore), {
    initialValue: activeLobbyGameIdStore.get()
  });
  private readonly _lobbyGames = toSignal(this._nanoStoreService.useStore(lobbyGamesStore), {
    initialValue: lobbyGamesStore.get()
  });
  private readonly _gameOwnerId = toSignal(this._nanoStoreService.useStore(gameOwnerIdStore), {
    initialValue: gameOwnerIdStore.get()
  });
  private readonly _selfPlayerId = toSignal(this._nanoStoreService.useStore(selfPlayerIdStore), {
    initialValue: selfPlayerIdStore.get()
  });

  // Derived state for ownership, game title, and expansion selection.
  readonly isGameOwner = computed(() => this._selfPlayerId() === this._gameOwnerId());
  readonly playerCount = computed(() => this.playerIds().length);
  readonly activeGameName = computed(() => {
    const activeGameId = this.activeLobbyGameId();
    if (!activeGameId) return undefined;
    return this._lobbyGames().find((game) => game.gameId === activeGameId)?.gameName ?? activeGameId;
  });
  readonly selectedExpansions = computed(() => this.matchConfiguration()?.expansions?.map((expansion) => expansion.name) ?? []);
  readonly selectedExpansionLookup = computed<Record<string, true>>(() => {
    const lookup: Record<string, true> = {};
    for (const expansionName of this.selectedExpansions()) {
      lookup[expansionName] = true;
    }
    return lookup;
  });

  // Derived selection lists rendered by each card-like section.
  readonly selectedKingdoms = computed(() => this.sortByCardKey(this.matchConfiguration()?.preselectedKingdoms ?? []));
  readonly bannedKingdoms = computed(() => this.sortByCardKey(this.matchConfiguration()?.bannedKingdoms ?? []));
  readonly selectedEvents = computed(() => this.sortByCardKey(this.matchConfiguration()?.events ?? []));
  readonly selectedLandmarks = computed(() => this.sortByCardKey(this.matchConfiguration()?.landmarks ?? []));
  readonly selectedArtifacts = computed(() => this.sortByCardKey(this.matchConfiguration()?.artifacts ?? []));
  readonly selectedProjects = computed(() => this.sortByCardKey(this.matchConfiguration()?.projects ?? []));
  readonly selectedWays = computed(() => this.sortByCardKey(this.matchConfiguration()?.ways ?? []));

  // UI lists that include trailing empty slots for add-buttons.
  readonly preSelectedKingdoms = computed(() => this.withKingdomPlaceholders(this.selectedKingdoms()));
  readonly preSelectedEvents = computed(() => this.withTrailingEmptySlot(this.selectedEvents()));
  readonly preSelectedLandmarks = computed(() => this.withTrailingEmptySlot(this.selectedLandmarks()));
  readonly preSelectedArtifacts = computed(() => this.withTrailingEmptySlot(this.selectedArtifacts()));
  readonly preSelectedProjects = computed(() => this.withTrailingEmptySlot(this.selectedProjects()));
  readonly preSelectedWays = computed(() => this.withTrailingEmptySlot(this.selectedWays()));

  // Banned-card stack height grows with card count for staggered overlap.
  readonly bannedKingdomStackHeight = computed(() => {
    const count = this.bannedKingdoms().length;
    return count > 0 ? 122 + ((count - 1) * 25) : 122;
  });

  // Toggles expansion selection in match configuration.
  onToggleExpansion(expansion: ExpansionListElement) {
    if (!this.isGameOwner()) return;
    const currentConfig = this.matchConfiguration();
    if (!currentConfig) return;

    const currentExpansions = [...(currentConfig.expansions ?? [])];
    const currentIdx = currentExpansions.findIndex((entry) => entry.name === expansion.name);
    if (currentIdx === -1) {
      currentExpansions.push(expansion);
    } else {
      currentExpansions.splice(currentIdx, 1);
    }

    this.emitMatchConfigurationUpdate({ expansions: currentExpansions });
  }

  // Adds a single computer player to the lobby.
  addComputerPlayer() {
    if (!this.isGameOwner()) return;
    this._socketService.emit('addComputerPlayer', 1);
  }

  // Leaves the active lobby game and returns to the lobby screen.
  leaveGame(gameId: string) {
    activeLobbyGameIdStore.set(undefined);
    lobbyStatusMessageStore.set(undefined);
    sceneStore.set('lobby');
    this._socketService.emit('leaveLobbyGame', gameId);
  }

  // Opens a single shared selection modal configured for the requested selection type.
  openSelectionModal(kind: SelectionModalKind) {
    if (!this.isGameOwner()) return;

    switch (kind) {
      case 'bannedKingdom':
        this.activeSelectionModal.set({
          kind,
          excludedItems: [...this.preSelectedKingdoms(), ...this.bannedKingdoms()],
          catalogKind: 'cards',
          imageSize: 'half',
          filterBasicCards: true,
        });
        return;
      case 'kingdom':
        this.activeSelectionModal.set({
          kind,
          excludedItems: [...this.preSelectedKingdoms(), ...this.bannedKingdoms()],
          catalogKind: 'cards',
          imageSize: 'half',
          filterBasicCards: true,
        });
        return;
      case 'events':
        this.activeSelectionModal.set({
          kind,
          excludedItems: this.preSelectedEvents(),
          catalogKind: 'events',
          imageSize: 'full',
          filterBasicCards: false,
        });
        return;
      case 'landmarks':
        this.activeSelectionModal.set({
          kind,
          excludedItems: this.preSelectedLandmarks(),
          catalogKind: 'landmarks',
          imageSize: 'full',
          filterBasicCards: false,
        });
        return;
      case 'artifacts':
        this.activeSelectionModal.set({
          kind,
          excludedItems: this.preSelectedArtifacts(),
          catalogKind: 'artifacts',
          imageSize: 'full',
          filterBasicCards: false,
        });
        return;
      case 'projects':
        this.activeSelectionModal.set({
          kind,
          excludedItems: this.preSelectedProjects(),
          catalogKind: 'projects',
          imageSize: 'full',
          filterBasicCards: false,
        });
        return;
      case 'ways':
        this.activeSelectionModal.set({
          kind,
          excludedItems: this.preSelectedWays(),
          catalogKind: 'ways',
          imageSize: 'full',
          filterBasicCards: false,
        });
        return;
    }
  }

  // Closes the active selection modal.
  closeSelectionModal() {
    this.activeSelectionModal.set(undefined);
  }

  // Routes selected modal item to the matching configuration handler.
  onSelectionModalItemSelected(item: SelectableSearchResult) {
    const modalKind = this.activeSelectionModal()?.kind;
    if (!modalKind) return;

    switch (modalKind) {
      case 'bannedKingdom':
        this.onBannedKingdomSelected(item as CardNoId);
        break;
      case 'kingdom':
        this.onKingdomSelected(item as CardNoId);
        break;
      case 'events':
        this.onEventSelected(item as EventNoId);
        break;
      case 'landmarks':
        this.onLandmarkSelected(item as LandmarkNoId);
        break;
      case 'artifacts':
        this.onArtifactSelected(item as ArtifactNoId);
        break;
      case 'projects':
        this.onProjectSelected(item as ProjectNoId);
        break;
      case 'ways':
        this.onWaySelected(item as WayNoId);
        break;
    }

    this.closeSelectionModal();
  }

  // Removes one selected kingdom card from the fixed kingdom list.
  deleteKingdom(kingdom: CardNoId) {
    if (!this.isGameOwner()) return;
    const kingdoms = this.selectedKingdoms().filter((entry) => entry.cardKey !== kingdom.cardKey);
    this.updateKingdomSelections(kingdoms);
  }

  // Removes a selected event from the fixed event list.
  deleteEvent(event: EventNoId) {
    if (!this.isGameOwner()) return;
    const remainingEvents = this.selectedEvents().filter((entry) => entry.cardKey !== event.cardKey);
    this.emitMatchConfigurationUpdate({ events: remainingEvents });
  }

  // Removes a selected landmark from the fixed landmark list.
  deleteLandmark(landmark: LandmarkNoId) {
    if (!this.isGameOwner()) return;
    const remainingLandmarks = this.selectedLandmarks().filter((entry) => entry.cardKey !== landmark.cardKey);
    this.emitMatchConfigurationUpdate({ landmarks: remainingLandmarks });
  }

  // Removes a selected artifact from the fixed artifact list.
  deleteArtifact(artifact: ArtifactNoId) {
    if (!this.isGameOwner()) return;
    const remainingArtifacts = this.selectedArtifacts().filter((entry) => entry.cardKey !== artifact.cardKey);
    this.emitMatchConfigurationUpdate({ artifacts: remainingArtifacts });
  }

  // Removes a selected project from the fixed project list.
  deleteProject(project: ProjectNoId) {
    if (!this.isGameOwner()) return;
    const remainingProjects = this.selectedProjects().filter((entry) => entry.cardKey !== project.cardKey);
    this.emitMatchConfigurationUpdate({ projects: remainingProjects });
  }

  // Removes a selected way from the fixed way list.
  deleteWay(way: WayNoId) {
    if (!this.isGameOwner()) return;
    const remainingWays = this.selectedWays().filter((entry) => entry.cardKey !== way.cardKey);
    this.emitMatchConfigurationUpdate({ ways: remainingWays });
  }

  // Adds one kingdom card selected from the search modal.
  onKingdomSelected(selectedCard: CardNoId) {
    if (!this.isGameOwner()) return;
    const kingdoms = [...this.selectedKingdoms(), selectedCard];
    this.updateKingdomSelections(kingdoms);
  }

  // Adds one event selected from the search modal.
  onEventSelected(selectedEvent: EventNoId) {
    if (!this.isGameOwner()) return;
    const selectedEvents = [...this.selectedEvents(), selectedEvent];
    this.emitMatchConfigurationUpdate({ events: this.sortByCardKey(selectedEvents) });
  }

  // Adds one landmark selected from the search modal.
  onLandmarkSelected(selectedLandmark: LandmarkNoId) {
    if (!this.isGameOwner()) return;
    const selectedLandmarks = [...this.selectedLandmarks(), selectedLandmark];
    this.emitMatchConfigurationUpdate({ landmarks: this.sortByCardKey(selectedLandmarks) });
  }

  // Adds one artifact selected from the search modal.
  onArtifactSelected(selectedArtifact: ArtifactNoId) {
    if (!this.isGameOwner()) return;
    const selectedArtifacts = [...this.selectedArtifacts(), selectedArtifact];
    this.emitMatchConfigurationUpdate({ artifacts: this.sortByCardKey(selectedArtifacts) });
  }

  // Adds one project selected from the search modal.
  onProjectSelected(selectedProject: ProjectNoId) {
    if (!this.isGameOwner()) return;
    const selectedProjects = [...this.selectedProjects(), selectedProject];
    this.emitMatchConfigurationUpdate({ projects: this.sortByCardKey(selectedProjects) });
  }

  // Adds one way selected from the search modal.
  onWaySelected(selectedWay: WayNoId) {
    if (!this.isGameOwner()) return;
    const selectedWays = [...this.selectedWays(), selectedWay];
    this.emitMatchConfigurationUpdate({ ways: this.sortByCardKey(selectedWays) });
  }

  // Adds one banned kingdom card if it is not already banned.
  onBannedKingdomSelected(selectedCard: CardNoId) {
    if (!this.isGameOwner()) return;
    const currentBanned = this.bannedKingdoms();
    const exists = currentBanned.some((entry) => entry.cardKey === selectedCard.cardKey);
    if (exists) return;

    this.emitMatchConfigurationUpdate({ bannedKingdoms: this.sortByCardKey([...currentBanned, selectedCard]) });
  }

  // Removes one kingdom card from the banned list.
  deleteBannedKingdom(bannedCard: CardNoId) {
    if (!this.isGameOwner()) return;
    const updatedBanned = this.bannedKingdoms().filter((card) => card.cardKey !== bannedCard.cardKey);
    this.emitMatchConfigurationUpdate({ bannedKingdoms: this.sortByCardKey(updatedBanned) });
  }

  // Emits a match-configuration patch while preserving untouched fields.
  private emitMatchConfigurationUpdate(updatedFields: Partial<MatchConfiguration>) {
    const currentConfig = this.matchConfiguration();
    if (!currentConfig) return;

    this._socketService.emit('matchConfigurationUpdated', {
      ...currentConfig,
      ...updatedFields,
    });
  }

  // Applies selected kingdoms and recomputes basic/kingdom supply fields.
  private updateKingdomSelections(kingdoms: CardNoId[]) {
    const sortedKingdoms = this.sortByCardKey(kingdoms).slice(0, 10);
    const { basicSupply, kingdomSupply } = this.buildSupplyFromKingdoms(sortedKingdoms);

    this.emitMatchConfigurationUpdate({
      preselectedKingdoms: sortedKingdoms,
      basicSupply,
      kingdomSupply,
    });
  }

  // Splits selected kingdoms into basic and non-basic piles for setup.
  private buildSupplyFromKingdoms(kingdoms: CardNoId[]) {
    const basicSupply = kingdoms
      .filter((card) => card.isBasic)
      .map((card) => ({ name: card.cardKey, cards: [card] }));

    const kingdomSupply = kingdoms
      .filter((card) => !card.isBasic)
      .map((card) => ({ name: card.cardKey, cards: [card] }));

    return { basicSupply, kingdomSupply };
  }

  // Returns a stable sorted copy of card-like entries keyed by cardKey.
  private sortByCardKey<T extends { cardKey: string }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => a.cardKey.localeCompare(b.cardKey));
  }

  // Pads selected kingdoms to exactly 10 entries for fixed slot rendering.
  private withKingdomPlaceholders(kingdoms: CardNoId[]): (CardNoId | null)[] {
    const placeholders = new Array(Math.max(0, 10 - kingdoms.length)).fill(null);
    return [...kingdoms, ...placeholders];
  }

  // Appends one empty add-slot for card-like section rendering.
  private withTrailingEmptySlot<T>(items: T[]): (T | null)[] {
    return [...items, null];
  }
}
