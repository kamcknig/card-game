import { Application, Container, Graphics, Text } from 'pixi.js';
import { AppButton, createAppButton } from '../../../../core/create-app-button';
import { clientSelectableCardsOverrideStore, selectedCardStore } from '../../../../state/interactive-state';
import { STANDARD_GAP } from '../../../../core/app-contants';
import { PlayerId, UserPromptActionArgs } from 'shared/shared-types';
import { List } from '@pixi/ui';
import { cardSelectionView } from './card-selection-view';
import { cardRearrangeView } from './card-rearrange-view';
import { cardBlindRearrangeView } from './card-blind-rearrange-view';
import { nameCardView } from './name-card-view';
import { SocketService } from '../../../../core/socket-service/socket.service';

export const userPromptModal = (
  app: Application,
  socketService: SocketService,
  args: UserPromptActionArgs,
  selfPlayerId: PlayerId,
): Promise<unknown> => {
  return new Promise((resolve) => {
    let validationBtn: AppButton;
    let contentView: Container;
    let contentResults: unknown;

    const modalContainer = new Container();
    const background = new Graphics();

    if (args.prompt) {
      const prompt = new Text({
        text: args.prompt,
        style: {
          fontSize: 36,
          fill: 'white',
          wordWrap: true,
          wordWrapWidth: 400,
        }
      });
      prompt.x = Math.floor(-prompt.width * .5);
      modalContainer.addChild(prompt);
    }

    const cleanup = () => {
      app.stage.removeChild(modalContainer);
      selectedCardStore.set([]);
      clientSelectableCardsOverrideStore.set(null);
    };

    const actionButtonListener = (args?: { action?: number; result?: unknown}) => {
      resolve({
        action: args?.action,
        result: args?.result ?? contentResults
      });

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
        default:
          contentView = cardSelectionView(app, args.content);

          contentView.on('finished', () => {
            actionButtonListener()
          });

          contentView.on('validationUpdated', valid => {
            if (validationBtn) {
              validationBtn.button.alpha = valid ? 1 : .6;
              validationBtn.button.eventMode = valid ? 'static' : 'none';
            }
          });
          break;
      }

      if (contentView) {
        contentView.on('removed', () => {
          contentView.removeAllListeners();
        });

        contentView.on('resultsUpdated', result => {
          contentResults = result;
        });

        contentView.x = Math.floor(-contentView.width * .5);
        contentView.y = modalContainer.height + STANDARD_GAP;
        modalContainer.addChild(contentView);
      }
    }

    if (args.actionButtons) {
      const actionList = new List({
        maxWidth: 300,
        type: 'bidirectional',
        elementsMargin: STANDARD_GAP
      });

      args.actionButtons?.forEach(actionButton => {
        const btn = createAppButton({
          text: actionButton.label,
          style: {
            wordWrap: true,
            wordWrapWidth: 100,
            fill: 'white',
            fontSize: 24,
          }
        });
        if (args.validationAction === actionButton.action) {
          validationBtn = btn;
        }
        btn.button.on('pointerdown', () => actionButtonListener({action: actionButton.action}));
        btn.button.on('removed', () => btn.button.removeAllListeners());
        actionList.addChild(btn.button);
      });

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
      .fill({ color: 'black', alpha: .8 });

    modalContainer.addChildAt(background, 0);
    modalContainer.x = app.renderer.width * .5;
    modalContainer.y = app.renderer.height * .5 - modalContainer.height * .5;
    app.stage.addChild(modalContainer);
  });
}
