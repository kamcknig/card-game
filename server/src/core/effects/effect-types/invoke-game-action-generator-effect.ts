import { EffectBase } from './effect-base.ts';
import { GameActionOverrides, GameActions, GameActionTypes } from '../../../types.ts';

export type InvokeGameActionGeneratorArgs<T extends GameActionTypes> = {
  gameAction: T;
  context: GameActions[T];
  overrides?: GameActionOverrides;
}

export class InvokeGameActionGeneratorEffect<T extends GameActionTypes = GameActionTypes> extends EffectBase {
  type = 'invokeGameActionGenerator' as const;
  
  gameAction: T;
  context: GameActions[T];
  overrides?: GameActionOverrides = {
    moveCard: true,
    playCard: true,
    actionCost: 1,
  };
  
  constructor(args:  InvokeGameActionGeneratorArgs<T>) {
    super();
    
    this.gameAction = args.gameAction;
    this.context = args.context;
    this.overrides = {
      moveCard: args.overrides?.moveCard ?? true,
      playCard: args.overrides?.playCard ?? true,
      actionCost: args.overrides?.actionCost
    };
  }
}
