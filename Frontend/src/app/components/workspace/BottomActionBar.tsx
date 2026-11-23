import { Save, FileSpreadsheet, Download, Share2, ArrowUpRight, CheckCircle } from "lucide-react";

interface BottomActionBarProps {
  onSaveDraft:    () => void;
  onSaveToExcel:  () => void;
  onDownload:     () => void;
  onShare:        () => void;
  onSubmit:       () => void;
  savedDraft:     boolean;
  isComplete:     boolean;
}

export default function BottomActionBar({
  onSaveDraft, onSaveToExcel, onDownload, onShare, onSubmit, savedDraft, isComplete,
}: BottomActionBarProps) {
  return (
    <div className="flex-shrink-0 border-t border-border bg-card px-4 py-2.5 flex items-center gap-2 justify-between">
      {/* Left: status indicator */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isComplete ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle size={13} />Review complete
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Review in progress…</span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onSaveDraft}
          className="h-8 px-3 rounded-[8px] text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5"
        >
          <Save size={12} />
          {savedDraft ? "Saved" : "Save Draft"}
        </button>

        <button
          onClick={onSaveToExcel}
          className="h-8 px-3 rounded-[8px] text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5"
        >
          <FileSpreadsheet size={12} className="text-emerald-600 dark:text-emerald-400" />
          Save to Excel
        </button>

        <button
          onClick={onDownload}
          className="h-8 px-3 rounded-[8px] text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5"
        >
          <Download size={12} />
          Download Excel
        </button>

        <div className="w-px h-5 bg-border mx-0.5" />

        <button
          onClick={onShare}
          className="h-8 px-3 rounded-[8px] text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5"
        >
          <Share2 size={12} />
          Share
        </button>

        <button
          onClick={onSubmit}
          className="h-8 px-4 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
          style={{ backgroundColor: "#F5821F" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D9710E")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5821F")}
        >
          <ArrowUpRight size={13} />
          Submit to Next Department
        </button>
      </div>
    </div>
  );
}
