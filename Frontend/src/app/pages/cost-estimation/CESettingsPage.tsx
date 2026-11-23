import { useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useOutletContext } from "react-router";
import {
  User, CreditCard, Palette, Bell, Shield, Camera, Save, X,
  Eye, EyeOff, Monitor, Sun, Moon, LogOut, Smartphone,
  CheckCircle2, AlertTriangle, Trash2, ChevronRight, Lock,
  Globe, ToggleLeft, ToggleRight, Search, ChevronDown, Settings,
} from "lucide-react";
import type { CELayoutContext } from "@/app/layouts/CELayout";

// ── Helpers ───────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className={`relative rounded-full transition-all flex-shrink-0 ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ height: "22px", width: "42px", backgroundColor: checked ? "#F5821F" : "var(--muted)" }}>
      <span className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all duration-200"
        style={{ left: checked ? "calc(100% - 20px)" : "2px" }} />
    </button>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder = "", required = false, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <div className="relative">
        <input type={isPassword && !show ? "password" : "text"} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          className={`w-full h-8 px-3 rounded-[8px] text-xs border border-border bg-input-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all ${disabled ? "opacity-60 cursor-not-allowed bg-muted" : ""}`} />
        {isPassword && (
          <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-8 px-3 rounded-[8px] text-xs border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-4 border-b border-border mb-5">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function SaveBar({ onSave, onCancel, dirty }: { onSave: () => void; onCancel: () => void; dirty: boolean }) {
  return (
    <div className={`flex items-center gap-2 mt-6 pt-4 border-t border-border transition-opacity ${dirty ? "opacity-100" : "opacity-50"}`}>
      <button onClick={onSave} disabled={!dirty} className="h-8 px-5 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
        style={{ backgroundColor: dirty ? "#F5821F" : "#F5821F80" }}>
        <Save size={12} />Save Changes
      </button>
      <button onClick={onCancel} disabled={!dirty} className="h-8 px-4 rounded-[8px] text-xs font-medium border border-border text-foreground hover:bg-accent flex items-center gap-1.5 disabled:opacity-50 transition-all">
        <X size={12} />Cancel
      </button>
      {dirty && <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle size={10} />Unsaved changes</span>}
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────
function ProfileSection() {
  const INIT = { name: "Aqib Ali", email: "a.ali@qadrigroup.com", phone: "+92-321-567-8901", department: "Cost Estimation", role: "Senior Engineer", employeeId: "QG-EMP-002" };
  const [form, setForm] = useState(INIT);
  const [saved, setSaved] = useState(INIT);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: keyof typeof INIT) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div>
      <SectionHeader title="Profile Information" description="Manage your personal details and contact information." />
      <div className="flex items-center gap-5 mb-6 p-4 rounded-[12px] border border-border bg-muted/20">
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: "#3B82F6" }}>AA</div>
          <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent shadow-sm">
            <Camera size={11} className="text-muted-foreground" />
          </button>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{form.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{form.role} · {form.department}</p>
          <button className="mt-2 text-[11px] font-medium hover:underline" style={{ color: "#F5821F" }}>Upload Photo</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <InputField label="Full Name"     value={form.name}       onChange={set("name")}       required />
        <InputField label="Employee ID"   value={form.employeeId} onChange={set("employeeId")} disabled />
        <InputField label="Email Address" value={form.email}      onChange={set("email")}      required type="email" />
        <InputField label="Phone Number"  value={form.phone}      onChange={set("phone")} />
        <SelectField label="Department" value={form.department} onChange={set("department")} options={["Cost Estimation", "Admin", "Marketing", "Foundry", "QEN", "Fabrication"]} />
        <SelectField label="Role"       value={form.role}       onChange={set("role")}       options={["Senior Engineer", "Junior Engineer", "Marketing Lead", "Foundry Engineer", "QEN Engineer", "Fab. Engineer", "Data Analyst"]} />
      </div>
      <SaveBar onSave={() => setSaved(form)} onCancel={() => setForm(saved)} dirty={dirty} />
    </div>
  );
}

