/**
 * Frontend/src/app/types/auth.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * TypeScript types for the identity and authorization layer.
 * Mirrors the FastAPI MeResponse schema exactly.
 */

/** The complete identity returned by GET /api/v1/auth/me */
export interface MeResponse {
  user_id: string;
  department_id: string;
  department_name: string;
  department_code: string;
  role_id: string;
  role_name: string;
  permissions: string[];         // "module:action" strings
  is_super_admin: boolean;
  session_id: string | null;
}

/** Payload sent to POST /api/v1/auth/session after Supabase login */
export interface SessionCreateRequest {
  email: string;
  ip_address?: string;
  device?: string;
  browser?: string;
  operating_system?: string;
}

/** Response from POST /api/v1/auth/session */
export interface SessionCreateResponse {
  session_id: string;
}

/** Helper: check if the user has a specific permission */
export function hasPermission(
  user: MeResponse | null,
  module: string,
  action: string
): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return user.permissions.includes(`${module}:${action}`);
}
