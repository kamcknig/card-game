import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { CardFacing, CardId, CardLikeId, UserPromptKinds } from 'shared/types';
import { validateCountSpec } from 'shared/validate-count-spec';
import { resolveCountSpec, resolveMaxSelectable } from 'shared/resolve-count-spec';
import { CardComponent } from '../../card/card.component';
import { CardLikeComponent } from '../../card-like/card-like.component';
import { WayPickerPanelComponent } from '../../way-picker-overlay/way-picker-panel.component';
import { cardStore } from '../../../state/card-state';
import { cardSourceStore } from '../../../state/card-source-store';
import { matchStore } from '../../../state/match-state';
import { debugRuntimeContextStore } from '../../../state/debug-runtime-state';
import { createSelectionEmitter } from './selection-emitter';

type PromptSelectContent = Extract<UserPromptKinds, { type: 'select' | 'display-cards' }>;

type PromptSelectionEntry = {
  key: string;
  kind: 'card' | 'cardLike';
  sourceId: number;
  selectable: boolean;
  isActionCard: boolean;
  forceFacing?: CardFacing;
};

@Component({
  selector: 'app-prompt-select-content',
  imports: [
    CardComponent,
    CardLikeComponent,
    WayPickerPanelComponent,
  ],
  templateUrl: './prompt-select-content.component.html',
  styleUrl: './prompt-select-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptSelectContentComponent {
  private static readonly DEFAULT_TOOLTIP_CLOSE_DELAY_MS = 160;
  private static readonly TOOLTIP_EDGE_OVERLAP_PX = 5;
  private static readonly TOOLTIP_PADDING_PX = 8;
  // Board-parity tooltip metrics: 256 = 238px landscape card-like
  // + 2 * 8px panel padding + 2px borders (same recipe as
  // way-picker-overlay.component.scss). Height estimate mirrors
  // WayPickerOverlayService: 149px per entry + 8px gaps + 18px chrome,
  // capped by the scrollable list's 320px max-height + chrome.
  private static readonly TOOLTIP_ESTIMATED_WIDTH_PX = 256;
  private static readonly TOOLTIP_ENTRY_HEIGHT_PX = 149;
  private static readonly TOOLTIP_ENTRY_GAP_PX = 8;
  private static readonly TOOLTIP_CHROME_PX = 18;
  private static readonly TOOLTIP_MAX_HEIGHT_PX = 338;

  private readonly _nanoService = inject(NanostoresService);

  content = input.required<PromptSelectContent>();

  validationUpdated = output<boolean>();
  resultsUpdated = output<number[]>();
  selectedWayUpdated = output<CardLikeId | null>();

  private readonly _cardsById = toSignal(this._nanoService.useStore(cardStore), {
    initialValue: cardStore.get(),
  });

  private readonly _cardSources = toSignal(this._nanoService.useStore(cardSourceStore), {
    initialValue: cardSourceStore.get(),
  });

  private readonly _match = toSignal(this._nanoService.useStore(matchStore), {
    initialValue: matchStore.get(),
  });
  private readonly _debugRuntimeContext = toSignal(this._nanoService.useStore(debugRuntimeContextStore), {
    initialValue: debugRuntimeContextStore.get(),
  });

  private readonly _selectedEntryKeys = signal<string[]>([]);
  private readonly _selectedWayId = signal<CardLikeId | null>(null);
  private readonly _selectedWayEntryKey = signal<string | null>(null);
  private readonly _wayTooltipEntryKey = signal<string | null>(null);
  private readonly _wayTooltipHovering = signal(false);
  private readonly _wayTooltipPosition = signal<{ left: number; top: number }>({ left: 8, top: 8 });
  private _wayTooltipCloseTimeout: ReturnType<typeof setTimeout> | null = null;

  private _lastSelectedWaySignature: string | null = null;

  // Shared dedup-and-emit machinery for results/validation; see
  // selection-emitter.ts for why this isn't itself an `effect()`.
  private readonly _selectionEmitter = createSelectionEmitter<number[]>({
    resultsUpdated: this.resultsUpdated,
    validationUpdated: this.validationUpdated,
  });

  // Rebuilds prompt-local selection state whenever the prompt payload changes.
  private readonly _resetSelectionOnContentChange = effect(() => {
    this.content();
    this._selectedEntryKeys.set([]);
    this._selectedWayId.set(null);
    this._selectedWayEntryKey.set(null);
    this.cancelWayTooltipClose();
    this._wayTooltipEntryKey.set(null);
    this._wayTooltipHovering.set(false);
    this._selectionEmitter.reset();
    this._lastSelectedWaySignature = null;
  });

  // Emits prompt results/validation as selection state changes.
  private readonly _emitSelectionState = effect(() => {
    const selectedIds = this.selectedSourceIds();
    const validationState = this.isValidSelection();

    this._selectionEmitter.emit({
      result: selectedIds,
      isValid: validationState,
    });

    if (this.showWaySelection()) {
      const selectedWayId = this.resolveSelectedWayIdForEmission();
      const waySignature = selectedWayId === null ? 'null' : String(selectedWayId);
      if (waySignature !== this._lastSelectedWaySignature) {
        this._lastSelectedWaySignature = waySignature;
        this.selectedWayUpdated.emit(selectedWayId);
      }
    }
  });

  // Prompt entries derived from card/card-like ids in prompt payload order.
  readonly entries = computed<PromptSelectionEntry[]>(() => {
    const content = this.content();
    const cardsById = this._cardsById();
    const trashCardIds = new Set(this._cardSources()?.['trash'] ?? []);

    const selectableCardIds = new Set(content.type === 'select'
      ? (content.selectableCardIds ?? content.cardIds ?? [])
      : []);
    const selectableCardLikeIds = new Set(content.type === 'select'
      ? (content.selectableCardLikeIds ?? content.cardLikeIds ?? [])
      : []);

    const builtEntries: PromptSelectionEntry[] = [];

    let cardIndex = 0;
    for (const cardId of content.cardIds ?? []) {
      const card = cardsById[cardId as CardId];
      builtEntries.push({
        key: `card:${cardId}:${cardIndex}`,
        kind: 'card',
        sourceId: cardId,
        selectable: selectableCardIds.has(cardId),
        isActionCard: !!card && card.type.includes('ACTION'),
        forceFacing: trashCardIds.has(cardId) ? 'front' : undefined,
      });
      cardIndex += 1;
    }

    let cardLikeIndex = 0;
    for (const cardLikeId of content.cardLikeIds ?? []) {
      builtEntries.push({
        key: `cardLike:${cardLikeId}:${cardLikeIndex}`,
        kind: 'cardLike',
        sourceId: cardLikeId,
        selectable: selectableCardLikeIds.has(cardLikeId),
        isActionCard: false,
      });
      cardLikeIndex += 1;
    }

    return builtEntries;
  });

  // Prompt entries that render as regular cards.
  readonly cardEntries = computed(() => this.entries().filter((entry) => entry.kind === 'card'));

  // Prompt entries that render as card-like rows (events, boons, states, etc).
  readonly cardLikeEntries = computed(() => this.entries().filter((entry) => entry.kind === 'cardLike'));

  // Current single selected card entry eligible for modal-local Way selection.
  readonly wayEligibleEntry = computed<PromptSelectionEntry | null>(() => {
    if (!this.showWaySelection()) {
      return null;
    }

    const selectedEntries = this.selectedEntries();
    if (selectedEntries.length !== 1) {
      return null;
    }

    const [selectedEntry] = selectedEntries;
    if (!selectedEntry || selectedEntry.kind !== 'card' || !selectedEntry.isActionCard) {
      return null;
    }

    return selectedEntry;
  });

  // Current entry that should own the modal-local Way tooltip.
  readonly wayTooltipEntry = computed<PromptSelectionEntry | null>(() => {
    const hoveredEntryKey = this._wayTooltipEntryKey();
    const hoveredEntry = this.entries().find((entry) => entry.key === hoveredEntryKey) ?? null;
    if (hoveredEntry && this.canShowWayTooltipForEntry(hoveredEntry)) {
      return hoveredEntry;
    }
    return null;
  });

  // Sorted active ways shown when a modal select prompt supports play-as-way behavior.
  readonly sortedWays = computed(() => {
    return [...(this._match()?.ways ?? [])].sort((a, b) => a.cardKey.localeCompare(b.cardKey));
  });

  // Sorted Way ids for the shared way-picker-panel component.
  readonly sortedWayIds = computed(() => this.sortedWays().map((way) => way.id));

  // True when this prompt should expose a modal-local Way selection UI.
  readonly showWaySelection = computed(() => {
    const content = this.content();
    if (content.type !== 'select') {
      return false;
    }

    const countSpec = resolveCountSpec(content.selectCount);
    const singleSelection = countSpec.kind === 'fixed'
      ? countSpec.count === 1
      : countSpec.min === 1 && countSpec.max === 1;

    const playIntent = content.selectionIntent;
    const supportsPlayIntent = !!playIntent
      && playIntent.kind === 'play-card'
      && playIntent.cardTypes.includes('ACTION');

    return supportsPlayIntent && singleSelection && (this.sortedWays().length > 0);
  });

  // True when the modal-local Way tooltip panel should be visible.
  readonly showWayTooltip = computed(() => !!this.wayTooltipEntry());
  readonly wayTooltipPosition = computed(() => this._wayTooltipPosition());

  // Selected way id displayed in the modal-local way picker UI.
  readonly selectedWayId = computed(() => this._selectedWayId());

  // Display name of the currently chosen Way (badge text), or null.
  readonly selectedWayName = computed(() => {
    const selectedWayId = this._selectedWayId();
    if (selectedWayId === null) {
      return null;
    }
    return this.sortedWays().find((way) => way.id === selectedWayId)?.cardName ?? null;
  });

  // True when this prompt content is display-only and should not accept selection.
  readonly displayOnly = computed(() => this.content().type === 'display-cards');

  // Toggles one selectable entry in the prompt selection. Selection never
  // submits by itself — the host's Confirm button (validation-gated) is the
  // only submit path.
  toggleEntry(entry: PromptSelectionEntry): void {
    if (this.displayOnly() || !entry.selectable) {
      return;
    }

    const currentSelection = this._selectedEntryKeys();

    if (currentSelection.includes(entry.key)) {
      // Clicking a selected entry always deselects it (any count spec) —
      // Confirm disables again if the selection drops below the spec.
      this.deselectEntry(entry.key);
    } else if (this.isSingleSelection()) {
      // Exact-1 specs move the selection to the clicked entry.
      this._selectedEntryKeys.set([entry.key]);
      this.syncWaySelectionWithCurrentSelection();
    } else {
      // Multi-pick specs ("select 2", "up to 3") keep pure toggle
      // semantics: add on click, remove on re-click — never replace. The
      // count spec's maximum is a hard cap: once reached, further clicks
      // are ignored until the player deselects an entry.
      if (currentSelection.length >= this.maxSelectable()) {
        return;
      }
      this._selectedEntryKeys.set([...currentSelection, entry.key]);
      this.syncWaySelectionWithCurrentSelection();
    }
  }

  // Hard cap on simultaneous selections derived from the prompt's count
  // spec. display-cards prompts never select, so the cap is irrelevant there.
  private readonly maxSelectable = computed(() => {
    const content = this.content();
    return content.type === 'select' ? resolveMaxSelectable(content.selectCount) : 0;
  });

  // Applies a Way choice to the hovered eligible card. Selecting a Way
  // records the choice (blue ring + badge); re-clicking the chosen Way
  // fully deselects the card — same result as clicking the card itself
  // while a Way is selected — rather than falling back to a "selected for
  // normal play" state. Confirm is the only submit path.
  selectWay(wayId: CardLikeId): void {
    const targetEntry = this.wayTooltipEntry();
    if (!targetEntry) {
      return;
    }

    if (this._selectedWayId() === wayId && this._selectedWayEntryKey() === targetEntry.key) {
      this.deselectEntry(targetEntry.key);
      return;
    }

    this._selectedEntryKeys.set([targetEntry.key]);
    this._selectedWayEntryKey.set(targetEntry.key);
    this._selectedWayId.set(wayId);
    this.cancelWayTooltipClose();
    this._wayTooltipEntryKey.set(null);
    this._wayTooltipHovering.set(false);
  }

  // Removes one entry from the current selection and clears any Way choice
  // tied to it. Shared by toggleEntry() (clicking a selected card) and
  // selectWay() (re-clicking the currently chosen Way) so both paths
  // produce the same fully-deselected result.
  private deselectEntry(entryKey: string): void {
    this._selectedEntryKeys.set(this._selectedEntryKeys().filter((key) => key !== entryKey));
    this.syncWaySelectionWithCurrentSelection();
  }

  // Indicates whether an entry is currently selected.
  isSelected(entry: PromptSelectionEntry): boolean {
    return this._selectedEntryKeys().includes(entry.key);
  }

  // True when this entry is the card the current Way choice applies to —
  // drives the blue "as Way" ring + badge instead of the green selected ring.
  isSelectedAsWay(entry: PromptSelectionEntry): boolean {
    return this._selectedWayId() !== null && this._selectedWayEntryKey() === entry.key;
  }

  // Opens the modal-local Way tooltip for one hovered card entry.
  onEntryMouseEnter(entry: PromptSelectionEntry, event: MouseEvent): void {
    if (!this.canShowWayTooltipForEntry(entry)) {
      return;
    }
    this.cancelWayTooltipClose();
    this._wayTooltipPosition.set(this.resolveTooltipPosition(event.currentTarget as HTMLElement));
    this._wayTooltipEntryKey.set(entry.key);
  }

  // Schedules tooltip close when pointer leaves a card entry.
  onEntryMouseLeave(entry: PromptSelectionEntry): void {
    if (this._wayTooltipEntryKey() !== entry.key) {
      return;
    }
    this.scheduleWayTooltipClose();
  }

  // Keeps tooltip open while the pointer is over the tooltip panel.
  onWayTooltipMouseEnter(): void {
    this._wayTooltipHovering.set(true);
    this.cancelWayTooltipClose();
  }

  // Closes tooltip after a short delay when pointer leaves tooltip panel.
  onWayTooltipMouseLeave(): void {
    this._wayTooltipHovering.set(false);
    this.scheduleWayTooltipClose();
  }

  // Keeps selected way state aligned to the currently selected card.
  private syncWaySelectionWithCurrentSelection(): void {
    const selectedKeys = this._selectedEntryKeys();
    const selectedWayEntryKey = this._selectedWayEntryKey();

    if (!selectedWayEntryKey || selectedKeys.length !== 1 || selectedKeys[0] !== selectedWayEntryKey) {
      this._selectedWayEntryKey.set(null);
      this._selectedWayId.set(null);
    }
  }

  // Returns true when an entry can display modal-local Way choices.
  private canShowWayTooltipForEntry(entry: PromptSelectionEntry): boolean {
    return this.showWaySelection() && entry.kind === 'card' && entry.selectable && entry.isActionCard;
  }

  // Returns selected prompt entries in click order.
  private selectedEntries(): PromptSelectionEntry[] {
    const entryMap = new Map(this.entries().map((entry) => [entry.key, entry]));
    return this._selectedEntryKeys()
      .map((entryKey) => entryMap.get(entryKey))
      .filter((entry): entry is PromptSelectionEntry => !!entry);
  }

  // Returns selected source ids used as prompt result payload.
  private selectedSourceIds(): number[] {
    return this.selectedEntries().map((entry) => entry.sourceId);
  }

  // Computes current validation result from count spec and selected count.
  private isValidSelection(): boolean {
    const content = this.content();
    if (content.type === 'display-cards') {
      return true;
    }
    return validateCountSpec(content.selectCount, this._selectedEntryKeys().length);
  }

  // Returns selected way id when the selected card still matches way-selection state.
  private resolveSelectedWayIdForEmission(): CardLikeId | null {
    const selectedEntries = this.selectedEntries();
    if (selectedEntries.length !== 1) {
      return null;
    }

    const [selectedEntry] = selectedEntries;
    if (!selectedEntry || this._selectedWayEntryKey() !== selectedEntry.key) {
      return null;
    }

    return this._selectedWayId();
  }

  // True when the prompt's count spec demands exactly one selection —
  // clicking a different entry then moves the selection instead of
  // stacking into an invalid two-selected state.
  private isSingleSelection(): boolean {
    const content = this.content();
    if (content.type !== 'select') {
      return false;
    }
    const countSpec = resolveCountSpec(content.selectCount);
    return countSpec.kind === 'fixed'
      ? countSpec.count === 1
      : countSpec.min === 1 && countSpec.max === 1;
  }

  // Cancels in-flight tooltip close timers.
  private cancelWayTooltipClose(): void {
    if (this._wayTooltipCloseTimeout) {
      clearTimeout(this._wayTooltipCloseTimeout);
      this._wayTooltipCloseTimeout = null;
    }
  }

  // Schedules delayed tooltip close for cursor transitions from card to tooltip.
  private scheduleWayTooltipClose(): void {
    this.cancelWayTooltipClose();
    const tooltipCloseDelayMs = this.resolveTooltipCloseDelayMs();
    this._wayTooltipCloseTimeout = setTimeout(() => {
      this._wayTooltipCloseTimeout = null;
      if (!this._wayTooltipHovering()) {
        this._wayTooltipEntryKey.set(null);
      }
    }, tooltipCloseDelayMs);
  }

  // Resolves runtime-configured tooltip close delay with a stable default.
  private resolveTooltipCloseDelayMs(): number {
    const configuredDelay = this._debugRuntimeContext()?.tooltipDefaultCloseDelayMs;
    if (configuredDelay !== undefined) {
      return Math.max(0, Math.floor(configuredDelay));
    }
    return PromptSelectContentComponent.DEFAULT_TOOLTIP_CLOSE_DELAY_MS;
  }

  // Anchors the tooltip beside the hovered card in viewport space. The panel
  // is position: fixed, so it escapes the dialog body's scroll/overflow
  // clipping entirely (board-flyout parity). getBoundingClientRect already
  // yields viewport coordinates.
  private resolveTooltipPosition(anchorElement: HTMLElement): { left: number; top: number } {
    const anchorRect = anchorElement.getBoundingClientRect();

    const tooltipWidth = PromptSelectContentComponent.TOOLTIP_ESTIMATED_WIDTH_PX;
    const tooltipHeight = this.estimateTooltipHeight();
    const padding = PromptSelectContentComponent.TOOLTIP_PADDING_PX;
    const edgeOverlap = PromptSelectContentComponent.TOOLTIP_EDGE_OVERLAP_PX;

    const maxLeft = Math.max(padding, window.innerWidth - tooltipWidth - padding);
    let left = anchorRect.right - edgeOverlap;
    if (left > maxLeft) {
      // Flip to the card's left edge when the right side would overflow.
      left = anchorRect.left - tooltipWidth + edgeOverlap;
    }
    left = Math.min(Math.max(left, padding), maxLeft);

    const maxTop = Math.max(padding, window.innerHeight - tooltipHeight - padding);
    const top = Math.min(Math.max(anchorRect.top, padding), maxTop);

    return { left: Math.floor(left), top: Math.floor(top) };
  }

  // Estimates rendered tooltip height from the way count, capped by the
  // panel's scrollable max-height, for viewport clamping.
  private estimateTooltipHeight(): number {
    const wayCount = Math.max(1, this.sortedWayIds().length);
    const estimated = PromptSelectContentComponent.TOOLTIP_CHROME_PX +
      wayCount * PromptSelectContentComponent.TOOLTIP_ENTRY_HEIGHT_PX +
      (wayCount - 1) * PromptSelectContentComponent.TOOLTIP_ENTRY_GAP_PX;
    return Math.min(estimated, PromptSelectContentComponent.TOOLTIP_MAX_HEIGHT_PX);
  }
}
