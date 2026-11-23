/**
 * Frontend/src/app/lib/supabase.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Supabase client singleton for the React frontend.
 *
 * This client is used ONLY for Supabase Auth operations:
 *   - signInWithPassword
 *   - signOut
 *   - onAuthStateChange (session refresh listener)
 *   - getSession / getUser
 *
 * The frontend NEVER uses this client to query data directly.
 * All data flows through FastAPI (VITE_API_BASE_URL).
 * Supabase Auth handles authentication; FastAPI handles authorization.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Supabase JS SDK automatically refreshes the access token before expiry.
    // The refresh token is stored in localStorage and managed entirely by the SDK.
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
