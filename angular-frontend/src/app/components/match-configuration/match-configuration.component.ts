import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import {
  AllyNoId,
  CardNoId,
  EventNoId,
  ExpansionListElement,
  LandmarkNoId,
  MatchConfigurationDeleteResult,
  MatchConfigurationLoadResult,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  MatchConfiguration,
  ProphecyNoId,
  ProjectNoId,
  SavedMatchConfigurationEntry,
  TraitNoId,
  WayNoId
} from 'shared/types';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, selfPlayerIdStore } from '../../state/player-state';
import { NgClass, NgOptimizedImage, NgStyle } from '@angular/common';
import { expansionListStore } from '../../state/expansion-list-state';
import { matchConfigurationStore, matchStartedStore } from '../../state/match-state';
import { SocketService } from '../../core/socket-service/socket.service';
import { gameOwnerIdStore } from '../../state/game-state';
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
import { FolderOpen, LogOut, LucideAngularModule, Save, Search, Trash2, X } from 'lucide-angular';
import Fuse from 'fuse.js';
import { displayCardDetail } from '../match/views/modal/display-card-detail';
import { CardComponent } from '../card/card.component';
import { CardLikeComponent } from '../card-like/card-like.component';

type SelectionModalKind =
  | 'bannedKingdom'
  | 'kingdom'
  | 'events'
  | 'landmarks'
  | 'projects'
  | 'ways'
  | 'traits'
  | 'allies'
  | 'prophecies';
