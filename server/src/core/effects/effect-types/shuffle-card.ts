import { EffectBase } from './effect-base.ts';

export class ShuffleDeckEffect extends EffectBase {
  type = 'shuffleDeck' as const;
  playerId: number;
  
  constructor({ playerId }: { playerId: number }) {
    super({ sourcePlayerId: playerId });
    this.playerId = playerId;
  }
}
