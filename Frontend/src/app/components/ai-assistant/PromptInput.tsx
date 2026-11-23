import { useRef, useState, useEffect } from "react";
import {
  Send, Paperclip, Image, FileSpreadsheet,
  X, Mic, Command, Loader2, FileText,
} from "lucide-react";
import type { ContextChip } from "@/app/types/ai-assistant";

interface PromptInputProps {
  onSend: (text: string, attachments: string[]) => void;
  /** Called when user sends text WITH a staged file attached. */
  onSendWithFile?: (text: string, file: File) => void;
  /** True while a message+file combo is being sent. */
  isSendingWithFile?: boolean;
  disabled: boolean;
  contextChips: ContextChip[];
  onRemoveChip: (id: string) => void;
}

const CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  rfq:     { bg: "rgba(245,130,31,0.1)",  color: "#F5821F" },
  drawing: { bg: "rgba(59,130,246,0.1)",  color: "#3B82F6" },
  excel:   { bg: "rgba(34,197,94,0.1)",   color: "#22C55E" },
  project: { bg: "rgba(139,92,246,0.1)",  color: "#8B5CF6" },
  general: { bg: "rgba(100,116,139,0.1)", color: "#64748B" },
};

/** Pick an icon based on file MIME type */
function FileChipIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <Image size={9} />;
  if (mime.includes("spreadsheet") || mime.includes("excel")) return <FileSpreadsheet size={9} />;
  return <FileText size={9} />;
}

export default function PromptInput({
  onSend, onSendWithFile, isSendingWithFile = false,
  disabled, contextChips, onRemoveChip,
}: PromptInputProps) {
  const [text, setText] = useState("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [text]);

  const isBusy = disabled || isSendingWithFile;

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;

    if (stagedFile && onSendWithFile) {
      // Send text + file together
      onSendWithFile(trimmed, stagedFile);
    } else {
      // Text-only chat
      onSend(trimmed, []);
    }

    setText("");
    setStagedFile(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStagedFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="flex-shrink-0 border-t border-border bg-card px-3 pt-2 pb-3">
      {/* Context chips */}
      {contextChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="text-[10px] text-muted-foreground font-medium self-center">Context:</span>
          {contextChips.map((chip) => {
            const cc = CHIP_COLORS[chip.type] ?? CHIP_COLORS.general;
            return (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: cc.bg, color: cc.color }}
              >
                {chip.label}
                <button
                  onClick={() => onRemoveChip(chip.id)}
                  className="w-3 h-3 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors ml-0.5"
                >
                  <X size={8} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Staged file chip — shows BEFORE sending */}
      {stagedFile && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border"
            style={{
              backgroundColor: "rgba(245,130,31,0.08)",
              borderColor: "rgba(245,130,31,0.25)",
              color: "#F5821F",
            }}
          >
            <FileChipIcon mime={stagedFile.type} />
            <span className="max-w-[200px] truncate">{stagedFile.name}</span>
            <span className="text-[9px] opacity-60">
              ({(stagedFile.size / 1024).toFixed(0)} KB)
            </span>
            <button
              onClick={() => setStagedFile(null)}
              className="ml-0.5 hover:opacity-60 transition-opacity"
              title="Remove attachment"
            >
              <X size={8} />
            </button>
          </span>
          <span className="text-[10px] text-muted-foreground self-center italic">
            will be sent with your message
          </span>
        </div>
      )}

      {/* Hidden file input — PDF, DOCX, TXT and all images */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.svg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Input box */}
      <div className="flex gap-2 items-end">
        {/* Attachment buttons */}
        <div className="flex gap-0.5 flex-shrink-0 pb-0.5">
          <button
            title="Attach Drawing"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-blue-500 transition-all disabled:opacity-40"
          >
            <Image size={15} />
          </button>
          <button
            title="Attach Excel / Spreadsheet"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-emerald-500 transition-all disabled:opacity-40"
          >
            <FileSpreadsheet size={15} />
          </button>

          {/* Paperclip — general file picker */}
          <button
            title={
              isSendingWithFile
                ? "Sending…"
                : stagedFile
                  ? `Replace "${stagedFile.name}"`
                  : "Attach file or image (PDF, DOCX, PNG, JPG…) — sent with your message"
            }
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className={`w-8 h-8 flex items-center justify-center rounded-[8px] transition-all disabled:opacity-40
              ${stagedFile
                ? "text-amber-500 bg-amber-50 dark:bg-amber-950/30"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
          >
            {isSendingWithFile
              ? <Loader2 size={15} className="animate-spin" />
              : <Paperclip size={15} />
            }
          </button>
        </div>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBusy}
            placeholder={
              stagedFile
                ? `Ask something about "${stagedFile.name}"…`
                : "Ask anything about your project, drawings, costs, or materials…"
            }
            rows={1}
            className="w-full px-3.5 py-2.5 pr-10 rounded-[10px] text-sm text-foreground bg-input-background border border-border
              placeholder:text-muted-foreground/60 resize-none
              focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50
              disabled:opacity-50 transition-all"
          />
          <div className="absolute right-2.5 bottom-2 flex items-center gap-1">
            {!text && (
              <button className="w-5 h-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <Mic size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || isBusy}
          className="w-9 h-9 flex items-center justify-center rounded-[10px] text-white transition-all flex-shrink-0
            disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#F5821F" }}
          onMouseEnter={(e) => { if (text.trim() && !isBusy) (e.currentTarget.style.backgroundColor = "#D9710E"); }}
          onMouseLeave={(e) => { (e.currentTarget.style.backgroundColor = "#F5821F"); }}
          title={stagedFile ? "Send message + file (Enter)" : "Send (Enter)"}
        >
          <Send size={15} />
        </button>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
          <Command size={9} />Enter to send · Shift+Enter for new line
          {stagedFile && (
            <span className="ml-1 text-amber-500/70">· File attached</span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          Powered by Qadri AI · RAG-enabled
        </span>
      </div>
    </div>
  );
}
