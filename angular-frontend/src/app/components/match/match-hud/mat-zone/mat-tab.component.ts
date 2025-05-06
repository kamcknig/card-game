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
  @Input() mat!: { mat: Mats | string; content: MatPlayerContent | CardId[]  };

  getCount() {
    if (!Array.isArray(this.mat.content)) {
      const matContent = this.mat.content as MatPlayerContent
      return Object.keys(this.mat.content).reduce((acc, playerId) => {
        return acc + matContent[+playerId].cardIds.length;
      }, 0);
    }
    else {
      return this.mat.content.length ?? 0;
    }
  }
}
