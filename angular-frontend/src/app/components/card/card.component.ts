import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { cardStore } from '../../state/card-state';
import { map, Observable } from 'rxjs';
import { Card, CardId } from 'shared/shared-types';
import { AsyncPipe, NgIf, NgOptimizedImage } from '@angular/common';
import { CARD_WIDTH } from '../../core/app-contants';

@Component({
  selector: 'app-card',
  imports: [
    NgOptimizedImage,
    AsyncPipe,
    NgIf
  ],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardComponent implements OnInit {
  @Input() cardId!: CardId;

  card$: Observable<Card> | undefined;

  constructor(private _nanoStores: NanostoresService) {
  }

  ngOnInit() {
    this.card$ = this._nanoStores.useStore(cardStore).pipe(map(store => store[this.cardId]))
  }

  protected readonly CARD_WIDTH = CARD_WIDTH;
}
