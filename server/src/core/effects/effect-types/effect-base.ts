type Args = {
  log?: boolean;
  isRootLog?: boolean;
};

export type EffectArgs<T> = T & Args;

export abstract class EffectBase {
  abstract type: string;
  
  log: boolean;
  isRootLog: boolean;
  
  protected constructor(args: Args = {}) {
    this.log = args.log ?? true;
    this.isRootLog = args.isRootLog ?? true;
  }
}