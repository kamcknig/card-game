import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CardNoId, PlayerId } from 'shared/types';
import { SocketService } from '../../../core/socket-service/socket.service';
import { CardComponent } from '../../card/card.component';
import { SearchInputComponent } from '../../ui/search-input/search-input.component';

@Component({
  selector: 'app-prompt-name-card-content',
  imports: [
    CardComponent,
    SearchInputComponent,
  ],
  templateUrl: './prompt-name-card-content.component.html',
  styleUrl: './prompt-name-card-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptNameCardContentComponent implements OnInit, OnDestroy {
  private readonly _socketService = inject(SocketService);

  selfPlayerId = input.required<PlayerId>();

  resultsUpdated = output<string>();
  validationUpdated = output<boolean>();

  private _searchTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly _searchTerm = signal('');
  private readonly _searchResults = signal<CardNoId[]>([]);
  private readonly _selectedCardKey = signal<string | null>(null);

  // Search term shown in the prompt input.
  readonly searchTerm = computed(() => this._searchTerm());

  // Current search results rendered in the prompt body.
  readonly searchResults = computed(() => this._searchResults());

  // True when non-empty search text has no matching results.
  readonly showNoResults = computed(() => {
    return this._searchTerm().trim().length > 0 && this._searchResults().length < 1;
  });

  // Currently selected search result, or null when the search results no
  // longer contain the picked card (stale selection after a new search).
  readonly selectedCardKey = computed(() => {
    const selectedKey = this._selectedCardKey();
    if (selectedKey === null) {
      return null;
    }
    return this._searchResults().some((card) => card.cardKey === selectedKey)
      ? selectedKey
      : null;
  });

  // Emits result + validation whenever the effective selection changes. The
  // host resets its validation state to true per prompt, so the initial
  // `false` emission here is what disables Confirm until a card is picked.
  private readonly _emitSelectionState = effect(() => {
    const selectedKey = this.selectedCardKey();
    this.resultsUpdated.emit(selectedKey ?? '');
    this.validationUpdated.emit(selectedKey !== null);
  });

  ngOnInit(): void {
    this._socketService.on('searchCardResponse', this.onSearchCardResponse);
  }

  ngOnDestroy(): void {
    this._socketService.off('searchCardResponse', this.onSearchCardResponse);
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
      this._searchTimeout = null;
    }
  }

  // Updates the local search term and debounces server search requests.
  onSearchTermChanged(value: string): void {
    this._searchTerm.set(value);

    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
      this._searchTimeout = null;
    }

    this._searchTimeout = setTimeout(() => {
      this._searchTimeout = null;
      this._socketService.emit('searchCards', this.selfPlayerId(), value);
    }, 250);
  }

  // Toggles the clicked search result as the named card; clicking a
  // different card moves the selection (single pick by definition).
  selectCard(card: CardNoId): void {
    this._selectedCardKey.set(
      this._selectedCardKey() === card.cardKey ? null : card.cardKey,
    );
  }

  // Receives server-backed name search results.
  private onSearchCardResponse = (results: CardNoId[]) => {
    this._searchResults.set(results ?? []);
  };
}
