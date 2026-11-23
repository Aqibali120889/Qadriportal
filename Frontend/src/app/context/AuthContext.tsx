/**
 * Frontend/src/app/context/AuthContext.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Global authentication and identity context.
 *
 * Architecture:
 *   Supabase Auth → JWT → FastAPI /auth/me → MeResponse → AuthContext
 *
 * This provider:
 *   1. Listens to Supabase Auth state changes (login, logout, token refresh)
 *   2. When a valid session exists, fetches identity from GET /api/v1/auth/me
 *   3. Exposes the resolved identity to all child components via useAuth()
 *
 * All components that need identity data call useAuth() — never Supabase directly.
 * All API requests use the access token from the Supabase session.
 *
 * Phase 2A: Removed all dev bypass / fallback logic.
 *   - No DEV_SESSION constant
 *   - No getDevUserFallback() function
 *   - No dev-bypass-token fallback in fetchIdentity
 *   - isAuthenticated is true when a valid Supabase session exists
 *   - Network errors do NOT log the user out (session in localStorage = still logged in)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/app/lib/supabase";
import { hasPermission, type MeResponse, type SessionCreateRequest } from "@/app/types/auth";

// ── API Base URL ──────────────────────────────────────────────────────────────
const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string) || "";

// ── Context Type ──────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Resolved identity from FastAPI /auth/me. Null when not authenticated. */
  user: MeResponse | null;
  /** Raw Supabase session (contains access_token for API calls). */
  session: Session | null;
  /** True while auth state or /auth/me is loading. */
  isLoading: boolean;
  /** True when a valid session and user identity exist. */
  isAuthenticated: boolean;
  /** Error message when /auth/me fails (e.g. account inactive/not provisioned). */
  authError: string | null;
  /** Sign out from Supabase Auth and clear local identity. */
  logout: () => Promise<void>;
  /** Check if the current user has a specific permission. */
  can: (module: string, action: string) => boolean;
  /** Manually refresh identity from /auth/me and return identity */
  refreshUser: () => Promise<MeResponse | null>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // True when fetchIdentity failed due to a network error (not an auth rejection).
  // When this is true, we keep the user "authenticated" via their Supabase session.
  const [backendUnreachable, setBackendUnreachable] = useState(false);
  const sessionRegisteredRef = useRef<string | null>(null);

  /**
   * Fetch identity from FastAPI using the current Supabase access token.
   * Returns the MeResponse on success, or null on any failure.
   * Does NOT fall back to a fake user — unauthenticated state is the correct
   * outcome when no valid session exists.
   */
  const fetchIdentity = useCallback(async (
    accessToken: string,
    { clearOnNetworkError = false }: { clearOnNetworkError?: boolean } = {}
  ): Promise<MeResponse | null> => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (res.status === 401) {
        // JWT is explicitly rejected by the server — clear auth state
        setBackendUnreachable(false);
        setUser(null);
        return null;
      }

      if (res.status === 403) {
        // Authenticated by Supabase but account is inactive/not provisioned
        setBackendUnreachable(false);
        const body = await res.json().catch(() => ({}));
        const code = body?.code ?? "";
        const msg =
          code === "ACCOUNT_INACTIVE"
            ? "Your account has been deactivated. Contact an administrator."
            : code === "ACCOUNT_LOCKED"
            ? "Your account is locked. Contact an administrator."
            : code === "NO_DEPARTMENT"
            ? "Your account has not been assigned to a department. Contact an administrator."
            : body?.message ?? "Access denied.";
        setAuthError(msg);
        setUser(null);
        return null;
      }

      if (!res.ok) {
        // Non-auth server error (5xx etc) — don't evict the user
        // Return null but keep existing user state intact
        setBackendUnreachable(true);
        return null;
      }

      setBackendUnreachable(false);
      const identity: MeResponse = await res.json();
      setUser(identity);
      return identity;
    } catch {
      // Network error (offline, DNS failure, timeout) — do NOT clear the user.
      // The Supabase session is still valid in localStorage; keep the user
      // logged in so they aren't bounced to /login every time the network
      // hiccups or the screen wakes from sleep.
      setBackendUnreachable(true);
      if (clearOnNetworkError) {
        setUser(null);
      }
      // Return null to signal that a fresh identity could not be loaded,
      // but the caller should not treat this as a logout event.
      return null;
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<MeResponse | null> => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      setUser(null);
      return null;
    }
    return fetchIdentity(data.session.access_token);
  }, [fetchIdentity]);

  /**
   * Register session with FastAPI after first login.
   * This writes the user_sessions row, updates last_login, and records login_history.
   */
  const registerSession = useCallback(
    async (accessToken: string, email: string, sessionId: string) => {
      if (sessionRegisteredRef.current === sessionId) return;

      const payload: SessionCreateRequest = {
        email,
        browser: navigator.userAgent.substring(0, 255),
        device: /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
        operating_system: navigator.platform?.substring(0, 255),
      };

      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          sessionRegisteredRef.current = sessionId;
        }
      } catch {
        // Non-critical — session tracking failure should not block the user
        console.warn("[AuthContext] Session registration failed (non-blocking)");
      }
    },
    []
  );

  // ── Auth State Listener ───────────────────────────────────────────────────

  useEffect(() => {
    // Initial session check — Supabase reads from localStorage
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
      if (s?.access_token) {
        // On initial load, if network is unavailable, do NOT clear the user.
        // Pass clearOnNetworkError: false (default) so the app stays usable
        // when the backend is temporarily unreachable.
        fetchIdentity(s.access_token).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s ?? null);

        if (s?.access_token) {
          await fetchIdentity(s.access_token);

          if (event === "SIGNED_IN" && s.user?.email) {
            await registerSession(s.access_token, s.user.email, s.access_token.slice(-16));
          }
        } else if (event === "SIGNED_OUT") {
          // Explicit sign-out — clear user
          setUser(null);
          setAuthError(null);
        } else if (event === "TOKEN_REFRESHED") {
          // Token refreshed but no session returned - keep existing user
          // This can happen transiently; don't log out the user
        } else {
          // Session expired without explicit sign-out — only clear if truly gone
          setUser(null);
          setAuthError(null);
        }

        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchIdentity, registerSession]);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    // Revoke backend session tracking record if we have session_id
    if (user?.session_id && session?.access_token) {
      try {
        await fetch(`${API_BASE}/api/v1/auth/session/${user.session_id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });
      } catch {
        // Non-critical
      }
    }

    // Sign out from Supabase Auth (clears local session storage)
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAuthError(null);
    sessionRegisteredRef.current = null;
  }, [user, session]);

  // ── Permission Helper ─────────────────────────────────────────────────────

  const can = useCallback(
    (module: string, action: string) => hasPermission(user, module, action),
    [user]
  );

  // ── Context Value ─────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    // isAuthenticated is true if:
    //   1. session exists AND user was resolved from /auth/me (normal case)
    //   2. session exists AND backend was unreachable (network error) — keep user
    //      logged in; they are still authenticated with Supabase.
    // isAuthenticated is false only when:
    //   - No Supabase session (never logged in, or explicit logout)
    //   - Server explicitly rejected the JWT (401)
    //   - Server explicitly rejected access (403 INACTIVE/LOCKED)
    isAuthenticated: session !== null && (user !== null || backendUnreachable),
    authError,
    logout,
    can,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used inside <AuthProvider>.");
  }
  return ctx;
}
