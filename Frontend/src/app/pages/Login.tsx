import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Shield, ChevronRight } from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { AuthLayout, useDarkMode } from "@/app/components/auth/AuthLayout";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import logoSrc from "@/imports/image003.jpg";

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, refreshUser, authError: accountError } = useAuth();
  const [dark, toggleDark] = useDarkMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isMsSigningIn, setIsMsSigningIn] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [authError, setAuthError] = useState("");

  // Auto-redirect authenticated users away from Login page
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.is_super_admin) {
        navigate("/admin", { replace: true });
      } else {
        const routes: Record<string, string> = {
          CE: "/dashboard",
          FOUNDRY: "/foundry",
        };
        navigate(routes[user.department_code] ?? "/dashboard", { replace: true });
      }
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  function validate() {
    let valid = true;
    if (!email) {
      setEmailError("Email address is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    } else {
      setEmailError("");
    }
    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else {
      setPasswordError("");
    }
    return valid;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setAuthError("");
    setIsSigningIn(true);

    try {
      // Real Supabase authentication — errors are surfaced to the user
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        // Map Supabase error codes to user-friendly messages
        const msg = signInError.message.toLowerCase();
        if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password")) {
          setAuthError("Invalid email or password.");
        } else if (msg.includes("email not confirmed")) {
          setAuthError("Please confirm your email address before signing in.");
        } else if (msg.includes("too many")) {
          setAuthError("Too many login attempts. Please wait a few minutes and try again.");
        } else {
          setAuthError(signInError.message);
        }
        return;
      }

      // Fetch identity from /auth/me — AuthContext will update automatically
      // but we need the identity NOW to determine the redirect route.
      const identity = await refreshUser();

      if (!identity) {
        // /auth/me failed (account inactive, not provisioned, etc.)
        // accountError from AuthContext will be displayed below.
        return;
      }

      // Route based on actual database identity — not email substring
      if (identity.is_super_admin) {
        navigate("/admin", { replace: true });
      } else {
        const routes: Record<string, string> = {
          CE: "/dashboard",
          FOUNDRY: "/foundry",
        };
        navigate(routes[identity.department_code] ?? "/dashboard", { replace: true });
      }
    } catch (err: any) {
      setAuthError("An unexpected error occurred. Please try again.");
      console.error("[Login] Sign-in error:", err);
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleMicrosoftSignIn() {
    // Microsoft SSO is not yet configured.
    // To enable: set up an Azure AD app registration in Supabase Dashboard → Auth → Providers → Azure.
    setAuthError("Microsoft sign-in is not available. Please use your email and password.");
  }

  return (
    <AuthLayout dark={dark} onToggleDark={toggleDark}>
      <div className="relative z-10 w-full max-w-[420px] bg-card rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-border p-8">
        {/* Card header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="hidden lg:block w-10 h-10 rounded-lg overflow-hidden ring-1 ring-border shadow-sm flex-shrink-0">
            <ImageWithFallback src={logoSrc} alt="Qadri Group logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground leading-tight tracking-tight">Sign In</h2>
            <p className="text-muted-foreground text-sm font-normal">Access your workspace</p>
          </div>
        </div>

        <div className="h-px bg-border mb-6" />

        <form onSubmit={handleSignIn} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
              placeholder="you@qadrigroup.com"
              className={`w-full h-10 px-3.5 rounded-[10px] text-sm text-foreground
                bg-input-background border transition-all duration-150
                placeholder:text-muted-foreground/60
                focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary
                ${emailError ? "border-destructive" : "border-border"}`}
            />
            {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium transition-colors duration-150"
                style={{ color: "#F5821F" }}
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(""); }}
                placeholder="Enter your password"
                className={`w-full h-10 px-3.5 pr-10 rounded-[10px] text-sm text-foreground
                  bg-input-background border transition-all duration-150
                  placeholder:text-muted-foreground/60
                  focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary
                  ${passwordError ? "border-destructive" : "border-border"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordError && <p className="mt-1 text-xs text-destructive">{passwordError}</p>}
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={rememberMe}
              onClick={() => setRememberMe((v) => !v)}
              className="w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring/40"
              style={{
                backgroundColor: rememberMe ? "#F5821F" : "transparent",
                borderColor: rememberMe ? "#F5821F" : "rgba(28,28,28,0.25)",
              }}
            >
              {rememberMe && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span
              className="text-sm text-muted-foreground select-none cursor-pointer"
              onClick={() => setRememberMe((v) => !v)}
            >
              Remember me
            </span>
          </div>

          {/* Auth errors: sign-in failure + account status errors from /auth/me */}
          {(authError || accountError) && (
            <div className="rounded-[8px] bg-destructive/10 border border-destructive/20 px-3.5 py-2.5">
              <p className="text-xs text-destructive leading-relaxed">{authError || accountError}</p>
            </div>
          )}

          {/* Sign In button */}
          <button
            type="submit"
            disabled={isSigningIn}
            className="w-full h-10 rounded-[10px] text-sm font-semibold text-white
              flex items-center justify-center gap-2 transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-ring/40
              disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#F5821F" }}
            onMouseEnter={(e) => { if (!isSigningIn) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#D9710E"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F5821F"; }}
          >
            {isSigningIn ? (
              <>
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Signing in…
              </>
            ) : (
              <>Sign In <ChevronRight size={15} /></>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Microsoft sign in */}
        <button
          type="button"
          onClick={handleMicrosoftSignIn}
          disabled={isMsSigningIn}
          className="w-full h-10 rounded-[10px] text-sm font-medium text-foreground
            flex items-center justify-center gap-2.5 bg-card border border-border
            hover:bg-secondary transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-ring/40
            disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isMsSigningIn ? (
            <>
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.15)" strokeWidth="2.5" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Connecting…
            </>
          ) : (
            <><MicrosoftLogo />Sign in with Microsoft</>
          )}
        </button>

        {/* Authorized users notice */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <Shield size={12} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground text-center">Authorized users only</p>
        </div>
      </div>
    </AuthLayout>
  );
}