type SelectionModalState = {
  kind: SelectionModalKind;
  /** Card keys pre-selected when the modal opens (current configuration state). */
  initialSelectionKeys: string[];
  catalogKind: SearchCatalogKind;
  imageSize: 'half' | 'full';
  filterBasicCards: boolean;
  /** Maximum number of cards the user may select; Infinity for no limit. */
  maxSelections: number;
  /** Display title shown in the modal header. */
  title: string;
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
    LucideAngularModule,
    CardComponent,
    CardLikeComponent,
  ],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchConfigurationComponent implements OnDestroy {
  // Lucide icon references for header action buttons.
  readonly SaveIcon = Save;
  readonly LoadIcon = FolderOpen;
  readonly ClearIcon = Trash2;
  readonly LeaveIcon = LogOut;
  // Per-slot remove affordance shown on hover over a chosen card.
  readonly RemoveIcon = X;
  // Lucide icon used in the load-dialog search input.
  readonly SearchIcon = Search;

  private readonly _router = inject(Router);
  private readonly _nanoStoreService = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _saveNameInput$ = new Subject<string>();
  @ViewChild('saveDialogNameInput') private readonly _saveDialogNameInput?: ElementRef<HTMLInputElement>;

  // When true, expansion names render below their icons in the expansion list.
  readonly showExpansionNames = signal(false);

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
  // Raw search term entered in the load-configuration dialog. Drives the
  // filtered list and the visibility of the clear button. Cleared whenever
  // the dialog is opened or closed.
  readonly loadDialogSearchTerm = signal('');

  // Fuse index over the current saved-configuration list. Rebuilt only when
  // the underlying list changes (server push after save/delete/initial fetch).
  // `threshold` is loosened from Fuse's default 0.6 → 0.4 for a typical
  // type-as-you-go filtering UX, and `ignoreLocation` is enabled so a match
  // can occur anywhere in the entry name.
  private readonly _loadConfigurationsFuse = computed(() => new Fuse(
    this.savedConfigurations(),
    {
      keys: ['name'],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 1,
    },
  ));

  // Filtered saved configuration list driven by the load-dialog search term.
  // When the term is empty, returns the full list unchanged so the dialog
  // still shows everything before the user types.
  readonly filteredSavedConfigurations = computed(() => {
    const term = this.loadDialogSearchTerm().trim();
    if (term.length < 1) {
      return this.savedConfigurations();
    }
    return this._loadConfigurationsFuse().search(term).map((result) => result.item);
  });
  // Last successfully loaded on-disk configuration display name for save-dialog defaults.
  readonly loadedConfigurationName = signal<string | null>(null);
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

  // Save dialog submit state requires a valid non-blank name.
  readonly canSubmitSaveDialog = computed(() => {
    const check = this.saveNameCheck();
    if (!check || !check.isValid) {
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
      || this.selectedProjects().length > 0
      || this.selectedWays().length > 0
      || this.selectedTraits().length > 0
      || (this.matchConfiguration()?.allies?.length ?? 0) > 0
      || (this.matchConfiguration()?.prophecies?.length ?? 0) > 0;
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
  // True when expansion selection currently includes one or more entries.
  readonly canSelectNoExpansions = computed(() => {
    if (!this.isGameOwner()) {
      return false;
    }
    return (this.matchConfiguration()?.expansions?.length ?? 0) > 0;
  });
  // True when at least one available expansion is not currently selected.
  readonly canSelectAllExpansions = computed(() => {
    if (!this.isGameOwner()) {
      return false;
    }
    const expansionItems = this.expansionList();
    if (expansionItems.length < 1) {
      return false;
    }
    const selectedLookup = this.selectedExpansionLookup();
    return expansionItems.some((expansion) => selectedLookup[expansion.name] !== true);
  });

  // Derived selection lists rendered by each landscape section.
  readonly selectedKingdoms = computed(() => this.sortByCardKey(this.matchConfiguration()?.preselectedKingdoms ?? []));
  readonly bannedKingdoms = computed(() => this.sortByCardKey(this.matchConfiguration()?.bannedKingdoms ?? []));
  readonly selectedEvents = computed(() => this.sortByCardKey(this.matchConfiguration()?.events ?? []));
  readonly selectedLandmarks = computed(() => this.sortByCardKey(this.matchConfiguration()?.landmarks ?? []));
  readonly selectedProjects = computed(() => this.sortByCardKey(this.matchConfiguration()?.projects ?? []));
  readonly selectedWays = computed(() => this.sortByCardKey(this.matchConfiguration()?.ways ?? []));
  readonly selectedTraits = computed(() => this.sortByCardKey(this.matchConfiguration()?.traits ?? []));
  // Allies are capped to one preselected card in UI.
  readonly selectedAllies = computed(() => this.sortByCardKey(this.matchConfiguration()?.allies ?? []).slice(0, 1));
  // Prophecies are capped to one preselected card in UI.
  readonly selectedProphecies = computed(() =>
    this.sortByCardKey(this.matchConfiguration()?.prophecies ?? []).slice(0, 1)
  );
  // Determines if the currently selected kingdom includes at least one Liaison card.
  readonly hasSelectedLiaisonKingdom = computed(() =>
    this.selectedKingdoms().some((card) => card.type.includes('LIAISON'))
  );
  // Determines if the currently selected kingdom includes at least one Omen card.
  readonly hasSelectedOmenKingdom = computed(() =>
    this.selectedKingdoms().some((card) => card.type.includes('OMEN'))
  );
  // Ally add slot is only interactive when Liaison is selected and no ally is currently preselected.
  readonly canAddAlly = computed(() => this.hasSelectedLiaisonKingdom() && this.selectedAllies().length < 1);
  // Prophecy add slot is only interactive when Omen is selected and no prophecy is currently preselected.
  readonly canAddProphecy = computed(() => this.hasSelectedOmenKingdom() && this.selectedProphecies().length < 1);
  // Shows users why ally selection is locked.
  readonly allySelectionDisabledReason = computed(() =>
    this.hasSelectedLiaisonKingdom() ? null : 'Select at least one Liaison kingdom card to add an Ally.'
  );
  // Shows users why prophecy selection is locked.
  readonly prophecySelectionDisabledReason = computed(() =>
    this.hasSelectedOmenKingdom() ? null : 'Select at least one Omen kingdom card to add a Prophecy.'
  );

  // UI lists that include trailing empty slots for add-buttons.
  readonly preSelectedKingdoms = computed(() => this.withKingdomPlaceholders(this.selectedKingdoms()));
  readonly preSelectedEvents = computed(() => this.withTrailingEmptySlot(this.selectedEvents()));
  readonly preSelectedLandmarks = computed(() => this.withTrailingEmptySlot(this.selectedLandmarks()));
  readonly preSelectedProjects = computed(() => this.withTrailingEmptySlot(this.selectedProjects()));
  readonly preSelectedWays = computed(() => this.withTrailingEmptySlot(this.selectedWays()));
  readonly preSelectedTraits = computed(() => this.withTrailingEmptySlot(this.selectedTraits()));
  readonly preSelectedAllies = computed(() => this.withTrailingEmptySlot(this.selectedAllies()));
  readonly preSelectedProphecies = computed(() => this.withTrailingEmptySlot(this.selectedProphecies()));

  // Banned-card stack height grows with card count for staggered overlap.
  // Tracks the half-size card height and the stagger step from
  // .banned-card-item in SCSS so the wrapper container is tall enough to
  // contain the fanned stack.
  private static readonly BANNED_CARD_HEIGHT_PX = 150;
  private static readonly BANNED_CARD_STAGGER_PX = 32;
  readonly bannedKingdomStackHeight = computed(() => {
    const count = this.bannedKingdoms().length;
    if (count < 1) return MatchConfigurationComponent.BANNED_CARD_HEIGHT_PX;
    return MatchConfigurationComponent.BANNED_CARD_HEIGHT_PX
      + (count - 1) * MatchConfigurationComponent.BANNED_CARD_STAGGER_PX;
  });

  // Set to true when matchReady is received during this component's lifetime.
  // Used by ngOnDestroy to skip the auto-leave emit on the /configuration → /match
  // transition, since the user is not leaving the game — the match is starting.
  private _matchStarting = false;

  // Bound handler reference for matchReady so it can be unregistered in ngOnDestroy.
  private readonly _onMatchReady = () => {
    this._matchStarting = true;
  };

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
    this._socketService.on('matchConfigurationDeleteCompleted', this.onDeleteCompleted);

    // matchReady fires immediately before the router navigates from /configuration
    // to /match. Latch the flag so ngOnDestroy knows not to auto-emit leaveLobbyGame
    // on that transition (the user is starting a match, not leaving the game).
    this._socketService.on('matchReady', this._onMatchReady);

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
    this._socketService.off('matchConfigurationDeleteCompleted', this.onDeleteCompleted);
    this._socketService.off('matchReady', this._onMatchReady);

    // Skip the auto-leave when transitioning into /match — the user is not
    // leaving the game, the match is starting. Without this gate every
    // configuration → match navigation would call leaveLobbyGame because
    // activeLobbyGameIdStore now stays set throughout the match phase (Phase 2).
    if (this._matchStarting) {
      return;
    }

    // If the user navigated away without explicitly clicking "Leave Game", emit
    // the leave event now. leaveGame() clears the store before navigating, so
    // this branch is skipped when that path is taken (no double-emit).
    const activeGameId = activeLobbyGameIdStore.get();
    if (activeGameId) {
      // During an active match the user may navigate back to /configuration via
      // browser history — that is not a deliberate leave action. Skip the
      // auto-leave so the store is preserved and the leftMatch/enteredMatch flow
      // from MatchComponent continues to work correctly.
      if (matchStartedStore.get()) {
        return;
      }
      activeLobbyGameIdStore.set(undefined);
      lobbyStatusMessageStore.set(undefined);
      this._socketService.emit('leaveLobbyGame', activeGameId);
    }
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

  // Selects all expansions currently available in the expansion list.
  onSelectAllExpansions() {
    if (!this.isGameOwner()) return;
    const currentConfig = this.matchConfiguration();
    if (!currentConfig) return;

    this.emitMatchConfigurationUpdate({ expansions: [...this.expansionList()] });
  }

  // Clears all selected expansions from match configuration.
  onSelectNoExpansions() {
    if (!this.isGameOwner()) return;
    const currentConfig = this.matchConfiguration();
    if (!currentConfig) return;

    this.emitMatchConfigurationUpdate({ expansions: [] });
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
    void this._router.navigate(['/lobby']);
    this._socketService.emit('leaveLobbyGame', gameId);
  }

  // Opens the save-configuration dialog and resets previous save feedback.
  openSaveDialog() {
    if (!this.isGameOwner() || !this.hasConfigurationChanges()) return;
    this.saveDialogVisible.set(true);
    // Dialog input is conditionally rendered, so focus it on the next task after visibility flips.
    setTimeout(() => this._saveDialogNameInput?.nativeElement.focus(), 0);
    this.loadDialogVisible.set(false);
    this.dialogStatusMessage.set(null);
    const loadedName = this.loadedConfigurationName()?.trim() ?? '';
    if (loadedName.length > 0) {
      this.saveDialogName.set(loadedName);
    }
    const defaultName = this.saveDialogName().trim();
    if (defaultName.length > 0) {
      this.saveNameCheckPending.set(true);
      this._socketService.emit('checkMatchConfigurationSaveName', defaultName);
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
    this.loadDialogSearchTerm.set('');
    this._socketService.emit('requestSavedMatchConfigurationList');
  }

  // Clears manually selected kingdom and landscape configuration fields.
  // Also forgets which saved configuration was loaded — once the contents
  // are wiped, it would be misleading to keep prefilling the save name or
  // showing the loaded label in the header.
  clearConfiguration() {
    if (!this.isGameOwner() || !this.canClearConfiguration()) return;
    this.emitMatchConfigurationUpdate({
      bannedKingdoms: [],
      preselectedKingdoms: [],
      basicSupply: [],
      kingdomSupply: [],
      events: [],
      landmarks: [],
      projects: [],
      ways: [],
      traits: [],
      allies: [],
      prophecies: [],
    });
    this.loadedConfigurationName.set(null);
  }

  // Closes the load-configuration dialog.
  closeLoadDialog() {
    this.loadDialogVisible.set(false);
    this.selectedLoadConfigurationKey.set(null);
    this.dialogStatusMessage.set(null);
    this.loadDialogSearchTerm.set('');
  }

  // Loads one saved configuration directly from its list entry click.
  loadSavedConfiguration(key: string) {
    if (!this.isGameOwner()) return;
    this.selectedLoadConfigurationKey.set(key);
    this.dialogStatusMessage.set(null);
    this._socketService.emit('loadSavedMatchConfiguration', key);
  }

  // Updates the load-dialog search term from raw input events.
  updateLoadDialogSearchTerm(term: string) {
    this.loadDialogSearchTerm.set(term);
  }

  // Clears the load-dialog search term, restoring the full saved list.
  clearLoadDialogSearch() {
    this.loadDialogSearchTerm.set('');
  }

  // Deletes a saved configuration entry from the load dialog list.
  deleteSavedConfiguration(key: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isGameOwner()) return;
    this.dialogStatusMessage.set(null);
    if (this.selectedLoadConfigurationKey() === key) {
      this.selectedLoadConfigurationKey.set(null);
    }
    this._socketService.emit('deleteSavedMatchConfiguration', key);
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
          initialSelectionKeys: this.bannedKingdoms().map((c) => c.cardKey),
          catalogKind: 'cards',
          imageSize: 'half',
          filterBasicCards: true,
          maxSelections: Infinity,
          title: 'Banned Cards',
        });
        return;
      case 'kingdom':
        this.activeSelectionModal.set({
          kind,
          initialSelectionKeys: this.selectedKingdoms().map((c) => c.cardKey),
          catalogKind: 'cards',
          imageSize: 'half',
          filterBasicCards: true,
          maxSelections: 10,
          title: 'Kingdom Cards',
        });
        return;
      case 'events':
        this.activeSelectionModal.set({
          kind,
          initialSelectionKeys: this.selectedEvents().map((e) => e.cardKey),
          catalogKind: 'events',
          imageSize: 'full',
          filterBasicCards: false,
          maxSelections: Infinity,
          title: 'Events',
        });
        return;
      case 'landmarks':
        this.activeSelectionModal.set({
          kind,
          initialSelectionKeys: this.selectedLandmarks().map((l) => l.cardKey),
          catalogKind: 'landmarks',
          imageSize: 'full',
          filterBasicCards: false,
          maxSelections: Infinity,
          title: 'Landmarks',
        });
        return;
      case 'projects':
        this.activeSelectionModal.set({
          kind,
          initialSelectionKeys: this.selectedProjects().map((p) => p.cardKey),
          catalogKind: 'projects',
          imageSize: 'full',
          filterBasicCards: false,
          maxSelections: Infinity,
          title: 'Projects',
        });
        return;
      case 'ways':
        this.activeSelectionModal.set({
          kind,
          initialSelectionKeys: this.selectedWays().map((w) => w.cardKey),
          catalogKind: 'ways',
          imageSize: 'full',
          filterBasicCards: false,
          maxSelections: Infinity,
          title: 'Ways',
        });
        return;
      case 'allies':
        if (!this.canAddAlly()) {
          return;
        }
        this.activeSelectionModal.set({
          kind,
          initialSelectionKeys: this.selectedAllies().map((a) => a.cardKey),
          catalogKind: 'allies',
          imageSize: 'full',
          filterBasicCards: false,
          maxSelections: 1,
          title: 'Allies',
        });
        return;
      case 'traits':
        this.activeSelectionModal.set({
          kind,
          initialSelectionKeys: this.selectedTraits().map((t) => t.cardKey),
          catalogKind: 'traits',
          imageSize: 'full',
          filterBasicCards: false,
          maxSelections: Infinity,
          title: 'Traits',
        });
        return;
      case 'prophecies':
        if (!this.canAddProphecy()) {
          return;
        }
        this.activeSelectionModal.set({
          kind,
          initialSelectionKeys: this.selectedProphecies().map((p) => p.cardKey),
          catalogKind: 'prophecies',
          imageSize: 'full',
          filterBasicCards: false,
          maxSelections: 1,
          title: 'Prophecies',
        });
        return;
    }
  }

  // Closes the active selection modal.
  closeSelectionModal() {
    this.activeSelectionModal.set(undefined);
  }

  // Routes the confirmed multi-selection to the matching configuration handler and closes.
  onSelectionModalConfirmed(items: SelectableSearchResult[]) {
    const modalKind = this.activeSelectionModal()?.kind;
    if (!modalKind) return;

    switch (modalKind) {
      case 'bannedKingdom':
        this.emitMatchConfigurationUpdate({
          bannedKingdoms: this.sortByCardKey(items as CardNoId[]),
        });
        break;
      case 'kingdom':
        this.updateKingdomSelections(items as CardNoId[]);
        break;
      case 'events':
        this.emitMatchConfigurationUpdate({
          events: this.sortByCardKey(items as EventNoId[]),
        });
        break;
      case 'landmarks':
        this.emitMatchConfigurationUpdate({
          landmarks: this.sortByCardKey(items as LandmarkNoId[]),
        });
        break;
      case 'projects':
        this.emitMatchConfigurationUpdate({
          projects: this.sortByCardKey(items as ProjectNoId[]),
        });
        break;
      case 'ways':
        this.emitMatchConfigurationUpdate({
          ways: this.sortByCardKey(items as WayNoId[]),
        });
        break;
      case 'allies':
        if (!this.canAddAlly()) break;
        this.emitMatchConfigurationUpdate({ allies: items as AllyNoId[] });
        break;
      case 'traits':
        this.emitMatchConfigurationUpdate({
          traits: this.sortByCardKey(items as TraitNoId[]),
        });
        break;
      case 'prophecies':
        if (!this.canAddProphecy()) break;
        this.emitMatchConfigurationUpdate({ prophecies: items as ProphecyNoId[] });
        break;
    }

    this.closeSelectionModal();
  }

  // Right-click on a chosen slot — surface the full-screen detail view for
  // the card if one is selected. Suppresses the browser's native context
  // menu so the gesture is reserved for the in-app action; empty slots and
  // missing detail paths are no-ops so the right-click on a "?" placeholder
  // simply prevents the default menu without opening anything.
  onSlotContextMenu(event: MouseEvent, detailImagePath: string | null | undefined): void {
    event.preventDefault();
    if (!detailImagePath) {
      return;
    }
    void displayCardDetail({ detailImagePath });
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

  // Removes a selected trait from the fixed trait list.
  deleteTrait(trait: TraitNoId) {
    if (!this.isGameOwner()) return;
    const remainingTraits = this.selectedTraits().filter((entry) => entry.cardKey !== trait.cardKey);
    this.emitMatchConfigurationUpdate({ traits: remainingTraits });
  }

  // Removes a selected ally from the fixed ally list.
  deleteAlly(ally: AllyNoId) {
    if (!this.isGameOwner()) return;
    const remainingAllies = this.selectedAllies().filter((entry) => entry.cardKey !== ally.cardKey);
    this.emitMatchConfigurationUpdate({ allies: remainingAllies });
  }

  // Removes a selected prophecy from the fixed prophecy list.
  deleteProphecy(prophecy: ProphecyNoId) {
    if (!this.isGameOwner()) return;
    const remainingProphecies = this.selectedProphecies().filter((entry) => entry.cardKey !== prophecy.cardKey);
    this.emitMatchConfigurationUpdate({ prophecies: remainingProphecies });
  }

  // Removes one kingdom card from the banned list.
  deleteBannedKingdom(bannedCard: CardNoId) {
    if (!this.isGameOwner()) return;
    const updatedBanned = this.bannedKingdoms().filter((card) => card.cardKey !== bannedCard.cardKey);
    this.emitMatchConfigurationUpdate({ bannedKingdoms: this.sortByCardKey(updatedBanned) });
  }

  // Removes all banned kingdom cards from configuration.
  clearBannedKingdoms() {
    if (!this.isGameOwner()) return;
    if (this.bannedKingdoms().length < 1) return;
    this.emitMatchConfigurationUpdate({ bannedKingdoms: [] });
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
    const nextEntries = [...entries];
    this.savedConfigurations.set(nextEntries);
    const selectedKey = this.selectedLoadConfigurationKey();
    if (selectedKey && !nextEntries.some((entry) => entry.key === selectedKey)) {
      this.selectedLoadConfigurationKey.set(null);
    }
  };

  // Handles load-completion responses from server.
  private onLoadCompleted = (result: MatchConfigurationLoadResult) => {
    if (result.ok) {
      const loadedEntryName = this.savedConfigurations()
        .find((entry) => entry.key === result.key)
        ?.name
        ?.trim();
      this.loadedConfigurationName.set(loadedEntryName && loadedEntryName.length > 0 ? loadedEntryName : result.key);
      this.refreshSaveBaselineOnNextConfigUpdate.set(true);
      this.dialogStatusMessage.set(null);
      this.closeLoadDialog();
      return;
    }
    this.dialogStatusMessage.set(result.message ?? `Failed to load '${result.key}'.`);
  };

  // Handles delete-completion responses from server.
  private onDeleteCompleted = (result: MatchConfigurationDeleteResult) => {
    if (result.ok) {
      this.dialogStatusMessage.set(null);
      return;
    }
    this.dialogStatusMessage.set(result.message ?? `Failed to delete '${result.key}'.`);
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
