import { Application, Container, Graphics, Text } from 'pixi.js';
import { AppButton, createAppButton } from '../../../../core/create-app-button';
import { clientSelectableCardsOverrideStore, selectedCardStore } from '../../../../state/interactive-state';
import { STANDARD_GAP } from '../../../../core/app-contants';
import { PlayerId, UserPromptActionArgs } from 'shared/types';
import { List } from '@pixi/ui';
import { cardSelectionView } from './card-selection-view';
import { cardRearrangeView } from './card-rearrange-view';
import { cardBlindRearrangeView } from './card-blind-rearrange-view';
import { nameCardView } from './name-card-view';
import { SocketService } from '../../../../core/socket-service/socket.service';
import { overpayView } from './overpay-view';
import { numberInputView } from './number-input-view';
import { getPixiSceneTheme } from '../../../../theme/pixi-theme';

export const userPromptModal = (
  app: Application,
  socketService: SocketService,
  args: UserPromptActionArgs,
  selfPlayerId: PlayerId,
): Promise<unknown> => {
  const pixiTheme = getPixiSceneTheme();

  return new Promise((resolve) => {
    let validationBtn: AppButton;
    let contentView: Container;
    let contentResults: unknown;
    let selectedWayId: number | null | undefined = undefined;
    // Cache validation updates that happen before buttons render.
    let validationState: boolean | null = null;

    const modalContainer = new Container();
    const background = new Graphics();

    if (args.prompt) {
      const prompt = new Text({
        text: args.prompt,
        style: {
          fontSize: 36,
          fill: pixiTheme.text.onOverlay,
          wordWrap: true,
          wordWrapWidth: 400,
        }
      });
      prompt.x = Math.floor(-prompt.width * .5);
      modalContainer.addChild(prompt);
    }
    clientSelectableCardsOverrideStore.set([]);
    // Reset any prior selection state so prompt validation doesn't auto-complete.
    selectedCardStore.set([]);

    const cleanup = () => {
      app.stage.removeChild(modalContainer);
      selectedCardStore.set([]);
      clientSelectableCardsOverrideStore.set(null);
    };

    const actionButtonListener = (actionArgs?: { action?: string | number; result?: unknown }) => {
      const isNumberInput = args.content?.type === 'number-input';
      // Number-input prompts only emit a value when the submit action is used.
      const shouldEmitValue = isNumberInput &&
        actionArgs?.action !== undefined &&
        actionArgs.action === 1;
      const result = isNumberInput
        ? (shouldEmitValue ? (actionArgs?.result ?? contentResults) : actionArgs?.result)
        : (actionArgs?.result ?? contentResults);
      const response: { action?: string | number; result?: unknown; selectedWayId?: number | null } = {
        action: actionArgs?.action,
        result,
      };
      if (selectedWayId !== undefined) {
        response.selectedWayId = selectedWayId;
      }

      resolve(response);

      cleanup();
    }

    if (args.content) {
      switch (args.content.type) {
        case 'rearrange':
          contentView = cardRearrangeView(app, args.content);
          break;
        case 'blind-rearrange':
          contentView = cardBlindRearrangeView(args.content);
          break;
        case 'name-card':
          contentView = nameCardView(app, args.content, socketService, selfPlayerId);
          contentView.on('finished', () => {
            actionButtonListener()
          });
          break;
        case 'number-input':
          // Render a numeric input prompt with validation.
          contentView = numberInputView(app, args.content);
          break;
        case 'overpay': {
          contentView = overpayView(app, args.content);
          break;
        }
        case 'display-cards':
        default:
          contentView = cardSelectionView(app, args.content);

          contentView.on('finished', () => {
            actionButtonListener()
          });

          break;
      }

      if (contentView) {
        contentView.on('removed', () => {
          contentView.removeAllListeners();
        });

        contentView.on('validationUpdated', valid => {
          // Cache validation state so we can apply it once the button exists.
          validationState = valid;
          if (validationBtn) {
            validationBtn.button.alpha = valid ? 1 : .6;
            validationBtn.button.eventMode = valid ? 'static' : 'none';
          }
        });

        contentView.on('resultsUpdated', result => {
          contentResults = result;
        });

        contentView.on('selectedWayUpdated', (wayId: number | null) => {
          selectedWayId = wayId;
        });

        contentView.x = Math.floor(-contentView.width * .5);
        contentView.y = modalContainer.height + STANDARD_GAP;
        modalContainer.addChild(contentView);
      }
    }
    // Number-input prompts always use submit/cancel buttons with fixed actions.
    const actionButtons = args.content?.type === 'number-input'
      ? (() => {
        const buttons = [{ label: args.content.submitText ?? 'SUBMIT', action: 1 }];
        // Only show cancel when the prompt is optional.
        if (args.content.optional) {
          buttons.push({ label: args.content.cancelText ?? 'CANCEL', action: 0 });
        }
        return buttons;
      })()
      : args.actionButtons;
    // Number-input prompts always validate against the submit action.
    const validationAction = args.content?.type === 'number-input'
      ? 1
      : args.validationAction;
    setTimeout(() => {
      if (actionButtons) {
        const actionList = new List({
          maxWidth: 300,
          type: 'bidirectional',
          elementsMargin: STANDARD_GAP
        });

        actionButtons?.forEach(actionButton => {
          const btn = createAppButton({
            text: actionButton.label,
            style: {
              wordWrap: true,
              wordWrapWidth: 100,
              fill: pixiTheme.ui.buttonText,
              fontSize: 24,
            }
          });
          if (validationAction !== undefined && validationAction === actionButton.action) {
            validationBtn = btn;
          }
          btn.button.on('pointerdown', () => actionButtonListener({ action: actionButton.action }));
          btn.button.on('removed', () => btn.button.removeAllListeners());
          actionList.addChild(btn.button);
        });
        // Apply cached validation state if it fired before the buttons were created.
        if (validationBtn && validationState !== null) {
          validationBtn.button.alpha = validationState ? 1 : .6;
          validationBtn.button.eventMode = validationState ? 'static' : 'none';
        }

        actionList.y = modalContainer.height + STANDARD_GAP * 2;
        actionList.x = Math.floor(-actionList.width * .5);
        modalContainer.addChild(actionList);
      }


      background.roundRect(
        -modalContainer.width * .5 - STANDARD_GAP * 2,
        -STANDARD_GAP * 2,
        modalContainer.width + STANDARD_GAP * 4,
        modalContainer.height + STANDARD_GAP * 4,
        5
      )
        .fill({ color: pixiTheme.overlay.color, alpha: pixiTheme.overlay.strongAlpha });

      modalContainer.addChildAt(background, 0);

      // Display-only landscape modals use a close button for dismissal.
      const showCloseButton = args.content?.type === 'display-cards';
      if (showCloseButton) {
        const closeButton = createAppButton({
          text: 'X',
          style: { fill: pixiTheme.ui.buttonText, fontSize: 18 }
        });
        closeButton.button.on('pointerdown', () => actionButtonListener({ action: 0 }));
        closeButton.button.on('removed', () => closeButton.button.removeAllListeners());
        closeButton.button.x = Math.floor(modalContainer.width * .5) - closeButton.button.width - STANDARD_GAP;
        closeButton.button.y = Math.floor(-STANDARD_GAP * 1.5);
        modalContainer.addChild(closeButton.button);
      }

      modalContainer.x = app.renderer.width * .5;
      modalContainer.y = app.renderer.height * .5 - modalContainer.height * .5;
      app.stage.addChild(modalContainer);
    }, 50);
  });
}
