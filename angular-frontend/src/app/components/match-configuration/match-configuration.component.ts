import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import {
  ArtifactNoId,
  CardNoId,
  EventNoId,
  ExpansionListElement,
  LandmarkNoId,
  MatchConfigurationLoadResult,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  MatchConfiguration,
  PlayerId,
  ProjectNoId,
  SavedMatchConfigurationEntry,
  WayNoId
} from 'shared/types';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { UiDialogComponent } from '../ui/dialog/ui-dialog.component';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { compare } from 'fast-json-patch';

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
    NgStyle,
    UiDialogComponent,
  ],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchConfigurationComponent implements OnDestroy {
  private readonly _nanoStoreService = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _saveNameInput$ = new Subject<string>();

  // Tracks active modal type and settings for a single reusable search dialog.
  readonly activeSelectionModal = signal<SelectionModalState | undefined>(undefined);
  // Controls save-configuration dialog visibility.
  readonly saveDialogVisible = signal(false);
  // Controls load-configuration dialog visibility.
  readonly loadDialogVisible = signal(false);
  // User-provided save name currently entered in save dialog.
  readonly saveDialogName = signal('');
  // Name-check response returned by server for current save dialog input.
  readonly saveNameCheck = signal<MatchConfigurationSaveNameCheckResult | null>(null);
  // Indicates whether the save-name check request is currently in flight.
  readonly saveNameCheckPending = signal(false);
  // Operation feedback shown in save/load dialogs.
  readonly dialogStatusMessage = signal<string | null>(null);
  // Latest saved configuration list returned by server.
  readonly savedConfigurations = signal<SavedMatchConfigurationEntry[]>([]);
  // Currently selected saved configuration key in load dialog.
  readonly selectedLoadConfigurationKey = signal<string | null>(null);
  // Baseline snapshot used to determine if configuration has changed since last save/load baseline.
  readonly configurationSaveBaseline = signal<MatchConfiguration | null>(null);
  // When true, baseline will be refreshed on next matchConfiguration update.
  readonly refreshSaveBaselineOnNextConfigUpdate = signal(false);

  // True when the current configuration differs from the saved baseline snapshot.
  readonly hasConfigurationChanges = computed(() => {
    const baseline = this.configurationSaveBaseline();
    const current = this.matchConfiguration();
    if (!baseline || !current) {
      return false;
    }
    return compare(structuredClone(baseline), structuredClone(current)).length > 0;
  });

  // Save dialog submit state requires valid non-blank name not already taken.
  readonly canSubmitSaveDialog = computed(() => {
    const check = this.saveNameCheck();
    if (!check || !check.isValid || check.exists) {
      return false;
    }
    return this.saveDialogName().trim().length > 0
      && !this.saveNameCheckPending()
      && this.hasConfigurationChanges();
  });

  // True when any manually selected configuration entries can be cleared.
  readonly canClearConfiguration = computed(() => {
    return this.selectedKingdoms().length > 0
      || this.bannedKingdoms().length > 0
      || this.selectedEvents().length > 0
      || this.selectedLandmarks().length > 0
      || this.selectedArtifacts().length > 0
      || this.selectedProjects().length > 0
      || this.selectedWays().length > 0;
  });

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

  // Derived selection lists rendered by each landscape section.
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

  constructor() {
    // Debounce save-name checks so server validation runs only after typing pauses.
    this._saveNameInput$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((name) => {
        const trimmedName = name.trim();
        if (trimmedName.length < 1) {
          this.saveNameCheckPending.set(false);
          this.saveNameCheck.set(null);
          return;
        }
        this.saveNameCheckPending.set(true);
        this._socketService.emit('checkMatchConfigurationSaveName', trimmedName);
      });

    this._socketService.on('matchConfigurationSaveNameChecked', this.onSaveNameChecked);
    this._socketService.on('matchConfigurationSaveCompleted', this.onSaveCompleted);
    this._socketService.on('savedMatchConfigurationList', this.onSavedConfigurationListReceived);
    this._socketService.on('matchConfigurationLoadCompleted', this.onLoadCompleted);

    // Initialize baseline from first loaded configuration, and refresh it after successful loads.
    effect(() => {
      const currentConfig = this.matchConfiguration();
      if (!currentConfig) {
        return;
      }

      if (!this.configurationSaveBaseline()) {
        this.configurationSaveBaseline.set(structuredClone(currentConfig));
        return;
      }

      if (this.refreshSaveBaselineOnNextConfigUpdate()) {
        this.configurationSaveBaseline.set(structuredClone(currentConfig));
        this.refreshSaveBaselineOnNextConfigUpdate.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this._socketService.off('matchConfigurationSaveNameChecked', this.onSaveNameChecked);
    this._socketService.off('matchConfigurationSaveCompleted', this.onSaveCompleted);
    this._socketService.off('savedMatchConfigurationList', this.onSavedConfigurationListReceived);
    this._socketService.off('matchConfigurationLoadCompleted', this.onLoadCompleted);
  }

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

  // Opens the save-configuration dialog and resets previous save feedback.
  openSaveDialog() {
    if (!this.isGameOwner() || !this.hasConfigurationChanges()) return;
    this.saveDialogVisible.set(true);
    this.loadDialogVisible.set(false);
    this.dialogStatusMessage.set(null);
    const existingName = this.saveDialogName().trim();
    if (existingName.length > 0) {
      this.saveNameCheckPending.set(true);
      this._socketService.emit('checkMatchConfigurationSaveName', existingName);
    } else {
      this.saveNameCheck.set(null);
      this.saveNameCheckPending.set(false);
    }
  }

  // Closes the save-configuration dialog.
  closeSaveDialog() {
    this.saveDialogVisible.set(false);
    this.saveNameCheckPending.set(false);
    this.dialogStatusMessage.set(null);
  }

  // Updates save name and triggers debounced server-side availability checks.
  onSaveDialogNameInput(name: string) {
    this.saveDialogName.set(name);
    this.saveNameCheckPending.set(name.trim().length > 0);
    this._saveNameInput$.next(name);
  }

  // Submits the current configuration save request when the name is valid.
  submitSaveDialog() {
    if (!this.canSubmitSaveDialog()) return;
    this.dialogStatusMessage.set(null);
    this._socketService.emit('saveMatchConfiguration', this.saveDialogName().trim());
  }

  // Opens the load-configuration dialog and requests current saved files from server.
  openLoadDialog() {
    if (!this.isGameOwner()) return;
    this.loadDialogVisible.set(true);
    this.saveDialogVisible.set(false);
    this.dialogStatusMessage.set(null);
    this.selectedLoadConfigurationKey.set(null);
    this._socketService.emit('requestSavedMatchConfigurationList');
  }

  // Clears manually selected kingdom and landscape configuration fields.
  clearConfiguration() {
    if (!this.isGameOwner() || !this.canClearConfiguration()) return;
    this.emitMatchConfigurationUpdate({
      bannedKingdoms: [],
      preselectedKingdoms: [],
      basicSupply: [],
      kingdomSupply: [],
      events: [],
      landmarks: [],
      artifacts: [],
      projects: [],
      ways: [],
    });
  }

  // Closes the load-configuration dialog.
  closeLoadDialog() {
    this.loadDialogVisible.set(false);
    this.selectedLoadConfigurationKey.set(null);
    this.dialogStatusMessage.set(null);
  }

  // Updates the selected saved-configuration key for the load dialog.
  selectLoadConfiguration(key: string) {
    this.selectedLoadConfigurationKey.set(key);
  }

  // Loads the currently selected saved configuration.
  submitLoadDialog() {
    const selectedKey = this.selectedLoadConfigurationKey();
    if (!selectedKey) return;
    this.dialogStatusMessage.set(null);
    this._socketService.emit('loadSavedMatchConfiguration', selectedKey);
  }

  // Opens a single shared selection modal configured for the requested selection type.
  openSelectionModal(kind: SelectionModalKind) {
    if (!this.isGameOwner()) return;
    // Refresh searchable catalog on demand so modal results remain valid even after reconnect or late expansion loads.
    this._socketService.emit('requestSelectableSearchCatalog');

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

  // Handles debounced save-name availability responses from server.
  private onSaveNameChecked = (result: MatchConfigurationSaveNameCheckResult) => {
    const currentName = this.saveDialogName().trim();
    if (result.requestedName.trim() !== currentName) {
      return;
    }
    this.saveNameCheckPending.set(false);
    this.saveNameCheck.set(result);
  };

  // Handles save-completion responses from server.
  private onSaveCompleted = (result: MatchConfigurationSaveResult) => {
    if (result.ok) {
      const currentConfig = this.matchConfiguration();
      if (currentConfig) {
        this.configurationSaveBaseline.set(structuredClone(currentConfig));
      }
      this.dialogStatusMessage.set(null);
      this.closeSaveDialog();
      return;
    }
    this.dialogStatusMessage.set(result.message ?? `Failed to save '${result.name}'.`);
  };

  // Handles saved configuration list updates from server.
  private onSavedConfigurationListReceived = (entries: SavedMatchConfigurationEntry[]) => {
    this.savedConfigurations.set([...entries]);
  };

  // Handles load-completion responses from server.
  private onLoadCompleted = (result: MatchConfigurationLoadResult) => {
    if (result.ok) {
      this.refreshSaveBaselineOnNextConfigUpdate.set(true);
      this.dialogStatusMessage.set(null);
      this.closeLoadDialog();
      return;
    }
    this.dialogStatusMessage.set(result.message ?? `Failed to load '${result.key}'.`);
  };

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

  // Returns a stable sorted copy of landscape entries keyed by cardKey.
  private sortByCardKey<T extends { cardKey: string }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => a.cardKey.localeCompare(b.cardKey));
  }

  // Pads selected kingdoms to exactly 10 entries for fixed slot rendering.
  private withKingdomPlaceholders(kingdoms: CardNoId[]): (CardNoId | null)[] {
    const placeholders = new Array(Math.max(0, 10 - kingdoms.length)).fill(null);
    return [...kingdoms, ...placeholders];
  }

  // Appends one empty add-slot for landscape section rendering.
  private withTrailingEmptySlot<T>(items: T[]): (T | null)[] {
    return [...items, null];
  }
}
