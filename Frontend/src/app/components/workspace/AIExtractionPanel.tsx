import { useState } from "react";
import {
  Check, X, RotateCcw, ChevronDown, ChevronUp,
  Sparkles, AlertTriangle, CheckCircle2, Clock, Cpu, Loader2,
} from "lucide-react";
import type { ExtractedField, FieldSection, Confidence, ReviewStatus } from "@/app/types/workspace";
import { CONFIDENCE_CONFIG } from "@/app/types/workspace";

interface AIExtractionPanelProps {
  sections: FieldSection[];
  isDark: boolean;
  onFieldChange:  (fieldId: string, value: string) => void;
  onApprove:      (fieldId: string) => void;
  onReject:       (fieldId: string) => void;
  onRestore:      (fieldId: string) => void;
  onMarkComplete: () => void;
  reviewedCount:  number;
  totalCount:     number;
  processingStatus?: "NONE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  onProcess?: () => void;
}

function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const cfg = CONFIDENCE_CONFIG[confidence];
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function ReviewIcon({ status }: { status: ReviewStatus }) {
  if (status === "approved") return <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />;
  if (status === "rejected") return <X            size={13} className="text-red-500 flex-shrink-0" />;
  return <Clock size={13} className="text-muted-foreground flex-shrink-0" />;
}

