import { EffectArgs, EffectBase } from './effect-base.ts';
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
  
  constructor(args: EffectArgs<ModifyCostEffectArgs>) {
    super(args);
    this.expiresAt = args.expiresAt;
    this.amount = args.amount;
    this.appliesTo = args.appliesToPlayer;
    this.appliesToCard = args.appliesToCard;
  }
}