import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NanostoresService } from '@nanostores/angular';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Flag, LucideAngularModule, Moon, Settings, Sun, Volume2, VolumeX } from 'lucide-angular';
import { logStore } from '../../../../state/log-state';
import { LogEntryMessage } from '../../../../../types';
import { ThemeService } from '../../../../core/theme.service';
import { SoundService } from '../../../../core/sound.service';
import { authIsAdminStore } from '../../../../core/auth/auth.service';
import { APP_VERSION } from '../../../../core/app-version';
import { debugOverlayVisibleStore } from '../../../../state/debug-runtime-state';
import { serverVersionStore } from '../../../../state/server-version-state';
import { displayCardDetail } from '../../views/modal/display-card-detail';
import { matchStore } from '../../../../state/match-state';
import { findCardLikeEntryInMatch } from 'shared/find-card-like-in-match';

type SanitizedLogEntry = LogEntryMessage & { safeMessage: SafeHtml; };

/**
 * Game log panel. Renders the "GAME LOG" header with a settings gear button
 * and an expandable settings menu (dark mode, sound, resign). The menu
 * overlays the log entries — it does not push them down. Emits
 * `resignRequested` so the host (MatchHudAsideComponent) can relay to
 * MatchHudComponent.
 */
@Component({
  selector: 'app-game-log',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameLogComponent implements AfterViewInit {
  private readonly _sanitizer = inject(DomSanitizer);
  private readonly _nanoService = inject(NanostoresService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Theme/sound services — exposed to the template via these readonly handles. */
  readonly theme = inject(ThemeService);
  readonly sound = inject(SoundService);

  // Lucide icon references — class fields required for template access.
  readonly SettingsIcon = Settings;
  readonly MoonIcon = Moon;
  readonly SunIcon = Sun;
  readonly Volume2Icon = Volume2;
  readonly VolumeXIcon = VolumeX;
  readonly FlagIcon = Flag;

  @ViewChild('logContent', { read: ElementRef }) logContent!: ElementRef;

  entries = input<readonly LogEntryMessage[] | null>(null);

  /** Emitted when the user clicks the resign-game row in the settings menu. */
  readonly resignRequested = output<void>();

  /** Whether the settings panel is expanded. */
  readonly settingsOpen = signal(false);

  /** Whether the current user has admin privileges; gates the debug entry. */
  readonly isAdmin = toSignal(this._nanoService.useStore(authIsAdminStore), {
    initialValue: authIsAdminStore.get(),
  });

  /** Current debug overlay visibility — read by the admin-only menu entry. */
  readonly debugOverlayVisible = toSignal(
    this._nanoService.useStore(debugOverlayVisibleStore),
    { initialValue: debugOverlayVisibleStore.get() },
  );

  /** Frontend bundle version — baked in at build time from package.json. */
  readonly clientVersion = APP_VERSION;

  /** Server version received via /status (pre-auth) and refreshed by serverHello. */
  readonly serverVersion = toSignal(this._nanoService.useStore(serverVersionStore), {
    initialValue: serverVersionStore.get(),
  });

  /**
   * Combined client + server version string rendered as the settings panel
   * footer. Same format as the scene-banner pill so the two readouts stay
   * visually consistent.
   */
  readonly versionLine = computed(() => {
    const server = this.serverVersion();
    return server
      ? `Client v${this.clientVersion} · Server v${server}`
      : `Client v${this.clientVersion}`;
  });

  // Sanitized log entries ready for innerHTML binding.
  readonly sanitizedEntries = computed<readonly SanitizedLogEntry[]>(() => {
    const entries = this.entries() ?? [];
    return entries.map((entry) => ({
      ...entry,
      safeMessage: this._sanitizer.bypassSecurityTrustHtml(entry.message),
    }));
  });

  ngAfterViewInit() {
    // Auto-scroll to bottom when new log entries arrive.
    this._nanoService.useStore(logStore)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        setTimeout(() => this.logContent.nativeElement.scrollTop = this.logContent.nativeElement.scrollHeight, 10);
      });
  }

  /** Toggles the settings panel open/closed. */
  toggleSettings(): void {
    this.settingsOpen.update((value) => !value);
  }

  /** Closes the settings panel. */
  closeSettings(): void {
    this.settingsOpen.set(false);
  }

  /** Toggles between light and dark theme. */
  toggleDarkMode(): void {
    this.theme.setMode(this.theme.mode() === 'dark' ? 'light' : 'dark');
  }

  /** Toggles sound on/off. */
  toggleSound(): void {
    this.sound.toggle();
  }

  /** Toggles the admin debug overlay. */
  toggleDebugOverlay(): void {
    debugOverlayVisibleStore.set(!debugOverlayVisibleStore.get());
  }

  /** Closes the panel and emits the resign request to the host. */
  onResignClick(): void {
    this.closeSettings();
    this.resignRequested.emit();
  }

  /**
   * Delegated click handler for card-name buttons embedded in log entries via
   * `[innerHTML]`. Walks from the click target up to the nearest
   * `.log-card-link` element and dispatches to the global card detail dialog
   * with a card id (regular cards) or a detail-image path (card-likes resolved
   * via match state). Stops propagation so the click does not bubble to the
   * host-listener that closes the settings panel.
   */
  onLogContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const link = target.closest<HTMLElement>('.log-card-link');
    // Guard: only handle links that are actually inside our log container.
    if (!link || !this.logContent.nativeElement.contains(link)) return;

    event.preventDefault();
    event.stopPropagation();

    const cardIdAttr = link.dataset['cardId'];
    if (cardIdAttr) {
      const cardId = Number(cardIdAttr);
      if (!Number.isFinite(cardId)) return;
      void displayCardDetail(cardId);
      return;
    }

    const cardLikeIdAttr = link.dataset['cardLikeId'];
    if (cardLikeIdAttr) {
      const cardLikeId = Number(cardLikeIdAttr);
      if (!Number.isFinite(cardLikeId)) return;
      const match = matchStore.get();
      const entry = findCardLikeEntryInMatch(match, cardLikeId);
      const detailImagePath = entry?.cardLike.detailImagePath;
      if (!detailImagePath) return;
      void displayCardDetail({ detailImagePath });
    }
  }

  /** Closes the menu when clicking outside the component bounds. */
  @HostListener('document:click', ['$event'])
  protected _onDocumentClick(event: MouseEvent): void {
    if (!this.settingsOpen()) return;
    const target = event.target as Node | null;
    if (target && this._hostElement.nativeElement.contains(target)) return;
    this.closeSettings();
  }

  /** Closes the menu on Escape key. */
  @HostListener('document:keydown.escape')
  protected _onEscape(): void {
    if (this.settingsOpen()) this.closeSettings();
  }
}
