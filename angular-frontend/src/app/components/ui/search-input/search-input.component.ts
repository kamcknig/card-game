import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { LucideAngularModule, Search, X } from 'lucide-angular';

// Shared search box: magnifying-glass icon, text input, and a clear (X)
// button that appears once there's text. This is the single implementation
// for every dialog/prompt search surface (kingdom/banned card pickers, the
// match-configuration load dialog, name-a-card prompts, etc.) so search
// boxes look and behave identically everywhere. See
// docs/design-guidelines.md "Search input".
@Component({
  selector: 'app-search-input',
  imports: [LucideAngularModule],
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchInputComponent {
  /** Current text value, shown in the input (controlled by the consumer). */
  value = input('');
  /** Input placeholder text. */
  placeholder = input('Search...');
  /** Focuses the input as soon as it mounts (e.g. a picker dialog opening). */
  autofocus = input(false);

  /** Emitted with the new value on every keystroke, and with '' on clear. */
  valueChange = output<string>();

  readonly SearchIcon = Search;
  readonly XIcon = X;

  private readonly _inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  constructor() {
    // Imperative focus instead of the native `autofocus` attribute: the
    // browser's autofocus-processed flag is scoped to the Document and is
    // consumed permanently on first use, so a native `autofocus` attribute
    // silently no-ops on every open after the first in an SPA that never
    // navigates the top-level document. afterNextRender runs once per
    // component instance, and the consuming modal is destroyed/recreated
    // (not reused) on every open, so this fires fresh every time.
    afterNextRender(() => {
      if (this.autofocus()) {
        this._inputEl()?.nativeElement.focus();
      }
    });
  }

  onInput(next: string): void {
    this.valueChange.emit(next);
  }

  onClear(): void {
    this.valueChange.emit('');
  }
}
