import { ExpansionListElement } from 'shared/types/index.ts';
import { Game } from './game.ts';
import { LoggerService } from './logger-service.ts';
import { ExpansionLoaderService } from './expansion-loader-service.ts';

// Owns one-time server startup tasks so server.ts can stay focused on composition and host wiring.
export class ServerStartupService {
  constructor(
    private readonly game: Game,
    private readonly expansionLoaderService: ExpansionLoaderService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads expansion data/effects and notifies the game when each expansion is ready.
  public async start(): Promise<void> {
    try {
      const expansionList = (await import('@expansions/expansion-list.json', {
        with: { type: 'json' },
      })).default as ExpansionListElement[];

      for (const expansion of expansionList) {
        this.loggerService.info(`[SERVER] loading expansion card data for ${expansion.title}`);
        await this.expansionLoaderService.loadExpansion(expansion);
        this.game.expansionLoaded(expansion);
      }
    } catch (error) {
      this.loggerService.error('[SERVER] failed while loading expansions');
      this.loggerService.error(error);
      this.game.dispose();
      throw error;
    }
  }
}
