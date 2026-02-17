import { ExpansionListElement } from 'shared/types/index.ts';
import { Game } from './game.ts';
import { loadExpansion } from '../utils/load-expansion.ts';
import { ExpansionEffectRegistryService } from './expansion-effect-registry-service.ts';

// Owns one-time server startup tasks so server.ts can stay focused on composition and host wiring.
export class ServerStartupService {
  constructor(
    private readonly game: Game,
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
  ) {}

  // Loads expansion data/effects and notifies the game when each expansion is ready.
  public async start(): Promise<void> {
    try {
      const expansionList = (await import('@expansions/expansion-list.json', {
        with: { type: 'json' },
      })).default as ExpansionListElement[];

      for (const expansion of expansionList) {
        console.info(`[SERVER] loading expansion card data for ${expansion.title}`);
        await loadExpansion(expansion, this.expansionEffectRegistryService);
        this.game.expansionLoaded(expansion);
      }
    } catch (error) {
      console.error('[SERVER] failed while loading expansions');
      console.error(error);
      this.game.dispose();
      throw error;
    }
  }
}
