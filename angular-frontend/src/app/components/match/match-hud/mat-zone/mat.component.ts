import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CardId, Mats } from 'shared/shared-types';

@Component({
  selector: 'app-mat',
  imports: [],
  templateUrl: './mat.component.html',
  styleUrl: './mat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatComponent {
  @Input() mat!: { mat: Mats; cardIds: CardId[] };
}
