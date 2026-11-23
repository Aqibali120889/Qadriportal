/**
 * Frontend/src/app/components/ProtectedRoute.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Route guard for authenticated routes.
 *
 * Wrap any route that requires authentication:
 *   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 *
 * Behaviour:
 *   - While auth is loading: shows a loading spinner
 *   - If not authenticated: redirects to /login
 *   - If authenticated: renders children
 *   - If permission prop provided: checks that specific permission,
 *     shows 403 if denied (does not redirect)
 */

import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/app/context/AuthContext";

interface ProtectedRouteProps {
  /** The protected content to render when authenticated */
  children: React.ReactNode;
  /** Optional: restrict to a specific permission ("module:action") */
  permission?: { module: string; action: string };
  /** Optional: restrict to Super Admin only */
  requireSuperAdmin?: boolean;
}

export default function ProtectedRoute({
  children,
  permission,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated, can } = useAuth();
  const location = useLocation();

  // While resolving auth state — show spinner
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="Loading"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="text-sm text-muted-foreground">Verifying access…</span>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect to login preserving intended destination
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Super admin check
  if (requireSuperAdmin && !user?.is_super_admin) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground text-sm">This area requires Super Admin access.</p>
        </div>
      </div>
    );
  }

  // Permission check
  if (permission && !can(permission.module, permission.action)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground text-sm">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
