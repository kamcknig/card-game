import { Injectable } from '@angular/core';
import { atom } from 'nanostores';

// Stores the authenticated username (undefined when not logged in).
export const authUsernameStore = atom<string | undefined>(
  localStorage.getItem('authUsername') ?? undefined,
);

// Stores the auth token (undefined when not logged in).
export const authTokenStore = atom<string | undefined>(
  localStorage.getItem('authToken') ?? undefined,
);

(globalThis as any).authUsernameStore = authUsernameStore;
(globalThis as any).authTokenStore = authTokenStore;

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
      const response = await fetch('/auth/login', {
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
      authTokenStore.set(body.token);
      authUsernameStore.set(body.username);
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
      const response = await fetch('/auth/validate', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const body = await response.json();
      if (body.ok) {
        authUsernameStore.set(body.username);
        return true;
      }

      // Token invalid — clear stored auth state.
      this.clearAuth();
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clears all auth state from localStorage and stores.
   */
  clearAuth(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsername');
    authTokenStore.set(undefined);
    authUsernameStore.set(undefined);
  }

  /**
   * Logs out by invalidating the server-side session and clearing local auth state.
   * The server call is best-effort — local state is always cleared.
   */
  async logout(): Promise<void> {
    const token = authTokenStore.get();
    if (token) {
      try {
        await fetch('/auth/logout', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {
        // Ignore network errors — clear local state regardless.
      }
    }
    this.clearAuth();
  }
}
