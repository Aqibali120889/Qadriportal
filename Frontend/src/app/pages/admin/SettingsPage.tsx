import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  User, CreditCard, Palette, Bell, Shield, Camera, Save, X,
  Eye, EyeOff, Monitor, Sun, Moon, LogOut, Smartphone,
  CheckCircle2, AlertTriangle, Trash2, ChevronRight, Lock,
  ToggleLeft, ToggleRight, Globe, Building, Mail, Sparkles,
  HardDrive, Cpu, Plug, Clock, RefreshCw, FileText, Check,
} from "lucide-react";
import { adminApi, SettingCategory, IntegrationTestResult } from "@/app/services/admin";

// ── Helpers ───────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative rounded-full transition-all flex-shrink-0 ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ height: "22px", width: "42px", backgroundColor: checked ? "#F5821F" : "var(--muted)" }}
    >
      <span
        className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all duration-200"
        style={{ left: checked ? "calc(100% - 20px)" : "2px" }}
      />
    </button>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder = "", required = false, disabled = false, help = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; disabled?: boolean; help?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <div className="relative">
        <input
          type={isPassword && !show ? "password" : type}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full h-8 px-3 rounded-[8px] text-xs border border-border bg-input-background text-foreground
            placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all
            ${disabled ? "opacity-60 cursor-not-allowed bg-muted" : ""}`}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
      {help && <p className="text-[10px] text-muted-foreground/70 mt-1">{help}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, help = "" }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; help?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">{label}</label>
      <select
        value={value ?? ""} onChange={e => onChange(e.target.value)}
        className="w-full h-8 px-3 rounded-[8px] text-xs border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
      >{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
      {help && <p className="text-[10px] text-muted-foreground/70 mt-1">{help}</p>}
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

function SaveBar({ onSave, onCancel, dirty, saving }: { onSave: () => void; onCancel: () => void; dirty: boolean; saving?: boolean }) {
  return (
    <div className={`flex items-center gap-2 mt-6 pt-4 border-t border-border transition-opacity ${dirty ? "opacity-100" : "opacity-50"}`}>
      <button onClick={onSave} disabled={!dirty || saving}
        className="h-8 px-5 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
        style={{ backgroundColor: dirty && !saving ? "#F5821F" : "#F5821F80" }}>
        {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
        {saving ? "Saving…" : "Save Changes"}
      </button>
      <button onClick={onCancel} disabled={!dirty || saving}
        className="h-8 px-4 rounded-[8px] text-xs font-medium border border-border text-foreground hover:bg-accent flex items-center gap-1.5 transition-all disabled:opacity-50">
        <X size={12} />Reset Defaults
      </button>
      {dirty && <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle size={10} />Unsaved changes</span>}
    </div>
  );
}

// ── Generic Category Form ──────────────────────────────────────────────────
function CategoryFormSection({
  category,
  title,
  description,
  fields,
  initialData,
  onSaveCategory,
}: {
  category: SettingCategory;
  title: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type?: "text" | "select" | "toggle" | "password";
    options?: string[];
    help?: string;
  }>;
  initialData: Record<string, any>;
  onSaveCategory: (cat: SettingCategory, data: Record<string, any>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, any>>(initialData);
  const [saved, setSaved] = useState<Record<string, any>>(initialData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialData);
    setSaved(initialData);
  }, [initialData]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  function setVal(key: string, val: any) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveCategory(category, form);
      setSaved(form);
    } catch (err) {
      console.error(`Failed to save settings for ${category}:`, err);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm(saved);
  }

  return (
    <div>
      <SectionHeader title={title} description={description} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {fields.map(f => {
          if (f.type === "toggle") {
            const isChecked = String(form[f.key]).toLowerCase() === "true";
            return (
              <div key={f.key} className="flex items-center justify-between p-3 rounded-[10px] border border-border bg-card">
                <div>
                  <p className="text-xs font-semibold text-foreground">{f.label}</p>
                  {f.help && <p className="text-[10px] text-muted-foreground mt-0.5">{f.help}</p>}
                </div>
                <Toggle checked={isChecked} onChange={v => setVal(f.key, String(v))} />
              </div>
            );
          }
          if (f.type === "select") {
            return (
              <SelectField
                key={f.key}
                label={f.label}
                value={form[f.key] ?? ""}
                onChange={v => setVal(f.key, v)}
                options={f.options || []}
                help={f.help}
              />
            );
          }
          return (
            <InputField
              key={f.key}
              label={f.label}
              value={form[f.key] ?? ""}
              onChange={v => setVal(f.key, v)}
              type={f.type || "text"}
              help={f.help}
            />
          );
        })}
      </div>
      <SaveBar onSave={handleSave} onCancel={handleReset} dirty={dirty} saving={saving} />
    </div>
  );
}

// ── Integrations Section with Live Test Handlers ─────────────────────────────
function IntegrationsSection({
  initialData,
  onSaveCategory,
}: {
  initialData: Record<string, any>;
  onSaveCategory: (cat: SettingCategory, data: Record<string, any>) => Promise<void>;
}) {
  const [testResults, setTestResults] = useState<Record<string, IntegrationTestResult | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  async function runTest(type: "email" | "ai" | "storage" | "webhook") {
    setTesting(prev => ({ ...prev, [type]: true }));
    try {
      let res: IntegrationTestResult;
      if (type === "email") res = await adminApi.testEmail();
      else if (type === "ai") res = await adminApi.testAI();
      else if (type === "storage") res = await adminApi.testStorage();
      else res = await adminApi.testWebhook();
      setTestResults(prev => ({ ...prev, [type]: res }));
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [type]: { status: "FAILED", message: err.message || "Integration test failed" },
      }));
    } finally {
      setTesting(prev => ({ ...prev, [type]: false }));
    }
  }

  const INTEGRATIONS = [
    { key: "email",   title: "Outlook & SMTP Ingestion", desc: "Monitors inbox and auto-creates RFQ projects from emails.", icon: Mail },
    { key: "ai",      title: "Modal / DataLift AI Pipeline", desc: "Engine for automatic OCR drawing extraction and specs parsing.", icon: Sparkles },
    { key: "storage", title: "Supabase Cloud Storage", desc: "Encrypted bucket storage for technical drawings & cost sheets.", icon: HardDrive },
    { key: "webhook", title: "n8n Automation Webhooks", desc: "Dispatches workflow triggers between email parser and database.", icon: Plug },
  ];

  return (
    <div>
      <SectionHeader title="Enterprise Integrations" description="Manage external service connections, cloud APIs, and automation webhooks." />

      <div className="space-y-4">
        {INTEGRATIONS.map(item => {
          const Icon = item.icon;
          const res  = testResults[item.key];
          const isTesting = testing[item.key];
          return (
            <div key={item.key} className="p-4 rounded-[12px] border border-border bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => runTest(item.key as any)}
                  disabled={isTesting}
                  className="h-7 px-3 rounded-[7px] text-xs font-semibold border border-border text-foreground hover:bg-accent flex items-center gap-1.5 transition-all flex-shrink-0"
                >
                  {isTesting ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  {isTesting ? "Testing…" : "Test Connection"}
                </button>
              </div>

              {res && (
                <div className={`mt-3 p-3 rounded-[8px] text-xs font-medium border ${
                  res.status === "SUCCESS"
                    ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"
                    : "border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {res.status === "SUCCESS" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {res.status === "SUCCESS" ? "Connection Successful" : "Connection Failed"}
                    {res.latency_ms && <span className="ml-auto text-[10px] font-mono font-normal">{res.latency_ms} ms</span>}
                  </div>
                  <p className="text-[11px] leading-relaxed">{res.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Category Config Schema Map ────────────────────────────────────────────────
const CATEGORY_SCHEMAS: Record<SettingCategory, {
  title: string;
  description: string;
  fields: Array<{ key: string; label: string; type?: "text" | "select" | "toggle" | "password"; options?: string[]; help?: string }>;
}> = {
  general: {
    title: "General Enterprise Settings",
    description: "Core organization identity, localization, and portal defaults.",
    fields: [
      { key: "company_name",         label: "Company Name",           help: "Displayed on headers and generated PDF quotes." },
      { key: "company_logo_url",     label: "Company Logo URL" },
      { key: "timezone",             label: "Timezone",               type: "select", options: ["Asia/Karachi", "UTC", "America/New_York", "Europe/London"] },
      { key: "currency",             label: "Default Currency",       type: "select", options: ["PKR", "USD", "EUR", "GBP"] },
      { key: "date_format",          label: "Date Format",            type: "select", options: ["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"] },
      { key: "language",             label: "Language",               type: "select", options: ["English (US)", "English (UK)", "Urdu (PK)"] },
      { key: "default_department",   label: "Default Department",     type: "select", options: ["Cost Estimation", "Marketing", "Foundry", "QEN", "Fabrication"] },
      { key: "default_landing_page", label: "Default Landing Page",   type: "select", options: ["/dashboard", "/admin", "/foundry/workspace"] },
    ],
  },
  organization: {
    title: "Organization & RFQ Rules",
    description: "Job numbering schemes, prefix conventions, and project archiving rules.",
    fields: [
      { key: "rfq_prefix",            label: "RFQ Prefix",             help: "Example: RFQ-2026-" },
      { key: "rfq_number_format",     label: "RFQ Number Format" },
      { key: "project_number_format", label: "Project Number Format" },
      { key: "auto_project_creation", label: "Auto Create Project on Email Ingest", type: "toggle" },
      { key: "default_status",        label: "Default Project Status",  type: "select", options: ["DRAFT", "ACTIVE", "ON_HOLD"] },
      { key: "archive_rules_days",    label: "Auto Archive Closed Projects (Days)", help: "Enter number of days (e.g. 365)" },
    ],
  },
  departments: {
    title: "Department Workspace Settings",
    description: "Isolation preferences, workspace defaults, and default email assignments.",
    fields: [
      { key: "department_defaults",   label: "Enable Workspace Isolation", type: "toggle" },
      { key: "dashboard_defaults",    label: "Dashboard View Theme",       type: "select", options: ["Standard Enterprise View", "Compact Table View", "Kanban View"] },
      { key: "department_colors",     label: "Department Badge Color Mapping" },
      { key: "default_email_accounts",label: "Ingestion Mailbox Account" },
      { key: "workspace_permissions", label: "Permission Policy",          type: "select", options: ["Department Isolated", "Shared Cross-Department", "Restricted"] },
    ],
  },
  email: {
    title: "Email & Pipeline Configuration",
    description: "Configure Outlook/SMTP ingestion settings and attachment filters.",
    fields: [
      { key: "provider",                label: "Email Provider",            type: "select", options: ["Outlook", "SMTP/IMAP", "Custom Webhook"] },
      { key: "mailbox",                 label: "Ingestion Mailbox" },
      { key: "polling_interval_seconds",label: "Polling Interval (Sec)" },
      { key: "n8n_webhook_url",         label: "n8n Webhook URL" },
      { key: "auto_rfq_detection",      label: "Auto RFQ Email Detection",  type: "toggle" },
      { key: "max_attachment_size_mb",  label: "Max Attachment Size (MB)" },
      { key: "supported_formats",       label: "Supported Attachment Formats" },
    ],
  },
  ai: {
    title: "AI Drawing Processing Settings",
    description: "Modal/DataLift endpoints, confidence thresholds, and review automation.",
    fields: [
      { key: "modal_endpoint",                label: "Modal AI Extraction Endpoint" },
      { key: "datalift_endpoint",             label: "DataLift API Endpoint" },
      { key: "timeout_seconds",               label: "Extraction Timeout (Seconds)" },
      { key: "max_retries",                   label: "Max Processing Retries" },
      { key: "confidence_threshold",          label: "Confidence Threshold (0.0 - 1.0)" },
      { key: "auto_processing",               label: "Auto Process Uploaded Drawings", type: "toggle" },
      { key: "auto_human_review_assignment",  label: "Auto Assign Low-Confidence to Review", type: "toggle" },
      { key: "caching_enabled",               label: "Cache Identical Drawing Hashes", type: "toggle" },
      { key: "supported_models",              label: "Primary OCR Model Version" },
    ],
  },
  notifications: {
    title: "Notification Dispatch Settings",
    description: "Global notification toggles, real-time alerts, and daily summaries.",
    fields: [
      { key: "realtime_enabled",       label: "Real-time SSE Notifications", type: "toggle" },
      { key: "email_notifications",    label: "Email Notifications",         type: "toggle" },
      { key: "desktop_notifications",  label: "Browser Push Notifications",   type: "toggle" },
      { key: "ai_complete_alert",      label: "AI Extraction Completed Alert", type: "toggle" },
      { key: "review_required_alert",  label: "Human Review Required Alert",  type: "toggle" },
      { key: "rfq_created_alert",      label: "New RFQ Created Alert",        type: "toggle" },
      { key: "assignments_alert",      label: "Task Assignment Alert",        type: "toggle" },
      { key: "daily_digest_enabled",   label: "Send Daily Email Summary Digest", type: "toggle" },
    ],
  },
  security: {
    title: "Security & Access Control",
    description: "Session limits, password enforcement, API throttling, and dev mode options.",
    fields: [
      { key: "session_timeout_minutes",  label: "Session Inactivity Timeout (Mins)" },
      { key: "password_rules",           label: "Password Complexity Policy" },
      { key: "jwt_expiration_hours",     label: "JWT Expiration Token (Hours)" },
      { key: "api_rate_limit_per_min",   label: "API Rate Limit Per Min" },
      { key: "max_login_attempts",       label: "Max Failed Login Attempts" },
      { key: "mfa_toggle",               label: "Require Multi-Factor Authentication", type: "toggle" },
      { key: "dev_mode_bypass",          label: "Enable DEV Mode Auth Bypass", type: "toggle" },
      { key: "allowed_origins",          label: "CORS Allowed Origins" },
    ],
  },
  storage: {
    title: "Cloud File Storage",
    description: "Supabase storage buckets, size limits, and data retention policies.",
    fields: [
      { key: "provider",              label: "Storage Provider",            type: "select", options: ["Supabase Storage", "AWS S3", "Azure Blob"] },
      { key: "bucket_names",          label: "Storage Bucket Names" },
      { key: "file_limit_mb",         label: "Individual File Limit (MB)" },
      { key: "allowed_types",         label: "Allowed Extensions" },
      { key: "retention_policy_days", label: "File Retention Period (Days)" },
    ],
  },
  system: {
    title: "System Maintenance & Performance",
    description: "Maintenance toggles, diagnostic logging, and system health thresholds.",
    fields: [
      { key: "maintenance_mode",             label: "Enable Enterprise Maintenance Mode", type: "toggle" },
      { key: "debug_logging",                label: "Verbose Debug Logging",              type: "toggle" },
      { key: "system_version",               label: "Current System Version",             disabled: true },
      { key: "cpu_alert_threshold_percent",  label: "CPU Alert Threshold (%)" },
      { key: "memory_alert_threshold_percent",label: "Memory Alert Threshold (%)" },
    ],
  },
  integrations: {
    title: "Integrations",
    description: "",
    fields: [],
  },
  audit: {
    title: "Audit & Compliance Retention",
    description: "Log retention schedules, history cleanup, and compliance export rules.",
    fields: [
      { key: "log_retention_days",     label: "System Event Retention (Days)" },
      { key: "history_retention_days", label: "Audit Log Retention (Days)" },
      { key: "export_rules",           label: "Export Authorization",  type: "select", options: ["Super Admin Only", "Admin & Department Leads", "Public"] },
      { key: "automatic_cleanup",      label: "Auto-purge Expired Logs", type: "toggle" },
      { key: "archive_schedule",       label: "Purge Schedule Expression" },
    ],
  },
  appearance: {
    title: "Theme & UI Customization",
    description: "Portal brand colors, theme defaults, and layout density.",
    fields: [
      { key: "theme",                 label: "Default Color Theme",    type: "select", options: ["system", "light", "dark"] },
      { key: "compact_view",          label: "Enable Compact Table Spacing", type: "toggle" },
      { key: "auto_collapse_sidebar", label: "Auto-collapse Sidebar",        type: "toggle" },
      { key: "accent_color",          label: "Brand Accent Color" },
      { key: "table_density",         label: "Table Density",          type: "select", options: ["comfortable", "compact", "spacious"] },
      { key: "brand_primary",         label: "Brand Primary Color" },
    ],
  },
};

// ── Left Navigation ────────────────────────────────────────────────────────
const SETTINGS_NAV: { id: SettingCategory; label: string; icon: LucideIcon; desc: string }[] = [
  { id: "general",       label: "General",       icon: Building,     desc: "Identity & localization"          },
  { id: "organization",  label: "Organization",  icon: FileText,     desc: "RFQ & project numbering"         },
  { id: "departments",   label: "Departments",   icon: User,         desc: "Workspace isolation"              },
  { id: "email",         label: "Email",         icon: Mail,         desc: "Outlook & n8n ingestion"          },
  { id: "ai",            label: "AI Processing", icon: Sparkles,     desc: "Modal & OCR thresholds"           },
  { id: "notifications", label: "Notifications", icon: Bell,         desc: "Alerts & daily digests"           },
  { id: "security",      label: "Security",      icon: Shield,       desc: "Session, rate limits & MFA"       },
  { id: "storage",       label: "Storage",       icon: HardDrive,    desc: "Buckets & retention"              },
  { id: "system",        label: "System",        icon: Cpu,          desc: "Maintenance & logging"            },
  { id: "integrations",  label: "Integrations",  icon: Plug,         desc: "Service connections & tests"      },
  { id: "audit",         label: "Audit",         icon: Clock,        desc: "Retention & cleanup rules"        },
  { id: "appearance",    label: "Appearance",    icon: Palette,      desc: "Theme & layout density"           },
];

// ── Main Page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [active, setActive] = useState<SettingCategory>("general");
  const [allSettings, setAllSettings] = useState<Record<string, Record<string, any>>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAllSettings();
      setAllSettings(res);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleSaveCategory(category: SettingCategory, data: Record<string, any>) {
    const updated = await adminApi.updateSettingsCategory(category, data);
    setAllSettings(prev => ({ ...prev, [category]: updated }));
  }

  const currentSchema = CATEGORY_SCHEMAS[active];
  const categoryData  = allSettings[active] || {};

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4">
        {/* Page header */}
        <div className="mb-4">
          <h1 className="text-base font-bold text-foreground">Centralized Enterprise Settings</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Control organization rules, AI pipelines, security policies, and integrations.</p>
        </div>

        <div className="flex gap-4 items-start">
          {/* Left nav */}
          <aside className="flex-shrink-0 w-56 sticky top-4">
            <nav className="bg-card border border-border rounded-[14px] overflow-hidden">
              {SETTINGS_NAV.map(({ id, label, icon: Icon, desc }) => {
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActive(id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors relative border-b border-border last:border-0 group
                      ${isActive ? "" : "hover:bg-accent/40"}`}
                    style={isActive ? { backgroundColor: "rgba(245,130,31,0.06)" } : {}}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full" style={{ backgroundColor: "#F5821F" }} />}
                    <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{ backgroundColor: isActive ? "rgba(245,130,31,0.12)" : "var(--muted)" }}>
                      <Icon size={13} style={isActive ? { color: "#F5821F" } : {}} className={!isActive ? "text-muted-foreground group-hover:text-foreground" : ""} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? "" : "text-foreground"}`} style={isActive ? { color: "#F5821F" } : {}}>{label}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right content */}
          <div className="flex-1 min-w-0 bg-card border border-border rounded-[14px] p-6">
            {loading ? (
              <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-primary" />
                Loading settings from database…
              </div>
            ) : active === "integrations" ? (
              <IntegrationsSection initialData={categoryData} onSaveCategory={handleSaveCategory} />
            ) : (
              <CategoryFormSection
                key={active}
                category={active}
                title={currentSchema.title}
                description={currentSchema.description}
                fields={currentSchema.fields}
                initialData={categoryData}
                onSaveCategory={handleSaveCategory}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
