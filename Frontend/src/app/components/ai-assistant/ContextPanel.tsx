import { useState } from "react";
import {
  FileText, FileSpreadsheet, BookOpen, Database,
  History, ChevronDown, ChevronUp, ExternalLink,
  Plus, RefreshCw, Layers,
} from "lucide-react";
import type { ContextChip } from "@/app/types/ai-assistant";
import { SUGGESTED_ACTIONS, KNOWLEDGE_CATEGORIES } from "@/app/types/ai-assistant";

interface ContextPanelProps {
  contextChips: ContextChip[];
  onAddChip: (chip: ContextChip) => void;
  onRemoveChip: (id: string) => void;
  onSuggestedAction: (label: string) => void;
}

const DOC_TYPE_ICON: Record<string, React.ElementType> = {
  drawing: FileText,
  excel:   FileSpreadsheet,
  pdf:     FileText,
  sop:     BookOpen,
  project: History,
  standard: BookOpen,
  catalog: Database,
};

const DOC_TYPE_COLOR: Record<string, string> = {
  drawing: "#3B82F6", excel: "#22C55E", pdf: "#EF4444",
  sop: "#8B5CF6", project: "#F59E0B", standard: "#64748B", catalog: "#10B981",
};

const CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  rfq:     { bg: "rgba(245,130,31,0.1)",  color: "#F5821F" },
  drawing: { bg: "rgba(59,130,246,0.1)",  color: "#3B82F6" },
  excel:   { bg: "rgba(34,197,94,0.1)",   color: "#22C55E" },
  project: { bg: "rgba(139,92,246,0.1)",  color: "#8B5CF6" },
  general: { bg: "rgba(100,116,139,0.1)", color: "#64748B" },
};

const REFERENCED_DOCS = [
  { id: "d1", name: "DWG-2026-001-A.pdf",       type: "drawing", updated: "Today"      },
  { id: "d2", name: "RFQ-2026-001.xlsx",         type: "excel",   updated: "Today"      },
  { id: "d3", name: "Crusher_Housing_Spec.pdf",  type: "pdf",     updated: "Yesterday"  },
  { id: "d4", name: "ASTM A48 Standard",         type: "standard",updated: "1 week ago" },
  { id: "d5", name: "RFQ-2025-087 Lucky Cement", type: "project", updated: "8 months ago"},
];

function SectionHeader({
  label, open, onToggle, count,
}: { label: string; open: boolean; onToggle: () => void; count?: number }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="flex items-center gap-1.5">
        {label}
        {count !== undefined && (
          <span className="px-1.5 py-px rounded-full bg-muted text-muted-foreground font-semibold text-[9px]">{count}</span>
        )}
      </span>
      {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
    </button>
  );
}

export default function ContextPanel({ contextChips, onAddChip, onRemoveChip, onSuggestedAction }: ContextPanelProps) {
  const [secProject,    setSecProject]    = useState(true);
  const [secDocs,       setSecDocs]       = useState(true);
  const [secKnowledge,  setSecKnowledge]  = useState(true);
  const [secActions,    setSecActions]    = useState(true);
  const [activeCat,     setActiveCat]     = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Layers size={13} className="text-muted-foreground" />
          Context & Knowledge
        </span>
        <button title="Refresh context" className="w-6 h-6 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <RefreshCw size={11} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">

        {/* ── Current Project ── */}
        <SectionHeader label="Current Project" open={secProject} onToggle={() => setSecProject((v) => !v)} />
        {secProject && (
          <div className="mb-3 p-2.5 rounded-[8px] border border-border bg-accent/20 space-y-1.5">
            {[
              { k: "RFQ ID",     v: "RFQ-2026-001",            color: "#F5821F" },
              { k: "Customer",   v: "Lucky Cement",             color: null },
              { k: "Department", v: "Cost Estimation",          color: null },
              { k: "Stage",      v: "Drawing Review",           color: "#3B82F6" },
            ].map(({ k, v, color }) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{k}</span>
                <span className="text-[11px] font-semibold" style={{ color: color ?? "var(--foreground)" }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-border mb-1" />

        {/* ── Active Context ── */}
        <div className="py-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Active Context</p>
          <div className="flex flex-wrap gap-1.5">
            {contextChips.map((chip) => {
              const cc = CHIP_COLORS[chip.type] ?? CHIP_COLORS.general;
              return (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: cc.bg, color: cc.color }}
                  onClick={() => onRemoveChip(chip.id)}
                  title="Click to remove"
                >
                  {chip.label}
                  <span className="text-[8px] opacity-60">×</span>
                </span>
              );
            })}
            <button
              onClick={() => onAddChip({ id: `ctx${Date.now()}`, label: "New Context", type: "general" })}
              className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground transition-all"
            >
              <Plus size={9} /> Add
            </button>
          </div>
        </div>

        <div className="h-px bg-border mb-1" />

        {/* ── Referenced Documents ── */}
        <SectionHeader label="Referenced Documents" open={secDocs} onToggle={() => setSecDocs((v) => !v)} count={REFERENCED_DOCS.length} />
        {secDocs && (
          <div className="space-y-1.5 mb-3">
            {REFERENCED_DOCS.map((doc) => {
              const Icon  = DOC_TYPE_ICON[doc.type]  ?? FileText;
              const color = DOC_TYPE_COLOR[doc.type] ?? "#64748B";
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 rounded-[7px] border border-border hover:bg-accent/40 cursor-pointer transition-colors group"
                >
                  <Icon size={12} style={{ color }} className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-foreground truncate">{doc.name}</p>
                    <p className="text-[9px] text-muted-foreground">{doc.updated}</p>
                  </div>
                  <ExternalLink size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        <div className="h-px bg-border mb-1" />

        {/* ── Knowledge Sources ── */}
        <SectionHeader label="Knowledge Sources" open={secKnowledge} onToggle={() => setSecKnowledge((v) => !v)} />
        {secKnowledge && (
          <div className="space-y-1 mb-3">
            {KNOWLEDGE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[7px] transition-all text-left
                  ${activeCat === cat.id
                    ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                    : "hover:bg-accent/40 text-foreground"
                  }`}
              >
                <span className="text-[11px] font-medium truncate">{cat.label}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{cat.count}</span>
                  <span className="text-[9px] text-muted-foreground/60">{cat.updated}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="h-px bg-border mb-1" />

        {/* ── Suggested Actions ── */}
        <SectionHeader label="Suggested Actions" open={secActions} onToggle={() => setSecActions((v) => !v)} />
        {secActions && (
          <div className="grid grid-cols-1 gap-1.5 mb-2">
            {SUGGESTED_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => onSuggestedAction(action.label)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-xs font-medium text-foreground
                  border border-border hover:bg-accent hover:border-border/60 transition-all text-left"
              >
                <span className="text-sm leading-none flex-shrink-0">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