// ── Account ───────────────────────────────────────────────────────────────
function AccountSection() {
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdSaved, setPwdSaved] = useState(false);
  function savePwd() {
    if (!pwd.current || !pwd.next || pwd.next !== pwd.confirm) return;
    setPwdSaved(true);
    setTimeout(() => { setShowPwdForm(false); setPwdSaved(false); setPwd({ current: "", next: "", confirm: "" }); }, 1500);
  }
  const INFO = [
    { label: "Username",        value: "a.ali"                      },
    { label: "Account Status",  value: "Active",  highlight: "#22C55E" },
    { label: "Last Login",      value: "17 Jul 2026 · 09:41 AM"    },
    { label: "Account Created", value: "March 2022"                 },
  ];
  return (
    <div>
      <SectionHeader title="Account Settings" description="Manage credentials, session status, and account configuration." />
      <div className="grid grid-cols-2 gap-3 mb-6">
        {INFO.map(({ label, value, highlight }) => (
          <div key={label} className="p-3.5 rounded-[10px] border border-border bg-card">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
            <p className="text-sm font-bold mt-1" style={{ color: highlight ?? "var(--foreground)" }}>{value}</p>
          </div>
        ))}
      </div>
      <div className="border border-border rounded-[12px] overflow-hidden mb-4">
        <button onClick={() => setShowPwdForm(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-3">
            <Lock size={14} className="text-muted-foreground" />
            <div className="text-left">
              <p className="text-xs font-semibold text-foreground">Change Password</p>
              <p className="text-[10px] text-muted-foreground">Last changed 60+ days ago</p>
            </div>
          </div>
          <ChevronRight size={14} className={`text-muted-foreground transition-transform ${showPwdForm ? "rotate-90" : ""}`} />
        </button>
        {showPwdForm && (
          <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10 space-y-3">
            <InputField label="Current Password" value={pwd.current} onChange={v => setPwd(p => ({ ...p, current: v }))} type="password" required />
            <InputField label="New Password"     value={pwd.next}    onChange={v => setPwd(p => ({ ...p, next:    v }))} type="password" required />
            <InputField label="Confirm Password" value={pwd.confirm} onChange={v => setPwd(p => ({ ...p, confirm: v }))} type="password" required />
            {pwdSaved
              ? <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle2 size={14} />Updated!</div>
              : <div className="flex gap-2">
                  <button onClick={savePwd} className="h-7 px-4 rounded-[7px] text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: "#F5821F" }}>
                    <Save size={11} />Update
                  </button>
                  <button onClick={() => setShowPwdForm(false)} className="h-7 px-3 rounded-[7px] text-xs font-medium border border-border text-muted-foreground hover:bg-accent">Cancel</button>
                </div>
            }
          </div>
        )}
      </div>
      <div className="border border-border rounded-[12px] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LogOut size={14} className="text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-foreground">Sign Out All Devices</p>
            <p className="text-[10px] text-muted-foreground">Terminate all active sessions.</p>
          </div>
        </div>
        <button className="h-7 px-4 rounded-[7px] text-xs font-medium border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
          Sign Out All
        </button>
      </div>
    </div>
  );
}

// ── Appearance ────────────────────────────────────────────────────────────
function AppearanceSection() {
  function getInitial(): "light" | "dark" | "system" {
    if (typeof window === "undefined") return "system";
    const s = localStorage.getItem("qg-theme");
    if (s === "dark") return "dark";
    if (s === "light") return "light";
    return "system";
  }
  const [theme, setTheme] = useState<"light" | "dark" | "system">(getInitial);
  const [compact, setCompact] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [language, setLang]   = useState("English (US)");
  const [saved, setSaved]     = useState({ theme, compact, sidebar, language });
  const dirty = theme !== saved.theme || compact !== saved.compact || sidebar !== saved.sidebar || language !== saved.language;

  function applyTheme(t: "light" | "dark" | "system") {
    setTheme(t);
    const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("qg-theme", isDark ? "dark" : "light");
  }

  const THEMES: { id: "light" | "dark" | "system"; label: string; icon: LucideIcon; desc: string }[] = [
    { id: "light",  label: "Light",  icon: Sun,     desc: "Clean bright interface" },
    { id: "dark",   label: "Dark",   icon: Moon,    desc: "Easy on the eyes"       },
    { id: "system", label: "System", icon: Monitor, desc: "Follows OS preference"  },
  ];

  return (
    <div>
      <SectionHeader title="Appearance" description="Customize the look and feel of the platform." />
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Theme</p>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(({ id, label, icon: Icon, desc }) => {
            const active = theme === id;
            return (
              <button key={id} onClick={() => applyTheme(id)}
                className={`p-4 rounded-[12px] border-2 text-left transition-all ${active ? "" : "border-border hover:border-primary/30"}`}
                style={{ borderColor: active ? "#F5821F" : undefined, backgroundColor: active ? "rgba(245,130,31,0.06)" : undefined }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-[7px] flex items-center justify-center" style={{ backgroundColor: active ? "rgba(245,130,31,0.12)" : "var(--muted)" }}>
                    <Icon size={14} style={{ color: active ? "#F5821F" : undefined }} className={!active ? "text-muted-foreground" : ""} />
                  </div>
                  {active && <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F5821F" }}><span className="text-white text-[8px] font-bold">✓</span></div>}
                </div>
                <p className="text-xs font-semibold" style={active ? { color: "#F5821F" } : {}}>{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Interface Preferences</p>
        <div className="border border-border rounded-[12px] divide-y divide-border overflow-hidden">
          {[
            { label: "Compact View",        desc: "Reduce spacing in tables and lists",    checked: compact, onChange: setCompact, icon: ToggleLeft  },
            { label: "Auto-collapse Sidebar", desc: "Collapse sidebar when switching pages", checked: sidebar, onChange: setSidebar, icon: ToggleRight },
          ].map(({ label, desc, checked, onChange, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors">
              <div className="flex items-center gap-3">
                <Icon size={14} className="text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Toggle checked={checked} onChange={onChange} />
            </div>
          ))}
        </div>
      </div>
      <div className="mb-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Language</p>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] bg-muted flex items-center justify-center flex-shrink-0"><Globe size={14} className="text-muted-foreground" /></div>
          <select value={language} onChange={e => setLang(e.target.value)}
            className="flex-1 h-8 px-3 rounded-[8px] text-xs border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer max-w-xs">
            {["English (US)", "English (UK)", "Urdu (PK)"].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <SaveBar onSave={() => setSaved({ theme, compact, sidebar, language })} onCancel={() => { setTheme(saved.theme); setCompact(saved.compact); setSidebar(saved.sidebar); setLang(saved.language); }} dirty={dirty} />
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────
function NotificationsSection() {
  const CHANNELS = [
    { key: "email",     label: "Email Notifications",  desc: "Summary emails for platform activity",        defaultOn: true  },
    { key: "projects",  label: "Project Updates",       desc: "Status changes and new assignments",          defaultOn: true  },
    { key: "tasks",     label: "Task Assignments",      desc: "Notify when tasks are assigned or due",       defaultOn: true  },
    { key: "transfers", label: "Dept. Transfers",       desc: "Alert when a project enters your department", defaultOn: true  },
    { key: "ai",        label: "AI Processing Updates", desc: "Extraction complete and review reminders",    defaultOn: true  },
    { key: "security",  label: "Security Alerts",       desc: "Login from new device or password changes",   defaultOn: true  },
    { key: "desktop",   label: "Desktop Notifications", desc: "Browser push notifications",                  defaultOn: false },
  ];
  type NS = Record<string, boolean>;
  const init: NS = Object.fromEntries(CHANNELS.map(c => [c.key, c.defaultOn]));
  const [prefs, setPrefs] = useState<NS>(init);
  const [saved, setSaved] = useState<NS>(init);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  return (
    <div>
      <SectionHeader title="Notification Preferences" description="Control which notifications you receive." />
      <div className="border border-border rounded-[12px] divide-y divide-border overflow-hidden mb-4">
        {CHANNELS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between px-4 py-3.5 hover:bg-accent/20 transition-colors">
            <div>
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <Toggle checked={prefs[key]} onChange={v => setPrefs(p => ({ ...p, [key]: v }))} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setPrefs(Object.fromEntries(CHANNELS.map(c => [c.key, true])))} className="h-7 px-3 rounded-[7px] text-xs font-medium border border-border text-foreground hover:bg-accent">Enable All</button>
        <button onClick={() => setPrefs(Object.fromEntries(CHANNELS.map(c => [c.key, false])))} className="h-7 px-3 rounded-[7px] text-xs font-medium border border-border text-foreground hover:bg-accent">Disable All</button>
      </div>
      <SaveBar onSave={() => setSaved(prefs)} onCancel={() => setPrefs(saved)} dirty={dirty} />
    </div>
  );
}

// ── Security ──────────────────────────────────────────────────────────────
function SecuritySection() {
  const [twoFA, setTwoFA] = useState(false);

  const SESSIONS = [
    { id: "s1", device: "Chrome / Windows 10",   ip: "10.0.1.14", location: "Lahore, PK", lastActive: "Now",     current: true  },
    { id: "s2", device: "Safari / iPhone 14",    ip: "10.0.1.5",  location: "Lahore, PK", lastActive: "4h ago",  current: false },
  ];

  const LOGIN_HISTORY = [
    { date: "17 Jul 2026 · 09:41 AM", device: "Chrome / Windows 10", ip: "10.0.1.14" },
    { date: "16 Jul 2026 · 08:55 AM", device: "Chrome / Windows 10", ip: "10.0.1.14" },
    { date: "15 Jul 2026 · 09:10 AM", device: "Chrome / Windows 10", ip: "10.0.1.14" },
    { date: "14 Jul 2026 · 08:32 AM", device: "Chrome / Windows 10", ip: "10.0.1.14" },
    { date: "13 Jul 2026 · 09:05 AM", device: "Chrome / Windows 10", ip: "10.0.1.14" },
  ];

  const TRUSTED = [{ name: "Office Workstation", browser: "Chrome 128", ip: "10.0.1.14", added: "Mar 2022" }];

  return (
    <div className="space-y-6">
      <SectionHeader title="Security Settings" description="Manage authentication, active sessions, and trusted devices." />
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Change Password</p>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Current Password" value="" onChange={() => {}} type="password" required />
          <div />
          <InputField label="New Password"     value="" onChange={() => {}} type="password" required />
          <InputField label="Confirm Password" value="" onChange={() => {}} type="password" required />
        </div>
        <button className="mt-4 h-8 px-5 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: "#F5821F" }}>
          <Lock size={12} />Update Password
        </button>
      </div>

      <div className="border border-border rounded-[12px] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Smartphone size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Two-Factor Authentication</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Add an extra layer of security via authenticator app.</p>
              {twoFA
                ? <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1"><CheckCircle2 size={11} />Enabled</p>
                : <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} />Not enabled</p>
              }
            </div>
          </div>
          <Toggle checked={twoFA} onChange={setTwoFA} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Active Sessions ({SESSIONS.length})</p>
          <button className="h-6 px-2.5 rounded-[6px] text-[10px] font-medium border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">Revoke All Others</button>
        </div>
        <div className="border border-border rounded-[12px] divide-y divide-border overflow-hidden">
          {SESSIONS.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.current ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{s.device}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.ip} · {s.location} · {s.lastActive}</p>
              </div>
              {s.current
                ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40">Current</span>
                : <button className="h-6 px-2.5 rounded-[6px] text-[10px] font-medium border border-border text-muted-foreground hover:bg-accent hover:text-red-500 transition-all">Revoke</button>
              }
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Login History</p>
        <div className="border border-border rounded-[12px] divide-y divide-border overflow-hidden">
          {LOGIN_HISTORY.map((h, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/10 transition-colors">
              <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground">{h.date}</p>
                <p className="text-[10px] text-muted-foreground">{h.device} · {h.ip}</p>
              </div>
              {i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-blue-600 bg-blue-50 dark:bg-blue-950/40">Latest</span>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trusted Devices</p>
        <div className="border border-border rounded-[12px] divide-y divide-border overflow-hidden">
          {TRUSTED.map((d, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
              <Monitor size={14} className="text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{d.name}</p>
                <p className="text-[10px] text-muted-foreground">{d.browser} · {d.ip} · Added {d.added}</p>
              </div>
              <button className="h-6 w-6 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-all">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Settings Nav ──────────────────────────────────────────────────────────
type Section = "profile" | "account" | "appearance" | "notifications" | "security";

const SETTINGS_NAV: { id: Section; label: string; icon: LucideIcon; desc: string }[] = [
  { id: "profile",       label: "Profile",       icon: User,     desc: "Personal details & photo"         },
  { id: "account",       label: "Account",       icon: CreditCard, desc: "Password & session management"  },
  { id: "appearance",    label: "Appearance",    icon: Palette,  desc: "Theme, layout & language"         },
  { id: "notifications", label: "Notifications", icon: Bell,     desc: "Alerts & email preferences"       },
  { id: "security",      label: "Security",      icon: Shield,   desc: "2FA, sessions & devices"          },
];

// ── Main Page ─────────────────────────────────────────────────────────────
export default function CESettingsPage() {
  const { dark, toggleDark } = useOutletContext<CELayoutContext>();
  const [active, setActive] = useState<Section>("profile");
  const [userMenuOpen, setUserMenu] = useState(false);

  const CONTENT: Record<Section, ReactNode> = {
    profile:       <ProfileSection />,
    account:       <AccountSection />,
    appearance:    <AppearanceSection />,
    notifications: <NotificationsSection />,
    security:      <SecuritySection />,
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Top nav */}
      <header className="h-12 flex-shrink-0 border-b border-border bg-card flex items-center gap-3 px-4 z-20">
        <span className="text-sm font-semibold text-foreground flex-shrink-0">Settings</span>
        <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input type="search" placeholder="Search settings…"
            className="w-full h-7 pl-7 pr-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={toggleDark} className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent transition-all">
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent relative">
            <Bell size={14} />
          </button>
          <div className="relative">
            <button onClick={() => setUserMenu(v => !v)} className="flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-[7px] hover:bg-accent transition-all">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: "#3B82F6" }}>AA</div>
              <ChevronDown size={11} className="text-muted-foreground" />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 top-9 w-44 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50 py-1">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-semibold text-foreground">Aqib Ali</p>
                    <p className="text-[10px] text-muted-foreground">Cost Estimation</p>
                  </div>
                  {[{ icon: User, label: "Profile" }, { icon: Settings, label: "Settings" }].map(({ icon: Icon, label }) => (
                    <button key={label} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors">
                      <Icon size={13} className="text-muted-foreground" />{label}
                    </button>
                  ))}
                  <div className="h-px bg-border my-1" />
                  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <LogOut size={13} />Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="mb-4">
            <h1 className="text-base font-bold text-foreground">Settings</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage your account, preferences, and security.</p>
          </div>

          <div className="flex gap-4 items-start">
            <aside className="flex-shrink-0 w-52 sticky top-4">
              <nav className="bg-card border border-border rounded-[14px] overflow-hidden">
                {SETTINGS_NAV.map(({ id, label, icon: Icon, desc }) => {
                  const isActive = active === id;
                  return (
                    <button key={id} onClick={() => setActive(id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors relative border-b border-border last:border-0 group ${isActive ? "" : "hover:bg-accent/40"}`}
                      style={isActive ? { backgroundColor: "rgba(245,130,31,0.06)" } : {}}>
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full" style={{ backgroundColor: "#F5821F" }} />}
                      <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ backgroundColor: isActive ? "rgba(245,130,31,0.12)" : "var(--muted)" }}>
                        <Icon size={13} style={isActive ? { color: "#F5821F" } : {}} className={!isActive ? "text-muted-foreground group-hover:text-foreground" : ""} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={isActive ? { color: "#F5821F" } : {}}>{label}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{desc}</p>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div className="flex-1 min-w-0 bg-card border border-border rounded-[14px] p-6">
              {CONTENT[active]}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
