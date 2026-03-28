import { ExpansionListElement } from 'shared/types/index.ts';
import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { LoggerService } from './logger-service.ts';
import { ExpansionLoaderService } from './expansion-loader-service.ts';
import { AuthSessionService } from './auth/auth-session-service.ts';
import { PresetPasswordAuthProvider } from './auth/preset-password-auth-provider.ts';

// Owns one-time server startup tasks so server.ts can stay focused on composition and host wiring.
export class ServerStartupService {
  constructor(
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly expansionLoaderService: ExpansionLoaderService,
    private readonly loggerService: LoggerService,
    private readonly authSessionService: AuthSessionService,
    private readonly presetPasswordAuthProvider: PresetPasswordAuthProvider,
  ) {}

  // Loads expansion data/effects and notifies the lobby directory for game propagation.
  public async start(): Promise<void> {
    // Register and initialize auth providers before loading expansions.
    this.authSessionService.registerProvider(this.presetPasswordAuthProvider);
    await this.authSessionService.initializeProviders();

    try {
      const expansionList = (
        await import('@expansions/expansion-list.json', {
          with: { type: 'json' },
        })
      ).default as ExpansionListElement[];

      for (const expansion of expansionList) {
        this.loggerService.info(`[SERVER] loading expansion card data for ${expansion.title}`);
        await this.expansionLoaderService.loadExpansion(expansion);
        this.lobbyDirectoryService.expansionLoaded(expansion);
      }
    } catch (error) {
      this.loggerService.error('[SERVER] failed while loading expansions');
      this.loggerService.error(error);
      this.lobbyDirectoryService.dispose();
      throw error;
    }
  }
}
