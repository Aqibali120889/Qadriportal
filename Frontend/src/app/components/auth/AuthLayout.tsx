import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import logoSrc from "@/imports/image003.jpg";

export function BlueprintIllustration() {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[360px] opacity-[0.07]"
      aria-hidden="true"
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="white" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="400" stroke="white" strokeWidth="0.5" />
      ))}
      <circle cx="200" cy="200" r="80" stroke="white" strokeWidth="1.5" strokeDasharray="6 3" />
      <circle cx="200" cy="200" r="30" stroke="white" strokeWidth="1.5" />
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return (
          <line
            key={`g${i}`}
            x1={200 + Math.cos(angle) * 80}
            y1={200 + Math.sin(angle) * 80}
            x2={200 + Math.cos(angle) * 95}
            y2={200 + Math.sin(angle) * 95}
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
          />
        );
      })}
      <line x1="60" y1="340" x2="340" y2="340" stroke="white" strokeWidth="1" />
      <line x1="60" y1="335" x2="60" y2="345" stroke="white" strokeWidth="1" />
      <line x1="340" y1="335" x2="340" y2="345" stroke="white" strokeWidth="1" />
      <line x1="60" y1="60" x2="60" y2="320" stroke="white" strokeWidth="1" />
      <line x1="55" y1="60" x2="65" y2="60" stroke="white" strokeWidth="1" />
      <line x1="55" y1="320" x2="65" y2="320" stroke="white" strokeWidth="1" />
      <line x1="185" y1="200" x2="215" y2="200" stroke="white" strokeWidth="1" />
      <line x1="200" y1="185" x2="200" y2="215" stroke="white" strokeWidth="1" />
      <path d="M20 20 L20 50 M20 20 L50 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M380 20 L380 50 M380 20 L350 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 380 L20 350 M20 380 L50 380" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M380 380 L380 350 M380 380 L350 380" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {[
        [100, 100], [300, 100], [100, 300], [300, 300],
      ].map(([cx, cy]) => (
        <circle key={`n${cx}${cy}`} cx={cx} cy={cy} r="3" stroke="white" strokeWidth="1" />
      ))}
      <line x1="100" y1="100" x2="150" y2="100" stroke="white" strokeWidth="0.75" />
      <line x1="300" y1="100" x2="250" y2="100" stroke="white" strokeWidth="0.75" />
      <line x1="100" y1="300" x2="150" y2="300" stroke="white" strokeWidth="0.75" />
      <line x1="300" y1="300" x2="250" y2="300" stroke="white" strokeWidth="0.75" />
    </svg>
  );
}

interface AuthLayoutProps {
  children: React.ReactNode;
  dark: boolean;
  onToggleDark: () => void;
}

export function AuthLayout({ children, dark, onToggleDark }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background font-[Inter,system-ui,sans-serif]">
      {/* Header */}
      <header className="absolute top-0 right-0 z-20 p-4">
        <button
          onClick={onToggleDark}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
            bg-card border border-border text-muted-foreground
            hover:text-foreground shadow-sm transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
        </button>
      </header>

      <div className="flex flex-1 min-h-screen">
        {/* Left panel */}
        <div
          className="hidden lg:flex lg:w-[35%] flex-col relative overflow-hidden"
          style={{ backgroundColor: "#1C1C1C" }}
        >
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: "#F5821F" }} />

          <div className="relative z-10 flex flex-col h-full px-10 py-12">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-auto">
              <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-white/10 shadow-md flex-shrink-0">
                <ImageWithFallback src={logoSrc} alt="Qadri Group logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-white font-semibold text-base leading-tight tracking-tight">Qadri Group</p>
                <p className="text-white/40 text-xs font-normal leading-tight">Manufacturing Excellence</p>
              </div>
            </div>

            {/* Illustration */}
            <div className="flex-1 flex items-center justify-center py-8">
              <BlueprintIllustration />
            </div>

            {/* App title */}
            <div className="mt-auto pb-2">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 text-xs font-medium tracking-wide"
                style={{ backgroundColor: "rgba(245,130,31,0.12)", color: "#F5821F" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#F5821F" }} />
                AI-POWERED PLATFORM
              </div>
              <h1 className="text-white text-2xl font-semibold leading-snug tracking-tight mb-2">
                AI Engineering<br />Estimation Portal
              </h1>
              <p className="text-white/40 text-sm font-normal leading-relaxed">
                Intelligent cost estimation and project analytics for manufacturing operations.
              </p>
              <div className="flex flex-wrap gap-2 mt-5">
                {["Cost Estimation", "BOM Analysis", "Project Planning"].map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.45)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 lg:w-[65%] flex flex-col items-center justify-center px-6 py-16 bg-background relative">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 70% 30%, rgba(245,130,31,0.04) 0%, transparent 60%)",
            }}
          />

          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center mb-8 gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md ring-1 ring-border">
              <ImageWithFallback src={logoSrc} alt="Qadri Group logo" className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground text-base leading-tight">Qadri Group</p>
              <p className="text-muted-foreground text-xs leading-tight">AI Engineering Estimation Portal</p>
            </div>
          </div>

          {children}

          <footer className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-xs text-muted-foreground">© 2026 Qadri Group. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

// Hook to share dark mode state via localStorage
export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("qg-theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("qg-theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, () => setDark((d) => !d)] as const;
}
