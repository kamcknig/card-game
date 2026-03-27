import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Default color assigned to unowned tokens (no player owner).
const UNOWNED_TOKEN_COLOR = '#cccccc';

/**
 * Renders an image-based token badge as a circle with an optional
 * player-colored highlight ring. Used for tokens like the trashing
 * token that have a dedicated icon and per-player ownership.
 * Tokens with the default unowned color do not display a ring.
 */
@Component({
  selector: 'app-token-image-badge',
  standalone: true,
  template: `
    <img [src]="imagePath()" alt="" />
  `,
  styles: [`
    :host {
      display: inline-block;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      overflow: hidden;
      box-sizing: border-box;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `],
  host: {
    '[style.box-shadow]': 'highlightShadow()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokenImageBadgeComponent {
  // Path to the token image asset.
  readonly imagePath = input.required<string>();

  // Optional player color for the highlight ring around the badge.
  readonly highlightColor = input<string | null>(null);

  // Computed box-shadow that draws the player-colored ring when set,
  // suppressed for unowned tokens that use the default gray color.
  readonly highlightShadow = computed(() => {
    const color = this.highlightColor();
    if (!color || color === UNOWNED_TOKEN_COLOR) {
      return 'none';
    }
    return `0 0 0 2px ${color}`;
  });
}
