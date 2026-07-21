import { ActionService, FindCardService, SupplyGainService } from '@server-types/index.ts';
import { CardId, CardKey, CardLocationSpec, LogEntrySource, PlayerId } from 'shared/types/index.ts';
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
    source?: LogEntrySource;
  }): Promise<CardId | undefined> {
    const tag = args.logTag ?? 'gainTopSupplyCardForPileKey';
    const fromLocations = args.from
      ? Array.isArray(args.from)
        ? args.from
        : [args.from]
      : ['basicSupply', 'kingdomSupply'];

    this.loggerService.debug(
      `[${tag}] attempting top-supply gain for player ${args.playerId}: pileKey=${args.pileKey}, from=${fromLocations.join(
        ',',
      )}, to=${args.to.location}`,
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

    await this.actionService.run(
      'gainCard',
      {
        playerId: args.playerId,
        cardId: topSupplyCard.id,
        to: args.to,
      },
      // Explicit source attribution: this service's actionService is a match-scoped singleton,
      // not the per-effect wrapped instance, so it never auto-injects a source (see the
      // SupplyGainService type comment).
      args.source !== undefined ? { source: args.source } : undefined,
    );

    this.loggerService.debug(`[${tag}] gained cardId=${topSupplyCard.id} for player ${args.playerId}`);

    return topSupplyCard.id;
  }

  // Gains the current top card for a named non-supply pile to the specified destination.
  public async gainTopNonSupplyCardForPileName(args: {
    playerId: PlayerId;
    pileName: string;
    to: CardLocationSpec;
    logTag?: string;
    source?: LogEntrySource;
  }): Promise<CardId | undefined> {
    const tag = args.logTag ?? 'gainTopNonSupplyCardForPileName';
    this.loggerService.debug(
      `[${tag}] attempting top non-supply gain for player ${args.playerId}: pileName=${args.pileName}, to=${args.to.location}`,
    );

    const topNonSupplyCard = this.findCardService.findTopNonSupplyCardForPileName({
      pileName: args.pileName,
    });
    if (!topNonSupplyCard) {
      this.loggerService.debug(`[${tag}] no top card found in non-supply pile ${args.pileName}`);
      return undefined;
    }

    this.loggerService.debug(
      `[${tag}] found top cardId=${topNonSupplyCard.id} in non-supply pile ${args.pileName}, gaining now`,
    );

    await this.actionService.run(
      'gainCard',
      {
        playerId: args.playerId,
        cardId: topNonSupplyCard.id,
        to: args.to,
      },
      args.source !== undefined ? { source: args.source } : undefined,
    );

    this.loggerService.debug(`[${tag}] gained cardId=${topNonSupplyCard.id} for player ${args.playerId}`);

    return topNonSupplyCard.id;
  }
}
