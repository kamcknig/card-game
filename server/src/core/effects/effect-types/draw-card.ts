import { PlayerId } from 'shared/shared-types.ts';
import { EffectArgs, EffectBase } from './effect-base.ts';

type DrawCardArgs = { playerId: PlayerId };

export class DrawCardEffect extends EffectBase{
  type = 'drawCard' as const;
  playerId: PlayerId;
  
  constructor(args: EffectArgs<DrawCardArgs>) {
    super(args);
    this.playerId = args.playerId;
  }
}
