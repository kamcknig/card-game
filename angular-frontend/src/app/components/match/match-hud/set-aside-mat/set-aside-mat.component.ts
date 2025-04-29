import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CardId, PlayerId } from 'shared/shared-types';

@Component({
  selector: 'app-set-aside-mat',
  imports: [],
  templateUrl: './set-aside-mat.component.html',
  styleUrl: './set-aside-mat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SetAsideMatComponent {
  @Input() mat!: Record<PlayerId, CardId[]>;
}
