import { Component, inject } from '@angular/core';
import { ThemeService, ThemeMode } from '../../../core/theme.service';

/**
 * Pill-style radiogroup toggle for Light / Dark / Auto theme modes.
 * Rendered inside SceneBannerComponent on every non-match screen.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <div class="theme-toggle" role="radiogroup" aria-label="Theme">
      @for (opt of options; track opt.value) {
        <button
          type="button"
          class="theme-opt"
          [class.is-active]="theme.mode() === opt.value"
          [attr.aria-checked]="theme.mode() === opt.value"
          role="radio"
          (click)="theme.setMode(opt.value)"
          [title]="opt.label"
        >
          <span class="icon" aria-hidden="true">{{ opt.icon }}</span>
          <span class="label">{{ opt.label }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-flex; }

    .theme-toggle {
      display: inline-flex;
      background: var(--theme-surface-panel);
      border: 1px solid var(--theme-border-subtle);
      border-radius: 999px;
      padding: var(--theme-space-xs);
      gap: var(--theme-space-2xs);
    }

    .theme-opt {
      display: inline-flex;
      align-items: center;
      gap: var(--theme-space-xs);
      padding: var(--theme-space-xs) 10px;
      background: transparent;
      border: none;
      border-radius: 999px;
      color: var(--theme-text-secondary);
      font-family: var(--theme-font-body);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;

      &:hover:not(.is-active) {
        color: var(--theme-text-primary);
      }

      &.is-active {
        background: var(--theme-action-primary-bg);
        color: var(--theme-text-primary);
      }

      .icon { font-size: 13px; line-height: 1; }

      @media (max-width: 640px) {
        .label { display: none; }
      }
    }
  `],
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);

  readonly options: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀' },
    { value: 'dark',  label: 'Dark',  icon: '☾' },
    { value: 'auto',  label: 'Auto',  icon: '◐' },
  ];
}
