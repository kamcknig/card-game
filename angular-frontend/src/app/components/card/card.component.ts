import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { cardStore } from '../../state/card-state';
import { combineLatestWith, map, Subscription } from 'rxjs';
import { CardId } from 'shared/shared-types';
import { NgOptimizedImage } from '@angular/common';
import { CARD_WIDTH } from '../../core/app-contants';
import { CardSize } from '../../../types';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { selfPlayerIdStore } from '../../state/match-state';

@Component({
  selector: 'app-card',
  imports: [
    NgOptimizedImage
  ],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardComponent implements OnInit, OnDestroy {
  @Input() cardId!: CardId;
  @Input() size: CardSize = 'full';

  path: SafeUrl | undefined;

  cardSub$: Subscription | undefined;

  constructor(
    private _nanoStores: NanostoresService,
    private _sanitizer: DomSanitizer,
  ) {
  }

  ngOnDestroy() {
    this.cardSub$?.unsubscribe();
  }

  ngOnInit() {
    this.cardSub$ = this._nanoStores.useStore(cardStore).pipe(
      map(store => store[this.cardId]),
      combineLatestWith(this._nanoStores.useStore(selfPlayerIdStore)),
    ).subscribe(([card, selfId]) => {
      let path: string = '';

      if (card.owner === selfId) {
        path = this.size === 'half' ? card.halfImagePath : this.size === 'full' ? card.fullImagePath : card.detailImagePath
      }
      else {
        path = card.facing === 'back' ?
          `/assets/card-images/base-v2/${this.size}-size/card-back.jpg` :
          this.size === 'half' ? card.halfImagePath : this.size === 'full' ? card.fullImagePath : card.detailImagePath;
      }

      this.path = this._sanitizer.bypassSecurityTrustUrl(path);

    });
  }

  protected readonly CARD_WIDTH = CARD_WIDTH;
}
