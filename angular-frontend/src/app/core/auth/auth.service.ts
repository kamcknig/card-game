import { Injectable } from '@angular/core';
import { atom } from 'nanostores';
import { environment } from '../../../environments/environment';

// Stores the authenticated username (undefined when not logged in).
export const authUsernameStore = atom<string | undefined>(
  localStorage.getItem('authUsername') ?? undefined,
);

// Stores the auth token (undefined when not logged in).
export const authTokenStore = atom<string | undefined>(
  localStorage.getItem('authToken') ?? undefined,
);

// Stores the admin flag (false when not logged in or user is not admin).
export const authIsAdminStore = atom<boolean>(
  localStorage.getItem('authIsAdmin') === 'true',
);

// Holds a registration code parsed from the URL query string on startup.
// Consumed (cleared) once LoginComponent reads it during initialization.
// Not localStorage-backed — only valid for the current page load.
export const pendingRegistrationCodeStore = atom<string | undefined>(undefined);

(globalThis as any).authUsernameStore = authUsernameStore;
(globalThis as any).authTokenStore = authTokenStore;
(globalThis as any).authIsAdminStore = authIsAdminStore;
(globalThis as any).pendingRegistrationCodeStore = pendingRegistrationCodeStore;

/**
 * Manages client-side authentication state and server login requests.
 *
 * Stores auth token and username in localStorage for session persistence
 * across page refreshes. Exposes nanostores atoms so other services can
 * reactively observe auth state. Login requests include a `provider`
 * field so the server can route to the correct auth provider.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /**
   * Sends login credentials to the server for the specified provider.
   * Stores the auth token and username in localStorage on success.
   * Returns an object indicating success or failure with an optional message.
   */
  async login(
    credentials: Record<string, unknown>,
    provider: string = 'password',
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await fetch(`${environment.wsHost}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, provider }),
      });

      const body = await response.json();
      if (!body.ok) {
        return { ok: false, message: body.message ?? 'Login failed' };
      }

      localStorage.setItem('authToken', body.token);
      localStorage.setItem('authUsername', body.username);
      localStorage.setItem('authIsAdmin', body.isAdmin ? 'true' : 'false');
      authTokenStore.set(body.token);
      authUsernameStore.set(body.username);
      authIsAdminStore.set(body.isAdmin ?? false);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Unable to reach server' };
    }
  }

  /**
   * Validates the stored auth token against the server.
   * Returns true if the token is still valid, false otherwise.
   * Clears local auth state if the token is invalid.
   */
  async validateStoredToken(): Promise<boolean> {
    const token = authTokenStore.get();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${environment.wsHost}/auth/validate`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const body = await response.json();
      if (body.ok) {
        authUsernameStore.set(body.username);
        localStorage.setItem('authIsAdmin', body.isAdmin ? 'true' : 'false');
        authIsAdminStore.set(body.isAdmin ?? false);
        return true;
      }

      // Token invalid — clear stored auth state.
      this.clearAuth();
      return false;
    } catch {
      // Network or JSON parse failure: we can't confirm the token, so treat
      // it as invalid and clear stored auth state. Leaving a stale token in
      // place would let authGuard pass on the next initial navigation and
      // strand the user inside the app without a working session.
      this.clearAuth();
      return false;
    }
  }

  /**
   * Clears all auth state from localStorage and stores.
   */
  clearAuth(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsername');
    localStorage.removeItem('authIsAdmin');
    authTokenStore.set(undefined);
    authUsernameStore.set(undefined);
    authIsAdminStore.set(false);
  }

  /**
   * Logs out by invalidating the server-side session and clearing local auth state.
   * The server call is best-effort — local state is always cleared.
   */
  async logout(): Promise<void> {
    const token = authTokenStore.get();
    if (token) {
      try {
        await fetch(`${environment.wsHost}/auth/logout`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {
        // Ignore network errors — clear local state regardless.
      }
    }
    this.clearAuth();
  }

  /**
   * Creates a new account via POST /auth/register.
   *
   * Requires a registration code issued out-of-band by an existing user or
   * the CLI (see server/scripts/auth-create-reg-code.ts). On success the
   * user must still log in separately — registration does not automatically
   * establish a session.
   */
  async register(
    username: string,
    password: string,
    registrationCode: string,
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await fetch(`${environment.wsHost}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, registrationCode }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        return { ok: false, message: body.message ?? 'Registration failed' };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: 'Unable to reach server' };
    }
  }

  /**
   * Creates a new registration code via POST /auth/registration-codes.
   *
   * Only succeeds when the authenticated user is an admin. Returns the
   * generated code string on success. `expiresIn` is relative milliseconds
   * from now; omit for no time limit. `maxUses` defaults to 1 on the server.
   */
  async createRegistrationCode(options?: {
    expiresIn?: number;
    maxUses?: number;
  }): Promise<{ ok: boolean; code?: string; expiresAt?: number | null; maxUses?: number; message?: string }> {
    const token = authTokenStore.get();
    if (!token) return { ok: false, message: 'Not signed in' };

    try {
      const response = await fetch(`${environment.wsHost}/auth/registration-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(options ?? {}),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        return { ok: false, message: body.message ?? 'Failed to create code' };
      }
      return { ok: true, code: body.code, expiresAt: body.expiresAt, maxUses: body.maxUses };
    } catch {
      return { ok: false, message: 'Unable to reach server' };
    }
  }

  /**
   * Lists active registration codes via GET /auth/registration-codes.
   *
   * Only succeeds when the authenticated user is an admin. Returns non-disabled,
   * non-expired codes in server-defined order.
   */
  async listRegistrationCodes(): Promise<{
    ok: boolean;
    codes?: Array<{
      code: string;
      createdAt: number;
      createdBy: string;
      expiresAt: number | null;
      maxUses: number;
      usedCount: number;
    }>;
    message?: string;
  }> {
    const token = authTokenStore.get();
    if (!token) return { ok: false, message: 'Not signed in' };

    try {
      const response = await fetch(`${environment.wsHost}/auth/registration-codes`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        return { ok: false, message: body.message ?? 'Failed to list codes' };
      }
      return { ok: true, codes: body.codes };
    } catch {
      return { ok: false, message: 'Unable to reach server' };
    }
  }

  /**
   * Disables a registration code via DELETE /auth/registration-codes/:code.
   *
   * Idempotent — returns ok even when the code was already disabled or unknown.
   */
  async disableRegistrationCode(code: string): Promise<{ ok: boolean; message?: string }> {
    const token = authTokenStore.get();
    if (!token) return { ok: false, message: 'Not signed in' };

    try {
      const response = await fetch(
        `${environment.wsHost}/auth/registration-codes/${encodeURIComponent(code)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        return { ok: false, message: body.message ?? 'Failed to disable code' };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: 'Unable to reach server' };
    }
  }

  /**
   * Checks whether a registration code is currently redeemable.
   *
   * Public endpoint — no auth token required. Returns `{ ok, valid }` where
   * `valid` is false when the code is unknown, disabled, expired, or exhausted.
   * Network errors resolve to `{ ok: false, valid: false }` so the caller can
   * treat connectivity failures the same as an invalid code.
   */
  async validateRegistrationCode(code: string): Promise<{ ok: boolean; valid: boolean }> {
    try {
      const response = await fetch(
        `${environment.wsHost}/auth/registration-codes/validate?code=${encodeURIComponent(code)}`,
      );
      const body = await response.json().catch(() => ({ ok: false, valid: false }));
      return { ok: body.ok ?? false, valid: body.valid ?? false };
    } catch {
      return { ok: false, valid: false };
    }
  }

  /**
   * Checks whether a username is already registered.
   *
   * Returns true when the username is available, false when it is taken.
   * Network errors resolve to true (available) so a transient failure does
   * not block the registration form — the server will give the definitive
   * answer on submit.
   */
  async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${environment.wsHost}/auth/check-username?username=${encodeURIComponent(username)}`,
      );
      const body = await response.json().catch(() => ({ available: true }));
      return body.available ?? true;
    } catch {
      return true;
    }
  }

  /**
   * Changes the authenticated user's password via POST /auth/change-password.
   *
   * On success the server revokes every other session for this user; the
   * current session survives. Clients should consider re-validating after a
   * successful call.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean; message?: string; revokedSessions?: number }> {
    const token = authTokenStore.get();
    if (!token) {
      return { ok: false, message: 'Not signed in' };
    }

    try {
      const response = await fetch(`${environment.wsHost}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        return { ok: false, message: body.message ?? 'Password change failed' };
      }
      return { ok: true, revokedSessions: body.revokedSessions };
    } catch {
      return { ok: false, message: 'Unable to reach server' };
    }
  }
}
