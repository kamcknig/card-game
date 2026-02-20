import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CardLikeId, Mats } from 'shared/types';
import { MatPlayerContent } from '../types';

export type MatTabModel = {
  id: string;
  mat: Mats | string;
  content: MatPlayerContent | CardLikeId[];
  labelPrefix: string;
  labelSource?: string;
  labelSuffix?: string;
  sourceColor?: string;
};

@Component({
  selector: 'app-mat-tab',
  imports: [],
  templateUrl: './mat-tab.component.html',
  styleUrl: './mat-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatTabComponent {
  mat = input.required<MatTabModel>();

  // Cached badge count for this mat tab.
  readonly matCount = computed(() => {
    const mat = this.mat();
    if (!Array.isArray(mat.content)) {
      const matContent = mat.content as MatPlayerContent;
      return Object.keys(mat.content).reduce((acc, playerId) => {
        return acc + matContent[+playerId].cardIds.length;
      }, 0);
    }
    return mat.content.length ?? 0;
  });
}
