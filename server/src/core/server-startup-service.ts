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
import { SupabaseSessionStore } from './auth/supabase-session-store.ts';
import { SupabaseUserStore } from './auth/supabase-user-store.ts';
import { SupabaseRegistrationCodeStore } from './auth/supabase-registration-code-store.ts';
import { SupabaseMatchConfigurationSaveService } from './supabase-match-configuration-save-service.ts';
import { AuthKvProvider } from './auth/auth-kv-provider.ts';
import { SupabaseClientProvider } from './storage/supabase-client-provider.ts';
import { ServerConfigService } from './server-config-service.ts';
import { ServerHealthService } from './server-health-service.ts';
import type { SessionStore } from './auth/session-store.ts';
import type { UserStore } from './auth/user-store.ts';
import type { RegistrationCodeStore } from './auth/registration-code-store.ts';
import { GameDataKvProvider } from './game-data-kv-provider.ts';
import { DenoKvMatchConfigurationSaveService } from './deno-kv-match-configuration-save-service.ts';
import type { MatchConfigurationSaveStore } from './match-configuration-save-store.ts';

/**
 * Owns one-time server startup tasks so server.ts can stay focused on
 * composition and host wiring.
 *
 * After `serverConfigService.validate()` succeeds in ServerBootstrapService,
 * this service sets the health backend label and opens the selected storage
 * backend. For 'supabase', failures are caught and registered as
 * `SUPABASE_OPEN_FAILED` issues so the server continues serving the /status
 * endpoint even when the storage layer is unavailable.
 */
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
    private readonly supabaseClientProvider: SupabaseClientProvider,
    private readonly serverHealthService: ServerHealthService,
  ) {}

  /**
   * Loads expansion data/effects and notifies the lobby directory for game
   * propagation.
   *
   * Opens the configured storage backend (supabase or kv) before the HTTP
   * server begins accepting connections. For the 'supabase' backend, a
   * connection failure is caught and registered as a health issue rather than
   * crashing the process — the /status endpoint will then report the error.
   */
  public async start(): Promise<void> {
    const backend = this.serverConfigService.getStorageBackend();
    // Record the active backend in the health service for inclusion in /status responses.
    // 'unknown' is used when the env var is unset or unrecognized so the frontend can still
    // render a meaningful label on the /server-status page.
    this.serverHealthService.setBackend(backend ?? 'unknown');

    if (backend === undefined) {
      // STORAGE_BACKEND is unset or set to an unrecognized value. Surface the
      // problem via /status instead of crashing the process — the in-memory
      // fallback stores were already wired into DI so the rest of startup
      // (auth provider init, expansion loading) can complete and the health
      // route can serve the error to the frontend.
      const raw = this.serverConfigService.getRawStorageBackend();
      const message = raw === undefined || raw.trim() === ''
        ? `STORAGE_BACKEND must be 'kv' or 'supabase'; it is currently unset`
        : `STORAGE_BACKEND must be 'kv' or 'supabase', received '${raw}'`;
      this.loggerService.error(`[server startup] ${message}`);
      this.serverHealthService.register({
        level: 'error',
        code: 'STORAGE_BACKEND_INVALID',
        message,
      });
    } else if (backend === 'supabase') {
      // Validate Supabase config before attempting to open. Missing URL/key
      // produces a dedicated SUPABASE_CONFIG_MISSING issue so the operator can
      // distinguish "you forgot to set the env vars" from "the connection
      // failed".
      const url = this.serverConfigService.getSupabaseUrl();
      const key = this.serverConfigService.getSupabaseServiceRoleKey();
      const missing: string[] = [];
      if (!url) missing.push('SUPABASE_URL');
      if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (missing.length > 0) {
        const message = `STORAGE_BACKEND=supabase but ${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} unset`;
        this.loggerService.error(`[server startup] ${message}`);
        this.serverHealthService.register({
          level: 'error',
          code: 'SUPABASE_CONFIG_MISSING',
          message,
        });
      } else {
        // Open the shared Supabase client once, then prime each store's cache.
        // Any failure here is non-fatal: the server continues with empty caches
        // and the /status endpoint reports SUPABASE_OPEN_FAILED so the frontend
        // can redirect to the /server-status error page.
        try {
          this.supabaseClientProvider.open(url!, key!);
          const client = this.supabaseClientProvider.get();
          this.loggerService.info('[server startup] opening Supabase-backed stores');
          await (this.userStore as SupabaseUserStore).open(client);
          await (this.sessionStore as SupabaseSessionStore).open(client, Date.now());
          await (this.registrationCodeStore as SupabaseRegistrationCodeStore).open(client);
          await (this.matchConfigurationSaveService as SupabaseMatchConfigurationSaveService).open(client);
          this.loggerService.log('[server startup] Supabase stores ready');
        } catch (err) {
          const message = `Failed to connect to Supabase: ${err instanceof Error ? err.message : String(err)}`;
          this.loggerService.error(`[server startup] ${message}`);
          this.serverHealthService.register({
            level: 'error',
            code: 'SUPABASE_OPEN_FAILED',
            message,
          });
        }
      }
    } else {
      // When using the Deno KV stores, open a single shared KV handle
      // and hand it to every KV-backed store so only one handle exists per
      // Deno.Kv file (Deno forbids multiple concurrent handles to the same
      // file-backed database in one process). All three stores load their
      // caches from the shared handle before the HTTP server accepts
      // connections.
      const kvPath = Deno.env.get('AUTH_KV_PATH') ?? './game-data/auth.kv';
      this.loggerService.info(`[server startup] opening shared Deno KV auth store at '${kvPath}'`);
      const kv = await this.authKvProvider.open(kvPath);
      await (this.sessionStore as DenoKvSessionStore).open(kv, Date.now());

      // User/registration-code stores share the same KV handle as the session
      // store (see register-root-services.ts selection logic).
      if (this.userStore instanceof DenoKvUserStore) {
        await this.userStore.open(kv);
      }
      if (this.registrationCodeStore instanceof DenoKvRegistrationCodeStore) {
        await this.registrationCodeStore.open(kv);
      }

      // When using the Deno KV game-data store, open a single shared KV handle
      // via GameDataKvProvider and hand it to the match-configuration save service
      // so that all game-data consumers share a single handle (separate from
      // the auth KV file).
      if (this.matchConfigurationSaveService instanceof DenoKvMatchConfigurationSaveService) {
        const gameDataKvPath = Deno.env.get('GAME_DATA_KV_PATH') ?? './game-data/game-data.kv';
        this.loggerService.info(`[server startup] opening game-data KV store at '${gameDataKvPath}'`);
        const gameDataKv = await this.gameDataKvProvider.open(gameDataKvPath);
        await this.matchConfigurationSaveService.open(gameDataKv);
      }
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
