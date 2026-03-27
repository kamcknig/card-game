import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Renders a circular count badge used to display the number of cards
 * in a pile, deck, hand group, or discard stack. Positioned by the
 * parent via absolute or flex layout.
 */
@Component({
  selector: 'app-count-badge',
  standalone: true,
  template: `{{ count() }}`,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 30px;
      border-radius: 999px;
      border: 1px solid var(--theme-border-strong);
      background: rgba(0, 0, 0, 0.75);
      color: var(--theme-text-on-dark);
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      pointer-events: none;
      box-sizing: border-box;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountBadgeComponent {
  // The numeric count to display inside the badge.
  readonly count = input.required<number>();
}
