import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { CardNoId, PlayerId } from 'shared/types';
import { SocketService } from '../../../core/socket-service/socket.service';
import { displayCardDetail } from '../../match/views/modal/display-card-detail';

@Component({
  selector: 'app-prompt-name-card-content',
  imports: [
    NgOptimizedImage,
  ],
  templateUrl: './prompt-name-card-content.component.html',
  styleUrl: './prompt-name-card-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptNameCardContentComponent implements OnInit, OnDestroy {
  private readonly _socketService = inject(SocketService);

  selfPlayerId = input.required<PlayerId>();

  resultsUpdated = output<string>();
  finished = output<void>();

  private _searchTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly _searchTerm = signal('');
  private readonly _searchResults = signal<CardNoId[]>([]);

  // Search term shown in the prompt input.
  readonly searchTerm = computed(() => this._searchTerm());

  // Current search results rendered in the prompt body.
  readonly searchResults = computed(() => this._searchResults());

  // True when non-empty search text has no matching results.
  readonly showNoResults = computed(() => {
    return this._searchTerm().trim().length > 0 && this._searchResults().length < 1;
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

  // Selects one card key and completes the prompt.
  selectCard(card: CardNoId): void {
    this.resultsUpdated.emit(card.cardKey);
    this.finished.emit();
  }

  // Opens detail art for a search result via right-click.
  onCardContextMenu(event: MouseEvent, card: CardNoId): void {
    event.preventDefault();
    void displayCardDetail(card);
  }

  // Receives server-backed name search results.
  private onSearchCardResponse = (results: CardNoId[]) => {
    this._searchResults.set(results ?? []);
  };
}
