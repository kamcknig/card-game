import { EffectBase, EffectBaseArgs } from "./effect-base.ts";

export class GainActionEffect extends EffectBase {
  type = "gainAction" as const;
  count: number;

  constructor({ count, ...arg }: { count: number } & EffectBaseArgs) {
    super(arg);
    this.count = count;
  }
}
