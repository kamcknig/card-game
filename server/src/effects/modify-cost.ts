import { EffectBase, EffectBaseArgs } from './effect-base.ts';
import { Card, EffectTarget } from 'shared/shared-types.ts';

export type ModifyCostEffectArgs = {
  expiresAt: 'TURN_END';
  amount: number;
  appliesToPlayer: EffectTarget;
  appliesToCard: 'ALL' | ((card: Card) => boolean);
}

export class ModifyCostEffect extends EffectBase {
  type = 'modifyCost' as const;
  
  public expiresAt: ModifyCostEffectArgs['expiresAt'];
  public amount: number;
  public appliesTo: EffectTarget;
  public appliesToCard: ModifyCostEffectArgs['appliesToCard'];
  
  constructor({expiresAt, amount, appliesToPlayer, appliesToCard, ...arg}: EffectBaseArgs & ModifyCostEffectArgs) {
    super(arg);
    this.expiresAt = expiresAt;
    this.amount = amount;
    this.appliesTo = appliesToPlayer;
    this.appliesToCard = appliesToCard;
  }
}