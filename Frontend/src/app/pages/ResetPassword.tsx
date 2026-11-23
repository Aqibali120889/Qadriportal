import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, ArrowLeft, ChevronRight, CheckCircle, ShieldCheck, Loader2 } from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { AuthLayout, useDarkMode } from "@/app/components/auth/AuthLayout";
import logoSrc from "@/imports/image003.jpg";

import { supabase } from "@/app/lib/supabase";

function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Password strength helpers ──────────────────────────────────────────────
type Strength = "empty" | "weak" | "fair" | "good" | "strong";

function getStrength(pw: string): Strength {
  if (!pw) return "empty";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}

const STRENGTH_META: Record<Strength, { label: string; color: string; bars: number }> = {
  empty:  { label: "",        color: "#E5E7EB", bars: 0 },
  weak:   { label: "Weak",    color: "#EF4444", bars: 1 },
  fair:   { label: "Fair",    color: "#F59E0B", bars: 2 },
  good:   { label: "Good",    color: "#3B82F6", bars: 3 },
  strong: { label: "Strong",  color: "#22C55E", bars: 4 },
};

function StrengthMeter({ password }: { password: string }) {
  const strength = getStrength(password);
  const meta = STRENGTH_META[strength];

  if (!password) return null;

  return (
    <div className="mt-2.5">
      <div className="flex gap-1 mb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i < meta.bars ? meta.color : "var(--muted)",
            }}
          />
        ))}
      </div>
      {meta.label && (
        <p className="text-xs font-medium" style={{ color: meta.color }}>
          {meta.label} password
        </p>
      )}
    </div>
  );
}

// ── Requirement row ────────────────────────────────────────────────────────
function Req({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{ backgroundColor: met ? "rgba(34,197,94,0.12)" : "var(--muted)" }}
      >
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none" aria-hidden="true">
          <path
            d="M1 3L3 5L7 1"
            stroke={met ? "#22C55E" : "var(--muted-foreground)"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-xs" style={{ color: met ? "var(--foreground)" : "var(--muted-foreground)" }}>
        {label}
      </span>
    </li>
  );
}

