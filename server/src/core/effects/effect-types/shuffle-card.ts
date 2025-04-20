import { PlayerId } from "shared/shared-types.ts";
import { EffectArgs, EffectBase } from './effect-base.ts';

type ShuffleDeckArgs = {
  playerId: PlayerId
}

export class ShuffleDeckEffect extends EffectBase {
  type = 'shuffleDeck' as const;
  
  playerId: number;
  
  constructor(args: EffectArgs<ShuffleDeckArgs>) {
    super();
    this.playerId = args.playerId;
  }
}
