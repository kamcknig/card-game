import { Container, Graphics, Text } from 'pixi.js';
import { AppButton, createAppButton } from '../../core/create-app-button';
import { app } from '../../core/create-app';
import { $selectableCards, $selectedCards } from '../../state/interactive-state';
import { STANDARD_GAP } from '../../app-contants';
import { UserPromptEffectArgs } from 'shared/shared-types';
import { List } from '@pixi/ui';
import { cardSelectionView } from './card-selection-view';
import { cardRearrangeView } from './card-rearrange-view';
import { cardBlindRearrangeView } from './card-blind-rearrange-view';

export const userPromptModal = (args: UserPromptEffectArgs): Promise<unknown> => {
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
      $selectedCards.set([]);
      $selectableCards.set([]);
    };
    
    const actionButtonListener = (args?: { action?: number; result?: unknown}) => {
      resolve({
        action: args?.action,
        result: args?.result ?? contentResults
      });
      
      cleanup();
    }
    
    if (args.content?.cards) {
      switch (args.content.cards.action) {
        case 'rearrange':
          contentView = cardSelectionView(args.content.cards);
          
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
        case 'blind-rearrange':
          contentView = cardBlindRearrangeView(args.content.cards);
          break;
        default:
          contentView = cardRearrangeView(args.content.cards);
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
        maxWidth: 250,
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
      
      actionList.y = modalContainer.height + STANDARD_GAP;
      actionList.x = Math.floor(-actionList.width * .5);
      modalContainer.addChild(actionList);
    }
    
    background.roundRect(
      -modalContainer.width * .5 - STANDARD_GAP,
      -STANDARD_GAP,
      modalContainer.width + STANDARD_GAP * 2,
      modalContainer.height + STANDARD_GAP * 2,
      5
    )
      .fill({ color: 'black', alpha: .6 });
    
    modalContainer.addChildAt(background, 0);
    modalContainer.x = app.renderer.width * .5;
    modalContainer.y = app.renderer.height * .5 - modalContainer.height * .5;
    app.stage.addChild(modalContainer);
  });
}