import { EffectBase, EffectBaseArgs } from "./effect-base.ts";
import { LocationSpec } from "shared/shared-types.ts";

export class MoveCardEffect extends EffectBase {
  type = "moveCard" as const;
  cardId: number;
  to: LocationSpec;
  playerId: number | undefined;

  constructor(
    { playerId, cardId, to, ...arg }: {
      cardId: number;
      to: LocationSpec;
      playerId?: number;
    } & EffectBaseArgs,
  ) {
    super(arg);
    this.cardId = cardId;
    this.to = to;
    this.playerId = playerId;
  }
}
