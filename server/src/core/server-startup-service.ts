import { ExpansionListElement } from 'shared/types/index.ts';
import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { LoggerService } from './logger-service.ts';
import { ExpansionLoaderService } from './expansion-loader-service.ts';
import { AuthSessionService } from './auth/auth-session-service.ts';
import { UserAccountAuthProvider } from './auth/user-account-auth-provider.ts';
import { AuthSessionCleanupService } from './auth/auth-session-cleanup-service.ts';
import { DenoKvSessionStore } from './auth/deno-kv-session-store.ts';
import { DenoKvUserStore } from './auth/deno-kv-user-store.ts';
import { DenoKvRegistrationCodeStore } from './auth/deno-kv-registration-code-store.ts';
import { AuthKvProvider } from './auth/auth-kv-provider.ts';
import { ServerConfigService } from './server-config-service.ts';
import type { SessionStore } from './auth/session-store.ts';
import type { UserStore } from './auth/user-store.ts';
import type { RegistrationCodeStore } from './auth/registration-code-store.ts';
import { GameDataKvProvider } from './game-data-kv-provider.ts';
import { DenoKvMatchConfigurationSaveService } from './deno-kv-match-configuration-save-service.ts';
import type { MatchConfigurationSaveStore } from './match-configuration-save-store.ts';

// Owns one-time server startup tasks so server.ts can stay focused on composition and host wiring.
export class ServerStartupService {
  constructor(
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly expansionLoaderService: ExpansionLoaderService,
    private readonly loggerService: LoggerService,
    private readonly authSessionService: AuthSessionService,
    private readonly userAccountAuthProvider: UserAccountAuthProvider,
    private readonly authSessionCleanupService: AuthSessionCleanupService,
    private readonly serverConfigService: ServerConfigService,
    private readonly sessionStore: SessionStore,
    private readonly userStore: UserStore,
    private readonly registrationCodeStore: RegistrationCodeStore,
    private readonly authKvProvider: AuthKvProvider,
    private readonly gameDataKvProvider: GameDataKvProvider,
    private readonly matchConfigurationSaveService: MatchConfigurationSaveStore,
  ) {}

  // Loads expansion data/effects and notifies the lobby directory for game propagation.
  public async start(): Promise<void> {
    // When using the Deno KV stores, open a single shared KV handle
    // and hand it to every KV-backed store so only one handle exists per
    // Deno.Kv file (Deno forbids multiple concurrent handles to the same
    // file-backed database in one process). All three stores load their
    // caches from the shared handle before the HTTP server accepts
    // connections.
    if (this.sessionStore instanceof DenoKvSessionStore) {
      const kvPath = this.serverConfigService.getAuthKvPath();
      this.loggerService.info(`[server startup] opening shared Deno KV auth store at '${kvPath}'`);
      const kv = await this.authKvProvider.open(kvPath);
      await this.sessionStore.open(kv, Date.now());

      // User/registration-code stores only exist as KV instances when the
      // session store is KV (see register-root-services.ts selection logic).
      if (this.userStore instanceof DenoKvUserStore) {
        await this.userStore.open(kv);
      }
      if (this.registrationCodeStore instanceof DenoKvRegistrationCodeStore) {
        await this.registrationCodeStore.open(kv);
      }
    }

    // When using the Deno KV game-data store, open a single shared KV handle
    // via GameDataKvProvider and hand it to the match-configuration save service
    // so that all game-data consumers share a single handle (separate from
    // the auth KV file).
    if (this.matchConfigurationSaveService instanceof DenoKvMatchConfigurationSaveService) {
      const kvPath = this.serverConfigService.getGameDataKvPath();
      this.loggerService.info(`[server startup] opening game-data KV store at '${kvPath}'`);
      const kv = await this.gameDataKvProvider.open(kvPath);
      await this.matchConfigurationSaveService.open(kv);
    }

    // Register the user-account provider for per-user credential management.
    this.authSessionService.registerProvider(this.userAccountAuthProvider);
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
