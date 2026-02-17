import { ActionService, FindCardService, SupplyGainService } from '@server-types/index.ts';
import { CardId, CardKey, CardLocationSpec, PlayerId } from 'shared/types/index.ts';
import { LoggerService } from './logger-service.ts';

// Supply locations that can provide top cards for pile-key gain effects.
type SupplyLocation = 'basicSupply' | 'kingdomSupply';

export class DefaultSupplyGainService implements SupplyGainService {
  constructor(
    private readonly findCardService: FindCardService,
    private readonly actionService: ActionService,
    private readonly loggerService: LoggerService,
  ) {}

  // Gains the current top card for a pile key from Supply to the specified destination.
  public async gainTopSupplyCardForPileKey(args: {
    playerId: PlayerId;
    pileKey: CardKey;
    to: CardLocationSpec;
    from?: SupplyLocation | SupplyLocation[];
    logTag?: string;
  }): Promise<CardId | undefined> {
    const tag = args.logTag ?? 'gainTopSupplyCardForPileKey';
    const fromLocations = args.from
      ? (Array.isArray(args.from) ? args.from : [args.from])
      : ['basicSupply', 'kingdomSupply'];

    this.loggerService.debug(
      `[${tag}] attempting top-supply gain for player ${args.playerId}: pileKey=${args.pileKey}, from=${fromLocations.join(',')}, to=${args.to.location}`,
    );

    const topSupplyCard = this.findCardService.findTopSupplyCardForPileKey({
      pileKey: args.pileKey,
      from: args.from,
    });
    if (!topSupplyCard) {
      this.loggerService.debug(`[${tag}] no ${args.pileKey} pile card in Supply to gain`);
      return undefined;
    }

    this.loggerService.debug(`[${tag}] found top cardId=${topSupplyCard.id} for pile ${args.pileKey}, gaining now`);

    await this.actionService.run('gainCard', {
      playerId: args.playerId,
      cardId: topSupplyCard.id,
      to: args.to,
    });

    this.loggerService.debug(`[${tag}] gained cardId=${topSupplyCard.id} for player ${args.playerId}`);

    return topSupplyCard.id;
  }
}
