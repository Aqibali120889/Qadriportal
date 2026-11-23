import { useState } from "react";
import { X, Mail, Link2, Building2, Paperclip, Send, CheckCircle, Copy } from "lucide-react";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "email" | "link" | "department";

const DEPARTMENTS = [
  "Procurement Department",
  "Production Planning",
  "Quality Assurance",
  "Accounts / Finance",
  "General Manager Office",
];

const INPUT_CLS =
  "w-full h-8 px-3 rounded-[8px] text-xs text-foreground bg-input-background border border-border " +
  "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 " +
  "transition-all duration-150";

export default function ShareModal({ open, onClose }: ShareModalProps) {
  const [tab, setTab]               = useState<Tab>("email");
  const [recipient, setRecipient]   = useState("");
  const [subject, setSubject]       = useState("RFQ-2026-001 — Crusher Housing Assembly — Cost Estimation");
  const [message, setMessage]       = useState("Please find attached the cost estimation for the above-referenced project. Kindly review and revert with your approval or comments at the earliest.");
  const [attachDrawing, setAttachDrawing] = useState(true);
  const [attachExcel, setAttachExcel]     = useState(true);
  const [attachDocs, setAttachDocs]       = useState(false);
  const [selectedDept, setSelectedDept]   = useState<string[]>([]);
  const [copied, setCopied]         = useState(false);
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);

  if (!open) return null;

  const projectLink = "https://portal.qadrigroup.com/rfq/2026-001";

  function handleCopy() {
    navigator.clipboard.writeText(projectLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSend() {
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); setTimeout(() => { setSent(false); onClose(); }, 1500); }, 1800);
  }

  const TABS: { id: Tab; icon: typeof Mail; label: string }[] = [
    { id: "email",      icon: Mail,      label: "Email"      },
    { id: "link",       icon: Link2,     label: "Copy Link"  },
    { id: "department", icon: Building2, label: "Department" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-card rounded-[14px] border border-border shadow-[0_24px_64px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Share — RFQ-2026-001</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Crusher Housing Assembly · Lucky Cement</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0 bg-card">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all border-b-2
                ${tab === id
                  ? "border-b-[#F5821F] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30"}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* EMAIL TAB */}
          {tab === "email" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Recipient Email
                </label>
                <input type="email" className={INPUT_CLS} placeholder="engineer@company.com"
                  value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Subject</label>
                <input type="text" className={INPUT_CLS} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Message</label>
                <textarea
                  className="w-full px-3 py-2 rounded-[8px] text-xs text-foreground bg-input-background border border-border
                    placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50
                    transition-all resize-none"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              {/* Attachments */}
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Attachments
                </label>
                <div className="space-y-2">
                  {[
                    { label: "Engineering Drawing (DWG-2026-001-A.pdf)", state: attachDrawing, set: setAttachDrawing },
                    { label: "Cost Estimation Sheet (Excel)",             state: attachExcel,   set: setAttachExcel   },
                    { label: "Supporting Documents",                       state: attachDocs,    set: setAttachDocs    },
                  ].map(({ label, state, set }) => (
                    <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={state}
                        onClick={() => set((v) => !v)}
                        className="w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ backgroundColor: state ? "#F5821F" : "transparent", borderColor: state ? "#F5821F" : "rgba(0,0,0,0.2)" }}
                      >
                        {state && <svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
                      </button>
                      <div className="flex items-center gap-1.5">
                        <Paperclip size={11} className="text-muted-foreground" />
                        <span className="text-xs text-foreground">{label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LINK TAB */}
          {tab === "link" && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Share a direct link to this project workspace. Anyone with access to the portal can open it.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 h-9 px-3 rounded-[8px] bg-input-background border border-border flex items-center">
                  <span className="text-xs text-muted-foreground truncate">{projectLink}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="h-9 px-3 rounded-[8px] text-xs font-semibold border border-border flex items-center gap-1.5 transition-all hover:bg-accent"
                  style={copied ? { color: "#22C55E", borderColor: "#22C55E" } : {}}
                >
                  {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="p-3 rounded-[8px] border border-border bg-accent/30">
                <p className="text-[11px] font-medium text-foreground mb-1">Permissions</p>
                <p className="text-[10px] text-muted-foreground">Only users with portal access can view this project.</p>
              </div>
            </div>
          )}

          {/* DEPARTMENT TAB */}
          {tab === "department" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Send this estimation internally to a department. They will receive a portal notification and email.
              </p>
              <div className="space-y-2">
                {DEPARTMENTS.map((dept) => {
                  const selected = selectedDept.includes(dept);
                  return (
                    <label key={dept}
                      className={`flex items-center gap-3 p-2.5 rounded-[8px] border cursor-pointer transition-all
                        ${selected ? "border-[#F5821F]/40 bg-[rgba(245,130,31,0.05)]" : "border-border hover:bg-accent/30"}`}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        onClick={() => setSelectedDept((prev) =>
                          prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
                        )}
                        className="w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ backgroundColor: selected ? "#F5821F" : "transparent", borderColor: selected ? "#F5821F" : "rgba(0,0,0,0.2)" }}
                      >
                        {selected && <svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
                      </button>
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 size={13} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">{dept}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border flex-shrink-0 bg-card">
          <button onClick={onClose} className="h-8 px-4 rounded-[8px] text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || (tab === "email" && !recipient)}
            className="h-8 px-4 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#F5821F" }}
            onMouseEnter={(e) => { if (!sending) (e.currentTarget.style.backgroundColor = "#D9710E"); }}
            onMouseLeave={(e) => { (e.currentTarget.style.backgroundColor = "#F5821F"); }}
          >
            {sent ? (
              <><CheckCircle size={13} />Sent!</>
            ) : sending ? (
              <><svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" /><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>Sending…</>
            ) : (
              <><Send size={13} />{tab === "email" ? "Send Email" : tab === "link" ? "Copy Link" : `Share to ${selectedDept.length || 0} dept.`}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
