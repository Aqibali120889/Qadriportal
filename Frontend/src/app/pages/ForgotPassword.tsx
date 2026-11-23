import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Mail, ChevronRight, CheckCircle } from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { AuthLayout, useDarkMode } from "@/app/components/auth/AuthLayout";
import logoSrc from "@/imports/image003.jpg";

function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ForgotPassword() {
  const [dark, toggleDark] = useDarkMode();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function validateEmail(val: string) {
    if (!val) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Enter a valid email address.";
    return "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setEmailError("");
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
    }, 2000);
  }

  return (
    <AuthLayout dark={dark} onToggleDark={toggleDark}>
      <div className="relative z-10 w-full max-w-[420px] bg-card rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-border p-8">
        {success ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center text-center py-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: "rgba(245,130,31,0.1)" }}
            >
              <CheckCircle size={28} style={{ color: "#F5821F" }} />
            </div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight mb-2">Check Your Email</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-2">
              We've sent a password reset link to
            </p>
            <p className="text-sm font-semibold text-foreground mb-6 break-all">{email}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-8">
              Didn't receive it? Check your spam folder or{" "}
              <button
                onClick={() => { setSuccess(false); setEmail(""); }}
                className="font-medium underline underline-offset-2 transition-colors"
                style={{ color: "#F5821F" }}
              >
                try again
              </button>
              .
            </p>
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={15} />
              Back to Sign In
            </Link>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            {/* Card header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="hidden lg:block w-10 h-10 rounded-lg overflow-hidden ring-1 ring-border shadow-sm flex-shrink-0">
                <ImageWithFallback src={logoSrc} alt="Qadri Group logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground leading-tight tracking-tight">Forgot Password</h2>
                <p className="text-muted-foreground text-sm font-normal">We'll send you a reset link</p>
              </div>
            </div>

            <div className="h-px bg-border mb-6" />

            {/* Description */}
            <div
              className="flex gap-3 p-3.5 rounded-[10px] mb-5"
              style={{ backgroundColor: "rgba(245,130,31,0.06)", border: "1px solid rgba(245,130,31,0.15)" }}
            >
              <Mail size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#F5821F" }} />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enter the email address associated with your account and we'll email you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="fp-email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email Address
                </label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onBlur={() => setEmailError(validateEmail(email))}
                  placeholder="you@qadrigroup.com"
                  className={`w-full h-10 px-3.5 rounded-[10px] text-sm text-foreground
                    bg-input-background border transition-all duration-150
                    placeholder:text-muted-foreground/60
                    focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary
                    ${emailError ? "border-destructive" : "border-border"}`}
                />
                {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 rounded-[10px] text-sm font-semibold text-white
                  flex items-center justify-center gap-2 transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-ring/40
                  disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#F5821F" }}
                onMouseEnter={(e) => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#D9710E"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F5821F"; }}
              >
                {isSubmitting ? <><Spinner />Sending…</> : <>Send Reset Link <ChevronRight size={15} /></>}
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
