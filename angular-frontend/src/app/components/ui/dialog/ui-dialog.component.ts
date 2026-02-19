import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  effect,
  inject,
  input,
  output
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

export type UiDialogBackdropVariant = 'none' | 'soft' | 'strong';

@Component({
  selector: 'app-ui-dialog',
  imports: [NgClass],
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

  // Controls whether clicking the backdrop dismisses the dialog.
  closeOnBackdrop = input(true);
  // Controls whether a full-screen backdrop is created for this dialog.
  hasBackdrop = input(true);
  // Controls z-index stacking for dialog ordering.
  zIndex = input(3000);
  // Backdrop intensity variant used by dialog overlays.
  backdropVariant = input<UiDialogBackdropVariant>('soft');
  // Optional panel class for per-dialog layout customization.
  panelClass = input<string | undefined>(undefined);

  close = output<void>();

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
    if (!this.closeOnBackdrop()) {
      return;
    }
    this.close.emit();
  }

  // Applies explicit z-index ordering to both overlay panel and backdrop.
  private applyZIndex(overlayRef: OverlayRef): void {
    const baseZIndex = this.zIndex();
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
