import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CardId, Mats } from 'shared/shared-types';
import { MatPlayerContent } from '../types';

@Component({
  selector: 'app-mat-tab',
  imports: [],
  templateUrl: './mat-tab.component.html',
  styleUrl: './mat-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatTabComponent {
  @Input() mat!: { mat: Mats; playerContent: MatPlayerContent };

  getCount() {
    return Object.keys(this.mat.playerContent).reduce((acc, playerId) => {
      return acc + this.mat.playerContent[+playerId].cardIds.length;
    }, 0);
  }
}
