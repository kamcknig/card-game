import { ExpansionListElement } from 'shared/types/index.ts';
import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { LoggerService } from './logger-service.ts';
import { ExpansionLoaderService } from './expansion-loader-service.ts';
import { AuthSessionService } from './auth/auth-session-service.ts';
import { PresetPasswordAuthProvider } from './auth/preset-password-auth-provider.ts';
import { AuthSessionCleanupService } from './auth/auth-session-cleanup-service.ts';
import { DenoKvSessionStore } from './auth/deno-kv-session-store.ts';
import { ServerConfigService } from './server-config-service.ts';
import type { SessionStore } from './auth/session-store.ts';

// Owns one-time server startup tasks so server.ts can stay focused on composition and host wiring.
export class ServerStartupService {
  constructor(
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly expansionLoaderService: ExpansionLoaderService,
    private readonly loggerService: LoggerService,
    private readonly authSessionService: AuthSessionService,
    private readonly presetPasswordAuthProvider: PresetPasswordAuthProvider,
    private readonly authSessionCleanupService: AuthSessionCleanupService,
    private readonly serverConfigService: ServerConfigService,
    private readonly sessionStore: SessionStore,
  ) {}

  // Loads expansion data/effects and notifies the lobby directory for game propagation.
  public async start(): Promise<void> {
    // When using the Deno KV session store, load persisted sessions from disk
    // into the write-through cache before the HTTP server starts accepting
    // connections. This must happen before initializeProviders() so that any
    // middleware relying on session validation sees the full restored state.
    if (this.sessionStore instanceof DenoKvSessionStore) {
      const kvPath = this.serverConfigService.getAuthKvPath();
      this.loggerService.info(`[server startup] opening Deno KV session store at '${kvPath}'`);
      await this.sessionStore.open(kvPath, Date.now());
    }

    // Register and initialize auth providers before loading expansions.
    this.authSessionService.registerProvider(this.presetPasswordAuthProvider);
    await this.authSessionService.initializeProviders();

    // Start periodic cleanup of expired sessions after providers are ready.
    this.authSessionCleanupService.start();

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
