import { EffectBase, EffectBaseArgs } from "./effect-base.ts";
import { Card, LocationSpec } from "shared/shared-types.ts";

export class GainCardEffect extends EffectBase {
  type = "gainCard" as const;
  cardId: number;
  cost?: Card["cost"];
  to: LocationSpec;
  playerId: number;

  constructor({ cardId, cost, to, playerId, ...arg }: {
    cardId: number;
    cost?: Card["cost"];
    to: LocationSpec;
    playerId: number;
  } & EffectBaseArgs) {
    super(arg);
    this.cardId = cardId;
    this.cost = cost;
    this.to = to;
    this.playerId = playerId;
  }
}
