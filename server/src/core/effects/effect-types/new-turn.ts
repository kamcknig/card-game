import { EffectBase } from './effect-base.ts';

export class NewTurnEffect extends EffectBase {
  type = 'newTurn' as const;
  
  constructor() {
    super();
  }
}