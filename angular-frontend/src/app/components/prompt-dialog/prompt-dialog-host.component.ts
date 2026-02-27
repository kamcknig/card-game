import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActionButtons, UserPromptActionArgs } from 'shared/types';
import { UiDialogComponent } from '../ui/dialog/ui-dialog.component';
import { PromptDialogCoordinatorService } from '../../core/prompt-dialog/prompt-dialog-coordinator.service';
import { PromptSelectContentComponent } from './content/prompt-select-content.component';
import { PromptNumberInputContentComponent } from './content/prompt-number-input-content.component';
import { PromptNameCardContentComponent } from './content/prompt-name-card-content.component';
import { PromptOverpayContentComponent } from './content/prompt-overpay-content.component';
import { PromptRearrangeContentComponent } from './content/prompt-rearrange-content.component';
import { PromptBlindRearrangeContentComponent } from './content/prompt-blind-rearrange-content.component';
import { PromptSelectPileContentComponent } from './content/prompt-select-pile-content.component';

@Component({
  selector: 'app-prompt-dialog-host',
  imports: [
    UiDialogComponent,
    PromptSelectContentComponent,
    PromptNumberInputContentComponent,
    PromptNameCardContentComponent,
    PromptOverpayContentComponent,
    PromptRearrangeContentComponent,
    PromptBlindRearrangeContentComponent,
    PromptSelectPileContentComponent,
  ],
  templateUrl: './prompt-dialog-host.component.html',
  styleUrl: './prompt-dialog-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptDialogHostComponent {
  private readonly _promptDialogCoordinator = inject(PromptDialogCoordinatorService);

  private readonly _validationState = signal(true);
  private readonly _contentResult = signal<unknown>(undefined);
  private readonly _selectedWayId = signal<number | null | undefined>(undefined);

  // Resets host-local prompt state whenever active request changes.
  private readonly _resetHostState = effect(() => {
    this.activeRequest()?.id;
    this._validationState.set(true);
    this._contentResult.set(undefined);
    this._selectedWayId.set(undefined);
  });

  // Active prompt request emitted by the prompt dialog coordinator.
  readonly activeRequest = this._promptDialogCoordinator.activeRequest;

  // Convenience accessor for active prompt args.
  readonly promptArgs = computed(() => this.activeRequest()?.args);

  // Resolved action button list with number-input/select defaults.
  readonly resolvedActionButtons = computed<ActionButtons | undefined>(() => {
    const promptArgs = this.promptArgs();
    const promptContent = promptArgs?.content;

    if (!promptArgs) {
      return undefined;
    }

    if (promptContent?.type === 'number-input') {
      const actionButtons: ActionButtons = [{ label: promptContent.submitText ?? 'SUBMIT', action: 1 }];
      if (promptContent.optional) {
        actionButtons.push({ label: promptContent.cancelText ?? 'CANCEL', action: 0 });
      }
      return actionButtons;
    }

    if (promptArgs.actionButtons?.length) {
      return promptArgs.actionButtons;
    }

    // Provide a default confirm action for select prompts that do not define action buttons.
    if (promptContent?.type === 'select') {
      return [{ label: 'Confirm', action: 1 }];
    }

    return undefined;
  });

  // Action id that should be disabled until prompt validation passes.
  readonly validationAction = computed<number | undefined>(() => {
    const promptArgs = this.promptArgs();
    const promptContent = promptArgs?.content;

    if (!promptArgs) {
      return undefined;
    }

    if (promptContent?.type === 'number-input') {
      return 1;
    }

    if (promptArgs.validationAction !== undefined) {
      return promptArgs.validationAction;
    }

    if (promptContent?.type === 'select' && !promptArgs.actionButtons?.length) {
      return 1;
    }

    return undefined;
  });

  // Display-cards prompts include an explicit close button in the panel header.
  readonly showDisplayCloseButton = computed(() => this.promptArgs()?.content?.type === 'display-cards');

  // Action-less prompt payloads still need an explicit close affordance.
  readonly showFallbackCloseButton = computed(() => {
    const promptArgs = this.promptArgs();
    if (!promptArgs || promptArgs.content) {
      return false;
    }
    return !(this.resolvedActionButtons()?.length);
  });

  // Current prompt validation state used by action button disable logic.
  readonly validationState = computed(() => this._validationState());

  // Updates host validation state from prompt content.
  onValidationUpdated(valid: boolean): void {
    this._validationState.set(valid);
  }

  // Updates host result payload from prompt content.
  onResultsUpdated(result: unknown): void {
    this._contentResult.set(result);
  }

  // Updates host way-selection payload from select prompt content.
  onSelectedWayUpdated(wayId: number | null): void {
    this._selectedWayId.set(wayId);
  }

  // Handles content-level finish events.
  onContentFinished(): void {
    this.submitResponse();
  }

  // Handles explicit dialog action button clicks.
  onActionSelected(action: string | number): void {
    this.submitResponse(action);
  }

  // Handles display-only close button actions.
  onDisplayClose(): void {
    this.submitResponse(0);
  }

  // Returns true when a button action should be disabled by validation state.
  isActionDisabled(action: string | number): boolean {
    const validationAction = this.validationAction();
    if (validationAction === undefined) {
      return false;
    }

    return validationAction === action && !this._validationState();
  }

  // Resolves the active prompt with normalized action/result payload semantics.
  private submitResponse(action?: string | number): void {
    const promptArgs = this.promptArgs();
    const promptContent = promptArgs?.content;

    if (!promptArgs) {
      this._promptDialogCoordinator.cancelActivePrompt();
      return;
    }

    const isNumberInputPrompt = promptContent?.type === 'number-input';
    const shouldEmitNumberInputValue = isNumberInputPrompt && action === 1;

    const result = isNumberInputPrompt
      ? (shouldEmitNumberInputValue ? this._contentResult() : undefined)
      : this._contentResult();

    const response: {
      action?: string | number;
      result?: unknown;
      selectedWayId?: number | null;
    } = {
      action,
      result,
    };

    const selectedWayId = this._selectedWayId();
    if (selectedWayId !== undefined) {
      response.selectedWayId = selectedWayId;
    }

    this._promptDialogCoordinator.resolveActivePrompt(response);
  }
}
