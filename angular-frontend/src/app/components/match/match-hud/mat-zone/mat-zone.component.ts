import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CardId, Mats } from 'shared/shared-types';

@Component({
  selector: 'app-mat-zone',
  imports: [],
  templateUrl: './mat-zone.component.html',
  styleUrl: './mat-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatZoneComponent {
  @Input() mat!: { mat: Mats; cardIds: CardId[] };

}
