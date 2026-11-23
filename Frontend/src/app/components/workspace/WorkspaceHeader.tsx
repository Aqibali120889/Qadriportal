import { Calendar, User, Tag, ArrowUpRight, Download, Share2, Save } from "lucide-react";

interface WorkspaceHeaderProps {
  onSaveDraft: () => void;
  onDownloadExcel: () => void;
  onShare: () => void;
  onSubmit: () => void;
  saved: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  "In Progress": { color: "#3B82F6", bg: "rgba(59,130,246,0.1)"  },
  "Review":      { color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
  "Completed":   { color: "#22C55E", bg: "rgba(34,197,94,0.1)"   },
  "Pending":     { color: "#64748B", bg: "rgba(100,116,139,0.1)" },
};

export default function WorkspaceHeader({ onSaveDraft, onDownloadExcel, onShare, onSubmit, saved }: WorkspaceHeaderProps) {
  const status = "In Progress";
  const sc = STATUS_CONFIG[status];

  return (
    <div className="flex-shrink-0 border-b border-border bg-card px-4 py-2.5 flex items-center gap-0 flex-wrap">
      {/* Project meta chips */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 flex-1 min-w-0">
        {/* RFQ */}
        <div className="flex items-center gap-1.5">
          <Tag size={12} className="text-muted-foreground flex-shrink-0" />
          <span className="text-[11px] font-mono font-semibold text-muted-foreground">RFQ-2026-001</span>
        </div>

        <div className="w-px h-3.5 bg-border" />

        {/* Customer */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex-shrink-0">Customer</span>
          <span className="text-xs font-semibold text-foreground truncate">Lucky Cement</span>
        </div>

        <div className="w-px h-3.5 bg-border" />

        {/* Project */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex-shrink-0">Project</span>
          <span className="text-xs font-semibold text-foreground truncate">Crusher Housing Assembly</span>
        </div>

        <div className="w-px h-3.5 bg-border" />

        {/* Status */}
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: sc.color, backgroundColor: sc.bg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
          {status}
        </span>

        <div className="w-px h-3.5 bg-border" />

        {/* Engineer */}
        <div className="flex items-center gap-1.5">
          <User size={11} className="text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-foreground font-medium">Aqib Ali</span>
        </div>

        <div className="w-px h-3.5 bg-border" />

        {/* Due date */}
        <div className="flex items-center gap-1.5">
          <Calendar size={11} className="text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-foreground font-medium">15 Jul 2026</span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">(Tomorrow)</span>
        </div>

        {/* Auto-save indicator */}
        {saved && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Saved
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <button
          onClick={onSaveDraft}
          className="h-7 px-3 rounded-[7px] text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5"
        >
          <Save size={12} />
          Save Draft
        </button>
        <button
          onClick={onDownloadExcel}
          className="h-7 px-3 rounded-[7px] text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5"
        >
          <Download size={12} />
          Excel
        </button>
        <button
          onClick={onShare}
          className="h-7 px-3 rounded-[7px] text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5"
        >
          <Share2 size={12} />
          Share
        </button>
        <button
          onClick={onSubmit}
          className="h-7 px-3 rounded-[7px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
          style={{ backgroundColor: "#F5821F" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D9710E")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5821F")}
        >
          <ArrowUpRight size={12} />
          Submit
        </button>
      </div>
    </div>
  );
}