function FieldRow({
  field, isDark, onChange, onApprove, onReject, onRestore,
}: {
  field: ExtractedField;
  isDark: boolean;
  onChange:  (v: string) => void;
  onApprove: () => void;
  onReject:  () => void;
  onRestore: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(field.value);
  const cfg = CONFIDENCE_CONFIG[field.confidence];

  const rowBg = field.confidence === "low" && field.reviewStatus === "pending"
    ? (isDark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)")
    : field.reviewStatus === "approved"
    ? (isDark ? "rgba(34,197,94,0.05)" : "rgba(34,197,94,0.04)")
    : field.reviewStatus === "rejected"
    ? (isDark ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.04)")
    : "transparent";

  return (
    <div
      className="border-b border-border last:border-0 px-3 py-2 group transition-colors"
      style={{ backgroundColor: rowBg }}
    >
      <div className="flex items-start gap-2">
        {/* Field label + review icon */}
        <div className="flex items-center gap-1.5 min-w-[120px] flex-shrink-0 pt-0.5">
          <ReviewIcon status={field.reviewStatus} />
          <span className="text-[11px] font-medium text-muted-foreground leading-tight">{field.label}</span>
        </div>

        {/* Value / edit input */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              className="w-full h-7 px-2 rounded-[6px] text-xs text-foreground bg-input-background border border-primary/50
                focus:outline-none focus:ring-1 focus:ring-primary/30"
              value={localVal}
              onChange={(e) => setLocalVal(e.target.value)}
              onBlur={() => { onChange(localVal); setEditing(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { onChange(localVal); setEditing(false); }
                if (e.key === "Escape") { setLocalVal(field.value); setEditing(false); }
              }}
            />
          ) : (
            <button
              className="text-xs font-semibold text-foreground text-left w-full truncate hover:text-primary transition-colors"
              onClick={() => { setLocalVal(field.value); setEditing(true); }}
              title="Click to edit"
            >
              {field.value}
              {field.unit && <span className="ml-1 text-muted-foreground font-normal">{field.unit}</span>}
            </button>
          )}
          {field.isEdited && (
            <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">
              Modified · Original: {field.originalValue}{field.unit ? ` ${field.unit}` : ""}
            </p>
          )}
        </div>

        {/* Confidence + actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <ConfidencePill confidence={field.confidence} />
          {field.reviewStatus === "pending" ? (
            <>
              <button onClick={onApprove} title="Approve"
                className="w-6 h-6 flex items-center justify-center rounded-[5px] opacity-0 group-hover:opacity-100 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all">
                <Check size={12} />
              </button>
              <button onClick={onReject} title="Reject"
                className="w-6 h-6 flex items-center justify-center rounded-[5px] opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                <X size={12} />
              </button>
            </>
          ) : (
            <button onClick={onRestore} title="Reset to pending"
              className="w-6 h-6 flex items-center justify-center rounded-[5px] opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-accent transition-all">
              <RotateCcw size={11} />
            </button>
          )}
          {field.isEdited && (
            <button onClick={onRestore} title="Restore AI value"
              className="w-6 h-6 flex items-center justify-center rounded-[5px] opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-accent transition-all"
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionBlock({
  section, isDark, onFieldChange, onApprove, onReject, onRestore,
}: {
  section: FieldSection;
  isDark: boolean;
  onFieldChange: (fid: string, v: string) => void;
  onApprove:     (fid: string) => void;
  onReject:      (fid: string) => void;
  onRestore:     (fid: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const approved = section.fields.filter((f) => f.reviewStatus === "approved").length;
  const low      = section.fields.filter((f) => f.confidence === "low").length;

  return (
    <div className="border border-border rounded-[10px] overflow-hidden mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-accent/30 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{section.title}</span>
          <span className="text-[10px] text-muted-foreground">
            {approved}/{section.fields.length} reviewed
          </span>
          {low > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-medium text-red-500">
              <AlertTriangle size={9} />{low} low confidence
            </span>
          )}
        </div>
        {open ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
      </button>
      {open && (
        <div>
          {section.fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              isDark={isDark}
              onChange={(v) => onFieldChange(field.id, v)}
              onApprove={() => onApprove(field.id)}
              onReject={()  => onReject(field.id)}
              onRestore={() => onRestore(field.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AIExtractionPanel({
  sections, isDark, onFieldChange, onApprove, onReject, onRestore, onMarkComplete,
  reviewedCount, totalCount, processingStatus = "NONE", onProcess,
}: AIExtractionPanelProps) {
  const progress = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;
  const lowCount = sections.flatMap((s) => s.fields).filter((f) => f.confidence === "low" && f.reviewStatus === "pending").length;

  // ── Empty states ─────────────────────────────────────────────────────────
  if (processingStatus === "NONE" && sections.length === 0) {
    return (
      <div className="flex flex-col border border-border rounded-[12px] overflow-hidden bg-card shadow-[0_1px_6px_rgba(0,0,0,0.07)] h-full items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,130,31,0.1)" }}>
          <Cpu size={24} style={{ color: "#F5821F" }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">No AI Extraction on File</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-48">
            AI processing normally starts automatically when the drawing is received.
            Use "Reprocess Drawing" if it didn't run.
          </p>
        </div>
        {onProcess && (
          <button
            onClick={onProcess}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
            style={{ backgroundColor: "#F5821F", color: "#fff" }}
            onMouseEnter={(e) => { (e.currentTarget.style.backgroundColor = "#D9710E"); }}
            onMouseLeave={(e) => { (e.currentTarget.style.backgroundColor = "#F5821F"); }}
          >
            <Cpu size={13} /> Reprocess Drawing
          </button>
        )}
      </div>
    );
  }

  if (processingStatus === "PROCESSING" || processingStatus === "QUEUED") {
    return (
      <div className="flex flex-col border border-border rounded-[12px] overflow-hidden bg-card shadow-[0_1px_6px_rgba(0,0,0,0.07)] h-full items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,130,31,0.1)" }}>
          <Loader2 size={24} style={{ color: "#F5821F" }} className="animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Analyzing Drawing…</p>
          <p className="text-xs text-muted-foreground mt-1">DataLift AI is extracting engineering data</p>
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "#F5821F", animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-border rounded-[12px] overflow-hidden bg-card shadow-[0_1px_6px_rgba(0,0,0,0.07)] h-full">
      {/* Panel header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: "#F5821F" }} />
          <span className="text-xs font-semibold text-foreground">AI Extracted Data</span>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(245,130,31,0.1)", color: "#F5821F" }}
          >
            20 fields
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lowCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-red-500">
              <AlertTriangle size={10} />{lowCount} need review
            </span>
          )}
        </div>
      </div>

      {/* Review progress */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-accent/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-foreground">
            {reviewedCount} of {totalCount} fields reviewed
          </span>
          <span className="text-[11px] font-bold" style={{ color: progress === 100 ? "#22C55E" : "#F5821F" }}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? "#22C55E" : "#F5821F",
            }}
          />
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={9} />
            {sections.flatMap((s) => s.fields).filter((f) => f.reviewStatus === "approved").length} approved
          </span>
          <span className="flex items-center gap-1 text-[10px] text-red-500">
            <X size={9} />
            {sections.flatMap((s) => s.fields).filter((f) => f.reviewStatus === "rejected").length} rejected
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock size={9} />
            {sections.flatMap((s) => s.fields).filter((f) => f.reviewStatus === "pending").length} pending
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card">
        <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground min-w-[120px]">Field</span>
        <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground flex-1">Extracted Value</span>
        <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Confidence</span>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto p-3">
        {sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            isDark={isDark}
            onFieldChange={onFieldChange}
            onApprove={onApprove}
            onReject={onReject}
            onRestore={onRestore}
          />
        ))}
      </div>

      {/* Mark complete */}
      <div className="flex-shrink-0 px-3 py-2.5 border-t border-border bg-card flex items-center gap-2">
        <button
          onClick={onMarkComplete}
          disabled={reviewedCount < totalCount}
          className="flex-1 h-8 rounded-[8px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#F5821F", color: "#fff" }}
          onMouseEnter={(e) => { if (reviewedCount >= totalCount) (e.currentTarget.style.backgroundColor = "#D9710E"); }}
          onMouseLeave={(e) => { (e.currentTarget.style.backgroundColor = "#F5821F"); }}
        >
          <CheckCircle2 size={13} />
          {reviewedCount >= totalCount ? "Mark Review Complete" : `${totalCount - reviewedCount} fields remaining`}
        </button>
      </div>
    </div>
  );
}