// ── Password input ─────────────────────────────────────────────────────────
function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  visible,
  onToggleVisible,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder: string;
  error: string;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={id === "new-password" ? "new-password" : "new-password"}
          className={`w-full h-10 px-3.5 pr-10 rounded-[10px] text-sm text-foreground
            bg-input-background border transition-all duration-150
            placeholder:text-muted-foreground/60
            focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary
            ${error ? "border-destructive" : "border-border"}`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function ResetPassword() {
  const [dark, toggleDark] = useDarkMode();
  const navigate = useNavigate();

  // ── Token/session state ──────────────────────────────────────────────────
  // When the user arrives via an invitation/reset email link, the URL hash
  // contains #access_token=...&refresh_token=...&type=invite (or "recovery").
  // Supabase SDK (detectSessionInUrl: true) picks this up automatically and
  // fires onAuthStateChange with INITIAL_SESSION / PASSWORD_RECOVERY.
  // We wait for that event before allowing the form to submit.
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [tokenType, setTokenType] = useState<"invite" | "recovery" | "none">("none");

  useEffect(() => {
    // Check if the URL hash contains an access_token (from invitation/reset email)
    const hash = window.location.hash;
    const hasToken = hash.includes("access_token=");
    const type = hash.includes("type=invite")
      ? "invite"
      : hash.includes("type=recovery")
      ? "recovery"
      : "none";

    if (hasToken) {
      setTokenType(type);
      // Supabase SDK will consume the URL hash and fire onAuthStateChange.
      // Listen for that event to confirm the session is active.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (session?.access_token) {
            setSessionReady(true);
            setSessionChecking(false);
            subscription.unsubscribe();
          }
        }
      );
      // Also try getSession in case the SDK already consumed the token
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          setSessionReady(true);
          setSessionChecking(false);
          subscription.unsubscribe();
        } else {
          // Give the SDK a moment to process the URL hash
          setTimeout(() => setSessionChecking(false), 3000);
        }
      });
      return () => subscription.unsubscribe();
    } else {
      // No token in URL — check for existing active session (forgot password flow)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          setSessionReady(true);
        }
        setSessionChecking(false);
      });
    }
  }, []);

  // ── Form state ───────────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newError, setNewError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = getStrength(newPassword);
  const isStrongEnough = strength === "good" || strength === "strong";

  const requirements = [
    { met: newPassword.length >= 8, label: "At least 8 characters" },
    { met: /[A-Z]/.test(newPassword), label: "One uppercase letter" },
    { met: /[0-9]/.test(newPassword), label: "One number" },
    { met: /[^A-Za-z0-9]/.test(newPassword), label: "One special character" },
  ];

  function validateNew(val = newPassword) {
    if (!val) return "New password is required.";
    if (val.length < 8) return "Password must be at least 8 characters.";
    if (!isStrongEnough) return "Password is too weak.";
    return "";
  }

  function validateConfirm(val = confirmPassword) {
    if (!val) return "Please confirm your password.";
    if (val !== newPassword) return "Passwords do not match.";
    return "";
  }

  const canSubmit =
    isStrongEnough &&
    newPassword.length >= 8 &&
    confirmPassword === newPassword &&
    confirmPassword.length > 0 &&
    sessionReady;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ne = validateNew();
    const ce = validateConfirm();
    setNewError(ne);
    setConfirmError(ce);
    if (ne || ce) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setNewError(error.message);
      } else {
        setSuccess(true);
        // For invite links, redirect to login after a short delay
        // so the user can read the success message
        if (tokenType === "invite") {
          setTimeout(() => navigate("/", { replace: true }), 2000);
        }
      }
    } catch (err: any) {
      setNewError(err.message || "Failed to update password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout dark={dark} onToggleDark={toggleDark}>
      <div className="relative z-10 w-full max-w-[420px] bg-card rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-border p-8">
        {/* ── Checking session / waiting for Supabase to consume URL token ── */}
        {sessionChecking ? (
          <div className="flex flex-col items-center text-center py-8 gap-4">
            <Loader2 size={32} className="animate-spin" style={{ color: "#F5821F" }} />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Setting up your account…</h2>
              <p className="text-muted-foreground text-sm mt-1">Please wait while we verify your invitation link.</p>
            </div>
          </div>
        ) : !sessionReady ? (
          /* ── Session failed / token expired ── */
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
            >
              <ShieldCheck size={28} style={{ color: "#EF4444" }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Link Expired or Invalid</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                This invitation link has expired or is invalid. Please ask your administrator to resend the invitation.
              </p>
            </div>
            <Link
              to="/"
              className="w-full h-10 rounded-[10px] text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: "#F5821F" }}
            >
              Back to Sign In
            </Link>
          </div>
        ) : success ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center text-center py-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: "rgba(245,130,31,0.1)" }}
            >
              <ShieldCheck size={28} style={{ color: "#F5821F" }} />
            </div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight mb-2">Password Updated</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Your password has been successfully updated.{" "}
              {tokenType === "invite"
                ? "Redirecting you to sign in…"
                : "You can now sign in with your new credentials."}
            </p>
            <Link
              to="/"
              className="w-full h-10 rounded-[10px] text-sm font-semibold text-white
                flex items-center justify-center gap-2 transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-ring/40"
              style={{ backgroundColor: "#F5821F" }}
            >
              <CheckCircle size={15} />
              Go to Sign In
            </Link>
          </div>
        ) : (
          <>
            {/* Card header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="hidden lg:block w-10 h-10 rounded-lg overflow-hidden ring-1 ring-border shadow-sm flex-shrink-0">
                <ImageWithFallback src={logoSrc} alt="Qadri Group logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground leading-tight tracking-tight">
                  {tokenType === "invite" ? "Set Your Password" : "Reset Password"}
                </h2>
                <p className="text-muted-foreground text-sm font-normal">
                  {tokenType === "invite"
                    ? "Create a password to activate your account"
                    : "Create a new secure password"}
                </p>
              </div>
            </div>

            <div className="h-px bg-border mb-6" />

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* New password */}
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5">
                  {tokenType === "invite" ? "Create Password" : "New Password"}
                </label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={(v) => {
                    setNewPassword(v);
                    if (newError) setNewError("");
                    if (confirmError && confirmPassword) setConfirmError(v !== confirmPassword ? "Passwords do not match." : "");
                  }}
                  onBlur={() => setNewError(validateNew())}
                  placeholder="Create a strong password"
                  error={newError}
                  visible={showNew}
                  onToggleVisible={() => setShowNew((v) => !v)}
                />
                <StrengthMeter password={newPassword} />
              </div>

              {/* Requirements */}
              {newPassword && (
                <ul className="space-y-1.5 p-3 rounded-[10px] bg-muted/40">
                  {requirements.map((r) => (
                    <Req key={r.label} met={r.met} label={r.label} />
                  ))}
                </ul>
              )}

              {/* Confirm password */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm Password
                </label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    if (confirmError) setConfirmError(v !== newPassword ? "Passwords do not match." : "");
                  }}
                  onBlur={() => setConfirmError(validateConfirm())}
                  placeholder="Re-enter your password"
                  error={confirmError}
                  visible={showConfirm}
                  onToggleVisible={() => setShowConfirm((v) => !v)}
                />
                {/* Match indicator */}
                {confirmPassword && !confirmError && confirmPassword === newPassword && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: "#22C55E" }}>
                    <CheckCircle size={12} />
                    Passwords match
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="w-full h-10 rounded-[10px] text-sm font-semibold text-white
                  flex items-center justify-center gap-2 transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-ring/40
                  disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#F5821F" }}
                onMouseEnter={(e) => { if (!isSubmitting && canSubmit) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#D9710E"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F5821F"; }}
              >
                {isSubmitting
                  ? <><Spinner />Updating…</>
                  : tokenType === "invite"
                  ? <>Activate Account <ChevronRight size={15} /></>
                  : <>Update Password <ChevronRight size={15} /></>}
              </button>
            </form>

            {/* Back link */}
            <div className="flex justify-center mt-5">
              <Link
                to="/"
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
