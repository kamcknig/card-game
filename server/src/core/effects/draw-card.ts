import { EffectBase, EffectBaseArgs } from "./effect-base.ts";

export class DrawCardEffect extends EffectBase {
  type = "drawCard" as const;
  playerId: number;

  constructor({ playerId, ...arg }: { playerId: number } & EffectBaseArgs) {
    super(arg);
    this.playerId = playerId;
  }
}
