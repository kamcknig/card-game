import { PlayerId } from "shared/shared-types.ts";
import { EffectBase } from './effect-base.ts';

type ShuffleDeckArgs = {
  playerId: PlayerId
}

export class ShuffleDeckEffect extends EffectBase {
  type = 'shuffleDeck' as const;
  
  playerId: number;
  
  constructor(args: ShuffleDeckArgs) {
    super();
    this.playerId = args.playerId;
  }
}
