import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import {
  ArtifactNoId,
  CardNoId,
  EventNoId,
  ExpansionListElement,
  LandmarkNoId,
  ProjectNoId,
  MatchConfiguration,
  PlayerId
} from 'shared/types';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, selfPlayerIdStore } from '../../state/player-state';
import { combineLatest, map, Observable, Subscription } from 'rxjs';
import { AsyncPipe, NgClass, NgOptimizedImage, NgStyle } from '@angular/common';
import { expansionListStore } from '../../state/expansion-list-state';
import { matchConfigurationStore } from '../../state/match-state';
import { SocketService } from '../../core/socket-service/socket.service';
import { gameOwnerIdStore } from '../../state/game-state';
import { PlayerComponent } from './player-name-input/player-name-input.component';
import { SelectKingdomModalComponent } from './select-kingdom-modal/select-kingdom-modal.component';
import { SelectEventModalComponent } from './select-event-modal/select-event-modal.component';
import { SelectLandmarkModalComponent } from './select-landmark-modal/select-landmark-modal.component';
import { SelectArtifactModalComponent } from './select-artifact-modal/select-artifact-modal.component';
import { SelectProjectModalComponent } from './select-project-modal/select-project-modal.component';

@Component({
  selector: 'app-match-configuration',
  imports: [
    AsyncPipe,
    NgOptimizedImage,
    NgClass,
    PlayerComponent,
    SelectKingdomModalComponent,
    SelectEventModalComponent,
    SelectLandmarkModalComponent,
    SelectArtifactModalComponent,
    SelectProjectModalComponent,
    NgStyle
  ],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchConfigurationComponent implements OnDestroy {
  playerIds$!: Observable<readonly PlayerId[]>;
  expansionList$!: Observable<readonly ExpansionListElement[]>;
  matchExpansions$!: Observable<readonly string[]>;
  isGameOwner: boolean = false;
  preSelectedKingdoms: (CardNoId | null)[] = [];
  // Tracks the fixed events selected for the match.
  preSelectedEvents: (EventNoId | null)[] = [];
  // Tracks the fixed landmarks selected for the match.
  preSelectedLandmarks: (LandmarkNoId | null)[] = [];
  // Tracks the fixed artifacts selected for the match.
  preSelectedArtifacts: (ArtifactNoId | null)[] = [];
  // Tracks the fixed projects selected for the match.
  preSelectedProjects: (ProjectNoId | null)[] = [];
  selectingKingdom: boolean = false;
  // Controls the event selection modal visibility.
  selectingEvents: boolean = false;
  // Controls the landmark selection modal visibility.
  selectingLandmarks: boolean = false;
  // Controls the artifact selection modal visibility.
  selectingArtifacts: boolean = false;
  // Controls the project selection modal visibility.
  selectingProjects: boolean = false;
  selectingBannedCards: boolean = false
  bannedKingdoms$: Observable<readonly CardNoId[]>;

  private gameOwnerSub: Subscription;
  private bannedKingdoms: CardNoId[] = [];
  private selectedKingdomsSub: Subscription;
  // Keeps the preselected events list in sync with configuration changes.
  private selectedEventsSub: Subscription;
  // Keeps the preselected landmarks list in sync with configuration changes.
  private selectedLandmarksSub: Subscription;
  // Keeps the preselected artifacts list in sync with configuration changes.
  private selectedArtifactsSub: Subscription;
  // Keeps the preselected projects list in sync with configuration changes.
  private selectedProjectsSub: Subscription;

  constructor(
    private _nanoStoreService: NanostoresService,
    private _socketService: SocketService,
  ) {
    this.playerIds$ = this._nanoStoreService.useStore(playerIdStore);
    this.expansionList$ = this._nanoStoreService.useStore(expansionListStore);
    this.matchExpansions$ = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(
        map(config => config?.expansions?.map(e => e.name)),
        map(expansions => expansions ?? [])
      );

    this.bannedKingdoms$ = this._nanoStoreService.useStore(matchConfigurationStore).pipe(
      map(config => config?.bannedKingdoms ?? [])
    );

    this.selectedKingdomsSub = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(map(config => config?.preselectedKingdoms
        ?.sort((a, b) => a.cardKey.localeCompare(b.cardKey))))
      .subscribe(selectedKingdoms => {
        selectedKingdoms ??= []
        const remainingNulls = new Array(10 - (selectedKingdoms?.length ?? 0)).fill(null);

        for (const _ of remainingNulls) {
          selectedKingdoms.push(null as any);
        }

        this.preSelectedKingdoms = selectedKingdoms;
      });
    
    this.selectedEventsSub = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(map(config => config?.events
        ?.sort((a, b) => a.cardKey.localeCompare(b.cardKey))))
      .subscribe(selectedEvents => {
        selectedEvents ??= [];
        // Always keep a single empty slot for adding additional events.
        this.preSelectedEvents = [...selectedEvents, null];
      });

    this.selectedLandmarksSub = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(map(config => config?.landmarks
        ?.sort((a, b) => a.cardKey.localeCompare(b.cardKey))))
      .subscribe(selectedLandmarks => {
        selectedLandmarks ??= [];
        // Always keep a single empty slot for adding additional landmarks.
        this.preSelectedLandmarks = [...selectedLandmarks, null];
      });

    this.selectedArtifactsSub = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(map(config => config?.artifacts
        ?.sort((a, b) => a.cardKey.localeCompare(b.cardKey))))
      .subscribe(selectedArtifacts => {
        selectedArtifacts ??= [];
        // Always keep a single empty slot for adding additional artifacts.
        this.preSelectedArtifacts = [...selectedArtifacts, null];
      });

    // Keep project selections synced with the match configuration.
    this.selectedProjectsSub = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(map(config => config?.projects
        ?.sort((a, b) => a.cardKey.localeCompare(b.cardKey))))
      .subscribe(selectedProjects => {
        selectedProjects ??= [];
        // Always keep a single empty slot for adding additional projects.
        this.preSelectedProjects = [...selectedProjects, null];
      });

    this.gameOwnerSub = combineLatest([
      this._nanoStoreService.useStore(gameOwnerIdStore),
      this._nanoStoreService.useStore(selfPlayerIdStore)
    ]).subscribe(([ownerId, playerId]) => this.isGameOwner = playerId === ownerId);

    this.preSelectedKingdoms = new Array(10).fill(null);
    // Initialize event and landmark slots with a single empty placeholder.
    this.preSelectedEvents = [null];
    this.preSelectedLandmarks = [null];
    this.preSelectedArtifacts = [null];
    this.preSelectedProjects = [null];
  }

  ngOnDestroy(): void {
    this.gameOwnerSub.unsubscribe();
    this.selectedKingdomsSub.unsubscribe()
    this.selectedEventsSub.unsubscribe();
    this.selectedLandmarksSub.unsubscribe();
    this.selectedArtifactsSub.unsubscribe();
    this.selectedProjectsSub.unsubscribe();
  }

  onToggleExpansion(expansion: ExpansionListElement) {
    const currentConfig = matchConfigurationStore.get();
    const currentExpansions = currentConfig?.expansions ?? [];
    const currentIdx = currentExpansions?.findIndex(e => e.name === expansion.name);

    if (currentIdx === undefined || currentIdx === -1) {
      currentExpansions.push(expansion);
    }
    else {
      currentExpansions.splice(currentIdx, 1);
    }

    this._socketService.emit('matchConfigurationUpdated', {
      ...currentConfig as MatchConfiguration,
      expansions: currentExpansions
    });
  }

  // Adds a single computer player to the lobby.
  addComputerPlayer() {
    this._socketService.emit('addComputerPlayer', 1);
  }

  deleteKingdom(kingdom: CardNoId) {
    const idx = this.preSelectedKingdoms.findIndex(k => k !== null && k?.cardKey === kingdom.cardKey);
    this.preSelectedKingdoms = this.preSelectedKingdoms
      .toSpliced(idx, 1, null)
      .sort((a, b) => {
        if (a === null && b !== null) return 1;
        if (a !== null && b === null) return -1;
        else return 0;
      });

    this.sendMatchConfigUpdate();
  }
  
  // Removes a selected event from the fixed event list.
  deleteEvent(event: EventNoId) {
    const remainingEvents = this.preSelectedEvents
      .filter((entry): entry is EventNoId => !!entry)
      .filter(entry => entry.cardKey !== event.cardKey)
      .sort((a, b) => a.cardKey.localeCompare(b.cardKey));
    // Keep one empty slot after removing the event.
    this.preSelectedEvents = [...remainingEvents, null];
    
    this.sendMatchConfigUpdate();
  }

  // Removes a selected landmark from the fixed landmark list.
  deleteLandmark(landmark: LandmarkNoId) {
    const remainingLandmarks = this.preSelectedLandmarks
      .filter((entry): entry is LandmarkNoId => !!entry)
      .filter(entry => entry.cardKey !== landmark.cardKey)
      .sort((a, b) => a.cardKey.localeCompare(b.cardKey));
    // Keep one empty slot after removing the landmark.
    this.preSelectedLandmarks = [...remainingLandmarks, null];

    this.sendMatchConfigUpdate();
  }

  // Removes a selected artifact from the fixed artifact list.
  deleteArtifact(artifact: ArtifactNoId) {
    const remainingArtifacts = this.preSelectedArtifacts
      .filter((entry): entry is ArtifactNoId => !!entry)
      .filter(entry => entry.cardKey !== artifact.cardKey)
      .sort((a, b) => a.cardKey.localeCompare(b.cardKey));
    // Keep one empty slot after removing the artifact.
    this.preSelectedArtifacts = [...remainingArtifacts, null];

    this.sendMatchConfigUpdate();
  }

  // Removes a selected project from the fixed project list.
  deleteProject(project: ProjectNoId) {
    const remainingProjects = this.preSelectedProjects
      .filter((entry): entry is ProjectNoId => !!entry)
      .filter(entry => entry.cardKey !== project.cardKey)
      .sort((a, b) => a.cardKey.localeCompare(b.cardKey));
    // Keep one empty slot after removing the project.
    this.preSelectedProjects = [...remainingProjects, null];

    this.sendMatchConfigUpdate();
  }

  /**
   * user has selected a kingdom card from the modal to add to the starting kingdom
   *
   * @param $event
   */
  onKingdomSelected($event: CardNoId) {
    const idx = this.preSelectedKingdoms.findIndex(k => k === null);
    this.preSelectedKingdoms = this.preSelectedKingdoms.toSpliced(idx, 1, $event);
    this.selectingKingdom = false;
    this.sendMatchConfigUpdate();
  }
  
  // Adds a selected event to the fixed event list.
  onEventSelected($event: EventNoId) {
    const selectedEvents = this.preSelectedEvents
      .filter((entry): entry is EventNoId => !!entry);
    selectedEvents.push($event);
    // Keep one empty slot after adding the event.
    this.preSelectedEvents = [...selectedEvents.sort((a, b) => a.cardKey.localeCompare(b.cardKey)), null];
    this.selectingEvents = false;
    this.sendMatchConfigUpdate();
  }

  // Adds a selected landmark to the fixed landmark list.
  onLandmarkSelected($event: LandmarkNoId) {
    const selectedLandmarks = this.preSelectedLandmarks
      .filter((entry): entry is LandmarkNoId => !!entry);
    selectedLandmarks.push($event);
    // Keep one empty slot after adding the landmark.
    this.preSelectedLandmarks = [...selectedLandmarks.sort((a, b) => a.cardKey.localeCompare(b.cardKey)), null];
    this.selectingLandmarks = false;
    this.sendMatchConfigUpdate();
  }

  // Adds a selected artifact to the fixed artifact list.
  onArtifactSelected($event: ArtifactNoId) {
    const selectedArtifacts = this.preSelectedArtifacts
      .filter((entry): entry is ArtifactNoId => !!entry);
    selectedArtifacts.push($event);
    // Keep one empty slot after adding the artifact.
    this.preSelectedArtifacts = [...selectedArtifacts.sort((a, b) => a.cardKey.localeCompare(b.cardKey)), null];
    this.selectingArtifacts = false;
    this.sendMatchConfigUpdate();
  }

  // Adds a selected project to the fixed project list.
  onProjectSelected($event: ProjectNoId) {
    const selectedProjects = this.preSelectedProjects
      .filter((entry): entry is ProjectNoId => !!entry);
    selectedProjects.push($event);
    // Keep one empty slot after adding the project.
    this.preSelectedProjects = [...selectedProjects.sort((a, b) => a.cardKey.localeCompare(b.cardKey)), null];
    this.selectingProjects = false;
    this.sendMatchConfigUpdate();
  }

  private sendMatchConfigUpdate() {
    this._socketService.emit('matchConfigurationUpdated', {
      ...matchConfigurationStore.get() as MatchConfiguration,
      bannedKingdoms: this.bannedKingdoms,
      // Pass the fixed events through the match configuration.
      events: this.preSelectedEvents
        .filter(event => !!event)
        .map(event => event as EventNoId),
      // Pass the fixed landmarks through the match configuration.
      landmarks: this.preSelectedLandmarks
        .filter(landmark => !!landmark)
        .map(landmark => landmark as LandmarkNoId),
      // Pass the fixed artifacts through the match configuration.
      artifacts: this.preSelectedArtifacts
        .filter(artifact => !!artifact)
        .map(artifact => artifact as ArtifactNoId),
      // Pass the fixed projects through the match configuration.
      projects: this.preSelectedProjects
        .filter(project => !!project)
        .map(project => project as ProjectNoId),
      kingdomSupply: this.preSelectedKingdoms
        .filter(card => !card?.isBasic)
        .filter(card => !!card)
        .map(card => ({ name: card.cardKey, cards: [card] })),
      basicSupply: this.preSelectedKingdoms
        .filter(card => card?.isBasic)
        .filter(card => !!card)
        .map(card => ({ name: card.cardKey, cards: [card] }))
    });
  }

  onBannedKingdomSelected($event: CardNoId) {
    const idx = this.bannedKingdoms.findIndex(k => k.cardKey === $event.cardKey);
    if (idx === -1) {
      this.bannedKingdoms.push($event);
    }
    else {
      this.bannedKingdoms.splice(idx, 1)
    }
    this.bannedKingdoms = [...this.bannedKingdoms.sort((a, b) => a.cardKey.localeCompare(b.cardKey))];
    this.sendMatchConfigUpdate();
  }

  deleteBannedKingdom(bannedCard: CardNoId) {
    this.onBannedKingdomSelected(bannedCard);
  }
}
