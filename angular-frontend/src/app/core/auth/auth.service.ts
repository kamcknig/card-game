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

// Tracks whether the logged-in user still needs to attach an email address.
// true for legacy users who pre-date email registration, false once an email
// is set. localStorage-backed so the flag survives a page refresh.
// Login, validate, and attachEmail write to this; logout clears it.
export const authNeedsEmailStore = atom<boolean>(
  localStorage.getItem('authNeedsEmail') === 'true',
);

// Stores the authenticated user's email address (null when not set).
// localStorage-backed so the value survives a page refresh.
// Login, validate, and attachEmail write to this; logout clears it.
export const authEmailStore = atom<string | null>(
  localStorage.getItem('authEmail') ?? null,
);

(globalThis as any).authUsernameStore = authUsernameStore;
(globalThis as any).authTokenStore = authTokenStore;
(globalThis as any).authIsAdminStore = authIsAdminStore;
(globalThis as any).authNeedsEmailStore = authNeedsEmailStore;
(globalThis as any).authEmailStore = authEmailStore;

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

      const needsEmail = body.needsEmail === true;
      const email: string | null = typeof body.email === 'string' ? body.email : null;
      localStorage.setItem('authToken', body.token);
      localStorage.setItem('authUsername', body.username);
      localStorage.setItem('authIsAdmin', body.isAdmin ? 'true' : 'false');
      localStorage.setItem('authNeedsEmail', needsEmail ? 'true' : 'false');
      if (email !== null) {
        localStorage.setItem('authEmail', email);
      } else {
        localStorage.removeItem('authEmail');
      }
      authTokenStore.set(body.token);
      authUsernameStore.set(body.username);
      authIsAdminStore.set(body.isAdmin ?? false);
      authNeedsEmailStore.set(needsEmail);
      authEmailStore.set(email);
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
        const needsEmail = body.needsEmail === true;
        const email: string | null = typeof body.email === 'string' ? body.email : null;
        authUsernameStore.set(body.username);
        localStorage.setItem('authIsAdmin', body.isAdmin ? 'true' : 'false');
        authIsAdminStore.set(body.isAdmin ?? false);
        // Keep the needsEmail flag in sync across page refreshes via validate.
        localStorage.setItem('authNeedsEmail', needsEmail ? 'true' : 'false');
        authNeedsEmailStore.set(needsEmail);
        // Keep the email in sync across page refreshes via validate.
        if (email !== null) {
          localStorage.setItem('authEmail', email);
        } else {
          localStorage.removeItem('authEmail');
        }
        authEmailStore.set(email);
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
   *
   * Clears the needsEmail flag and cached email as well so the email-onboarding
   * gate is reset and stale email values are not shown on the next login.
   */
  clearAuth(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsername');
    localStorage.removeItem('authIsAdmin');
    localStorage.removeItem('authNeedsEmail');
    localStorage.removeItem('authEmail');
    authTokenStore.set(undefined);
    authUsernameStore.set(undefined);
    authIsAdminStore.set(false);
    authNeedsEmailStore.set(false);
    authEmailStore.set(null);
  }

  /**
   * Clears only the in-memory auth atoms — leaves localStorage intact.
   *
   * Intended for the server-initiated takeover-kick path: when the server
   * kicks this tab via `sessionTakenOver`, we must not propagate the clear
   * through localStorage because the kick winner (the new tab) shares
   * localStorage with us and would receive a `storage` event that flips
   * its own atoms to undefined and bounces it to /login. By clearing only
   * the local atoms, the kicked tab's authGuard redirects to /login on
   * the next navigation while the winner tab continues unaffected. A
   * refresh of the kicked tab will re-read the still-valid token from
   * localStorage and re-establish a session — at which point the server
   * will kick the previous winner. That refresh-as-takeover behaviour is
   * intentional: the user is the only one who should escalate the kick.
   */
  clearLocalAuthState(): void {
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
   * Open self-service registration — no registration code required. The `email`
   * parameter is required; the server rejects registrations without an email
   * with HTTP 400. On success the user must still log in separately —
   * registration does not automatically establish a session.
   */
  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await fetch(`${environment.wsHost}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
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
   * Checks whether an email address is already registered.
   *
   * Returns true when the email is available, false when it is taken.
   * Network errors resolve to true (available) so a transient failure does
   * not block the registration form — the server will give the definitive
   * answer on submit.
   */
  async checkEmailAvailability(email: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${environment.wsHost}/auth/check-email?email=${encodeURIComponent(email)}`,
      );
      const body = await response.json().catch(() => ({ available: true }));
      return body.available ?? true;
    } catch {
      return true;
    }
  }

  /**
   * Attaches an email address to the authenticated user's account via POST /auth/email.
   *
   * Intended for legacy users whose accounts predate email registration
   * (i.e. `authNeedsEmailStore` is true). On success the server either writes
   * the email directly (kv backend) or provisions a Supabase Auth user and
   * sends a confirmation email (supabase backend). On success, clears the
   * `authNeedsEmailStore` flag so the lobby gate is lifted immediately.
   *
   * @param email     The email address to attach.
   * @param password  The user's current password (required for re-auth).
   */
  async attachEmail(
    email: string,
    password: string,
  ): Promise<{ ok: boolean; message?: string }> {
    const token = authTokenStore.get();
    if (!token) {
      return { ok: false, message: 'Not signed in' };
    }

    try {
      const response = await fetch(`${environment.wsHost}/auth/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email, password }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        return { ok: false, message: body.message ?? 'Failed to attach email' };
      }

      // Clear the email-onboarding gate so the lobby allows create/join, and
      // persist the attached email address so it displays in the Account card.
      localStorage.setItem('authNeedsEmail', 'false');
      localStorage.setItem('authEmail', email);
      authNeedsEmailStore.set(false);
      authEmailStore.set(email);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Unable to reach server' };
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
