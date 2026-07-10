import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output
} from '@angular/core';
import { NgClass } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { LucideAngularModule, X } from 'lucide-angular';

export type UiDialogBackdropVariant = 'none' | 'medium' | 'strong';
// Visual skin applied to the panel: 'light' = design-guidelines dialog
// standard (surface-panel), 'dark' = match-overlay standard (translucent
// black), 'none' = chromeless (consumer paints its own chrome, e.g. card
// detail).
export type UiDialogSkin = 'light' | 'dark' | 'none';

// Named z-index ladder for all dialog surfaces. Later-attached overlays at
// the same layer stack above earlier ones (CDK appends in attach order), so
// fine-grained per-dialog offsets are no longer needed.
export const UI_DIALOG_LAYERS = {
  base: 3000,   // lobby and general confirmations
  hud: 4000,    // in-match HUD dialogs (pause, waiting, disconnect, resign, undo, mats)
  prompt: 4300, // server-driven prompt dialogs
  picker: 4400, // match-config selection/save/load dialogs
  detail: 5000, // card detail zoom — always topmost
} as const;
export type UiDialogLayer = keyof typeof UI_DIALOG_LAYERS;

@Component({
  selector: 'app-ui-dialog',
  imports: [NgClass, A11yModule, LucideAngularModule],
  templateUrl: './ui-dialog.component.html',
  styleUrl: './ui-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class UiDialogComponent implements AfterViewInit, OnDestroy {
  private readonly _overlay = inject(Overlay);
  private readonly _viewContainerRef = inject(ViewContainerRef);

  @ViewChild('dialogContent', { static: true }) private readonly _dialogContent!: TemplateRef<unknown>;

  private _overlayRef: OverlayRef | null = null;
  private _appliedBackdropVariant: UiDialogBackdropVariant | null = null;

  // Lucide icon reference for the standard header close-X.
  readonly XIcon = X;

  // Controls whether a full-screen backdrop is created for this dialog.
  hasBackdrop = input(true);
  // Backdrop intensity variant used by dialog overlays.
  backdropVariant = input<UiDialogBackdropVariant>('medium');
  // Optional panel class for per-dialog layout customization.
  panelClass = input<string | undefined>(undefined);
  // Visual skin: 'light' = design-guidelines dialog standard (surface-panel),
  // 'dark' = match-overlay standard (translucent black), 'none' = chromeless
  // (card detail). Panel radius/shadow/structure are shared by light+dark.
  skin = input<UiDialogSkin>('light');
  // Optional heading rendered in the standard header band with divider.
  heading = input<string | undefined>(undefined);
  // Shows the standard close-X in the header; clicking it requests dismissal.
  showClose = input(false);
  // Single gate for user-initiated dismissal (Escape, backdrop click, close-X).
  // When false the dialog can only be closed programmatically — required-action
  // prompts set this false so the user must perform the requested action.
  dismissable = input(true);
  // Named layer controlling z-index stacking; defaults to the base layer.
  layer = input<UiDialogLayer>('base');

  close = output<void>();

  // Skin + consumer panel classes applied to .ui-dialog-panel.
  readonly panelNgClass = computed(() => {
    const classes: Record<string, boolean> = {
      [`skin-${this.skin()}`]: this.skin() !== 'none',
    };
    const panelClass = this.panelClass();
    if (panelClass) {
      classes[panelClass] = true;
    }
    return classes;
  });

  constructor() {
    // Keep overlay z-index and backdrop variant in sync with input changes.
    effect(() => {
      const overlayRef = this._overlayRef;
      if (!overlayRef) {
        return;
      }

      this.applyZIndex(overlayRef);
      this.applyBackdropVariant(overlayRef);
    });
  }

  ngAfterViewInit(): void {
    const overlayRef = this._overlay.create({
      hasBackdrop: this.hasBackdrop(),
      backdropClass: 'ui-dialog-backdrop',
      panelClass: 'ui-dialog-overlay-pane',
      scrollStrategy: this._overlay.scrollStrategies.block(),
      positionStrategy: this._overlay.position().global().centerHorizontally().centerVertically(),
      disposeOnNavigation: false,
    });

    overlayRef.attach(new TemplatePortal(this._dialogContent, this._viewContainerRef));
    overlayRef.backdropClick().subscribe(() => this.onBackdropClick());

    // Escape requests dismissal. CDK's OverlayKeyboardDispatcher delivers
    // keydown only to the top-most overlay, so stacked dialogs behave.
    overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        this.requestDismiss();
      }
    });

    this._overlayRef = overlayRef;
    this.applyZIndex(overlayRef);
    this.applyBackdropVariant(overlayRef);
  }

  ngOnDestroy(): void {
    this._overlayRef?.dispose();
    this._overlayRef = null;
    this._appliedBackdropVariant = null;
  }

  // Handles backdrop clicks while preserving panel interactions.
  onBackdropClick() {
    this.requestDismiss();
  }

  // Handles the standard header close-X.
  onCloseClicked() {
    this.requestDismiss();
  }

  // Single user-dismissal gate: Escape, backdrop, and close-X all route here.
  // Non-dismissable dialogs (required actions) ignore all three.
  private requestDismiss(): void {
    if (!this.dismissable()) {
      return;
    }
    this.close.emit();
  }

  // Applies explicit z-index ordering to both overlay panel and backdrop,
  // resolved from the named layer ladder.
  private applyZIndex(overlayRef: OverlayRef): void {
    const baseZIndex = UI_DIALOG_LAYERS[this.layer()];
    overlayRef.hostElement.style.setProperty('z-index', String(baseZIndex + 1));
    overlayRef.overlayElement.style.setProperty('z-index', String(baseZIndex + 1));
    overlayRef.backdropElement?.style.setProperty('z-index', String(baseZIndex));
  }

  // Applies the selected backdrop variant class to the active overlay backdrop element.
  private applyBackdropVariant(overlayRef: OverlayRef): void {
    const backdropElement = overlayRef.backdropElement;
    if (!backdropElement) {
      return;
    }

    const nextVariant = this.backdropVariant();
    if (this._appliedBackdropVariant) {
      backdropElement.classList.remove(`variant-${this._appliedBackdropVariant}`);
    }
    backdropElement.classList.add(`variant-${nextVariant}`);
    this._appliedBackdropVariant = nextVariant;
  }
}
